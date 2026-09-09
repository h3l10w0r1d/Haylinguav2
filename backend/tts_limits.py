# backend/tts_limits.py
"""Cost controls for the public /tts endpoint.

/tts synthesises arbitrary text through a paid per-character API, and it is
deliberately unauthenticated — the landing page, the pronunciation page and
the public typing tool all need audio for logged-out visitors. That
combination is exactly the shape of an expensive abuse vector, so the
endpoint needs its own limits rather than relying on the global 300/min
per-IP rule, which is generous enough to be ruinous here.

Three separate controls, because each stops a different attack:

  1. LENGTH CAP — one request can't ask for an essay. Anonymous callers get
     a short cap; signed-in ones get a longer one.
  2. EXPENSIVE-PATH GATE — provider/voice/model overrides route to
     ElevenLabs, which costs far more per character than the Azure default.
     Anonymous callers can't reach it at all; they always get the default
     provider. (Pinning "azure" explicitly stays open — Adventures does that
     precisely to avoid the expensive path.)
  3. DAILY CHARACTER QUOTA — the real backstop. Rate limits cap requests per
     minute; this caps total spend per day per person, and survives restarts
     because it's in Postgres rather than memory.

The quota is keyed by user id when signed in and by IP otherwise, so
creating an account raises your ceiling rather than resetting it.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import text

from database import engine


def _quota_day():
    """The quota day, pinned to UTC.

    Deliberately not date.today(): that follows the server process's local
    timezone, which differs between a dev machine and the deploy container —
    and a quota whose day boundary moves with the host is a quota that can be
    reset by a config change. UTC also gives users one predictable reset
    time to be told about."""
    return datetime.now(timezone.utc).date()

# One request. Comfortably above any lesson line or exercise prompt, low
# enough that a scripted caller can't synthesise a book in one shot.
MAX_CHARS_ANON = int(os.getenv("TTS_MAX_CHARS_ANON", "300"))
MAX_CHARS_USER = int(os.getenv("TTS_MAX_CHARS_USER", "1500"))

# Per day, per subject. An anonymous visitor can comfortably work through a
# lesson or read a paragraph aloud a few times; sustained scraping hits the
# wall and is invited to sign in.
DAILY_CHARS_ANON = int(os.getenv("TTS_DAILY_CHARS_ANON", "5000"))
DAILY_CHARS_USER = int(os.getenv("TTS_DAILY_CHARS_USER", "40000"))


def limits_for(user_id: Optional[int]) -> tuple[int, int]:
    """(max chars per request, max chars per day)."""
    if user_id is not None:
        return MAX_CHARS_USER, DAILY_CHARS_USER
    return MAX_CHARS_ANON, DAILY_CHARS_ANON


def subject_key(user_id: Optional[int], client_ip: Optional[str]) -> str:
    if user_id is not None:
        return f"u:{user_id}"
    return f"ip:{client_ip or 'unknown'}"


def usage_today(subject: str) -> int:
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT chars FROM tts_usage WHERE day = :d AND subject = :s"),
                {"d": _quota_day(), "s": subject},
            ).first()
            return int(row[0]) if row else 0
    except Exception:
        # If the counter is unavailable we must not hard-fail audio for every
        # visitor — the length cap and rate limiter still apply.
        return 0


def record_usage(subject: str, chars: int) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO tts_usage (day, subject, chars)
                    VALUES (:d, :s, :c)
                    ON CONFLICT (day, subject) DO UPDATE
                        SET chars = tts_usage.chars + EXCLUDED.chars
                """),
                {"d": _quota_day(), "s": subject, "c": chars},
            )
    except Exception:
        pass


def enforce(text_value: str, user_id: Optional[int], client_ip: Optional[str],
            wants_premium_voice: bool) -> str:
    """Raises HTTPException if this request shouldn't proceed; returns the
    quota subject key so the caller can record usage afterwards.

    Every 4xx here carries a machine-readable `reason` so the UI can tell
    "sign in to continue" apart from "you've hit today's ceiling" instead of
    showing one generic error for both."""
    per_request, per_day = limits_for(user_id)

    if wants_premium_voice and user_id is None:
        raise HTTPException(
            status_code=401,
            detail={"reason": "auth_required_for_voice",
                    "message": "Sign in to use the premium voice."},
        )

    if len(text_value) > per_request:
        raise HTTPException(
            status_code=413,
            detail={"reason": "text_too_long", "limit": per_request, "given": len(text_value),
                    "signed_in": user_id is not None,
                    "message": (f"Text is limited to {per_request} characters"
                                + ("." if user_id is not None else " — sign in for more."))},
        )

    subject = subject_key(user_id, client_ip)
    used = usage_today(subject)
    if used + len(text_value) > per_day:
        raise HTTPException(
            status_code=429,
            detail={"reason": "daily_quota", "limit": per_day, "used": used,
                    "signed_in": user_id is not None,
                    "message": ("You've reached today's audio limit."
                                if user_id is not None
                                else "You've reached today's free audio limit — sign in to keep going.")},
        )
    return subject
