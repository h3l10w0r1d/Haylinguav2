# backend/routes_status.py — public status page: live health + 30-day uptime history.
#
# Architecture:
#   POST /cron/status-check  (secret-protected) — runs real checks against each
#     dependency (DB, ElevenLabs, Brevo, Google/Telegram) and appends one row
#     per service to service_health_log. Meant to run every few minutes via a
#     scheduler (see cron_status_check.py), same pattern as cron_leagues.py.
#   GET  /status              (public, no auth) — reads the latest logged
#     snapshot per service plus a 30-day daily rollup for the uptime bars.
#     Never makes outbound calls itself, so it's safe under public traffic.
from __future__ import annotations

import hmac
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db

router = APIRouter(tags=["status"])

# Ordered for display. "api" is checked implicitly (see below) since this
# code only runs if the API process is alive and serving requests.
SERVICES = [
    {"key": "api", "name": "API"},
    {"key": "database", "name": "Database"},
    {"key": "tts", "name": "Text-to-speech"},
    {"key": "email", "name": "Email delivery"},
    {"key": "sign_in", "name": "Sign-in providers"},
]
SERVICE_NAMES = {s["key"]: s["name"] for s in SERVICES}

# Rank for combining multiple sub-checks (e.g. Google + Telegram) or days
# into a single worst-of status.
_RANK = {"operational": 0, "degraded": 1, "down": 2}


def _worst(a: str, b: str) -> str:
    return a if _RANK.get(a, 0) >= _RANK.get(b, 0) else b


def _check_url(url: str, *, method: str = "HEAD", timeout: float = 5.0) -> tuple[str, Optional[int], Optional[str]]:
    """Generic reachability probe. Any HTTP response (even 4xx) means the
    service is up and routing traffic; only network failures / 5xx / slow
    responses count against it."""
    start = time.monotonic()
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.request(method, url)
        latency_ms = int((time.monotonic() - start) * 1000)
        if resp.status_code >= 500:
            return "down", latency_ms, f"HTTP {resp.status_code}"
        if latency_ms > 2500:
            return "degraded", latency_ms, "slow response"
        return "operational", latency_ms, None
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        return "down", latency_ms, str(exc)[:200]


def _check_database(db: Connection) -> tuple[str, Optional[int], Optional[str]]:
    start = time.monotonic()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = int((time.monotonic() - start) * 1000)
        if latency_ms > 800:
            return "degraded", latency_ms, "slow query"
        return "operational", latency_ms, None
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        return "down", latency_ms, str(exc)[:200]


def _check_tts() -> tuple[str, Optional[int], Optional[str]]:
    # Unauthenticated HEAD to the API host — confirms ElevenLabs is routing
    # traffic without spending API quota on a real synthesis call.
    return _check_url("https://api.elevenlabs.io/", method="HEAD", timeout=5.0)


def _check_email() -> tuple[str, Optional[int], Optional[str]]:
    return _check_url("https://api.brevo.com/", method="GET", timeout=5.0)


def _check_sign_in() -> tuple[str, Optional[int], Optional[str]]:
    google = _check_url("https://oauth2.googleapis.com/token", method="HEAD", timeout=5.0)
    telegram = _check_url("https://api.telegram.org/", method="HEAD", timeout=5.0)
    status = _worst(google[0], telegram[0])
    latency_ms = max(l for l in (google[1], telegram[1]) if l is not None) if (google[1] or telegram[1]) else None
    messages = [m for m in (google[2], telegram[2]) if m]
    return status, latency_ms, ("; ".join(messages) if messages else None)


def _run_all_checks(db: Connection) -> list[dict]:
    results = [{"service_key": "api", "status": "operational", "latency_ms": 0, "message": None}]
    for key, fn in (
        ("database", lambda: _check_database(db)),
        ("tts", _check_tts),
        ("email", _check_email),
        ("sign_in", _check_sign_in),
    ):
        status, latency_ms, message = fn()
        results.append({"service_key": key, "status": status, "latency_ms": latency_ms, "message": message})
    return results


@router.post("/cron/status-check")
def cron_status_check(
    x_cron_secret: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Run live health checks and log one snapshot per service. Authenticated
    with the shared CRON_SECRET; schedule every 3-5 minutes."""
    secret = (os.getenv("CRON_SECRET") or "").strip()
    if not secret or not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), secret):
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    results = _run_all_checks(db)
    for r in results:
        db.execute(
            text(
                """
                INSERT INTO service_health_log (service_key, status, latency_ms, message, checked_at)
                VALUES (:service_key, :status, :latency_ms, :message, NOW())
                """
            ),
            r,
        )
    return {"ok": True, "checked": len(results), "results": results}


@router.get("/status")
def get_status(db: Connection = Depends(get_db)):
    """Public status snapshot: latest state + 30-day uptime per service."""
    latest_rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (service_key)
                   service_key, status, latency_ms, message, checked_at
            FROM service_health_log
            ORDER BY service_key, checked_at DESC
            """
        )
    ).mappings().all()
    latest_by_key = {r["service_key"]: r for r in latest_rows}

    since = datetime.now(timezone.utc) - timedelta(days=30)
    history_rows = db.execute(
        text(
            """
            SELECT service_key,
                   DATE(checked_at) AS day,
                   status,
                   COUNT(*)::int AS n
            FROM service_health_log
            WHERE checked_at >= :since
            GROUP BY service_key, DATE(checked_at), status
            ORDER BY service_key, day
            """
        ),
        {"since": since},
    ).mappings().all()

    # Per service: day -> worst status that day, and overall operational ratio.
    by_service_days: dict[str, dict[str, str]] = {}
    op_count: dict[str, int] = {}
    total_count: dict[str, int] = {}
    for r in history_rows:
        key = r["service_key"]
        day = r["day"].isoformat()
        days = by_service_days.setdefault(key, {})
        days[day] = _worst(days.get(day, "operational"), r["status"])
        total_count[key] = total_count.get(key, 0) + int(r["n"])
        if r["status"] == "operational":
            op_count[key] = op_count.get(key, 0) + int(r["n"])

    today = datetime.now(timezone.utc).date()
    services_out = []
    overall = "operational"
    any_data = False
    for svc in SERVICES:
        key = svc["key"]
        row = latest_by_key.get(key)
        current_status = row["status"] if row else "unknown"
        if row:
            any_data = True
            overall = _worst(overall, current_status)

        days_map = by_service_days.get(key, {})
        day_bars = []
        for i in range(29, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            day_bars.append({"date": d, "status": days_map.get(d, "no_data")})

        tot = total_count.get(key, 0)
        uptime_pct = round((op_count.get(key, 0) / tot) * 100, 2) if tot > 0 else None

        services_out.append({
            "key": key,
            "name": svc["name"],
            "status": current_status,
            "latency_ms": row["latency_ms"] if row else None,
            "message": row["message"] if row else None,
            "checked_at": row["checked_at"].isoformat() if row else None,
            "uptime_pct_30d": uptime_pct,
            "days": day_bars,
        })

    return {
        "overall": overall if any_data else "unknown",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "services": services_out,
    }
