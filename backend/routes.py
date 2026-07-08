# backend/routes.py
import os
import json
from datetime import datetime, timedelta
import uuid
from typing import List, Dict, Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Body, Header, Query, UploadFile, File
import asyncio
from fastapi.responses import Response, JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine import Connection
import hashlib, hmac, traceback, datetime as dt
from database import engine

from database import get_db
from auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    validate_email_simple,
    validate_password_simple,
)
# JWT decode (for Bearer auth on /complete)
from jose import jwt, JWTError

# Authoritative, server-side answer grading (never trust client is_correct)
from grading import grade_attempt

# Brevo (Sendinblue) integration (contacts + events)
try:
    from integrations.brevo import upsert_contact as _brevo_upsert_contact
    from integrations.brevo import track_event as _brevo_track_event
    from integrations.brevo import _iso
except Exception:
    _brevo_upsert_contact = None
    _brevo_track_event = None
    def _iso(dt): return dt.isoformat() if dt else None  # fallback


def _expose_dev_codes() -> bool:
    """Whether to return email verification / change codes in API responses.

    🔒 SECURITY: this must be an explicit opt-in. Previously codes were returned
    whenever SMTP send "failed" (e.g. an SMTP env var missing in prod), which
    handed account-verification and email-change codes straight to the caller —
    enabling self-verification of arbitrary signups and email-change takeover.
    """
    return (os.getenv("EXPOSE_DEV_CODES") or "").strip().lower() in {"1", "true", "yes", "on"}



import math


#CMS
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import text
from database import get_db
import json

router = APIRouter()

# --- Login security (rate limiting + CAPTCHA escalation) ---
# Policy:
# - After 5 failed attempts in 5 minutes (per account + IP), require CAPTCHA for 15 minutes.
# - During CAPTCHA window, allow 10 further attempts; then lock for 2 hours.
# Notes:
# - This is in-memory for simplicity (single Render instance). For multi-instance scaling, back it with Redis integration.

import time
import threading

_LOGIN_GUARD_LOCK = threading.Lock()
_LOGIN_FAILS = {}  # key -> list[timestamps]
_LOGIN_CAPTCHA = {}  # key -> {until, remaining}
_LOGIN_LOCKOUT = {}  # key -> until_ts

LOGIN_FAIL_WINDOW_SECONDS = 5 * 60
LOGIN_FAIL_THRESHOLD = 5
CAPTCHA_WINDOW_SECONDS = 15 * 60
CAPTCHA_ATTEMPTS = 10
LOCKOUT_SECONDS = 2 * 60 * 60


def _client_ip(request: Request) -> str:
    # Cloudflare sets CF-Connecting-IP. Fallback to X-Forwarded-For.
    ip = (request.headers.get('cf-connecting-ip') or '').strip()
    if not ip:
        xff = (request.headers.get('x-forwarded-for') or '').strip()
        if xff:
            ip = xff.split(',')[0].strip()
    if not ip:
        ip = (getattr(request.client, 'host', None) or '').strip()
    return ip or 'unknown'


def _key_for(identifier: str, ip: str) -> tuple[str, str]:
    # Track both per-identifier and per-ip.
    ident = (identifier or '').strip().lower()
    return (f'acct:{ident}', f'ip:{ip}')

# Tech debt, this function has some limittations, handle for the future. 
def _cleanup_old(ts_list, now):
    cutoff = now - LOGIN_FAIL_WINDOW_SECONDS
    i = 0
    while i < len(ts_list) and ts_list[i] < cutoff:
        i += 1
    if i:
        del ts_list[:i]


def _login_guard_status(keys, now):
    # returns dict {locked_until, captcha_required, captcha_until, captcha_remaining}
    locked_until = 0
    for k in keys:
        lu = _LOGIN_LOCKOUT.get(k, 0)
        if lu and lu > locked_until:
            locked_until = lu
    if locked_until and locked_until > now:
        return {
            'locked_until': locked_until,
            'captcha_required': True,
            'captcha_until': locked_until,
            'captcha_remaining': 0,
        }

    captcha_until = 0
    captcha_remaining = None
    for k in keys:
        st = _LOGIN_CAPTCHA.get(k)
        if st and st.get('until', 0) > now:
            if st['until'] > captcha_until:
                captcha_until = st['until']
                captcha_remaining = int(st.get('remaining', CAPTCHA_ATTEMPTS))
    if captcha_until and captcha_until > now:
        return {
            'locked_until': 0,
            'captcha_required': True,
            'captcha_until': captcha_until,
            'captcha_remaining': captcha_remaining,
        }

    return {
        'locked_until': 0,
        'captcha_required': False,
        'captcha_until': 0,
        'captcha_remaining': None,
    }


def _start_captcha(keys, now):
    until = now + CAPTCHA_WINDOW_SECONDS
    for k in keys:
        _LOGIN_CAPTCHA[k] = {'until': until, 'remaining': CAPTCHA_ATTEMPTS}


def _consume_captcha_attempt(keys, now):
    # decrement remaining attempts; if reaches 0 -> lockout
    min_remaining = None
    for k in keys:
        st = _LOGIN_CAPTCHA.get(k)
        if not st or st.get('until', 0) <= now:
            continue
        st['remaining'] = max(0, int(st.get('remaining', CAPTCHA_ATTEMPTS)) - 1)
        if min_remaining is None or st['remaining'] < min_remaining:
            min_remaining = st['remaining']
    if min_remaining is not None and min_remaining <= 0:
        until = now + LOCKOUT_SECONDS
        for k in keys:
            _LOGIN_LOCKOUT[k] = until
            _LOGIN_CAPTCHA.pop(k, None)
        return True, until
    return False, 0


def _record_login_failure(keys, now):
    # Add failure timestamps, potentially transition to CAPTCHA
    should_captcha = False
    for k in keys:
        lst = _LOGIN_FAILS.get(k)
        if lst is None:
            lst = []
            _LOGIN_FAILS[k] = lst
        _cleanup_old(lst, now)
        lst.append(now)
        if len(lst) >= LOGIN_FAIL_THRESHOLD:
            should_captcha = True
    if should_captcha:
        _start_captcha(keys, now)


def _clear_login_failures(keys):
    for k in keys:
        _LOGIN_FAILS.pop(k, None)
        _LOGIN_CAPTCHA.pop(k, None)
        _LOGIN_LOCKOUT.pop(k, None)


def _verify_turnstile(token: str, ip: str) -> bool:
    secret = (os.getenv('TURNSTILE_SECRET_KEY') or '').strip() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence.
    if not secret:
        # 🔒 SECURITY: fail CLOSED when the CAPTCHA secret is not configured.
        # Previously this returned True for any token, so a missing/cleared
        # secret silently disabled the brute-force CAPTCHA gate entirely.
        # Set TURNSTILE_DEV_BYPASS=true ONLY in local dev to bypass.
        if (os.getenv('TURNSTILE_DEV_BYPASS') or '').strip().lower() in {"1", "true", "yes", "on"}:
            return True
        print("⚠️  TURNSTILE_SECRET_KEY not set — CAPTCHA verification fails closed.")
        return False
    token = (token or '').strip()
    if not token:
        return False
    try:
        import httpx
        resp = httpx.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data={'secret': secret, 'response': token, 'remoteip': ip},
            timeout=5,
        )
        data = resp.json() if resp is not None else {}
        return bool(data.get('success'))
    except Exception:
        return False

# ---------------- Email verification (6-digit code) ----------------
# Important: this project uses INTEGER user ids (users.id).

import hashlib
import random
import smtplib
from email.message import EmailMessage

EMAIL_CODE_PEPPER = os.getenv("EMAIL_CODE_PEPPER", "change_me") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 

def _gen_6digit_code() -> str:
    return f"{random.randint(0, 999999):06d}"

def _hash_code(code: str) -> str:
    # 6-digit codes are low entropy; pepper prevents offline brute-force if DB leaks.
    return hashlib.sha256(f"{code}{EMAIL_CODE_PEPPER}".encode("utf-8")).hexdigest()

def _render_verification_email_html(name: str, code: str) -> str:
    # Email-safe HTML (table layout, inline styles). Avoids complex CSS.
    safe_name = (name or "").strip() or "there"
    year = datetime.utcnow().year
    # Build digits row (visual). Copy-friendly full code is shown as a single block above.
    digits = "".join(
        f"""
        <td align=\"center\" valign=\"middle\" style=\"width:52px;height:56px;border:1px solid #E6EAF2;border-radius:12px;background:#FFFFFF;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:24px;line-height:56px;font-weight:700;color:#0B1220;\">{d}</td>
        """
        for d in code
    )

    # Hidden preheader improves inbox preview.
    preheader = f"Your Haylingua verification code is {code}. It expires in 10 minutes."

    return f"""<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
    <meta name=\"x-apple-disable-message-reformatting\" />
    <title>Haylingua verification</title>
  </head>
  <body style=\"margin:0;padding:0;background:#F6F8FC;\">
    <div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;\">{preheader}</div>

    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#F6F8FC;\">
      <tr>
        <td align=\"center\" style=\"padding:28px 12px;\">

          <!-- Outer card -->
          <table role=\"presentation\" width=\"620\" cellspacing=\"0\" cellpadding=\"0\" style=\"width:620px;max-width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E6EAF2;\">
            <tr>
              <td style=\"padding:0;\">
                <!-- Brand header -->
                <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:linear-gradient(135deg,#FF7A00 0%,#FFB000 60%,#FFD08A 100%);\">
                  <tr>
                    <td style=\"padding:20px 24px;\">
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:0.2px;color:#0B1220;\">Haylingua</div>
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#0B1220;opacity:0.9;margin-top:2px;\">Email verification</div>
                    </td>
                  </tr>
                </table>

                <!-- Content -->
                <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">
                  <tr>
                    <td style=\"padding:24px 24px 6px 24px;\">
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:18px;font-weight:750;color:#0B1220;\">Welcome, {safe_name} 👋</div>
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.55;color:#334155;margin-top:10px;\">
                        Use the code below to confirm your email address. This code expires in <b>10 minutes</b>.
                      </div>
                    </td>
                  </tr>

                  <!-- Copy-friendly code -->
                  <tr>
                    <td style=\"padding:12px 24px 0 24px;\">
                      <div style=\"background:#0B1220;border-radius:14px;padding:14px 16px;\">
                        <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;color:#94A3B8;\">Your verification code</div>
                        <div style=\"font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:8px;color:#FFFFFF;margin-top:6px;\">{code}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:18px 24px 22px 24px;\">
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#64748B;\">
                        If you didn’t request this, you can safely ignore this email.
                      </div>
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#64748B;margin-top:8px;\">
                        Need help? Reply to this email and we’ll assist you.
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style=\"padding:14px 24px; border-top:1px solid #E6EAF2;\">
                      <div style=\"font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:#94A3B8;\">© {year} Haylingua</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>"""


def _send_email(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> bool:
    """Send email via SMTP if configured; otherwise log to server console.
    
    Returns:
        bool: True if email was sent via SMTP, False if only logged to console
    """
    # 1) Preferred: Brevo transactional HTTP API. Works even when the host blocks
    #    outbound SMTP ports (Render does), and reuses the existing BREVO_API_KEY.
    try:
        from integrations.brevo import send_transactional_email as _brevo_send
    except Exception:
        _brevo_send = None
    if _brevo_send is not None:
        try:
            if _brevo_send(to_email=to_email, subject=subject, text=body, html=html_body):
                return True
        except Exception as e:
            print(f" ⚠️  Brevo email error, trying SMTP: {e}")

    # 2) Fallback: classic SMTP (if configured).
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    email_from = os.getenv("EMAIL_FROM", smtp_user or "no-reply@haylingua.local")

    if not (smtp_host and smtp_user and smtp_pass):
        # Dev-safe fallback — nothing configured, log only.
        print("\n--- EMAIL (not sent: no Brevo key + no SMTP) ---")
        print("To:", to_email)
        print("Subject:", subject)
        print(body)
        print("--- END EMAIL ---\n")
        return False

    try:
        msg = EmailMessage()
        msg["From"] = email_from
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        # Port 465 = implicit TLS (SMTPS); everything else = STARTTLS. Time out
        # quickly so a blocked port doesn't hang the request.
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as s:
                s.login(smtp_user, smtp_pass)
                s.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as s:
                s.ehlo()
                s.starttls()
                s.login(smtp_user, smtp_pass)
                s.send_message(msg)

        print(f" ✅ Email sent via SMTP to {to_email}")
        return True
    except Exception as e:
        print(f" ❌ SMTP email failed: {e}")
        print("\n--- EMAIL (fallback after error) ---")
        print("To:", to_email)
        print("Subject:", subject)
        print(body)
        print("--- END EMAIL ---\n")
        return False

def _require_verified(db: Connection, user_id: int):
    row = db.execute(
        text("SELECT email_verified FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not bool(row.get("email_verified")):
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")

KIND_MAP = {
    "fill-blank": "fill_blank",
    "multiple_choice": "translate_mcq",  # change if you want a different mapping
    "multi-select": "multi_select",
}

class AttemptIn(BaseModel):
    # FE historically sent no lesson_id. We can reliably derive it from exercise_id.
    lesson_id: Optional[int] = None
    attempt_no: int = 1
    # NOTE: `is_correct` is accepted for backward-compat but IGNORED. Correctness
    # is computed server-side (see grading.grade_attempt). Never trust the client.
    is_correct: Optional[bool] = None
    answer_text: Optional[str] = None
    selected_indices: Optional[list[int]] = None  # for multiselect
    time_ms: Optional[int] = None

class AttemptOut(BaseModel):
    ok: bool
    attempt_id: int
    accuracy: float
    earned_xp: int
    earned_xp_delta: Optional[int] = None  # XP gained from this attempt
    completion_ratio: float
    completed: bool
    # Hearts system (lives)
    hearts_current: Optional[int] = None
    hearts_max: Optional[int] = None
    is_premium: Optional[bool] = None
    next_regen_seconds: Optional[int] = None


class LogIn(BaseModel):
    # Keep compatibility with older FE payloads:
    #  - new style: {"lesson_id": 1, "event_type": "opened", "meta": {...}}
    #  - old style: {"event": "opened", "payload": {...}}
    lesson_id: Optional[int] = None
    event_type: Optional[str] = None
    meta: Optional[dict[str, Any]] = None

    # legacy aliases
    event: Optional[str] = None
    payload: Optional[dict[str, Any]] = None

class LogOut(BaseModel):
    ok: bool
    log_id: int

def normalize_kind(kind: str) -> str:
    k = (kind or "").strip()
    return KIND_MAP.get(k, k)

def validate_exercise_config(kind: str, config: dict):
    if kind != "multi_select":
        return

    choices = config.get("choices") or config.get("options") or []
    if not isinstance(choices, list) or len(choices) < 2:
        raise HTTPException(400, detail="multi_select requires config.choices (>=2 items)")

    correct_indices = config.get("correctIndices")
    correct_answers = config.get("correctAnswers")

    if correct_indices is None and correct_answers is None:
        raise HTTPException(400, detail="multi_select requires correctIndices or correctAnswers")

    if correct_indices is not None:
        if not isinstance(correct_indices, list) or len(correct_indices) < 1:
            raise HTTPException(400, detail="correctIndices must be a list with at least 1 item")
        for x in correct_indices:
            if not isinstance(x, int):
                raise HTTPException(400, detail="correctIndices must contain integers")
            if x < 0 or x >= len(choices):
                raise HTTPException(400, detail="correctIndices contains out-of-range index")

    if correct_answers is not None:
        if not isinstance(correct_answers, list) or len(correct_answers) < 1:
            raise HTTPException(400, detail="correctAnswers must be a list with at least 1 item")





def _now_utc():
    return datetime.utcnow()

def _clamp(x: float, a: float, b: float) -> float:
    return max(a, min(b, x))

def _json_default_list(v):
    return v if isinstance(v, list) else []

def _compute_spaced_interval_days(prev_interval: int | None, ease: float, is_correct: bool) -> tuple[int, float]:
    """
    Simple SM-2-ish logic:
    - If wrong -> interval back to 1 day, ease decreases
    - If correct -> interval grows, ease slightly increases
    """
    ease = float(ease or 2.3)
    prev_interval = int(prev_interval or 0)

    if not is_correct:
        ease = max(1.3, ease - 0.2)
        return 1, ease

    # correct
    ease = min(3.0, ease + 0.05)

    if prev_interval <= 0:
        return 1, ease
    if prev_interval == 1:
        return 3, ease

    # grow multiplicatively
    next_interval = int(math.ceil(prev_interval * ease))
    next_interval = max(next_interval, prev_interval + 1)
    return next_interval, ease

def _update_review_queue(db: Connection, user_id: int, lesson_id: int, exercise_id: int, is_correct: bool):
    """
    Reads review_queue JSON, updates entry for exercise_id, writes back.
    """
    row = db.execute(
        text("""
            SELECT review_queue
            FROM user_lesson_progress
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"u": user_id, "l": lesson_id},
    ).mappings().first()

    queue = _json_default_list(row["review_queue"] if row else [])

    # find existing entry
    idx = None
    for i, item in enumerate(queue):
        if int(item.get("exercise_id", -1)) == int(exercise_id):
            idx = i
            break

    if idx is None:
        # create new entry
        interval_days, ease = _compute_spaced_interval_days(None, 2.3, is_correct)
        due_at = _now_utc() + timedelta(days=interval_days)
        queue.append({
            "exercise_id": int(exercise_id),
            "interval_days": int(interval_days),
            "ease": float(ease),
            "due_at": due_at.isoformat() + "Z",
        })
    else:
        item = queue[idx]
        interval_days, ease = _compute_spaced_interval_days(
            item.get("interval_days"), item.get("ease"), is_correct
        )
        due_at = _now_utc() + timedelta(days=interval_days)
        item["interval_days"] = int(interval_days)
        item["ease"] = float(ease)
        item["due_at"] = due_at.isoformat() + "Z"
        queue[idx] = item

    # keep queue sorted by due_at (earliest first)
    def _due_key(it):
        s = it.get("due_at") or ""
        return s
    queue.sort(key=_due_key)

    db.execute(
        text("""
            UPDATE user_lesson_progress
            SET review_queue = CAST(:q AS jsonb)
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"q": json.dumps(queue), "u": user_id, "l": lesson_id},
    )

def _pick_due_review(queue: list[dict]) -> int | None:
    now = _now_utc().isoformat() + "Z"
    for it in queue:
        due = it.get("due_at")
        if due and due <= now:
            return int(it.get("exercise_id"))
    return None
# ---------- Auth schemas ----------

class UserCreate(BaseModel):
    # Optional display name (used by signup UI). Stored in users.name.
    name: str | None = None
    # Public handle shown in leaderboards, and can be used to login.
    username: str
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or less")
        return v


class UserLogin(BaseModel):
    # Single identifier field: accepts email OR username (kept as `email` for backwards compatibility)
    email: str
    password: str
    # Optional 2FA one-time password
    otp: Optional[str] = None
    # Optional Cloudflare Turnstile token (only required after suspicious login failures)
    turnstile_token: Optional[str] = None



class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


class VerifyEmailIn(BaseModel):
    # Accept multiple common keys from the frontend to avoid payload mismatches.
    # Primary key remains `code`.
    code: Optional[str] = None
    otp: Optional[str] = None
    verification_code: Optional[str] = None


class ResendOut(BaseModel):
    ok: bool
    retry_after_s: int
    verification_code: Optional[str] = None  # Added for dev mode


# ---------- Lesson schemas ----------

class ExerciseOptionOut(BaseModel):
    id: int
    text: str
    is_correct: bool | None = None
    side: str | None = None
    match_key: str | None = None

class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int
    lesson_type: str = "standard"
    config: Dict[str, Any] = {}


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str | None = None
    prompt: str
    expected_answer: str | None = None
    sentence_before: str | None = None
    sentence_after: str | None = None
    order: int
    config: Dict[str, Any]
    options: List[ExerciseOptionOut] = []


class LessonWithExercisesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int
    lesson_type: str = "standard"
    config: Dict[str, Any] = {}
    exercises: List[ExerciseOut]


class StatsOut(BaseModel):
    total_xp: int
    lessons_completed: int
    streak: int = 0
    today_xp: int = 0


def _compute_streak(active_dates, today, freezes: int = 0, frozen_dates=None):
    """Pure streak calculation (no DB), so it can be unit-tested.

    - active_dates / frozen_dates: sets of `date` (days practiced / days already
      bridged by a freeze).
    - Walks back from today. Today not yet practiced is a grace day (doesn't
      count, doesn't break). A single missing day is bridged by a freeze ONLY
      when the day before it is covered (i.e. it genuinely connects two active
      stretches); the bridged day does not add to the count.

    Returns (streak_count, newly_frozen) — newly_frozen are gap days a freeze was
    spent on, for the caller to persist.
    """
    one = timedelta(days=1)
    frozen_dates = set(frozen_dates or set())
    covered = set(active_dates) | frozen_dates
    if not covered:
        return 0, []

    newly = []
    avail = int(freezes or 0)
    streak = 0
    cur = today
    first = True
    while True:
        if cur in covered:
            if cur in active_dates:
                streak += 1  # only real practice days add to the number
            first = False
            cur -= one
            continue
        if first and cur == today:
            first = False  # today not practiced yet — grace, keep going
            cur -= one
            continue
        # gap day — bridge with a freeze only if the day before is covered.
        # Add to `covered` immediately so consecutive missed days can be chained.
        if avail > 0 and (cur - one) in covered:
            avail -= 1
            newly.append(cur)
            covered.add(cur)
            cur -= one
            continue
        break
    return streak, newly


def _compute_streak_days(db: Connection, user_id: int) -> int:
    """Current streak from exercise attempts (UTC dates), freeze-aware.

    Spends/persists streak freezes lazily when they bridge a missed day.
    """
    rows = db.execute(
        text(
            """
            SELECT DISTINCT DATE(created_at) AS d
            FROM user_exercise_attempts
            WHERE user_id = :u
              AND created_at >= NOW() - INTERVAL '400 days'
            """
        ),
        {"u": user_id},
    ).mappings().all()
    active = {r["d"] for r in rows if r.get("d") is not None}

    urow = db.execute(
        text("SELECT COALESCE(streak_freezes, 0) AS f, COALESCE(streak_frozen_days, '[]'::jsonb) AS fd FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first() or {}
    freezes = int(urow.get("f") or 0)
    frozen_raw = urow.get("fd") or []
    if isinstance(frozen_raw, str):
        try:
            frozen_raw = json.loads(frozen_raw)
        except Exception:
            frozen_raw = []
    frozen = set()
    for s in (frozen_raw or []):
        try:
            frozen.add(datetime.strptime(str(s), "%Y-%m-%d").date())
        except Exception:
            pass

    today = datetime.utcnow().date()
    streak, newly = _compute_streak(active, today, freezes, frozen)

    if newly:
        merged = sorted({*(d.isoformat() for d in frozen), *(d.isoformat() for d in newly)})
        db.execute(
            text(
                """
                UPDATE users
                SET streak_freezes = GREATEST(COALESCE(streak_freezes, 0) - :n, 0),
                    streak_frozen_days = CAST(:fd AS jsonb)
                WHERE id = :u
                """
            ),
            {"n": len(newly), "fd": json.dumps(merged), "u": user_id},
        )
    return streak


def _brevo_sync_user(db: Connection, user_id: int, *, event: str | None = None, event_props: dict | None = None) -> None:
    """Best-effort sync to Brevo.

    This must NEVER break the API flow.
    """
    if _brevo_upsert_contact is None:
        return
    # NOTE: this function is called inside request transactions.
    # Any SQL error would abort the whole transaction unless we isolate it.
    # Use a SAVEPOINT so failures here never roll back signup/verify flows.
    try:
        sp_name = "brevo_sync"
        try:
            db.execute(text(f"SAVEPOINT {sp_name}"))
        except Exception:
            sp_name = None

        u = db.execute(
            text(
                """
                SELECT id, email, username, display_name, first_name, last_name, bio,
                       avatar_url, banner_url, friends_public, is_hidden, email_verified,
                       country, timezone, joined_at, last_active_at,
                       is_premium, premium_since,
                       gems, chests, weekly_xp, league_tier,
                       streak_freezes, current_streak,
                       hearts_current, hearts_max,
                       totp_enabled, bonus_xp
                FROM users
                WHERE id = :id
                """
            ),
            {"id": int(user_id)},
        ).mappings().first()
        if not u:
            return

        stats = db.execute(
            text(
                """
                SELECT
                  COALESCE(SUM(lp.xp_earned), 0)                                              AS total_xp,
                  COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.completed_at IS NOT NULL)     AS lessons_completed,
                  (SELECT COUNT(*) FROM user_exercise_logs l WHERE l.user_id = :u)            AS exercises_done,
                  COUNT(DISTINCT DATE(lp.completed_at))                                       AS days_active,
                  (SELECT COUNT(*) FROM friends f WHERE f.user_id = :u)                       AS friends_count,
                  (SELECT COUNT(*) FROM (
                     SELECT c.id FROM chapters c
                     JOIN lessons ls ON ls.chapter_id = c.id
                     LEFT JOIN lesson_progress lp2 ON lp2.lesson_id = ls.id AND lp2.user_id = :u AND lp2.completed_at IS NOT NULL
                     GROUP BY c.id
                     HAVING COUNT(ls.id) > 0 AND COUNT(ls.id) = COUNT(lp2.lesson_id)
                   ) _cc)                                                                     AS chapters_completed,
                  (SELECT COALESCE(SUM(el.correct::int), 0)
                     FROM user_exercise_logs el WHERE el.user_id = :u)                        AS correct_answers
                FROM lesson_progress lp
                WHERE lp.user_id = :u
                """
            ),
            {"u": int(user_id)},
        ).mappings().first() or {}

        streak = _compute_streak_days(db, int(user_id))
        bonus_xp = int(u.get("bonus_xp") or 0)
        total_xp = int(stats.get("total_xp") or 0) + bonus_xp

        attrs = {
            # Identity
            "HAYLINGUA_USER_ID": int(u.get("id")),
            "USERNAME": (u.get("username") or "") or None,
            "DISPLAY_NAME": (u.get("display_name") or "") or None,
            "FIRSTNAME": (u.get("first_name") or "") or None,
            "LASTNAME": (u.get("last_name") or "") or None,
            "BIO": (u.get("bio") or "") or None,
            "AVATAR_URL": (u.get("avatar_url") or "") or None,
            "BANNER_URL": (u.get("banner_url") or "") or None,
            "COUNTRY": (u.get("country") or "") or None,
            "TIMEZONE": (u.get("timezone") or "") or None,
            # Account state
            "EMAIL_VERIFIED": bool(u.get("email_verified")),
            "IS_PREMIUM": bool(u.get("is_premium")),
            "PREMIUM_SINCE": _iso(u.get("premium_since")) if u.get("premium_since") else None,
            "JOINED_AT": _iso(u.get("joined_at")) if u.get("joined_at") else None,
            "LAST_ACTIVE_AT": _iso(u.get("last_active_at")) if u.get("last_active_at") else None,
            "TOTP_ENABLED": bool(u.get("totp_enabled")),
            "FRIENDS_PUBLIC": bool(u.get("friends_public")),
            "IS_HIDDEN": bool(u.get("is_hidden")),
            # Progress
            "XP_TOTAL": total_xp,
            "LESSONS_COMPLETED": int(stats.get("lessons_completed") or 0),
            "EXERCISES_COMPLETED": int(stats.get("exercises_done") or 0),
            "CORRECT_ANSWERS": int(stats.get("correct_answers") or 0),
            "DAYS_ACTIVE": int(stats.get("days_active") or 0),
            "CHAPTERS_COMPLETED": int(stats.get("chapters_completed") or 0),
            "FRIENDS_COUNT": int(stats.get("friends_count") or 0),
            # Streak
            "STREAK_DAYS": int(streak),
            "STREAK_FREEZES": int(u.get("streak_freezes") or 0),
            # Economy
            "GEMS": int(u.get("gems") or 0),
            "CHESTS": int(u.get("chests") or 0),
            "WEEKLY_XP": int(u.get("weekly_xp") or 0),
            "LEAGUE_TIER": int(u.get("league_tier") or 0),
            # Hearts
            "HEARTS_CURRENT": int(u.get("hearts_current") or 0) if u.get("hearts_current") is not None else None,
            "HEARTS_MAX": int(u.get("hearts_max") or 0) if u.get("hearts_max") is not None else None,
            # Meta
            "LANGUAGE": "Armenian",
        }

        email = (u.get("email") or "").strip()
        if not email:
            return

        _brevo_upsert_contact(email=email, attributes=attrs)

        if event and _brevo_track_event is not None:
            props = dict(event_props or {})
            props.update(
                {
                    "user_id": int(u.get("id")),
                    "username": (u.get("username") or "") or None,
                    "total_xp": total_xp,
                    "streak_days": int(streak),
                    "lessons_completed": int(stats.get("lessons_completed") or 0),
                    "gems": int(u.get("gems") or 0),
                    "is_premium": bool(u.get("is_premium")),
                }
            )
            _brevo_track_event(email=email, event=event, properties=props)

        if sp_name:
            try:
                db.execute(text(f"RELEASE SAVEPOINT {sp_name}"))
            except Exception:
                pass
    except Exception:
        # If we created a savepoint and something failed, rollback to it so the
        # outer request transaction isn't aborted.
        try:
            db.execute(text("ROLLBACK TO SAVEPOINT brevo_sync"))
            db.execute(text("RELEASE SAVEPOINT brevo_sync"))
        except Exception:
            pass
        # Never raise; just log server-side.
        try:
            traceback.print_exc()
        except Exception:
            pass

# ---------- Friends schemas + API ----------
class FriendOut(BaseModel):
    user_id: int
    username: str | None = None
    name: str
    avatar_url: str | None = None
    xp: int
    level: int
    streak: int
    global_rank: int

class FriendRequestOut(BaseModel):

    id: int
    requester_id: int
    requester_email: str
    requester_name: str | None = None
    created_at: datetime

class FriendRequestCreateIn(BaseModel):
    query: str  # username or email

@router.get("/friends", response_model=list[FriendOut])
def friends_list(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    rows = db.execute(
        text(
            """
            WITH xp AS (
              SELECT
                u.id,
                u.email,
                u.username,
                u.display_name,
                u.avatar_url,
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.email, u.username, u.display_name, u.avatar_url
            ), ranked AS (
              SELECT
                xp.*,
                RANK() OVER (ORDER BY xp.total_xp DESC, xp.id ASC) AS global_rank
              FROM xp
            )
            SELECT r.*
            FROM ranked r
            JOIN friends f ON f.friend_id = r.id
            WHERE f.user_id = :uid
            ORDER BY r.global_rank ASC, r.id ASC
            """
        ),
        {"uid": int(user_id)},
    ).mappings().all()

    out: list[FriendOut] = []
    for r in rows:
        email = (r.get("email") or "").strip()
        username = (r.get("username") or "").strip() or None
        display_name = (r.get("display_name") or "").strip()
        if display_name:
            name = display_name
        elif username:
            name = username
        else:
            name = email.split("@")[0] if "@" in email else (email or "User")

        xp = int(r.get("total_xp") or 0)
        level = max(1, (xp // 500) + 1)
        streak = _compute_streak_days(db, int(r["id"]))

        out.append(
            FriendOut(
                user_id=int(r["id"]),
                username=username,
                name=name,
                avatar_url=r.get("avatar_url"),
                xp=xp,
                level=level,
                streak=streak,
                global_rank=int(r.get("global_rank") or 0),
            )
        )

    return out


@router.get("/friends/leaderboard", response_model=list[FriendOut])
def friends_leaderboard(
    authorization: Optional[str] = Header(default=None),
    limit: int = 200,
    db: Connection = Depends(get_db),
):
    friends = friends_list(authorization=authorization, db=db)
    limit = max(1, min(int(limit or 200), 200))
    return friends[:limit]


@router.get("/friends/requests/outgoing", response_model=list[FriendRequestOut])
def friends_requests_outgoing(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text("""
            SELECT
              fr.id,
              fr.requester_id,
              u.email AS requester_email,
              u.name AS requester_name,
              fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.addressee_id
            WHERE fr.requester_id = :uid AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        """),
        {"uid": user_id},
    ).mappings().all()

    # NOTE: FriendRequestOut fields are named requester_*
    # For outgoing, it might be better to create a separate schema.
    # Quick hack: reuse but store the OTHER user as "requester_*".
    return [
        FriendRequestOut(
            id=r["id"],
            requester_id=user_id,
            requester_email=r["requester_email"],
            requester_name=r["requester_name"],
            created_at=r["created_at"],
        )
        for r in rows
    ]

@router.get("/friends/requests", response_model=list[FriendRequestOut])
def friends_requests_incoming(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text("""
            SELECT
              fr.id,
              fr.requester_id,
              u.email AS requester_email,
              u.name AS requester_name,
              fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.requester_id
            WHERE fr.addressee_id = :uid AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        """),
        {"uid": user_id},
    ).mappings().all()

    return [FriendRequestOut(**dict(r)) for r in rows]


@router.get("/friends/requests/sent")
def friends_requests_sent(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    requester_id = _get_user_id_from_bearer(authorization, db)
    if requester_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text("""
            SELECT
              fr.id,
              fr.addressee_id,
              u.email AS addressee_email,
              u.name AS addressee_name,
              fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.addressee_id
            WHERE fr.requester_id = :uid
              AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        """),
        {"uid": requester_id},
    ).mappings().all()

    # Keep it simple JSON (no schema needed unless you want response_model)
    return [
        {
            "id": int(r["id"]),
            "addressee_id": int(r["addressee_id"]),
            "addressee_email": r["addressee_email"],
            "addressee_name": r["addressee_name"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]

@router.post("/friends/request")
def friends_request_create(
    payload: FriendRequestCreateIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    requester_id = _get_user_id_from_bearer(authorization, db)
    if requester_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    q = (payload.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="username or email is required")

    q_l = q.lower()

    addressee = db.execute(
        text("SELECT id FROM users WHERE lower(email) = :q OR lower(username) = :q"),
        {"q": q_l},
    ).mappings().first()

    if not addressee:
        raise HTTPException(status_code=404, detail="User not found")

    addressee_id = int(addressee["id"])
    if addressee_id == requester_id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    # already friends? (friends table is symmetric)
    existing_friend = db.execute(
        text(
            """
            SELECT 1 FROM friends
            WHERE (user_id = :a AND friend_id = :b)
               OR (user_id = :b AND friend_id = :a)
            LIMIT 1
            """
        ),
        {"a": requester_id, "b": addressee_id},
    ).first()
    if existing_friend:
        return {"ok": True, "status": "already_friends"}

    # existing request either direction?
    existing_req = db.execute(
        text("""
            SELECT id, status, requester_id, addressee_id
            FROM friend_requests
            WHERE (requester_id = :a AND addressee_id = :b)
               OR (requester_id = :b AND addressee_id = :a)
            ORDER BY id DESC
            LIMIT 1
        """),
        {"a": requester_id, "b": addressee_id},
    ).mappings().first()

    if existing_req:
        # If there's already a pending/accepted/rejected request between the two users,
        # just return it so FE can react (e.g. show "Pending", or allow accept).
        return {
            "ok": True,
            "status": "request_exists",
            "request_id": int(existing_req["id"]),
            "request_status": existing_req["status"],
            "requester_id": int(existing_req["requester_id"]),
            "addressee_id": int(existing_req["addressee_id"]),
        }

    # Create new pending request and RETURN id so FE can update UI immediately
    new_id = db.execute(
        text("""
            INSERT INTO friend_requests (requester_id, addressee_id, status)
            VALUES (:r, :a, 'pending')
            RETURNING id
        """),
        {"r": requester_id, "a": addressee_id},
    ).scalar_one()

    return {"ok": True, "status": "requested", "request_id": int(new_id)}
@router.post("/friends/requests/{request_id}/accept")
def friends_request_accept(
    request_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    fr = db.execute(
        text("""
            SELECT id, requester_id, addressee_id, status
            FROM friend_requests
            WHERE id = :id
        """),
        {"id": request_id},
    ).mappings().first()

    if not fr:
        raise HTTPException(status_code=404, detail="Request not found")

    if int(fr["addressee_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your request")

    if fr["status"] != "pending":
        return {"ok": True, "status": fr["status"]}

    requester_id = int(fr["requester_id"])

    # mark accepted
    db.execute(
        text("""
            UPDATE friend_requests
            SET status='accepted', responded_at=NOW()
            WHERE id = :id
        """),
        {"id": request_id},
    )

    # create bidirectional friendship
    db.execute(
        text("""
            INSERT INTO friends (user_id, friend_id)
            VALUES (:a, :b)
            ON CONFLICT DO NOTHING
        """),
        {"a": user_id, "b": requester_id},
    )
    db.execute(
        text("""
            INSERT INTO friends (user_id, friend_id)
            VALUES (:a, :b)
            ON CONFLICT DO NOTHING
        """),
        {"a": requester_id, "b": user_id},
    )

    _brevo_sync_user(db, int(user_id), event="friend_added")
    return {"ok": True, "status": "accepted"}

@router.post("/friends/requests/{request_id}/reject")
def friends_request_reject(
    request_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    fr = db.execute(
        text("""
            SELECT id, addressee_id, status
            FROM friend_requests
            WHERE id = :id
        """),
        {"id": request_id},
    ).mappings().first()

    if not fr:
        raise HTTPException(status_code=404, detail="Request not found")

    if int(fr["addressee_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your request")

    if fr["status"] != "pending":
        return {"ok": True, "status": fr["status"]}

    db.execute(
        text("""
            UPDATE friend_requests
            SET status='rejected', responded_at=NOW()
            WHERE id = :id
        """),
        {"id": request_id},
    )
    return {"ok": True, "status": "rejected"}


@router.post("/friends/remove/{other_user_id}")
def friends_remove(
    other_user_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Unfriend another user (symmetric friends table).

    This endpoint exists mainly to support profile-page unfriending.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    if int(other_user_id) == int(user_id):
        raise HTTPException(status_code=400, detail="Invalid user")

    db.execute(
        text(
            """
            DELETE FROM friends
            WHERE (user_id = :a AND friend_id = :b)
               OR (user_id = :b AND friend_id = :a)
            """
        ),
        {"a": int(user_id), "b": int(other_user_id)},
    )

    return {"ok": True}

# ---------- TTS schema ----------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    or os.getenv("ELEVEN_LABS_API_KEY") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    or os.getenv("eleven_labs.io") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    # Note to the future me: "I didn't figure out which one works, so decided to use all of them, this can be considered as a future technical debt 💸"
)
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


class TTSPayload(BaseModel):
    text: str
    voice_id: str | None = None


# ---------- Leaderboard schemas ----------

class LeaderboardEntryOut(BaseModel):
    user_id: int
    email: str | None = None
    name: str
    username: str | None = None
    xp: int
    lesson_type: str = "standard"
    config: Dict[str, Any] = {}
    streak: int
    level: int
    rank: int
    avatar_url: str | None = None



# ---------- Profile data changing schemas ----------

class MeProfileOut(BaseModel):
    id: int
    email: str
    name: str | None = None
    avatar_url: str | None = None
    first_name: str | None = None
    last_name: str | None = None

class MeProfileUpdateIn(BaseModel):
    # Identity
    first_name: str | None = None
    last_name: str | None = None
    # Kept for backward compatibility; UI no longer exposes it.
    display_name: str | None = None
    username: str | None = None

    # Public profile
    bio: str | None = None
    avatar_url: str | None = None
    banner_url: str | None = None
    profile_theme: dict | None = None
    friends_public: bool | None = None
    is_hidden: bool | None = None

    # Preferences
    voice_pref: str | None = None


class OnboardingOut(BaseModel):
    completed: bool
    data: dict | None = None


class OnboardingIn(BaseModel):
    # Screen 1: basics
    age_range: str
    country: str
    planning_visit_armenia: bool | None = None

    # Screen 2: curriculum
    knowledge_level: str
    dialect: str
    primary_goal: str
    source_language: str

    # Screen 3: setup
    daily_goal_min: int
    reminder_time: str | None = None  # "08:00", "13:00", "20:00", or null
    voice_pref: str

    # Screen 4: legal
    marketing_opt_in: bool = False
    accepted_terms: bool


# ---------- JWT helpers (for /complete) ----------

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or "" # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM") or "HS256" # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 


def _get_user_id_from_bearer(authorization: Optional[str], db: Optional[Connection] = None) -> Optional[int]:
    """Decode Bearer JWT → user_id. When db is provided, validates token_version
    so password-change / logout invalidations take effect immediately."""
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")

    if not JWT_SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Token missing 'sub'")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    if db is not None:
        db_tv = db.execute(
            text("SELECT COALESCE(token_version, 0) FROM users WHERE id = :u"),
            {"u": user_id},
        ).scalar()
        if db_tv is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
        if int(payload.get("tv") or 0) != int(db_tv):
            raise HTTPException(status_code=401, detail="Session expired, please log in again")

    return user_id



def _ensure_user_lesson_progress(db: Connection, user_id: int, lesson_id: int):
    # Create progress row if missing (safe upsert)
    db.execute(
        text("""
            INSERT INTO user_lesson_progress (user_id, lesson_id, started_at, last_seen_at)
            VALUES (:u, :l, NOW(), NOW())
            ON CONFLICT (user_id, lesson_id) DO NOTHING
        """),
        {"u": user_id, "l": lesson_id},
    )

def _update_progress_after_attempt(
    db: Connection,
    user_id: int,
    lesson_id: int,
    exercise_id: int,
    is_correct: bool,
):
    # Update counters + accuracy in one statement
    db.execute(
        text("""
            UPDATE user_lesson_progress
            SET
              last_seen_at = NOW(),
              last_exercise_id = :ex,
              total_attempts = total_attempts + 1,
              correct_attempts = correct_attempts + CASE WHEN :ok THEN 1 ELSE 0 END,
              accuracy =
                ROUND(
                  (
                    (correct_attempts + CASE WHEN :ok THEN 1 ELSE 0 END)::numeric
                    /
                    NULLIF((total_attempts + 1), 0)
                  ) * 100
                , 2)
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"u": user_id, "l": lesson_id, "ex": exercise_id, "ok": is_correct},
    )

def _touch_progress_after_log(
    db: Connection,
    user_id: int,
    lesson_id: int,
    exercise_id: int,
):
    db.execute(
        text("""
            UPDATE user_lesson_progress
            SET last_seen_at = NOW(),
                last_exercise_id = :ex
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"u": user_id, "l": lesson_id, "ex": exercise_id},
    )

def _get_accuracy(db: Connection, user_id: int, lesson_id: int) -> float:
    row = db.execute(
        text("""
            SELECT accuracy
            FROM user_lesson_progress
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"u": user_id, "l": lesson_id},
    ).mappings().first()
    if not row:
        return 0.0
    return float(row["accuracy"] or 0.0)


# -------------------------
# Hearts (lives)
# -------------------------

DEFAULT_HEARTS_MAX = 5


def _ensure_hearts_initialized(db: Connection, user_id: int) -> None:
    """Make sure hearts_current/hearts_max are not NULL for the user.

    This assumes the DB migration added these columns. We keep this as a safe
    no-op for existing users by filling NULLs.
    """
    db.execute(
        text(
            """
            UPDATE users
            SET
              hearts_max = COALESCE(hearts_max, :mx),
              hearts_current = COALESCE(hearts_current, hearts_max, :mx)
            WHERE id = :u
            """
        ),
        {"u": user_id, "mx": DEFAULT_HEARTS_MAX},
    )


# Regenerate one heart every N minutes (Duolingo-style). Override via env.
HEARTS_REGEN_MINUTES = int(os.getenv("HEARTS_REGEN_MINUTES") or "30")


def _sync_hearts(db: Connection, user_id: int) -> None:
    """Lazily refill hearts based on time elapsed since the last loss.

    Premium users are skipped (they always have full/unlimited hearts).
    `last_heart_lost_at` is the regen clock; it advances as hearts come back
    and is cleared once the user is back to full.
    """
    interval = max(1, HEARTS_REGEN_MINUTES) * 60
    db.execute(
        text(
            """
            UPDATE users u SET
              hearts_current = LEAST(u.hearts_max, u.hearts_current + t.ticks),
              last_heart_lost_at = CASE
                  WHEN u.hearts_current + t.ticks >= u.hearts_max THEN NULL
                  ELSE u.last_heart_lost_at + ((t.ticks * :interval) * INTERVAL '1 second')
              END
            FROM (
              SELECT id,
                     FLOOR(EXTRACT(EPOCH FROM (NOW() - last_heart_lost_at)) / :interval)::int AS ticks
              FROM users WHERE id = :u
            ) t
            WHERE u.id = t.id
              AND NOT COALESCE(u.is_premium, FALSE)
              AND u.last_heart_lost_at IS NOT NULL
              AND u.hearts_current < u.hearts_max
              AND t.ticks > 0
            """
        ),
        {"u": user_id, "interval": interval},
    )


def _hearts_state(db: Connection, user_id: int) -> Dict[str, Any]:
    """Authoritative hearts state (after regen), incl. premium + next-regen ETA."""
    _ensure_hearts_initialized(db, user_id)
    _sync_hearts(db, user_id)
    interval = max(1, HEARTS_REGEN_MINUTES) * 60
    row = db.execute(
        text(
            """
            SELECT COALESCE(is_premium, FALSE) AS is_premium,
                   hearts_current, hearts_max,
                   CASE
                     WHEN COALESCE(is_premium, FALSE) THEN 0
                     WHEN hearts_current >= hearts_max THEN 0
                     WHEN last_heart_lost_at IS NULL THEN :interval
                     ELSE CEIL(:interval - MOD(EXTRACT(EPOCH FROM (NOW() - last_heart_lost_at)), :interval))::int
                   END AS next_regen_seconds
            FROM users WHERE id = :u
            """
        ),
        {"u": user_id, "interval": interval},
    ).mappings().first()

    mx = int((row and row["hearts_max"]) or DEFAULT_HEARTS_MAX)
    is_prem = bool(row and row["is_premium"])
    cur = mx if is_prem else int(
        row["hearts_current"] if (row and row["hearts_current"] is not None) else mx
    )
    return {
        "hearts_current": cur,
        "hearts_max": mx,
        "is_premium": is_prem,
        "unlimited": is_prem,
        "next_regen_seconds": 0 if is_prem else int((row and row["next_regen_seconds"]) or 0),
    }


def _lose_heart(db: Connection, user_id: int) -> Dict[str, Any]:
    """Apply pending regen, then subtract one heart (no-op for premium)."""
    _ensure_hearts_initialized(db, user_id)
    _sync_hearts(db, user_id)
    db.execute(
        text(
            """
            UPDATE users SET
              last_heart_lost_at = CASE WHEN hearts_current >= hearts_max THEN NOW() ELSE last_heart_lost_at END,
              hearts_current = GREATEST(COALESCE(hearts_current, hearts_max) - 1, 0)
            WHERE id = :u AND NOT COALESCE(is_premium, FALSE)
            """
        ),
        {"u": user_id},
    )
    return _hearts_state(db, user_id)


def _get_hearts(db: Connection, user_id: int) -> tuple[int, int]:
    st = _hearts_state(db, user_id)
    return (st["hearts_current"], st["hearts_max"])


# ----------------------------
# Leagues (Duolingo-style weekly divisions)
# ----------------------------
LEAGUE_TIERS = [
    "Bronze", "Silver", "Gold", "Sapphire", "Ruby",
    "Emerald", "Amethyst", "Pearl", "Obsidian", "Diamond",
]
LEAGUE_COHORT_SIZE = 30
LEAGUE_PROMOTE_TOP = 7
LEAGUE_DEMOTE_BOTTOM = 5


def _current_iso_week() -> str:
    iso = datetime.utcnow().isocalendar()
    return f"{iso[0]}-W{int(iso[1]):02d}"


def _week_seconds_left() -> int:
    """Seconds until the ISO week ends (Sunday 23:59:59 UTC)."""
    now = datetime.utcnow()
    end = (now + timedelta(days=7 - now.isoweekday())).replace(hour=23, minute=59, second=59, microsecond=0)
    return max(0, int((end - now).total_seconds()))


def _ensure_league_assignment(db: Connection, user_id: int) -> None:
    """Place the user into a cohort (≤30) of their tier for the current week.

    Resets weekly XP at the start of each new week (lazy, on first XP of the week).
    """
    wk = _current_iso_week()
    row = db.execute(
        text("SELECT league_tier, league_week, league_cohort FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first()
    if not row:
        return
    if row["league_week"] == wk and row["league_cohort"] is not None:
        return  # already in this week's cohort

    tier = int(row["league_tier"] or 0)
    cohort = db.execute(
        text(
            """
            SELECT league_cohort FROM users
            WHERE league_tier = :t AND league_week = :wk AND league_cohort IS NOT NULL
            GROUP BY league_cohort HAVING COUNT(*) < :cap
            ORDER BY league_cohort ASC LIMIT 1
            """
        ),
        {"t": tier, "wk": wk, "cap": LEAGUE_COHORT_SIZE},
    ).scalar()
    if cohort is None:
        mx = db.execute(
            text("SELECT COALESCE(MAX(league_cohort), -1) FROM users WHERE league_tier = :t AND league_week = :wk"),
            {"t": tier, "wk": wk},
        ).scalar()
        cohort = int(mx) + 1

    db.execute(
        text("UPDATE users SET weekly_xp = 0, league_week = :wk, league_cohort = :c WHERE id = :u"),
        {"wk": wk, "c": int(cohort), "u": user_id},
    )


def _award_weekly_xp(db: Connection, user_id: int, amount: int) -> None:
    if amount <= 0:
        return
    _ensure_league_assignment(db, user_id)
    db.execute(
        text("UPDATE users SET weekly_xp = COALESCE(weekly_xp, 0) + :d WHERE id = :u"),
        {"d": int(amount), "u": user_id},
    )

# ---------- Routes ----------

@router.get("/")
def root():
    return {"status": "Backend is running"}

class SignupPayload(BaseModel):
    name: str | None = None
    email: str
    password: str

@router.post("/signup")
def signup(user: UserCreate, db: Connection = Depends(get_db)):
    # 1) clean inputs
    name = (user.name or "").strip() or None
    username = (user.username or "").strip()
    email = (user.email or "").strip()
    password = (user.password or "")

    # 2) validate username (inline; no helper validators)
    # Rules: 3-20 chars, letters/digits/underscore/dot only, must start with letter or digit.
    # We keep it strict to avoid messy leaderboard rendering.
    username_errors: list[str] = []
    if username == "":
        username_errors.append("Username is required")
    else:
        if len(username) < 3:
            username_errors.append("Username must be at least 3 characters")
        if len(username) > 20:
            username_errors.append("Username must be 20 characters or less")

        # must not contain spaces or '@'
        for ch in username:
            if ch.isspace():
                username_errors.append("Username cannot contain spaces")
                break
            if ch == "@":
                username_errors.append("Username cannot contain '@'")
                break

        # allowed characters
        for ch in username:
            ok = False
            if "a" <= ch.lower() <= "z":
                ok = True
            elif "0" <= ch <= "9":
                ok = True
            elif ch == "_" or ch == ".":
                ok = True
            if not ok:
                username_errors.append("Username can only contain letters, numbers, '_' and '.'")
                break

        # first char must be alnum
        if username and not (username[0].isalnum()):
            username_errors.append("Username must start with a letter or number")

    if len(username_errors) > 0:
        raise HTTPException(status_code=400, detail={"field": "username", "errors": username_errors})

    # 3) validate email (inline)
    email_errors: list[str] = []
    if email == "":
        email_errors.append("Email is required")
    else:
        at_count = 0
        dot_after_at = False
        seen_at = False
        for ch in email:
            if ch.isspace():
                email_errors.append("Email cannot contain spaces")
                break
            if ch == "@":
                at_count += 1
                seen_at = True
                continue
            if seen_at and ch == ".":
                dot_after_at = True
        if len(email_errors) == 0:
            if at_count != 1:
                email_errors.append("Email must contain exactly one '@'")
            if not dot_after_at:
                email_errors.append("Email must contain a '.' after '@'")

    if len(email_errors) > 0:
        raise HTTPException(status_code=400, detail={"field": "email", "errors": email_errors})

    # 4) validate password (inline)
    password_errors: list[str] = []
    if password.strip() == "":
        password_errors.append("Password is required")
    else:
        if len(password) < 8:
            password_errors.append("Password must be at least 8 characters")
        if len(password.encode("utf-8")) > 72:
            password_errors.append("Password must be 72 bytes or less")

        has_letter = False
        has_digit = False
        for ch in password:
            if ch.isalpha():
                has_letter = True
            elif ch.isdigit():
                has_digit = True
        if not has_letter:
            password_errors.append("Password must contain at least one letter")
        if not has_digit:
            password_errors.append("Password must contain at least one number")

    if len(password_errors) > 0:
        raise HTTPException(status_code=400, detail={"field": "password", "errors": password_errors})

    # 5) check uniqueness (email + username)
    existing = db.execute(
        text("SELECT id FROM users WHERE LOWER(email) = :email"),
        {"email": email.lower()},
    ).mappings().first()

    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already exists")

    existing_u = db.execute(
        text("SELECT id FROM users WHERE LOWER(username) = LOWER(:u)"),
        {"u": username},
    ).mappings().first()

    if existing_u is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    # 6) hash password and insert
    password_hash = hash_password(password)

    row = db.execute(
        text(
            """
            INSERT INTO users (email, password_hash, name, username)
            VALUES (:email, :password_hash, :name, :username)
            RETURNING id
            """
        ),
        {"email": email, "password_hash": password_hash, "name": name, "username": username},
    ).mappings().first()

    if row is None:
        # very rare, but just in case insert failed
        raise HTTPException(status_code=500, detail="Could not create user")

    user_id = row["id"]

    # 6.5) Generate email verification code (6 digits) and store it.
    # NOTE: users.id is INTEGER in this project, so email_verification_codes.user_id is INTEGER.
    code = _gen_6digit_code()
    code_hash = _hash_code(code)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    db.execute(
        text(
            """
            INSERT INTO email_verification_codes (user_id, code_hash, expires_at, last_sent_at)
            VALUES (:uid, :code_hash, :expires_at, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                code_hash = EXCLUDED.code_hash,
                expires_at = EXCLUDED.expires_at,
                last_sent_at = NOW(),
                attempts = 0
            """
        ),
        {"uid": int(user_id), "code_hash": code_hash, "expires_at": expires_at},
    )

    # Send the code via email and track if it was actually sent
    subject = f"Haylingua verification code: {code}"
    plain = (
        f"Welcome to Haylingua, {name or 'there'}!\n\n"
        f"Your verification code is: {code}\n"
        f"This code expires in 10 minutes.\n\n"
        "If you didn't request this, you can ignore this email."
    )
    email_sent = _send_email(
        to_email=email,
        subject=subject,
        body=plain,
        html_body=_render_verification_email_html(name or "", code),
    )

    # 6) create token
    token = create_token(user_id)

    # 7) Build response
    response_data = {
        "message": "User created",
        "access_token": token,
        "email": email,
        "email_verified": False,
    }
    
    # Dev-only: include the code in the response when explicitly enabled.
    if not email_sent and _expose_dev_codes():
        response_data["verification_code"] = code
        print(f"⚠️  DEV MODE: Including verification code in response: {code}")

    # Best-effort Brevo sync (contacts + events). Never blocks signup.
    _brevo_sync_user(db, int(user_id), event="user_registered")

    return response_data


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, request: Request, db: Connection = Depends(get_db)):
    now = time.time()
    identifier = (payload.email or '').strip()
    password = (payload.password or '')

    if identifier == "":
        raise HTTPException(status_code=400, detail={"field": "email", "errors": ["Email or username is required"]})
    if password.strip() == "":
        raise HTTPException(status_code=400, detail={"field": "password", "errors": ["Password is required"]})

    ip = _client_ip(request)
    keys = _key_for(identifier, ip)

    with _LOGIN_GUARD_LOCK:
        st = _login_guard_status(keys, now)

    if st.get('locked_until'):
        retry = int(st['locked_until'] - now)
        raise HTTPException(
            status_code=429,
            detail={
                'locked': True,
                'locked_until': int(st['locked_until']),
                'retry_after_seconds': max(0, retry),
                'message': 'Too many failed attempts. Try again later.'
            },
            headers={'Retry-After': str(max(0, retry))},
        )

    # If we're in CAPTCHA phase, require Turnstile token before even attempting password.
    if st.get('captcha_required'):
        token = (payload.turnstile_token or '').strip()
        if not _verify_turnstile(token, ip):
            # Do not count this as a password attempt; just request CAPTCHA.
            retry = int(st.get('captcha_until', 0) - now) if st.get('captcha_until') else 0
            raise HTTPException(
                status_code=403,
                detail={
                    'requires_captcha': True,
                    'captcha_until': int(st.get('captcha_until') or 0),
                    'captcha_remaining': st.get('captcha_remaining'),
                    'retry_after_seconds': max(0, retry),
                    'message': 'Security check required.'
                },
            )

    # Determine if identifier is email by counting '@'
    at_count = 0
    for ch in identifier:
        if ch == "@":
            at_count += 1
    is_email = at_count == 1

    # Load user
    if is_email:
        key = identifier.lower()
        row = db.execute(
            text("""
                SELECT id, email, password_hash, COALESCE(totp_enabled, FALSE) AS totp_enabled, totp_secret, recovery_codes, totp_recovery_hashes
                FROM users
                WHERE email = :email
            """),
            {"email": key},
        ).mappings().first()
    else:
        key = identifier
        row = db.execute(
            text("""
                SELECT id, email, password_hash, COALESCE(totp_enabled, FALSE) AS totp_enabled, totp_secret, recovery_codes, totp_recovery_hashes
                FROM users
                WHERE LOWER(username) = LOWER(:u)
            """),
            {"u": key},
        ).mappings().first()

    # Use same message to avoid enumeration.
    if row is None:
        with _LOGIN_GUARD_LOCK:
            _record_login_failure(keys, now)
        raise HTTPException(status_code=400, detail="Invalid email/username or password")

    # Verify password
    ok = verify_password(password, row["password_hash"])
    if not ok:
        # If in captcha phase, consume one of the allowed attempts
        with _LOGIN_GUARD_LOCK:
            if st.get('captcha_required'):
                locked, until = _consume_captcha_attempt(keys, now)
                if locked:
                    retry = int(until - now)
                    raise HTTPException(
                        status_code=429,
                        detail={
                            'locked': True,
                            'locked_until': int(until),
                            'retry_after_seconds': max(0, retry),
                            'message': 'Too many failed attempts. Try again later.'
                        },
                        headers={'Retry-After': str(max(0, retry))},
                    )
            _record_login_failure(keys, now)
        raise HTTPException(status_code=400, detail="Invalid email/username or password")

    # If 2FA enabled, require OTP
    if bool(row.get('totp_enabled')):
        otp = (payload.otp or '').strip()
        if not otp:
            raise HTTPException(status_code=401, detail={"requires_2fa": True, "message": "2FA code required"})

        secret = (row.get('totp_secret') or '').strip()
        # Verify TOTP OR recovery code
        otp_ok = False
        if secret:
            try:
                import pyotp
                totp = pyotp.TOTP(secret)
                otp_ok = bool(totp.verify(otp, valid_window=1))
            except Exception:
                otp_ok = False

        # Recovery code fallback.
        # 🔒 Recovery codes are stored as SHA-256 hashes in `totp_recovery_hashes`
        # by /me/2fa/confirm. The previous code read the wrong column
        # (`recovery_codes`) and used bcrypt verification, so recovery login could
        # never succeed. Compare the SHA-256 of the submitted code instead.
        if not otp_ok:
            try:
                import json
                hashes = row.get('totp_recovery_hashes')
                if isinstance(hashes, str):
                    hashes_list = json.loads(hashes)
                else:
                    hashes_list = hashes or []
            except Exception:
                hashes_list = []

            otp_hash = _sha256_hex(otp)
            for hc in hashes_list:
                if not hc:
                    continue
                if hmac.compare_digest(str(hc), otp_hash):
                    otp_ok = True
                    # consume this recovery code (one-time use)
                    try:
                        new_list = [x for x in hashes_list if x != hc]
                        db.execute(
                            text("UPDATE users SET totp_recovery_hashes = CAST(:rc AS jsonb) WHERE id = :id"),
                            {"rc": json.dumps(new_list), "id": int(row['id'])},
                        )
                    except Exception:
                        pass
                    break

        if not otp_ok:
            # count this as a failure too
            with _LOGIN_GUARD_LOCK:
                if st.get('captcha_required'):
                    _consume_captcha_attempt(keys, now)
                _record_login_failure(keys, now)
            raise HTTPException(status_code=400, detail="Invalid email/username or password")

    # success: clear counters
    with _LOGIN_GUARD_LOCK:
        _clear_login_failures(keys)

    tv = int(db.execute(text("SELECT COALESCE(token_version, 0) FROM users WHERE id = :u"), {"u": row["id"]}).scalar() or 0)
    token = create_token(row["id"], tv)
    return AuthResponse(access_token=token, email=row["email"])


@router.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    """Increment token_version to invalidate all existing JWTs for this user."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    db.execute(
        text("UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = :u"),
        {"u": user_id},
    )
    return {"ok": True}


# ── Google OAuth ──────────────────────────────────────────────────────────────
@router.post("/auth/google")
def auth_google(
    payload: Dict[str, Any] = Body(default=None),
    db: Connection = Depends(get_db),
):
    """Exchange Google OAuth authorization code for a Haylingua JWT.

    Flow:
      1. Frontend sends { code, redirect_uri } after Google redirects back.
      2. We exchange the code with Google's token endpoint.
      3. We get user info (email, name, picture, sub) from Google.
      4. Find user by google_id → login.
         Find by email → link google_id → login.
         Otherwise → create new verified user (no password needed).
      5. Return same AuthResponse as password login.
    """
    import re as _re

    code = ((payload or {}).get("code") or "").strip()
    # Hard-coded server-side — never trust the client-supplied redirect_uri.
    redirect_uri = (os.getenv("GOOGLE_REDIRECT_URI") or "https://haylingua.am/auth/google/callback").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Missing OAuth code")

    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on this server")

    # 1) Exchange code for tokens
    try:
        token_resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google token exchange failed: {exc}")

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Google rejected the authorization code")

    token_data = token_resp.json()
    access_token_google = token_data.get("access_token")
    if not access_token_google:
        raise HTTPException(status_code=400, detail="No access token returned by Google")

    # 2) Get user info from Google
    try:
        info_resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token_google}"},
            timeout=10.0,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Google user info: {exc}")

    if info_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")

    ginfo = info_resp.json()
    google_id = ginfo.get("sub") or ""
    g_email = (ginfo.get("email") or "").strip().lower()
    g_name = ginfo.get("name") or ""
    g_picture = ginfo.get("picture") or ""

    if not google_id or not g_email:
        raise HTTPException(status_code=400, detail="Google did not return a valid email or user ID")

    # 3a) Find by google_id
    user_row = db.execute(
        text("SELECT id, email FROM users WHERE google_id = :gid LIMIT 1"),
        {"gid": google_id},
    ).mappings().first()

    if user_row:
        # existing OAuth user → just log in
        user_id = int(user_row["id"])
        db.execute(text("UPDATE users SET last_active_at = NOW() WHERE id = :u"), {"u": user_id})
        tv = int(db.execute(text("SELECT COALESCE(token_version, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0)
        jwt = create_token(user_id, tv)
        _brevo_sync_user(db, user_id, event="login_google")
        ob = db.execute(
            text("SELECT completed_at FROM user_onboarding WHERE user_id = :u LIMIT 1"),
            {"u": user_id},
        ).mappings().first()
        needs_onboarding = not (ob and ob.get("completed_at"))
        return {"access_token": jwt, "email": user_row["email"], "email_verified": True, "needs_onboarding": needs_onboarding}

    # 3b) Find by email → link account
    user_row = db.execute(
        text("SELECT id, email FROM users WHERE LOWER(email) = :e LIMIT 1"),
        {"e": g_email},
    ).mappings().first()

    if user_row:
        user_id = int(user_row["id"])
        db.execute(
            text("""
                UPDATE users
                SET google_id = :gid, oauth_provider = 'google',
                    email_verified = TRUE,
                    email_verified_at = COALESCE(email_verified_at, NOW()),
                    last_active_at = NOW()
                WHERE id = :u
            """),
            {"gid": google_id, "u": user_id},
        )
        tv = int(db.execute(text("SELECT COALESCE(token_version, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0)
        jwt = create_token(user_id, tv)
        _brevo_sync_user(db, user_id, event="google_linked")
        ob = db.execute(
            text("SELECT completed_at FROM user_onboarding WHERE user_id = :u LIMIT 1"),
            {"u": user_id},
        ).mappings().first()
        needs_onboarding = not (ob and ob.get("completed_at"))
        return {"access_token": jwt, "email": user_row["email"], "email_verified": True, "needs_onboarding": needs_onboarding}

    # 3c) Create new user
    # Generate a unique username from the email prefix
    base = _re.sub(r"[^a-z0-9_]", "_", g_email.split("@")[0].lower())[:15] or "user"
    username = base
    import random as _rand
    for _ in range(20):
        taken = db.execute(
            text("SELECT 1 FROM users WHERE LOWER(username) = LOWER(:u)"),
            {"u": username},
        ).scalar()
        if not taken:
            break
        username = f"{base}_{_rand.randint(10000, 99999)}"

    try:
        new_row = db.execute(
            text("""
                INSERT INTO users
                    (email, password_hash, username, display_name, avatar_url,
                     google_id, oauth_provider,
                     email_verified, email_verified_at, joined_at, last_active_at)
                VALUES
                    (:email, '', :username, :display_name, :avatar_url,
                     :gid, 'google',
                     TRUE, NOW(), NOW(), NOW())
                RETURNING id
            """),
            {
                "email": g_email,
                "username": username,
                "display_name": g_name or username,
                "avatar_url": g_picture,
                "gid": google_id,
            },
        ).mappings().first()
    except IntegrityError:
        raise HTTPException(status_code=503, detail="Could not create account, please try again")

    if not new_row:
        raise HTTPException(status_code=500, detail="Could not create user")

    user_id = int(new_row["id"])
    jwt = create_token(user_id, 0)
    _brevo_sync_user(db, user_id, event="user_registered")
    return {"access_token": jwt, "email": g_email, "email_verified": True, "needs_onboarding": True}


# ── Telegram OAuth ────────────────────────────────────────────────────────────
@router.post("/auth/telegram")
def auth_telegram(
    payload: Dict[str, Any] = Body(default=None),
    db: Connection = Depends(get_db),
):
    """Verify Telegram Login Widget data and return a Haylingua JWT.

    Telegram sends: { id, first_name, last_name, username, photo_url, auth_date, hash }
    We verify the HMAC-SHA256 signature using SHA256(bot_token) as the key.
    """
    import hashlib as _hashlib
    import hmac as _hmac
    import time as _time
    import re as _re

    bot_token = os.getenv("TELEGRAM_BOT_KEY", "")
    if not bot_token:
        raise HTTPException(status_code=503, detail="Telegram OAuth is not configured on this server")

    data = dict(payload or {})
    received_hash = data.pop("hash", "")
    if not received_hash:
        raise HTTPException(status_code=400, detail="Missing Telegram hash")

    # Build check string: sorted key=value pairs joined by \n
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if v is not None)

    # Key is SHA256 of the bot token (NOT the token itself)
    secret_key = _hashlib.sha256(bot_token.encode()).digest()
    expected_hash = _hmac.new(secret_key, check_string.encode(), _hashlib.sha256).hexdigest()

    if not _hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid Telegram signature")

    # Reject stale auth data (older than 24 hours)
    auth_date = int(data.get("auth_date") or 0)
    if _time.time() - auth_date > 86400:
        raise HTTPException(status_code=401, detail="Telegram auth data expired — please try again")

    tg_id = str(data.get("id") or "")
    tg_first = (data.get("first_name") or "").strip()
    tg_last = (data.get("last_name") or "").strip()
    tg_username = (data.get("username") or "").strip()
    tg_photo = (data.get("photo_url") or "").strip()
    tg_display = " ".join(filter(None, [tg_first, tg_last])) or tg_username or "Haylingua User"

    if not tg_id:
        raise HTTPException(status_code=400, detail="No Telegram user ID returned")

    def _ob_check(uid):
        ob = db.execute(
            text("SELECT completed_at FROM user_onboarding WHERE user_id = :u LIMIT 1"),
            {"u": uid},
        ).mappings().first()
        return not (ob and ob.get("completed_at"))

    # 1) Find by telegram_id → login
    row = db.execute(
        text("SELECT id, email FROM users WHERE telegram_id = :tid LIMIT 1"),
        {"tid": tg_id},
    ).mappings().first()
    if row:
        user_id = int(row["id"])
        db.execute(text("UPDATE users SET last_active_at = NOW() WHERE id = :u"), {"u": user_id})
        tv = int(db.execute(text("SELECT COALESCE(token_version, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0)
        _brevo_sync_user(db, user_id, event="login_telegram")
        return {"access_token": create_token(user_id, tv), "email": row["email"],
                "email_verified": True, "needs_onboarding": _ob_check(user_id)}

    # 2) Create new user
    # ⚠️  The previous "find by Telegram @username → link Haylingua account" fallback
    # was removed: it is an account-takeover vector — any Telegram user whose @handle
    # matches a Haylingua username silently gains full access to that account.
    base = _re.sub(r"[^a-z0-9_]", "_", (tg_username or tg_first or "user").lower())[:15] or "user"
    username = base
    import random as _rand
    for _ in range(20):
        taken = db.execute(
            text("SELECT 1 FROM users WHERE LOWER(username) = LOWER(:u)"), {"u": username}
        ).scalar()
        if not taken:
            break
        username = f"{base}_{_rand.randint(10000, 99999)}"

    # Telegram doesn't provide email — generate a placeholder
    placeholder_email = f"tg_{tg_id}@telegram.haylingua.local"

    try:
        new_row = db.execute(
            text("""
                INSERT INTO users
                    (email, password_hash, username, display_name, avatar_url,
                     telegram_id, oauth_provider,
                     email_verified, email_verified_at, joined_at, last_active_at)
                VALUES
                    (:email, '', :username, :display_name, :avatar_url,
                     :tid, 'telegram',
                     TRUE, NOW(), NOW(), NOW())
                RETURNING id
            """),
            {
                "email": placeholder_email,
                "username": username,
                "display_name": tg_display,
                "avatar_url": tg_photo,
                "tid": tg_id,
            },
        ).mappings().first()
    except IntegrityError:
        raise HTTPException(status_code=503, detail="Could not create account, please try again")

    if not new_row:
        raise HTTPException(status_code=500, detail="Could not create user")

    user_id = int(new_row["id"])
    _brevo_sync_user(db, user_id, event="user_registered")
    return {"access_token": create_token(user_id, 0), "email": placeholder_email,
            "email_verified": True, "needs_onboarding": True}


@router.post("/auth/verify-email")
def verify_email(
    payload: VerifyEmailIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    code = ((payload.code or payload.otp or payload.verification_code) or "").strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="INVALID_CODE")

    row = db.execute(
        text(
            """
            SELECT code_hash, expires_at, attempts
            FROM email_verification_codes
            WHERE user_id = :uid
            """
        ),
        {"uid": int(user_id)},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=400, detail="NO_CODE")

    if row["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="CODE_EXPIRED")

    # Optional brute-force protection
    if int(row.get("attempts") or 0) >= 10:
        raise HTTPException(status_code=429, detail="TOO_MANY_ATTEMPTS")

    if _hash_code(code) != row["code_hash"]:
        db.execute(
            text("UPDATE email_verification_codes SET attempts = attempts + 1 WHERE user_id = :uid"),
            {"uid": int(user_id)},
        )
        raise HTTPException(status_code=400, detail="INVALID_CODE")

    db.execute(
        text("UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = :uid"),
        {"uid": int(user_id)},
    )
    db.execute(
        text("DELETE FROM email_verification_codes WHERE user_id = :uid"),
        {"uid": int(user_id)},
    )

    # Sync verification to Brevo (so you can trigger onboarding sequences).
    _brevo_sync_user(db, int(user_id), event="email_verified")

    return {"ok": True}


@router.post("/auth/resend-verification", response_model=ResendOut)
def resend_verification(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    user_row = db.execute(
        text("SELECT email, email_verified FROM users WHERE id = :uid"),
        {"uid": int(user_id)},
    ).mappings().first()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if bool(user_row.get("email_verified")):
        raise HTTPException(status_code=400, detail="ALREADY_VERIFIED")

    code_row = db.execute(
        text("SELECT last_sent_at FROM email_verification_codes WHERE user_id = :uid"),
        {"uid": int(user_id)},
    ).mappings().first()

    if code_row is None:
        # If the user somehow has no code row, create one.
        last_sent_at = None
    else:
        last_sent_at = code_row["last_sent_at"]

    if last_sent_at is not None:
        delta_s = (datetime.utcnow() - last_sent_at).total_seconds()
        if delta_s < 60:
            retry_after = int(60 - delta_s)
            raise HTTPException(status_code=429, detail={"code": "RESEND_COOLDOWN", "retry_after_s": retry_after})

    code = _gen_6digit_code()
    code_hash = _hash_code(code)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    db.execute(
        text(
            """
            INSERT INTO email_verification_codes (user_id, code_hash, expires_at, last_sent_at)
            VALUES (:uid, :code_hash, :expires_at, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                code_hash = EXCLUDED.code_hash,
                expires_at = EXCLUDED.expires_at,
                last_sent_at = NOW(),
                attempts = 0
            """
        ),
        {"uid": int(user_id), "code_hash": code_hash, "expires_at": expires_at},
    )

    subject = f"Haylingua verification code: {code}"
    plain = (
        f"Welcome back to Haylingua, {user_row.get('name') or 'there'}!\n\n"
        f"Your verification code is: {code}\n"
        f"This code expires in 10 minutes.\n\n"
        "If you didn't request this, you can ignore this email."
    )
    email_sent = _send_email(
        to_email=user_row["email"],
        subject=subject,
        body=plain,
        html_body=_render_verification_email_html(user_row.get("name") or "", code),
    )

    response_data = ResendOut(ok=True, retry_after_s=60)
    
    # Dev-only: add the code to the response when explicitly enabled.
    if not email_sent and _expose_dev_codes():
        # Need to return dict instead of model to include verification_code
        response_data_dict = response_data.dict()
        response_data_dict["verification_code"] = code
        print(f"⚠️  DEV MODE: Including verification code in resend response: {code}")
        return response_data_dict

    return response_data
@router.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Connection = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT id, slug, title, description, level, xp, COALESCE(lesson_type, 'standard') as lesson_type, COALESCE(config, '{}'::jsonb) as config
            FROM lessons
            WHERE is_published = true
            ORDER BY level ASC, id ASC
            """
        )
    ).mappings().all()

    return [LessonOut(**dict(row)) for row in rows]


@router.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Connection = Depends(get_db)):
    lesson_row = db.execute(
        text("""
            SELECT id, slug, title, description, level, xp, COALESCE(lesson_type, 'standard') as lesson_type, COALESCE(config, '{}'::jsonb) as config
            FROM lessons
            WHERE slug = :slug
        """),
        {"slug": slug},
    ).mappings().first()

    if lesson_row is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    exercises_rows = db.execute(
        text("""
            SELECT
                id,
                kind,
                prompt,
                expected_answer,
                sentence_before,
                sentence_after,
                "order",
                config
            FROM exercises
            WHERE lesson_id = :lesson_id
            ORDER BY "order" ASC, id ASC
        """),
        {"lesson_id": lesson_row["id"]},
    ).mappings().all()

    ex_ids = [int(r["id"]) for r in exercises_rows]
    options_by_ex: dict[int, list[dict]] = {eid: [] for eid in ex_ids}
    lesson_dict: Dict[str, Any] = dict(lesson_row)
    lesson_dict["xp"] = sum(int(r.get("xp") or 0) for r in exercises_rows)
    
    if ex_ids:
        opt_rows = db.execute(
            text("""
                SELECT id, exercise_id, text, is_correct, side, match_key
                FROM exercise_options
                WHERE exercise_id = ANY(:ids)
                ORDER BY exercise_id ASC, id ASC
            """),
            {"ids": ex_ids},
        ).mappings().all()

        for o in opt_rows:
            options_by_ex[int(o["exercise_id"])].append(dict(o))

    
    exercises_out: list[dict] = []
    for r in exercises_rows:
        d = dict(r)
        d["options"] = options_by_ex.get(int(r["id"]), [])
        exercises_out.append(d)

    lesson_dict["exercises"] = [ExerciseOut(**e) for e in exercises_out]
    return LessonWithExercisesOut(**lesson_dict)


# --------- "Done" button: complete lesson & earn XP ---------

class LessonCompletePayload(BaseModel):
    # Keep this for backward compatibility (older FE might send email)
    email: str


@router.post("/lessons/{slug}/complete", response_model=StatsOut)
def complete_lesson(
    slug: str,
    payload: Optional[LessonCompletePayload] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """
    Supports BOTH:
    - New FE: Authorization: Bearer <token>, empty body
    - Old FE: JSON body { "email": "..." }
    """

    # 1) Determine user_id strictly from the Bearer token.
    # 🔒 SECURITY: the legacy `{"email": ...}` fallback was an unauthenticated
    # IDOR — anyone could complete lessons / award progress for any account just
    # by knowing its email. The email in the body (if any) is now ignored.
    user_id = _get_user_id_from_bearer(authorization, db)

    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")

    # Gate lesson completion for unverified accounts
    _require_verified(db, int(user_id))

    # Require email verification for awarding XP / completing lessons
    _require_verified(db, int(user_id))
        
    # 2) Find lesson
    lesson_row = db.execute(
        text(
            """
            SELECT id, xp
            FROM lessons
            WHERE slug = :slug
            """
        ),
        {"slug": slug},
    ).mappings().first()

    if lesson_row is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson_id = int(lesson_row["id"])

    # IMPORTANT: award XP based on what the user actually earned in this lesson,
    # not the lesson's theoretical max XP. This also prevents getting "full marks"
    # when only 70% completion is reached.
    progress = recompute_lesson_progress(db, int(user_id), lesson_id)
    xp_value = int(progress.get("earned_xp") or 0)

    # 3) Upsert into lesson_progress (no double-count protection here; your schema updates the same row)
    db.execute(
        text(
            """
            INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, completed_at)
            VALUES (:user_id, :lesson_id, :xp_earned, :completed_at)
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET
                xp_earned = EXCLUDED.xp_earned,
                completed_at = EXCLUDED.completed_at
            """
        ),
        {
            "user_id": user_id,
            "lesson_id": lesson_id,
            "xp_earned": xp_value,
            "completed_at": datetime.utcnow(),
        },
    )

    # 4) Recompute stats
    stats_row = db.execute(
        text(
            """
            SELECT
                COALESCE(SUM(xp_earned), 0) AS total_xp,
                COUNT(*) AS lessons_completed
            FROM lesson_progress
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    streak = _compute_streak_days(db, int(user_id))
    _brevo_sync_user(db, int(user_id), event="lesson_completed", event_props={
        "lesson_slug": slug,
        "xp_earned": xp_value,
        "streak": int(streak),
    })
    return StatsOut(
        total_xp=int(stats_row["total_xp"]),
        lessons_completed=int(stats_row["lessons_completed"]),
        streak=int(streak),
    )


@router.get("/me/stats", response_model=StatsOut)
def get_stats(
    email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Return current user's stats.

    Historically the frontend called this endpoint with `?email=...`.
    Email is now optional: if email is missing/blank we infer the user from the Bearer token.
    """

    # 🔒 SECURITY: resolve the user ONLY from the Bearer token. The legacy
    # `?email=` parameter let anyone read any user's stats and acted as an
    # account-existence/enumeration oracle. It is now ignored.
    user_id = _get_user_id_from_bearer(authorization, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")

    r = db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(lp.xp_earned), 0) AS total_xp,
              COALESCE(SUM(CASE WHEN lp.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS lessons_completed,
              COALESCE(SUM(CASE WHEN DATE(lp.completed_at AT TIME ZONE 'UTC') = CURRENT_DATE THEN lp.xp_earned ELSE 0 END), 0) AS today_xp
            FROM lesson_progress lp
            WHERE lp.user_id = :uid
            """
        ),
        {"uid": user_id},
    ).mappings().first()

    total_xp = int(r["total_xp"] or 0) if r else 0
    lessons_completed = int(r["lessons_completed"] or 0) if r else 0
    today_xp = int(r["today_xp"] or 0) if r else 0

    # Include claimed quest/achievement reward XP in the headline total.
    bonus = int(db.execute(text("SELECT COALESCE(bonus_xp, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0)
    total_xp += bonus

    streak = _compute_streak_days(db, user_id)

    return StatsOut(total_xp=total_xp, lessons_completed=lessons_completed, streak=streak, today_xp=today_xp)


class LessonProgressOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp_total: int
    xp_earned: int
    exercises_total: int
    exercises_completed: int
    completion_pct: float
    status: str  # completed | current | locked
    chapter_id: int | None = None
    chapter_title: str | None = None
    chapter_position: int | None = None


@router.get("/me/lessons/progress", response_model=list[LessonProgressOut])
def me_lessons_progress(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Dashboard helper: lessons joined with per-user progress and unlock state."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text(
            """
            WITH ex AS (
              SELECT lesson_id,
                     COUNT(*)::int AS exercises_total,
                     COALESCE(SUM(xp), 0)::int AS xp_total
              FROM exercises
              GROUP BY lesson_id
            )
            SELECT
              l.id,
              l.slug,
              l.title,
              l.description,
              l.level,
              COALESCE(ex.xp_total, COALESCE(l.xp, 0))::int AS xp_total,
              COALESCE(ex.exercises_total, 0)::int AS exercises_total,
              COALESCE(ulp.exercises_completed, 0)::int AS exercises_completed,
              COALESCE(ulp.xp_earned, 0)::int AS xp_earned,
              ulp.completed_at,
              l.chapter_id,
              c.title AS chapter_title,
              c.position AS chapter_position
            FROM lessons l
            LEFT JOIN ex ON ex.lesson_id = l.id
            LEFT JOIN chapters c ON c.id = l.chapter_id
            LEFT JOIN user_lesson_progress ulp
              ON ulp.lesson_id = l.id
             AND ulp.user_id = :u
            ORDER BY COALESCE(c.position, l.level) ASC, l.level ASC, l.id ASC
            """
        ),
        {"u": int(user_id)},
    ).mappings().all()

    out: list[LessonProgressOut] = []

    # Compute status: first is unlocked; next unlocks when previous is completed (>=70%).
    prev_completed = True  # allow first
    current_set = False
    for r in rows:
        exercises_total = int(r["exercises_total"] or 0)
        exercises_completed = int(r["exercises_completed"] or 0)
        xp_total = int(r["xp_total"] or 0)
        xp_earned = int(r["xp_earned"] or 0)

        pct = 0.0
        if exercises_total > 0:
            pct = round((exercises_completed / exercises_total) * 100.0, 2)

        is_completed = (pct >= 70.0) or (r.get("completed_at") is not None)

        if not prev_completed:
            status = "locked"
        else:
            if is_completed:
                status = "completed"
            else:
                if not current_set:
                    status = "current"
                    current_set = True
                else:
                    status = "locked"  # keep later ones locked until you finish the current

        # Unlock chaining uses "completed" only
        prev_completed = is_completed

        out.append(
            LessonProgressOut(
                id=int(r["id"]),
                slug=r["slug"],
                title=r["title"],
                description=r.get("description"),
                level=int(r["level"] or 1),
                xp_total=xp_total,
                xp_earned=xp_earned,
                exercises_total=exercises_total,
                exercises_completed=exercises_completed,
                completion_pct=float(pct),
                status=status,
                chapter_id=(int(r["chapter_id"]) if r.get("chapter_id") is not None else None),
                chapter_title=r.get("chapter_title"),
                chapter_position=(int(r["chapter_position"]) if r.get("chapter_position") is not None else None),
            )
        )

    return out

@router.post("/me/exercises/{exercise_id}/attempt", response_model=AttemptOut)
def record_exercise_attempt(
    exercise_id: int,
    payload: AttemptIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # Derive lesson_id from the exercise (FE historically didn't send it)
    ex_row = db.execute(
        text("SELECT lesson_id, kind, expected_answer, config FROM exercises WHERE id = :ex"),
        {"ex": exercise_id},
    ).mappings().first()
    if not ex_row:
        raise HTTPException(status_code=404, detail="Exercise not found")

    lesson_id = int(ex_row["lesson_id"])

    # 🔒 SECURITY: grade the attempt on the server. The client-supplied
    # `is_correct` is IGNORED — otherwise anyone could mint unlimited XP and
    # top the leaderboard by POSTing {"is_correct": true}.
    opt_rows = db.execute(
        text("SELECT text, is_correct FROM exercise_options WHERE exercise_id = :ex ORDER BY id ASC"),
        {"ex": exercise_id},
    ).mappings().all()
    is_correct = grade_attempt(
        kind=ex_row["kind"],
        expected_answer=ex_row["expected_answer"],
        config=ex_row["config"],
        options=[dict(o) for o in opt_rows],
        answer_text=payload.answer_text,
        selected_indices=payload.selected_indices,
    )
    if payload.lesson_id is not None and int(payload.lesson_id) != lesson_id:
        raise HTTPException(status_code=400, detail="lesson_id does not match exercise")

    # Ensure lesson exists (sanity)
    lesson = db.execute(text("SELECT id FROM lessons WHERE id = :id"), {"id": lesson_id}).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    _ensure_user_lesson_progress(db, user_id, lesson_id)

    # Insert attempt
    attempt_id = db.execute(
        text("""
            INSERT INTO user_exercise_attempts (
              user_id, lesson_id, exercise_id,
              attempt_no, is_correct,
              answer_text, selected_indices, time_ms
            )
            VALUES (
              :u, :l, :ex,
              :attempt_no, :ok,
              :answer_text, CAST(:selected_indices AS jsonb), :time_ms
            )
            RETURNING id
        """),
        {
            "u": user_id,
            "l": lesson_id,
            "ex": exercise_id,
            "attempt_no": int(payload.attempt_no or 1),
            "ok": bool(is_correct),
            "answer_text": payload.answer_text,
            "selected_indices": json.dumps(payload.selected_indices or []),
            "time_ms": payload.time_ms,
        },
    ).scalar_one()

    # Update progress counters + accuracy
    _update_progress_after_attempt(
        db=db,
        user_id=user_id,
        lesson_id=lesson_id,
        exercise_id=exercise_id,
        is_correct=bool(is_correct),
    )
    _update_review_queue(db, user_id, lesson_id, exercise_id, bool(is_correct))
    acc = _get_accuracy(db, user_id, lesson_id)

    # Snapshot XP + completion state before recompute (delta + first-time reward).
    prev_row = db.execute(
        text("SELECT xp_earned, completed_at FROM user_lesson_progress WHERE user_id = :uid AND lesson_id = :lid"),
        {"uid": user_id, "lid": lesson_id},
    ).mappings().first() or {}
    prev_xp = int(prev_row.get("xp_earned") or 0)
    was_completed = prev_row.get("completed_at") is not None

    # ✅ NEW: recompute lesson completion / xp-based progress
    progress = recompute_lesson_progress(db, user_id, lesson_id)

    earned_xp_delta = int(progress.get("earned_xp", 0)) - prev_xp
    if earned_xp_delta < 0:
        earned_xp_delta = 0

    # League: count this lesson's XP toward the user's weekly division total.
    _award_weekly_xp(db, user_id, earned_xp_delta)

    # Reward a chest the FIRST time a lesson is completed (not on replays), so
    # the gem economy can't be farmed by re-doing the same lesson.
    if bool(progress.get("completed")) and not was_completed:
        db.execute(text("UPDATE users SET chests = COALESCE(chests, 0) + 1 WHERE id = :u"), {"u": user_id})

    # Hearts: lose one on a wrong answer (with regen applied first); premium
    # users keep unlimited hearts. DB is the source of truth.
    if not bool(is_correct):
        hstate = _lose_heart(db, user_id)
    else:
        hstate = _hearts_state(db, user_id)

    return AttemptOut(
        ok=True,
        attempt_id=int(attempt_id),
        accuracy=acc,
        earned_xp=int(progress["earned_xp"]),
        earned_xp_delta=int(earned_xp_delta),
        completion_ratio=float(progress["completion_ratio"]),
        completed=bool(progress["completed"]),
        hearts_current=int(hstate["hearts_current"]),
        hearts_max=int(hstate["hearts_max"]),
        is_premium=bool(hstate["is_premium"]),
        next_regen_seconds=int(hstate["next_regen_seconds"]),
        )


@router.post("/me/exercises/{exercise_id}/log", response_model=LogOut)
def record_exercise_log(
    exercise_id: int,
    payload: LogIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # Derive lesson_id from DB when not provided by FE
    ex_row = db.execute(
        text("SELECT lesson_id FROM exercises WHERE id = :ex"),
        {"ex": exercise_id},
    ).mappings().first()
    if not ex_row:
        raise HTTPException(status_code=404, detail="Exercise not found")

    lesson_id = int(ex_row["lesson_id"])
    if payload.lesson_id is not None and int(payload.lesson_id) != lesson_id:
        raise HTTPException(status_code=400, detail="lesson_id mismatch")

    _ensure_user_lesson_progress(db, user_id, lesson_id)

    log_id = db.execute(
        text("""
            INSERT INTO user_exercise_logs (
              user_id, lesson_id, exercise_id,
              event_type, meta
            )
            VALUES (
              :u, :l, :ex,
              :event_type, CAST(:meta AS jsonb)
            )
            RETURNING id
        """),
        {
            "u": user_id,
            "l": lesson_id,
            "ex": exercise_id,
            "event_type": ((payload.event_type or payload.event or "").strip()[:64]),
            "meta": json.dumps(payload.meta or payload.payload or {}),
        },
    ).scalar_one()

    _touch_progress_after_log(db, user_id, lesson_id, exercise_id)

    return LogOut(ok=True, log_id=int(log_id))



@router.get("/me/learning/summary")
def me_learning_summary(
    days: int = 14,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    if days < 1: days = 1
    if days > 90: days = 90

    row = db.execute(
        text("""
            SELECT
              COUNT(*)::int AS attempts,
              SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct,
              ROUND( (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS accuracy
            FROM user_exercise_attempts
            WHERE user_id = :u
              AND created_at >= NOW() - (:days || ' days')::interval
        """),
        {"u": user_id, "days": days},
    ).mappings().first()

    return {
        "days": days,
        "attempts": int(row["attempts"] or 0),
        "correct": int(row["correct"] or 0),
        "accuracy": float(row["accuracy"] or 0.0),
    }
class MeOut(BaseModel):
    id: int
    email: str
    username: str | None = None

    # Names
    first_name: str | None = None
    last_name: str | None = None
    name: str | None = None  # display_name (legacy field name)

    # Profile customization
    bio: str | None = None
    avatar_url: str | None = None
    banner_url: str | None = None
    profile_theme: dict = {}
    friends_public: bool = True
    is_hidden: bool = False

    # Account
    email_verified: bool = False
    telegram_id: Optional[int] = None

    # Preferences
    voice_pref: str = "Random"

    # Stats
    total_xp: int = 0
    streak: int = 0
    today_xp: int = 0


class MeUpdateIn(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    profile_theme: dict | None = None
    friends_public: bool | None = None

def _recommend_next_exercise(db: Connection, user_id: int, lesson_id: int) -> dict:
    """
    Priority:
      1) Due review exercise from review_queue
      2) Weakest exercise by attempt accuracy/recency
      3) If none, lesson_complete
    Returns dict { status, exercise_id? }
    """
    # Load review queue
    progress = db.execute(
        text("""
            SELECT review_queue
            FROM user_lesson_progress
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"u": user_id, "l": lesson_id},
    ).mappings().first()

    queue = _json_default_list(progress["review_queue"] if progress else [])
    due_id = _pick_due_review(queue)
    if due_id:
        return {"status": "review_due", "exercise_id": due_id}

    # Compute "need_score" for exercises in this lesson
    rows = db.execute(
        text("""
            WITH stats AS (
              SELECT
                e.id AS exercise_id,
                COUNT(a.id)::int AS attempts,
                COALESCE(SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END), 0)::int AS correct,
                MAX(a.created_at) AS last_attempt_at
              FROM exercises e
              LEFT JOIN user_exercise_attempts a
                ON a.exercise_id = e.id
               AND a.user_id = :u
               AND a.lesson_id = :l
              WHERE e.lesson_id = :l
              GROUP BY e.id
            )
            SELECT
              exercise_id,
              attempts,
              correct,
              last_attempt_at
            FROM stats
        """),
        {"u": user_id, "l": lesson_id},
    ).mappings().all()

    if not rows:
        return {"status": "lesson_empty"}

    # Score in Python (adds complexity + readable)
    now = _now_utc()
    scored = []
    for r in rows:
        attempts = int(r["attempts"] or 0)
        correct = int(r["correct"] or 0)
        accuracy = (correct / attempts) if attempts > 0 else 0.0

        last = r["last_attempt_at"]
        if last is None:
            days_since = 999
        else:
            days_since = (now - last).total_seconds() / 86400.0

        recency_factor = _clamp(days_since / 7.0, 0.0, 1.0)
        low_attempts_bonus = 1.0 if attempts < 2 else 0.0

        need_score = ((1 - accuracy) * 0.65) + (recency_factor * 0.25) + (low_attempts_bonus * 0.10)

        scored.append({
            "exercise_id": int(r["exercise_id"]),
            "need_score": float(need_score),
            "attempts": attempts,
            "accuracy": accuracy,
        })

    scored.sort(key=lambda x: x["need_score"], reverse=True)
    best = scored[0]

    # If everything mastered (high accuracy & enough attempts), declare complete
    # tweakable threshold
    if best["attempts"] >= 3 and best["accuracy"] >= 0.9:
        return {"status": "lesson_complete"}

    return {"status": "practice", "exercise_id": best["exercise_id"]}

class PlacementPayload(BaseModel):
    lesson_ids: List[int]

@router.post("/me/placement")
def me_placement(
    payload: PlacementPayload,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """
    Mark a set of lessons as 'placed' (completed via placement test, 0 XP).
    Called when the adaptive test converges and the user confirms their starting point.
    Inserts/updates user_lesson_progress with completed_at=NOW() and xp_earned=0
    for every lesson_id in the list, filling exercises_completed = exercises_total.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    _require_verified(db, int(user_id))

    ids = [int(i) for i in payload.lesson_ids if i]
    if not ids:
        return {"placed": 0}

    # Get exercise counts per lesson so we can set completion to 100%
    count_rows = db.execute(
        text("SELECT lesson_id, COUNT(*)::int AS cnt FROM exercises WHERE lesson_id = ANY(:ids) GROUP BY lesson_id"),
        {"ids": ids},
    ).mappings().all()
    counts = {int(r["lesson_id"]): int(r["cnt"]) for r in count_rows}

    for lid in ids:
        total = counts.get(lid, 1)
        db.execute(
            text("""
                INSERT INTO user_lesson_progress
                    (user_id, lesson_id, exercises_total, exercises_completed, xp_earned, last_seen_at, completed_at)
                VALUES (:u, :l, :tot, :tot, 0, NOW(), NOW())
                ON CONFLICT (user_id, lesson_id) DO UPDATE SET
                    exercises_total     = EXCLUDED.exercises_total,
                    exercises_completed = EXCLUDED.exercises_completed,
                    completed_at        = COALESCE(user_lesson_progress.completed_at, NOW()),
                    last_seen_at        = NOW()
            """),
            {"u": user_id, "l": lid, "tot": total},
        )

    return {"placed": len(ids)}


@router.get("/me/checkpoint")
def me_checkpoint(
    lesson_ids: str = "",
    count: int = 15,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """
    Return a shuffled sample of exercises from a list of lessons for a checkpoint test.
    Query params:
      - lesson_ids: comma-separated list of lesson IDs
      - count: how many exercises to return (default 15)
    Only includes exercises the user has attempted at least once (familiar content).
    Falls back to any exercises in the lessons if no attempts exist yet.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # Parse lesson_ids
    try:
        ids = [int(x.strip()) for x in lesson_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson_ids")

    if not ids:
        raise HTTPException(status_code=400, detail="lesson_ids required")

    count = max(5, min(count, 30))

    # Prefer exercises the user has actually attempted
    tried_rows = db.execute(
        text("""
            SELECT DISTINCT e.id AS exercise_id
            FROM exercises e
            JOIN user_exercise_attempts a ON a.exercise_id = e.id AND a.user_id = :u
            WHERE e.lesson_id = ANY(:ids)
            ORDER BY e.id
        """),
        {"u": user_id, "ids": ids},
    ).mappings().all()

    ex_ids = [int(r["exercise_id"]) for r in tried_rows]

    if len(ex_ids) < count:
        # Supplement with unattempted exercises
        extra = db.execute(
            text("""
                SELECT id AS exercise_id
                FROM exercises
                WHERE lesson_id = ANY(:ids)
                  AND (cardinality(:tried::integer[]) = 0 OR id <> ALL(:tried::integer[]))
                ORDER BY id
            """),
            {"ids": ids, "tried": ex_ids if ex_ids else []},
        ).mappings().all()
        ex_ids += [int(r["exercise_id"]) for r in extra]

    if not ex_ids:
        return {"exercises": [], "message": "No exercises found for these lessons."}

    # Shuffle and cap
    random.shuffle(ex_ids)
    ex_ids = ex_ids[:count]

    # Fetch exercise objects
    ex_rows = db.execute(
        text("""
            SELECT id, lesson_id, kind, prompt, expected_answer, sentence_before, sentence_after, "order", config
            FROM exercises
            WHERE id = ANY(:ids)
        """),
        {"ids": ex_ids},
    ).mappings().all()

    ex_map = {int(r["id"]): dict(r) for r in ex_rows}

    opt_rows = db.execute(
        text("""
            SELECT id, exercise_id, text, is_correct, side, match_key
            FROM exercise_options
            WHERE exercise_id = ANY(:ids)
            ORDER BY exercise_id ASC, id ASC
        """),
        {"ids": ex_ids},
    ).mappings().all()

    options_by_ex: dict[int, list[dict]] = {eid: [] for eid in ex_ids}
    for o in opt_rows:
        eid = int(o["exercise_id"])
        if eid in options_by_ex:
            options_by_ex[eid].append(dict(o))

    exercises_out = [
        {**ex_map[eid], "options": options_by_ex.get(eid, [])}
        for eid in ex_ids
        if eid in ex_map
    ]

    return {"exercises": exercises_out}


@router.get("/me/practice")
def me_practice(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """
    Return a set of exercises for the cross-lesson practice mode.
    Priority:
      1. Exercises due for spaced-repetition review (any lesson)
      2. Exercises with lowest accuracy across all completed lessons (up to 10 total)
    Returns full exercise objects with options, ready for ExerciseRenderer.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # 1. Collect due review exercise IDs from all lessons the user has started
    progress_rows = db.execute(
        text("""
            SELECT lesson_id, review_queue
            FROM user_lesson_progress
            WHERE user_id = :u AND review_queue IS NOT NULL
        """),
        {"u": user_id},
    ).mappings().all()

    due_ids: list[int] = []
    for row in progress_rows:
        q = _json_default_list(row["review_queue"])
        eid = _pick_due_review(q)
        if eid and eid not in due_ids:
            due_ids.append(eid)

    # 2. Find weak exercises from completed lessons (limit to top-N by need score)
    weak_rows = db.execute(
        text("""
            WITH stats AS (
              SELECT
                e.id AS exercise_id,
                COUNT(a.id)::int AS attempts,
                COALESCE(SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END), 0)::int AS correct,
                MAX(a.created_at) AS last_attempt_at
              FROM exercises e
              JOIN user_lesson_progress ulp ON ulp.lesson_id = e.lesson_id AND ulp.user_id = :u
              LEFT JOIN user_exercise_attempts a
                ON a.exercise_id = e.id AND a.user_id = :u
              GROUP BY e.id
            )
            SELECT exercise_id, attempts, correct, last_attempt_at
            FROM stats
            WHERE attempts > 0
            ORDER BY (CAST(correct AS float) / attempts) ASC, last_attempt_at ASC NULLS FIRST
            LIMIT 20
        """),
        {"u": user_id},
    ).mappings().all()

    now = _now_utc()
    scored = []
    for r in weak_rows:
        attempts = int(r["attempts"] or 0)
        correct = int(r["correct"] or 0)
        accuracy = (correct / attempts) if attempts > 0 else 0.0
        last = r["last_attempt_at"]
        days_since = (now - last).total_seconds() / 86400.0 if last else 999.0
        recency = _clamp(days_since / 7.0, 0.0, 1.0)
        need_score = (1 - accuracy) * 0.7 + recency * 0.3
        scored.append((int(r["exercise_id"]), need_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    weak_ids = [eid for eid, _ in scored[:10] if eid not in due_ids]

    # Combine: due reviews first, then weak
    all_ids = due_ids + weak_ids
    if not all_ids:
        return {"exercises": [], "message": "Nothing to practice right now — you're all caught up!"}

    # Fetch full exercise objects
    ex_rows = db.execute(
        text("""
            SELECT id, lesson_id, kind, prompt, expected_answer, sentence_before, sentence_after, "order", config
            FROM exercises
            WHERE id = ANY(:ids)
        """),
        {"ids": all_ids},
    ).mappings().all()

    ex_map = {int(r["id"]): dict(r) for r in ex_rows}

    # Fetch options for all exercises
    opt_rows = db.execute(
        text("""
            SELECT id, exercise_id, text, is_correct, side, match_key
            FROM exercise_options
            WHERE exercise_id = ANY(:ids)
            ORDER BY exercise_id ASC, id ASC
        """),
        {"ids": all_ids},
    ).mappings().all()

    options_by_ex: dict[int, list[dict]] = {eid: [] for eid in all_ids}
    for o in opt_rows:
        eid = int(o["exercise_id"])
        if eid in options_by_ex:
            options_by_ex[eid].append(dict(o))

    # Build output in priority order
    exercises_out = []
    for eid in all_ids:
        ex = ex_map.get(eid)
        if ex:
            ex["options"] = options_by_ex.get(eid, [])
            exercises_out.append(ex)

    return {"exercises": exercises_out}


@router.get("/me/activity")
def me_activity(
    days: int = 7,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """
    Returns daily counts for the last N days (default 7).
    Currently counts LESSON completions (lesson_progress rows).
    Output:
      [{"day":"M","value":2}, ...]
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing credentials")

    if days < 1:
        days = 1
    if days > 30:
        days = 30

    # Build a date series in Python to keep it simple and stable
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)

    rows = db.execute(
        text(
            """
            SELECT
              DATE(completed_at) AS d,
              COUNT(*)::int AS c
            FROM lesson_progress
            WHERE user_id = :user_id
              AND completed_at >= :start_dt
            GROUP BY DATE(completed_at)
            ORDER BY d ASC
            """
        ),
        {"user_id": user_id, "start_dt": start},
    ).mappings().all()

    counts_by_date = {r["d"]: int(r["c"]) for r in rows}

    # Map to your UI labels M T W T F S S
    # (Monday=0 ... Sunday=6)
    labels = ["M", "T", "W", "T", "F", "S", "S"]

    out: List[Dict[str, int | str]] = []
    for i in range(days):
        d = start + timedelta(days=i)
        label = labels[d.weekday()]
        out.append({"date": d.isoformat(), "label": label, "value": counts_by_date.get(d, 0)})

    # FE expects a stable wrapper for forwards/backwards compatibility
    return {"days": out}

@router.get("/me/profile", response_model=MeOut)
def me_profile_get(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    row = db.execute(
        text("SELECT id, email, username, display_name, first_name, last_name, bio, avatar_url, banner_url, profile_theme, friends_public, is_hidden, email_verified, telegram_id FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="User not found")

    stats_row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(xp_earned), 0) AS total_xp
            FROM lesson_progress
            WHERE user_id = :u
            """
        ),
        {"u": user_id},
    ).mappings().first()

    ob_row = db.execute(
        text("SELECT voice_pref FROM user_onboarding WHERE user_id = :u LIMIT 1"),
        {"u": user_id},
    ).mappings().first()

    streak = _compute_streak_days(db, int(user_id))
    payload = dict(row)
    payload["total_xp"] = int(stats_row["total_xp"] or 0)
    payload["streak"] = int(streak)
    payload["voice_pref"] = (ob_row or {}).get("voice_pref") or "Random"
    return MeOut(**payload)


@router.get("/me/hearts")
def me_hearts(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Returns the current hearts (lives) state for the logged-in user."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    return _hearts_state(db, user_id)


STREAK_FREEZE_CAP = 2


@router.get("/me/streak")
def me_streak(authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    """Current streak + owned streak freezes."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    streak = _compute_streak_days(db, user_id)
    urow = db.execute(
        text("SELECT COALESCE(streak_freezes, 0) AS f, COALESCE(streak_frozen_days, '[]'::jsonb) AS fd FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first() or {}
    freezes = int(urow.get("f") or 0)
    frozen_raw = urow.get("fd") or []
    if isinstance(frozen_raw, str):
        try:
            frozen_raw = json.loads(frozen_raw)
        except Exception:
            frozen_raw = []
    frozen_days = {str(x) for x in (frozen_raw or [])}

    today = datetime.utcnow().date()
    practiced_today = bool(
        db.execute(
            text("SELECT 1 FROM user_exercise_attempts WHERE user_id = :u AND DATE(created_at) = :d LIMIT 1"),
            {"u": user_id, "d": today},
        ).scalar()
    )
    # The streak is currently "frozen" when it's alive only because a freeze
    # bridged yesterday's missed day and today's practice isn't done yet.
    yesterday = (today - timedelta(days=1)).isoformat()
    frozen = bool(streak > 0 and not practiced_today and yesterday in frozen_days)

    return {
        "streak": streak,
        "freezes": freezes,
        "freeze_cap": STREAK_FREEZE_CAP,
        "practiced_today": practiced_today,
        "frozen": frozen,
    }


@router.post("/me/streak/freeze")
def me_streak_freeze(authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    """DEPRECATED: streak freezes are no longer granted for free.
    Purchase them from the shop (POST /me/shop/buy with item 'streak_freeze'),
    which charges gems. This endpoint is kept only so old clients get a clear
    error instead of a silent free grant."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    raise HTTPException(status_code=400, detail="Streak freezes are available in the shop.")


# ==========================================================================
# Economy: gems currency, random chests, marketplace
# ==========================================================================

# Grant effects a shop item can have (the backend knows how to apply these).
SHOP_EFFECTS = {"streak_freeze", "hearts_refill", "xp_boost"}

# Fallbacks used only if the DB tables are missing/empty (defensive).
_FALLBACK_CHEST = [(10, 30), (15, 25), (20, 18), (25, 12), (30, 8), (40, 5), (60, 2)]
_FALLBACK_SHOP = [
    {"id": "streak_freeze", "title": "Streak Freeze", "desc": "Protects your streak from one missed day.", "price": 50, "icon": "snowflake", "effect": "streak_freeze", "effect_amount": 0},
    {"id": "hearts_refill", "title": "Refill Hearts", "desc": "Restore all your hearts instantly.", "price": 30, "icon": "heart", "effect": "hearts_refill", "effect_amount": 0},
    {"id": "xp_boost", "title": "XP Boost", "desc": "Instantly add 15 XP to your total.", "price": 20, "icon": "zap", "effect": "xp_boost", "effect_amount": 15},
]


def _load_shop_items(db: Connection) -> list[dict]:
    try:
        rows = db.execute(
            text(
                """
                SELECT id, title, description, icon, price, effect, effect_amount
                FROM shop_items WHERE COALESCE(is_active, TRUE)
                ORDER BY sort_order ASC, id ASC
                """
            )
        ).mappings().all()
    except Exception:
        rows = []
    if not rows:
        return [dict(it) for it in _FALLBACK_SHOP]
    return [
        {
            "id": r["id"], "title": r["title"], "desc": r.get("description") or "",
            "icon": r.get("icon") or "gem", "price": int(r["price"]),
            "effect": r["effect"], "effect_amount": int(r.get("effect_amount") or 0),
        }
        for r in rows
    ]


def _load_chest_rewards(db: Connection) -> list[tuple]:
    try:
        rows = db.execute(text("SELECT gems, weight FROM chest_rewards ORDER BY sort_order ASC, id ASC")).mappings().all()
        out = [(int(r["gems"]), max(1, int(r["weight"]))) for r in rows if int(r["weight"]) > 0]
        if out:
            return out
    except Exception:
        pass
    return _FALLBACK_CHEST


def _wallet(db: Connection, user_id: int) -> dict:
    row = db.execute(
        text("SELECT COALESCE(gems, 0) AS gems, COALESCE(chests, 0) AS chests FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first() or {}
    return {"gems": int(row.get("gems") or 0), "chests": int(row.get("chests") or 0)}


@router.get("/me/wallet")
def me_wallet(authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return _wallet(db, user_id)


@router.post("/me/chests/open")
def me_open_chest(authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    """Open one owned chest → a random gem reward (server-authoritative)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    rewards = _load_chest_rewards(db)
    amounts = [a for a, _ in rewards]
    weights = [w for _, w in rewards]
    reward = int(random.choices(amounts, weights=weights, k=1)[0])

    # Atomic decrement: only succeeds if the user actually has a chest.
    # Prevents double-tap races from awarding two rewards from one chest.
    opened = db.execute(
        text("UPDATE users SET chests = chests - 1, gems = COALESCE(gems, 0) + :r WHERE id = :u AND COALESCE(chests, 0) > 0"),
        {"r": reward, "u": user_id},
    )
    if opened.rowcount == 0:
        raise HTTPException(status_code=400, detail="No chests to open")
    w = _wallet(db, user_id)
    _brevo_sync_user(db, int(user_id), event="chest_opened", event_props={"gems_won": reward})
    return {"ok": True, "reward_gems": reward, **w}


@router.get("/me/shop")
def me_shop(authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    w = _wallet(db, user_id)
    items = [
        {"id": it["id"], "title": it["title"], "desc": it["desc"], "icon": it["icon"], "price": it["price"], "affordable": w["gems"] >= it["price"]}
        for it in _load_shop_items(db)
    ]
    return {"gems": w["gems"], "items": items}


@router.post("/me/shop/buy")
def me_shop_buy(payload: Dict[str, Any] = Body(default=None), authorization: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    raw_id = (payload or {}).get("item")
    item = next((it for it in _load_shop_items(db) if str(it["id"]) == str(raw_id)), None)
    if not item:
        raise HTTPException(status_code=400, detail="Unknown item")

    price = int(item["price"])
    effect = item["effect"]
    amount = int(item.get("effect_amount") or 0)

    # Validate that the grant would be useful (pre-flight check, non-atomic).
    if effect == "streak_freeze":
        cur = int(db.execute(text("SELECT COALESCE(streak_freezes, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0)
        if cur >= STREAK_FREEZE_CAP:
            raise HTTPException(status_code=400, detail="You already have the maximum streak freezes")
    elif effect == "hearts_refill":
        hs = _hearts_state(db, user_id)
        if hs.get("is_premium"):
            raise HTTPException(status_code=400, detail="Premium already has unlimited hearts")
        if int(hs.get("hearts_current") or 0) >= int(hs.get("hearts_max") or 0):
            raise HTTPException(status_code=400, detail="Your hearts are already full")

    # Atomic charge: deduct gems only if balance is sufficient. This prevents
    # a double-tap race where two concurrent requests both pass the pre-flight check.
    charged = db.execute(
        text("UPDATE users SET gems = COALESCE(gems, 0) - :p WHERE id = :u AND COALESCE(gems, 0) >= :p"),
        {"p": price, "u": user_id},
    )
    if charged.rowcount == 0:
        raise HTTPException(status_code=400, detail="Not enough gems")

    if effect == "streak_freeze":
        db.execute(text("UPDATE users SET streak_freezes = LEAST(COALESCE(streak_freezes, 0) + 1, :cap) WHERE id = :u"), {"u": user_id, "cap": STREAK_FREEZE_CAP})
    elif effect == "hearts_refill":
        db.execute(text("UPDATE users SET hearts_current = COALESCE(hearts_max, :mx), last_heart_lost_at = NULL WHERE id = :u"), {"u": user_id, "mx": DEFAULT_HEARTS_MAX})
    elif effect == "xp_boost":
        amt = amount if amount > 0 else 15
        db.execute(text("UPDATE users SET bonus_xp = COALESCE(bonus_xp, 0) + :a WHERE id = :u"), {"a": amt, "u": user_id})
        _award_weekly_xp(db, user_id, amt)

    result = {"ok": True, "item": item["id"], **_wallet(db, user_id)}
    _brevo_sync_user(db, int(user_id), event="shop_purchase", event_props={
        "item_title": item["title"],
        "effect": effect,
        "price_gems": price,
    })
    return result


# ----------------------------
# Premium (unlimited hearts). Payment is SIMULATED for now — replace
# /me/premium/checkout with a real Stripe webhook later.
# ----------------------------

@router.get("/me/premium")
def me_premium_status(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    row = db.execute(
        text("SELECT COALESCE(is_premium, FALSE) AS is_premium, premium_since FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first()
    return {
        "is_premium": bool(row and row["is_premium"]),
        "premium_since": (row["premium_since"].isoformat() if row and row["premium_since"] else None),
    }


@router.post("/me/premium/checkout")
def me_premium_checkout(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """SIMULATED purchase — no real charge. Activates premium immediately.

    TODO: replace with Stripe Checkout + webhook before going live.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    db.execute(
        text(
            """
            UPDATE users
            SET is_premium = TRUE, premium_since = COALESCE(premium_since, NOW())
            WHERE id = :u
            """
        ),
        {"u": user_id},
    )
    st = _hearts_state(db, user_id)
    return {"ok": True, **st}


# ----------------------------
# Daily quests + achievements (computed from existing activity)
# ----------------------------

def _today_key() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def _claimed_keys(db: Connection, user_id: int, kind: str) -> set:
    return set(
        db.execute(
            text("SELECT claim_key FROM reward_claims WHERE user_id = :u AND kind = :k"),
            {"u": user_id, "k": kind},
        ).scalars().all()
    )


def _compute_quests(db: Connection, user_id: int) -> list:
    row = db.execute(
        text(
            """
            SELECT COUNT(*) FILTER (WHERE is_correct) AS correct_today,
                   COUNT(*) AS attempts_today,
                   COUNT(DISTINCT lesson_id) AS lessons_today
            FROM user_exercise_attempts
            WHERE user_id = :u AND created_at >= CURRENT_DATE
            """
        ),
        {"u": user_id},
    ).mappings().first() or {}
    correct = int(row.get("correct_today") or 0)
    attempts = int(row.get("attempts_today") or 0)
    lessons = int(row.get("lessons_today") or 0)
    quests = [
        {"id": "correct10", "title": "Sharp shooter", "desc": "Get 10 correct answers", "icon": "target", "progress": min(correct, 10), "target": 10, "reward_xp": 15},
        {"id": "lessons2", "title": "Daily practice", "desc": "Practice 2 lessons", "icon": "crown", "progress": min(lessons, 2), "target": 2, "reward_xp": 20},
        {"id": "attempts20", "title": "Warm up", "desc": "Answer 20 questions", "icon": "zap", "progress": min(attempts, 20), "target": 20, "reward_xp": 10},
    ]
    for q in quests:
        q["done"] = q["progress"] >= q["target"]
    return quests


def _compute_achievements(db: Connection, user_id: int) -> list:
    lp = db.execute(
        text(
            """
            SELECT COALESCE(SUM(xp_earned), 0) AS total_xp,
                   COUNT(DISTINCT lesson_id) FILTER (WHERE completed_at IS NOT NULL) AS lessons_completed
            FROM user_lesson_progress WHERE user_id = :u
            """
        ),
        {"u": user_id},
    ).mappings().first() or {}
    correct_total = int(
        db.execute(
            text("SELECT COUNT(*) FILTER (WHERE is_correct) FROM user_exercise_attempts WHERE user_id = :u"),
            {"u": user_id},
        ).scalar() or 0
    )
    streak = _compute_streak_days(db, user_id)
    total_xp = int(lp.get("total_xp") or 0)
    lessons = int(lp.get("lessons_completed") or 0)

    # Extra metrics (guarded — schema may differ across environments).
    def _scalar(sql: str) -> int:
        try:
            return int(db.execute(text(sql), {"u": user_id}).scalar() or 0)
        except Exception:
            return 0

    days_active = _scalar("SELECT COUNT(DISTINCT DATE(created_at)) FROM user_exercise_attempts WHERE user_id = :u")
    friends_count = _scalar("SELECT COUNT(*) FROM friends WHERE user_id = :u OR friend_id = :u")
    gems = _scalar("SELECT COALESCE(gems, 0) FROM users WHERE id = :u")
    chapters_completed = _scalar(
        """
        SELECT COUNT(*) FROM (
          SELECT l.chapter_id
          FROM lessons l
          WHERE l.chapter_id IS NOT NULL AND COALESCE(l.is_published, TRUE)
          GROUP BY l.chapter_id
          HAVING COUNT(*) = COUNT(*) FILTER (
            WHERE l.id IN (
              SELECT lesson_id FROM user_lesson_progress
              WHERE user_id = :u AND completed_at IS NOT NULL
            )
          )
        ) t
        """
    )

    # Map each configurable metric to the learner's current value.
    metric_values = {
        "lessons_completed": lessons,
        "streak_days": streak,
        "total_xp": total_xp,
        "correct_answers": correct_total,
        "days_active": days_active,
        "friends_count": friends_count,
        "chapters_completed": chapters_completed,
        "gems": gems,
    }

    # Achievements are CMS-editable rows in achievement_defs. Fall back to the
    # original built-ins if the table is missing/empty (defensive).
    rows = []
    try:
        rows = db.execute(
            text(
                """
                SELECT key, title, description, icon,
                       COALESCE(color, '#F59E0B') AS color,
                       metric, threshold, reward_xp
                FROM achievement_defs
                WHERE COALESCE(is_active, TRUE)
                ORDER BY sort_order ASC, id ASC
                """
            )
        ).mappings().all()
    except Exception:
        rows = []

    if not rows:
        rows = [
            {"key": "first_lesson", "title": "First Steps", "description": "Complete your first lesson", "icon": "star", "metric": "lessons_completed", "threshold": 1, "reward_xp": 20},
            {"key": "five_lessons", "title": "Getting Going", "description": "Complete 5 lessons", "icon": "crown", "metric": "lessons_completed", "threshold": 5, "reward_xp": 40},
            {"key": "streak7", "title": "On Fire", "description": "Reach a 7-day streak", "icon": "flame", "metric": "streak_days", "threshold": 7, "reward_xp": 50},
            {"key": "streak30", "title": "Unstoppable", "description": "Reach a 30-day streak", "icon": "flame", "metric": "streak_days", "threshold": 30, "reward_xp": 150},
            {"key": "xp500", "title": "Word Collector", "description": "Earn 500 XP", "icon": "zap", "metric": "total_xp", "threshold": 500, "reward_xp": 30},
            {"key": "xp2000", "title": "Scholar", "description": "Earn 2000 XP", "icon": "zap", "metric": "total_xp", "threshold": 2000, "reward_xp": 80},
            {"key": "correct100", "title": "Sharp Mind", "description": "Answer 100 questions correctly", "icon": "target", "metric": "correct_answers", "threshold": 100, "reward_xp": 40},
        ]

    out = []
    for r in rows:
        m = int(metric_values.get(r["metric"], 0))
        t = int(r["threshold"] or 0)
        out.append({
            "id": r["key"],
            "title": r["title"],
            "desc": r.get("description") or "",
            "icon": r.get("icon") or "star",
            "color": r.get("color") or "#F59E0B",
            "progress": min(m, t) if t else m,
            "target": t,
            "earned": (m >= t) if t else False,
            "reward_xp": int(r.get("reward_xp") or 0),
        })
    return out


@router.get("/me/quests")
def me_quests(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Today's quests (challenges), derived from today's exercise attempts (UTC)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    quests = _compute_quests(db, user_id)
    today = _today_key()
    claimed = _claimed_keys(db, user_id, "quest")
    for q in quests:
        q["claimed"] = f"{q['id']}:{today}" in claimed
        q["claimable"] = q["done"] and not q["claimed"]

    return {
        "quests": quests,
        "completed": sum(1 for q in quests if q["done"]),
        "total": len(quests),
        "claimable": sum(1 for q in quests if q["claimable"]),
    }


@router.get("/me/achievements")
def me_achievements(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Milestone badges, derived from cumulative stats."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    ach = _compute_achievements(db, user_id)
    claimed = _claimed_keys(db, user_id, "achievement")
    for a in ach:
        a["claimed"] = a["id"] in claimed
        a["claimable"] = a["earned"] and not a["claimed"]

    return {
        "achievements": ach,
        "earned": sum(1 for a in ach if a["earned"]),
        "total": len(ach),
        "claimable": sum(1 for a in ach if a["claimable"]),
    }


@router.post("/me/rewards/claim")
def me_rewards_claim(
    payload: Dict[str, Any] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Claim the XP reward for a completed quest or achievement (once each)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    kind = str((payload or {}).get("kind") or "").strip()
    item_id = str((payload or {}).get("id") or "").strip()
    if kind not in ("quest", "achievement") or not item_id:
        raise HTTPException(status_code=400, detail="Invalid claim")

    if kind == "quest":
        item = next((q for q in _compute_quests(db, user_id) if q["id"] == item_id), None)
        done = bool(item and item["done"])
        claim_key = f"{item_id}:{_today_key()}"
    else:
        item = next((a for a in _compute_achievements(db, user_id) if a["id"] == item_id), None)
        done = bool(item and item["earned"])
        claim_key = item_id

    if not item:
        raise HTTPException(status_code=404, detail="Unknown reward")
    if not done:
        raise HTTPException(status_code=400, detail="Not completed yet")

    reward = int(item.get("reward_xp") or 0)
    res = db.execute(
        text(
            """
            INSERT INTO reward_claims (user_id, kind, claim_key, reward_xp)
            VALUES (:u, :k, :ck, :r)
            ON CONFLICT (user_id, kind, claim_key) DO NOTHING
            """
        ),
        {"u": user_id, "k": kind, "ck": claim_key, "r": reward},
    )
    newly = (res.rowcount or 0) > 0
    if newly and reward > 0:
        db.execute(text("UPDATE users SET bonus_xp = COALESCE(bonus_xp, 0) + :r WHERE id = :u"), {"r": reward, "u": user_id})
        _award_weekly_xp(db, user_id, reward)  # also counts toward the weekly league

    if newly:
        _brevo_sync_user(db, int(user_id), event="reward_claimed", event_props={
            "kind": kind,
            "claim_key": claim_key,
            "reward_xp": reward,
        })
    return {"ok": True, "claimed": True, "newly_claimed": newly, "reward_xp": (reward if newly else 0)}


@router.get("/me/league")
def me_league(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """The user's current weekly league board (their division cohort) + a
    friends board (the user + friends ranked by this week's XP)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    wk = _current_iso_week()
    me = db.execute(
        text("SELECT league_tier, league_week, league_cohort FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first() or {}
    tier = int(me.get("league_tier") or 0)
    joined = (me.get("league_week") == wk and me.get("league_cohort") is not None)

    division = []
    if joined:
        rows = db.execute(
            text(
                """
                SELECT id AS user_id, username,
                       COALESCE(NULLIF(display_name, ''), username, split_part(email, '@', 1)) AS name,
                       avatar_url, COALESCE(weekly_xp, 0) AS weekly_xp
                FROM users
                WHERE league_tier = :t AND league_week = :wk AND league_cohort = :c
                  AND NOT COALESCE(is_hidden, FALSE)
                ORDER BY weekly_xp DESC, id ASC
                LIMIT :cap
                """
            ),
            {"t": tier, "wk": wk, "c": int(me["league_cohort"]), "cap": LEAGUE_COHORT_SIZE},
        ).mappings().all()
        division = [{**dict(r), "rank": i + 1, "is_self": int(r["user_id"]) == user_id} for i, r in enumerate(rows)]

    friends_rows = db.execute(
        text(
            """
            WITH fids AS (
              SELECT friend_id AS id FROM friends WHERE user_id = :u
              UNION SELECT :u AS id
            )
            SELECT u.id AS user_id, u.username,
                   COALESCE(NULLIF(u.display_name, ''), u.username, split_part(u.email, '@', 1)) AS name,
                   u.avatar_url,
                   CASE WHEN u.league_week = :wk THEN COALESCE(u.weekly_xp, 0) ELSE 0 END AS weekly_xp
            FROM users u JOIN fids ON fids.id = u.id
            WHERE NOT COALESCE(u.is_hidden, FALSE)
            ORDER BY weekly_xp DESC, u.id ASC
            """
        ),
        {"u": user_id, "wk": wk},
    ).mappings().all()
    friends = [{**dict(r), "rank": i + 1, "is_self": int(r["user_id"]) == user_id} for i, r in enumerate(friends_rows)]

    return {
        "tier": tier,
        "tier_name": LEAGUE_TIERS[min(tier, len(LEAGUE_TIERS) - 1)],
        "max_tier": len(LEAGUE_TIERS) - 1,
        "joined": joined,
        "days_left": 7 - datetime.utcnow().isoweekday(),  # Mon=1..Sun=7
        "seconds_left": _week_seconds_left(),
        "promote_top": LEAGUE_PROMOTE_TOP,
        "demote_bottom": (LEAGUE_DEMOTE_BOTTOM if tier > 0 else 0),
        "division": division,
        "has_friends": len(friends) > 1,
        "friends": friends,
    }


@router.post("/me/exercises/{exercise_id}/report")
def report_exercise(
    exercise_id: int,
    payload: Dict[str, Any] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Learner flags a problem with an exercise (wrong answer, bad audio, …)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    reason = str((payload or {}).get("reason") or "other").strip()[:60]
    detail = str((payload or {}).get("detail") or "").strip()[:1000]
    answer_text = str((payload or {}).get("answer_text") or "").strip()[:1000] or None

    lesson_id = db.execute(
        text("SELECT lesson_id FROM exercises WHERE id = :ex"), {"ex": exercise_id}
    ).scalar()

    db.execute(
        text(
            """
            INSERT INTO exercise_reports (user_id, exercise_id, lesson_id, reason, detail, answer_text)
            VALUES (:u, :ex, :l, :reason, :detail, :answer)
            """
        ),
        {"u": user_id, "ex": exercise_id, "l": lesson_id, "reason": reason, "detail": detail, "answer": answer_text},
    )
    return {"ok": True}


# ----------------------------
# Account: data export + deletion (GDPR self-service)
# ----------------------------

def _tables_with_user_id(db: Connection) -> list:
    return list(
        db.execute(
            text(
                """
                SELECT table_name FROM information_schema.columns
                WHERE table_schema = 'public' AND column_name = 'user_id'
                ORDER BY table_name
                """
            )
        ).scalars().all()
    )


@router.get("/me/export")
def me_export(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Download all of the current user's data as JSON (excludes secrets)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    profile = db.execute(
        text(
            """
            SELECT id, email, username, display_name, first_name, last_name, bio,
                   avatar_url, banner_url, profile_theme, friends_public, is_hidden,
                   joined_at, country, timezone, email_verified, is_premium,
                   premium_since, current_streak, hearts_current, hearts_max
            FROM users WHERE id = :u
            """
        ),
        {"u": user_id},
    ).mappings().first()

    data: Dict[str, Any] = {}
    for tbl in _tables_with_user_id(db):
        if tbl in ("users", "friends"):
            continue
        try:
            rows = db.execute(text(f'SELECT * FROM "{tbl}" WHERE user_id = :u'), {"u": user_id}).mappings().all()
            if rows:
                data[tbl] = [dict(r) for r in rows]
        except Exception:
            pass

    for label, sql in (
        ("friends", "SELECT * FROM friends WHERE user_id = :u OR friend_id = :u"),
        ("friend_requests", "SELECT * FROM friend_requests WHERE requester_id = :u OR addressee_id = :u"),
    ):
        try:
            rows = db.execute(text(sql), {"u": user_id}).mappings().all()
            if rows:
                data[label] = [dict(r) for r in rows]
        except Exception:
            pass

    payload = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "account": dict(profile) if profile else {},
        "data": data,
    }
    return JSONResponse(content=jsonable_encoder(payload))


@router.post("/me/delete")
def me_delete(
    payload: Dict[str, Any] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Permanently delete the current user's account and all their data.

    Requires the account password as confirmation. Irreversible.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    row = db.execute(text("SELECT password_hash FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    password = ((payload or {}).get("password") or "")
    if not row.get("password_hash") or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=403, detail="Password is incorrect")

    # Friendships + requests (both directions), then every user_id-keyed table,
    # then the user row last (FK-safe). Atomic via the request transaction.
    for sql in (
        "DELETE FROM friends WHERE user_id = :u OR friend_id = :u",
        "DELETE FROM friend_requests WHERE requester_id = :u OR addressee_id = :u",
    ):
        try:
            db.execute(text(sql), {"u": user_id})
        except Exception:
            pass

    for tbl in _tables_with_user_id(db):
        if tbl in ("users", "friends"):
            continue
        try:
            db.execute(text(f'DELETE FROM "{tbl}" WHERE user_id = :u'), {"u": user_id})
        except Exception:
            pass

    db.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})
    return {"ok": True}


@router.put("/me/profile", response_model=MeOut)
def me_profile_put(
    payload: MeProfileUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    fn = (payload.first_name or "").strip()
    ln = (payload.last_name or "").strip()
    computed_name = " ".join([x for x in [fn, ln] if x]) or None

    # display_name is optional/backward-compatible; newer UI uses first/last name.
    _display_name = getattr(payload, "display_name", None)
    explicit_name = (_display_name or "").strip() or None
    new_name = explicit_name if _display_name is not None else computed_name

    updates = {}
    # Persist first/last name (optional)
    if payload.first_name is not None:
        updates["first_name"] = fn or None
    if payload.last_name is not None:
        updates["last_name"] = ln or None

    # Store as display_name (users table uses display_name)
    if getattr(payload, "display_name", None) is not None or payload.first_name is not None or payload.last_name is not None:
        updates["display_name"] = new_name

    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url.strip() or None

    if payload.banner_url is not None:
        updates["banner_url"] = (payload.banner_url or "").strip() or None

    if payload.is_hidden is not None:
        updates["is_hidden"] = bool(payload.is_hidden)

    if payload.username is not None:
        uname = (payload.username or "").strip()
        # empty string means "unset"
        if uname == "":
            updates["username"] = None
        else:
            # basic validation: 3-20 chars, letters/numbers/underscore, starts with letter
            import re as _re
            if not _re.match(r"^[a-zA-Z][a-zA-Z0-9_]{2,19}$", uname):
                raise HTTPException(status_code=400, detail="Invalid username")
            # ensure uniqueness
            exists = db.execute(
                text("SELECT 1 FROM users WHERE lower(username) = lower(:u) AND id != :id LIMIT 1"),
                {"u": uname, "id": int(user_id)},
            ).first()
            if exists:
                raise HTTPException(status_code=409, detail="Username already taken")
            updates["username"] = uname

    if payload.bio is not None:
        updates["bio"] = (payload.bio or "").strip() or None

    if payload.profile_theme is not None:
        # Stored as jsonb. IMPORTANT: psycopg2 can't bind raw dicts in text() queries.
        # Bind as a JSON string and CAST to jsonb in SQL.
        import json as _json
        updates["profile_theme"] = _json.dumps(payload.profile_theme or {})

    if payload.friends_public is not None:
        updates["friends_public"] = bool(payload.friends_public)

    if updates:
        set_parts = []
        params = {"id": user_id}
        for k, v in updates.items():
            set_parts.append(f"{k} = :{k}")
            params[k] = v

        # Cast json fields explicitly when present
        if "profile_theme" in updates:
            # Replace profile_theme assignment with explicit jsonb cast
            set_parts = [
                ("profile_theme = CAST(:profile_theme AS jsonb)" if p.startswith("profile_theme") else p)
                for p in set_parts
            ]

        try:
            db.execute(text(f"UPDATE users SET {', '.join(set_parts)} WHERE id = :id"), params)
        except IntegrityError:
            # likely username case-insensitive unique constraint
            raise HTTPException(status_code=409, detail="Username already taken")

    # Update voice_pref in user_onboarding if provided
    if payload.voice_pref is not None:
        vp = payload.voice_pref.strip()
        if vp in ("Male", "Female", "Random"):
            db.execute(
                text("""
                    INSERT INTO user_onboarding (user_id, voice_pref, age_range, country, knowledge_level, dialect, primary_goal, source_language, daily_goal_min, accepted_terms, updated_at)
                    VALUES (:u, :vp, '', '', '', '', '', '', 5, FALSE, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET voice_pref = EXCLUDED.voice_pref, updated_at = NOW()
                """),
                {"u": int(user_id), "vp": vp},
            )

    row = db.execute(
        text("SELECT id, email, username, display_name, first_name, last_name, bio, avatar_url, banner_url, profile_theme, friends_public, is_hidden, email_verified, telegram_id FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()

    ob_row = db.execute(
        text("SELECT voice_pref FROM user_onboarding WHERE user_id = :u LIMIT 1"),
        {"u": user_id},
    ).mappings().first()

    # Best-effort Brevo sync for profile changes.
    _brevo_sync_user(db, int(user_id), event="profile_updated")

    result = dict(row)
    result["voice_pref"] = (ob_row or {}).get("voice_pref") or "Random"
    return MeOut(**result)


@router.post("/me/link/telegram")
def me_link_telegram(
    payload: Dict[str, Any] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Link a Telegram account to the currently authenticated user.

    Verifies the Telegram HMAC signature (same as /auth/telegram), then stores
    the telegram_id on the user's row. Returns 409 if the Telegram account is
    already linked to a different Haylingua account.
    """
    import hashlib as _hashlib
    import hmac as _hmac
    import time as _time

    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    bot_token = os.getenv("TELEGRAM_BOT_KEY", "")
    if not bot_token:
        raise HTTPException(status_code=503, detail="Telegram OAuth is not configured on this server")

    data = dict(payload or {})
    received_hash = data.pop("hash", "")
    if not received_hash:
        raise HTTPException(status_code=400, detail="Missing Telegram hash")

    check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if v is not None)
    secret_key = _hashlib.sha256(bot_token.encode()).digest()
    expected_hash = _hmac.new(secret_key, check_string.encode(), _hashlib.sha256).hexdigest()

    if not _hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid Telegram signature")

    auth_date = int(data.get("auth_date") or 0)
    if _time.time() - auth_date > 86400:
        raise HTTPException(status_code=401, detail="Telegram auth data expired — please try again")

    tg_id = str(data.get("id") or "")
    if not tg_id:
        raise HTTPException(status_code=400, detail="No Telegram user ID returned")

    # Reject if this Telegram ID is already linked to a *different* account
    existing = db.execute(
        text("SELECT id FROM users WHERE telegram_id = :tid AND id != :u LIMIT 1"),
        {"tid": tg_id, "u": int(user_id)},
    ).scalar()
    if existing:
        raise HTTPException(status_code=409, detail="This Telegram account is already linked to another Haylingua account")

    db.execute(
        text("UPDATE users SET telegram_id = :tid WHERE id = :u"),
        {"tid": tg_id, "u": int(user_id)},
    )
    return {"ok": True, "telegram_id": int(tg_id)}


@router.delete("/me/link/telegram")
def me_unlink_telegram(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Remove the Telegram link from the current user's account."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    db.execute(
        text("UPDATE users SET telegram_id = NULL WHERE id = :u"),
        {"u": int(user_id)},
    )
    return {"ok": True}


# ----------------------------
# Account security
# - Change password
# - Change email (confirm via code sent to new email)
# - Two-factor authentication (TOTP)
# ----------------------------


@router.post("/me/change-password")
def me_change_password(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""
    if not current_password.strip() or not new_password.strip():
        raise HTTPException(status_code=400, detail="current_password and new_password are required")

    row = db.execute(
        text("SELECT password_hash FROM users WHERE id=:id"),
        {"id": int(user_id)},
    ).mappings().first()
    if not row or not row.get("password_hash"):
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    errs = validate_password_simple(new_password)
    if errs:
        raise HTTPException(status_code=400, detail={"field": "new_password", "errors": errs})

    db.execute(
        text("UPDATE users SET password_hash=:ph, token_version = COALESCE(token_version, 0) + 1, updated_at=NOW() WHERE id=:id"),
        {"ph": hash_password(new_password), "id": int(user_id)},
    )
    return {"ok": True}


@router.post("/me/change-email/start")
def me_change_email_start(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    new_email = (payload.get("new_email") or "").strip().lower()
    errs = validate_email_simple(new_email)
    if errs:
        raise HTTPException(status_code=400, detail={"field": "new_email", "errors": errs})

    # Ensure not already used
    exists = db.execute(
        text("SELECT 1 FROM users WHERE lower(email)=:e AND id != :id LIMIT 1"),
        {"e": new_email, "id": int(user_id)},
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Email is already in use")

    # Generate confirmation code
    code = f"{secrets.randbelow(900000) + 100000}"  # 6 digits
    code_hash = _sha256_hex(code)
    expires_at = datetime.utcnow() + timedelta(minutes=20)

    db.execute(
        text(
            """
            UPDATE users
            SET pending_email=:e,
                pending_email_code_hash=:h,
                pending_email_expires_at=:x,
                updated_at=NOW()
            WHERE id=:id
            """
        ),
        {"e": new_email, "h": code_hash, "x": expires_at, "id": int(user_id)},
    )

    # Send to the NEW email
    subject = "Confirm your new Haylingua email"
    plain = f"Your Haylingua email change code is: {code}. It expires in 20 minutes."
    email_sent = _send_email(to_email=new_email, subject=subject, body=plain, html_body=None)

    resp = {"ok": True, "email_sent": bool(email_sent)}
    # Dev-only: include the code in the response when explicitly enabled.
    if not email_sent and _expose_dev_codes():
        resp["verification_code"] = code
    return resp


@router.post("/me/change-email/confirm")
def me_change_email_confirm(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    code = (payload.get("code") or "").strip().replace(" ", "")
    if not code:
        raise HTTPException(status_code=400, detail="code required")

    row = db.execute(
        text(
            """
            SELECT email, pending_email, pending_email_code_hash, pending_email_expires_at
            FROM users
            WHERE id=:id
            """
        ),
        {"id": int(user_id)},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    if not row.get("pending_email") or not row.get("pending_email_code_hash"):
        raise HTTPException(status_code=400, detail="No pending email change")

    exp = row.get("pending_email_expires_at")
    if exp is not None:
        now = datetime.utcnow()
        if getattr(exp, "tzinfo", None) is not None:
            now = datetime.now(dt.timezone.utc)
        if exp < now:
            raise HTTPException(status_code=400, detail="Code expired")

    if _sha256_hex(code) != row["pending_email_code_hash"]:
        raise HTTPException(status_code=400, detail="Invalid code")

    new_email = row["pending_email"].strip().lower()
    # Re-check uniqueness right before swap
    exists = db.execute(
        text("SELECT 1 FROM users WHERE lower(email)=:e AND id != :id LIMIT 1"),
        {"e": new_email, "id": int(user_id)},
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Email is already in use")

    db.execute(
        text(
            """
            UPDATE users
            SET email=:e,
                email_verified=TRUE,
                email_verified_at=NOW(),
                pending_email=NULL,
                pending_email_code_hash=NULL,
                pending_email_expires_at=NULL,
                updated_at=NOW()
            WHERE id=:id
            """
        ),
        {"e": new_email, "id": int(user_id)},
    )
    return {"ok": True, "email": new_email}


def _qr_png_data_url(data: str) -> str:
    # qrcode is installed; return a small PNG data URL
    import io
    import base64
    import qrcode

    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _make_recovery_codes(n: int = 10) -> list:
    # Human-friendly codes like XXXX-XXXX
    out = []
    for _ in range(n):
        raw = secrets.token_hex(4).upper()
        out.append(f"{raw[:4]}-{raw[4:]}")
    return out


@router.get("/me/2fa/status")
def me_2fa_status(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    row = db.execute(
        text("SELECT totp_enabled FROM users WHERE id=:id"),
        {"id": int(user_id)},
    ).mappings().first()
    return {"enabled": bool(row.get("totp_enabled")) if row else False}


@router.post("/me/2fa/setup")
def me_2fa_setup(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # Generate secret & save (not enabled until confirmed)
    secret = pyotp.random_base32()
    db.execute(
        text("UPDATE users SET totp_secret=:s, totp_enabled=FALSE, updated_at=NOW() WHERE id=:id"),
        {"s": secret, "id": int(user_id)},
    )

    email = db.execute(text("SELECT email FROM users WHERE id=:id"), {"id": int(user_id)}).scalar()
    issuer = "Haylingua"
    otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)
    return {
        "otpauth_url": otp_uri,
        "secret": secret,
        "qr_png": _qr_png_data_url(otp_uri),
        "issuer": issuer,
        "account": email,
    }


@router.post("/me/2fa/confirm")
def me_2fa_confirm(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    code = (payload.get("code") or "").strip().replace(" ", "")
    if not code:
        raise HTTPException(status_code=400, detail="code required")

    row = db.execute(
        text("SELECT totp_secret FROM users WHERE id=:id"),
        {"id": int(user_id)},
    ).mappings().first()
    secret = (row or {}).get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA not initialized")

    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # Generate one-time recovery codes (hash stored)
    recovery = _make_recovery_codes(10)
    hashes = [_sha256_hex(x) for x in recovery]
    import json as _json

    db.execute(
        text(
            """
            UPDATE users
            SET totp_enabled=TRUE,
                totp_recovery_hashes=CAST(:h AS jsonb),
                updated_at=NOW()
            WHERE id=:id
            """
        ),
        {"h": _json.dumps(hashes), "id": int(user_id)},
    )

    return {"ok": True, "recovery_codes": recovery}


@router.post("/me/2fa/disable")
def me_2fa_disable(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # Require either a valid current TOTP code or current password.
    code = (payload.get("code") or "").strip().replace(" ", "")
    current_password = payload.get("current_password") or ""

    row = db.execute(
        text("SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id=:id"),
        {"id": int(user_id)},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if not bool(row.get("totp_enabled")):
        return {"ok": True}

    ok = False
    if code and row.get("totp_secret"):
        ok = pyotp.TOTP(row["totp_secret"]).verify(code, valid_window=1)
    if not ok and current_password.strip() and row.get("password_hash"):
        ok = verify_password(current_password, row["password_hash"])

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid code or password")

    db.execute(
        text(
            """
            UPDATE users
            SET totp_enabled=FALSE,
                totp_secret=NULL,
                totp_recovery_hashes='[]'::jsonb,
                updated_at=NOW()
            WHERE id=:id
            """
        ),
        {"id": int(user_id)},
    )
    return {"ok": True}


@router.post("/me/avatar")
def me_avatar_upload(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Upload a custom avatar to disk and set users.avatar_url.

    Default avatars are shipped by the frontend. This endpoint is for custom uploads.
    """
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # Basic content-type gate
    allowed = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
    ext = allowed.get((file.content_type or "").lower())
    if not ext:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, or WEBP images are allowed")

    # Prefer Render Persistent Disk when writable; otherwise fall back.
    def _pick_uploads_dir() -> str:
        candidates = []
        env = os.getenv("UPLOADS_DIR") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
        if env:
            candidates.append(env)
        candidates.append("/var/data/uploads")
        candidates.append("uploads")
        for p in candidates:
            try:
                os.makedirs(p, exist_ok=True)
            except PermissionError:
                continue
            except OSError:
                continue
            if os.access(p, os.W_OK):
                return p
        return "uploads"

    uploads_dir = _pick_uploads_dir()
    avatar_dir = os.path.join(uploads_dir, "avatars")
    try:
        os.makedirs(avatar_dir, exist_ok=True)
    except PermissionError:
        avatar_dir = os.path.join("uploads", "avatars")
        os.makedirs(avatar_dir, exist_ok=True)

    filename = f"u{int(user_id)}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(avatar_dir, filename)

    # Save to disk
    try:
        content = file.file.read()
        if content is None or len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Avatar too large (max 5MB)")
        with open(path, "wb") as f:
            f.write(content)
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    avatar_url = f"/static/avatars/{filename}"
    db.execute(
        text("UPDATE users SET avatar_url = :url WHERE id = :id"),
        {"url": avatar_url, "id": int(user_id)},
    )

    return {"avatar_url": avatar_url}


@router.get("/me/onboarding", response_model=OnboardingOut)
def me_onboarding_get(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    row = db.execute(
        text(
            """
            SELECT age_range, country, planning_visit_armenia,
                   knowledge_level, dialect, primary_goal, source_language,
                   daily_goal_min, reminder_time, voice_pref,
                   marketing_opt_in, accepted_terms, completed_at
            FROM user_onboarding
            WHERE user_id = :u
            """
        ),
        {"u": int(user_id)},
    ).mappings().first()

    if row is None:
        return OnboardingOut(completed=False, data=None)

    data = dict(row)
    completed = data.get("completed_at") is not None
    data.pop("completed_at", None)
    return OnboardingOut(completed=bool(completed), data=data)


@router.post("/me/onboarding", response_model=OnboardingOut)
def me_onboarding_post(
    payload: OnboardingIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # Minimal validation (FE should enforce UX, BE enforces sanity)
    if not payload.accepted_terms:
        raise HTTPException(status_code=400, detail={"field": "accepted_terms", "errors": ["Terms must be accepted"]})

    if payload.daily_goal_min < 5 or payload.daily_goal_min > 60:
        raise HTTPException(status_code=400, detail={"field": "daily_goal_min", "errors": ["Daily goal must be between 5 and 60 minutes"]})

    country = (payload.country or "").strip()
    if country == "":
        raise HTTPException(status_code=400, detail={"field": "country", "errors": ["Country is required"]})

    # Upsert
    db.execute(
        text(
            """
            INSERT INTO user_onboarding (
                user_id,
                age_range, country, planning_visit_armenia,
                knowledge_level, dialect, primary_goal, source_language,
                daily_goal_min, reminder_time, voice_pref,
                marketing_opt_in, accepted_terms,
                completed_at, updated_at
            ) VALUES (
                :user_id,
                :age_range, :country, :planning_visit_armenia,
                :knowledge_level, :dialect, :primary_goal, :source_language,
                :daily_goal_min, :reminder_time, :voice_pref,
                :marketing_opt_in, :accepted_terms,
                NOW(), NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                age_range = EXCLUDED.age_range,
                country = EXCLUDED.country,
                planning_visit_armenia = EXCLUDED.planning_visit_armenia,
                knowledge_level = EXCLUDED.knowledge_level,
                dialect = EXCLUDED.dialect,
                primary_goal = EXCLUDED.primary_goal,
                source_language = EXCLUDED.source_language,
                daily_goal_min = EXCLUDED.daily_goal_min,
                reminder_time = EXCLUDED.reminder_time,
                voice_pref = EXCLUDED.voice_pref,
                marketing_opt_in = EXCLUDED.marketing_opt_in,
                accepted_terms = EXCLUDED.accepted_terms,
                completed_at = NOW(),
                updated_at = NOW()
            """
        ),
        {
            "user_id": int(user_id),
            "age_range": payload.age_range,
            "country": country,
            "planning_visit_armenia": payload.planning_visit_armenia,
            "knowledge_level": payload.knowledge_level,
            "dialect": payload.dialect,
            "primary_goal": payload.primary_goal,
            "source_language": payload.source_language,
            "daily_goal_min": int(payload.daily_goal_min),
            "reminder_time": payload.reminder_time,
            "voice_pref": payload.voice_pref,
            "marketing_opt_in": bool(payload.marketing_opt_in),
            "accepted_terms": bool(payload.accepted_terms),
        },
    )

    # Return latest
    row = db.execute(
        text(
            """
            SELECT age_range, country, planning_visit_armenia,
                   knowledge_level, dialect, primary_goal, source_language,
                   daily_goal_min, reminder_time, voice_pref,
                   marketing_opt_in, accepted_terms
            FROM user_onboarding
            WHERE user_id = :u
            """
        ),
        {"u": int(user_id)},
    ).mappings().first()

    return OnboardingOut(completed=True, data=dict(row) if row else None)


@router.get("/me/activity/last7days")
def me_activity_last7days(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    return me_activity(days=7, authorization=authorization, db=db)
    
@router.get("/me/lessons/{lesson_id}/next")
def me_next_exercise(
    lesson_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    _require_verified(db, int(user_id))

    # Ensure progress row
    _ensure_user_lesson_progress(db, user_id, lesson_id)

    rec = _recommend_next_exercise(db, user_id, lesson_id)

    # store next_exercise_id (optional but useful)
    if rec.get("exercise_id"):
        db.execute(
            text("""
                UPDATE user_lesson_progress
                SET next_exercise_id = :ex, last_seen_at = NOW()
                WHERE user_id = :u AND lesson_id = :l
            """),
            {"ex": int(rec["exercise_id"]), "u": user_id, "l": lesson_id},
        )
    else:
        db.execute(
            text("""
                UPDATE user_lesson_progress
                SET next_exercise_id = NULL, last_seen_at = NOW()
                WHERE user_id = :u AND lesson_id = :l
            """),
            {"u": user_id, "l": lesson_id},
        )

    return rec
    
@router.get("/leaderboard", response_model=List[LeaderboardEntryOut])
def get_leaderboard(limit: int = 50, db: Connection = Depends(get_db)):
    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200

    # Real XP from lesson_progress
    rows = db.execute(
        text(
            """
            SELECT
                u.id AS user_id,
                u.email AS email,
                u.username AS username,
                u.avatar_url AS avatar_url,
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
            FROM users u
            LEFT JOIN lesson_progress lp ON lp.user_id = u.id
            GROUP BY u.id, u.email, u.username, u.avatar_url
            ORDER BY total_xp DESC, u.id ASC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings().all()

    out: List[LeaderboardEntryOut] = []
    for i, r in enumerate(rows, start=1):
        email = r["email"] or ""
        # Show username when present; otherwise keep the old display format.
        u = (r.get("username") or "").strip()
        if u != "":
            name = u
        else:
            name = email.split("@")[0] if "@" in email else (email or "User")
        xp = int(r["total_xp"] or 0)

        # Derive level from XP (simple & stable for now)
        level = max(1, (xp // 500) + 1)

        # Streak not tracked in DB yet in this version -> return 0
        streak = 0

        out.append(
            LeaderboardEntryOut(
                user_id=int(r["user_id"]),
                email=email,
                name=name,
                username=(r.get("username") or "").strip() or None,
                xp=xp,
                streak=streak,
                level=level,
                rank=i,
                avatar_url=r.get("avatar_url"),
            )
        )

    return out



# --------- CMS Main ----------




# --------- CMS Main ----------
# Invite-only CMS auth (admin-only) with mandatory TOTP (Google Authenticator)

import secrets
import hashlib
from datetime import datetime, timedelta
import pyotp

CMS_INVITE_TTL_HOURS = int(os.getenv("CMS_INVITE_TTL_HOURS") or "72") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
CMS_INVITE_BASE_URL = (os.getenv("CMS_INVITE_BASE_URL") or "https://cms.haylingua.am").rstrip("/") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
CMS_BOOTSTRAP_EMAIL = (os.getenv("CMS_BOOTSTRAP_EMAIL") or "").strip().lower() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
CMS_BOOTSTRAP_SECRET = (os.getenv("CMS_BOOTSTRAP_SECRET") or "").strip() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 

def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _cms_jwt_encode(payload: dict, minutes: int) -> str:
    # Reuse the same JWT secret as main auth
    secret = (os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or "").strip() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")
    alg = (os.getenv("JWT_ALGORITHM") or "HS256").strip() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    exp = datetime.utcnow() + timedelta(minutes=minutes)
    full = {**payload, "exp": exp}
    return jwt.encode(full, secret, algorithm=alg)

def _cms_jwt_decode(token: str) -> dict:
    secret = (os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or "").strip() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")
    alg = (os.getenv("JWT_ALGORITHM") or "HS256").strip() # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    try:
        return jwt.decode(token, secret, algorithms=[alg])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_cms_admin(authorization: Optional[str] = Header(None), db=Depends(get_db)) -> dict:
    """
    CMS protected routes: require Bearer <cms_access_token>.
    Token must include: scope='cms', role='admin', typ='cms'
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = _cms_jwt_decode(token)
    if payload.get("scope") != "cms" or payload.get("typ") != "cms":
        raise HTTPException(status_code=403, detail="Not a CMS token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    cms_user_id = payload.get("sub")
    if not cms_user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    row = db.execute(
        text("SELECT id, email, status, totp_enabled FROM cms_users WHERE id = :id"),
        {"id": int(cms_user_id)},
    ).mappings().first()
    if not row or row["status"] != "active":
        raise HTTPException(status_code=403, detail="CMS user disabled or missing")
    if not row["totp_enabled"]:
        # Strict mode: no access without 2FA enabled
        raise HTTPException(status_code=403, detail="2FA is required")
    return dict(row)



def require_cms(request: Request, db):
    """
    Back-compat wrapper used by existing CMS endpoints below.
    Prefer Authorization: Bearer <cms_token>.
    """
    authz = request.headers.get("Authorization", "")
    if authz.lower().startswith("bearer "):
        # validate like admin
        payload = _cms_jwt_decode(authz.split(" ", 1)[1].strip())
        if payload.get("scope") != "cms" or payload.get("typ") != "cms" or payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized CMS token")
        cms_user_id = payload.get("sub")
        row = db.execute(
            text("SELECT id, email, status, totp_enabled FROM cms_users WHERE id=:id"),
            {"id": int(cms_user_id)},
        ).mappings().first()
        if not row or row["status"] != "active" or not row["totp_enabled"]:
            raise HTTPException(status_code=403, detail="Unauthorized CMS user")
        return dict(row)

    # Legacy support (optional): X-CMS-Token (deprecated)
    legacy = request.headers.get("X-CMS-Token", "")
    if legacy:
        raise HTTPException(status_code=401, detail="Legacy CMS token is disabled. Please log in.")
    raise HTTPException(status_code=401, detail="Unauthorized CMS token")

def require_cms_temp(authorization: Optional[str] = Header(None), db=Depends(get_db)) -> dict:
    """
    Temporary CMS token (invite accept / login step1) used ONLY for 2FA setup/verification.
    typ: cms_temp, scope: cms
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = _cms_jwt_decode(token)
    if payload.get("scope") != "cms" or payload.get("typ") != "cms_temp":
        raise HTTPException(status_code=403, detail="Not a CMS temp token")
    cms_user_id = payload.get("sub")
    if not cms_user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    row = db.execute(
        text("SELECT id, email, status, totp_secret, totp_enabled FROM cms_users WHERE id=:id"),
        {"id": int(cms_user_id)},
    ).mappings().first()
    if not row or row["status"] != "active":
        raise HTTPException(status_code=403, detail="CMS user disabled or missing")
    return dict(row)

# ----------------------------
# Support admin (CMS-admin only): look up users & resolve common issues
# ----------------------------

@router.get("/cms/support/users")
def support_search_users(
    q: Optional[str] = Query(None),
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    query = (q or "").strip()
    # No query → show the most recent learners so the panel isn't empty.
    if not query:
        rows = db.execute(
            text(
                """
                SELECT id, email, username, display_name, email_verified,
                       COALESCE(is_premium, FALSE) AS is_premium
                FROM users
                ORDER BY id DESC
                LIMIT 100
                """
            )
        ).mappings().all()
        return {"users": [dict(r) for r in rows]}
    rows = db.execute(
        text(
            """
            SELECT id, email, username, display_name, email_verified,
                   COALESCE(is_premium, FALSE) AS is_premium
            FROM users
            WHERE CAST(id AS TEXT) = :exact
               OR lower(email) LIKE :like
               OR lower(username) LIKE :like
            ORDER BY id
            LIMIT 50
            """
        ),
        {"exact": query, "like": f"%{query.lower()}%"},
    ).mappings().all()
    return {"users": [dict(r) for r in rows]}


@router.get("/cms/support/users/{uid}")
def support_user_detail(
    uid: int,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    u = db.execute(
        text(
            """
            SELECT id, email, username, display_name, first_name, last_name,
                   bio, avatar_url, country, timezone,
                   email_verified, COALESCE(is_premium, FALSE) AS is_premium, premium_since,
                   joined_at, last_active_at,
                   COALESCE(current_streak, 0) AS current_streak,
                   COALESCE(streak_freezes, 0) AS streak_freezes,
                   totp_enabled, is_hidden, friends_public,
                   COALESCE(gems, 0) AS gems,
                   COALESCE(chests, 0) AS chests,
                   COALESCE(weekly_xp, 0) AS weekly_xp,
                   COALESCE(league_tier, 0) AS league_tier,
                   COALESCE(bonus_xp, 0) AS bonus_xp
            FROM users WHERE id = :u
            """
        ),
        {"u": uid},
    ).mappings().first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    stats = db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(lp.xp_earned), 0)                                           AS total_xp,
              COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.completed_at IS NOT NULL)  AS lessons_completed,
              COUNT(DISTINCT DATE(lp.completed_at))                                    AS days_active,
              MIN(lp.completed_at)                                                     AS first_lesson_at,
              MAX(lp.completed_at)                                                     AS last_lesson_at
            FROM lesson_progress lp WHERE lp.user_id = :u
            """
        ),
        {"u": uid},
    ).mappings().first() or {}

    exercises = db.execute(
        text(
            """
            SELECT
              COUNT(*)                                      AS exercises_done,
              COALESCE(SUM(correct::int), 0)               AS correct,
              COUNT(DISTINCT DATE(created_at))             AS practice_days
            FROM user_exercise_logs WHERE user_id = :u
            """
        ),
        {"u": uid},
    ).mappings().first() or {}

    friends_count = db.execute(
        text("SELECT COUNT(*) FROM friends WHERE user_id = :u"),
        {"u": uid},
    ).scalar() or 0

    achievements = db.execute(
        text(
            """
            SELECT ad.title, ad.icon, ad.color, rc.created_at AS claimed_at
            FROM reward_claims rc
            JOIN achievement_defs ad ON ad.key = rc.claim_key
            WHERE rc.user_id = :u AND rc.kind = 'achievement'
            ORDER BY rc.created_at DESC
            """
        ),
        {"u": uid},
    ).mappings().all()

    # Last 30 days activity (XP per day)
    activity = db.execute(
        text(
            """
            SELECT DATE(completed_at) AS day, SUM(xp_earned) AS xp
            FROM lesson_progress
            WHERE user_id = :u AND completed_at >= NOW() - INTERVAL '30 days'
            GROUP BY day ORDER BY day
            """
        ),
        {"u": uid},
    ).mappings().all()

    # Lesson history (most recent 50)
    lesson_history = db.execute(
        text(
            """
            SELECT l.title, l.slug, lp.xp_earned, lp.completed_at,
                   c.title AS chapter_title
            FROM lesson_progress lp
            JOIN lessons l ON l.id = lp.lesson_id
            LEFT JOIN chapters c ON c.id = l.chapter_id
            WHERE lp.user_id = :u AND lp.completed_at IS NOT NULL
            ORDER BY lp.completed_at DESC
            LIMIT 50
            """
        ),
        {"u": uid},
    ).mappings().all()

    hs = _hearts_state(db, uid)
    streak = _compute_streak_days(db, uid)
    bonus_xp = int(u.get("bonus_xp") or 0)
    total_xp = int(stats.get("total_xp") or 0) + bonus_xp
    exercises_done = int(exercises.get("exercises_done") or 0)
    correct = int(exercises.get("correct") or 0)
    accuracy = round(correct / exercises_done * 100) if exercises_done > 0 else 0
    days_since_active = None
    if u.get("last_active_at"):
        from datetime import timezone as _tz
        _laa = u["last_active_at"]
        if hasattr(_laa, "replace"):
            _laa = _laa.replace(tzinfo=_tz.utc) if _laa.tzinfo is None else _laa
            days_since_active = (datetime.now(_tz.utc) - _laa).days

    # Churn risk scoring
    def _churn_risk(days_inactive, streak_val, lessons_done, weekly_xp_val, hearts_val):
        if days_inactive is None:
            # Never been active — new user risk
            if lessons_done == 0:
                return "high", "Never completed a lesson"
            return "medium", "No recent activity recorded"
        if days_inactive >= 14:
            return "high", f"Inactive for {days_inactive} days"
        if days_inactive >= 7:
            return "high", f"Inactive for {days_inactive} days"
        if days_inactive >= 3:
            return "medium", f"Inactive for {days_inactive} days"
        if streak_val == 0 and days_inactive >= 1:
            return "medium", "Streak just broke"
        if hearts_val is not None and hearts_val == 0:
            return "medium", "Out of hearts — blocked from playing"
        if weekly_xp_val == 0 and lessons_done > 0:
            return "low", "No XP this week"
        return "low", "Active recently"

    churn_level, churn_reason = _churn_risk(
        days_since_active,
        int(streak),
        int(stats.get("lessons_completed") or 0),
        int(u.get("weekly_xp") or 0),
        hs["hearts_current"],
    )

    # 90-day activity heatmap
    activity90 = db.execute(
        text(
            """
            SELECT DATE(completed_at) AS day, SUM(xp_earned) AS xp
            FROM lesson_progress
            WHERE user_id = :u AND completed_at >= NOW() - INTERVAL '90 days'
            GROUP BY day ORDER BY day
            """
        ),
        {"u": uid},
    ).mappings().all()

    # Admin notes
    notes = db.execute(
        text(
            """
            SELECT id, author_email, body, created_at
            FROM admin_notes WHERE user_id = :u ORDER BY created_at DESC
            """
        ),
        {"u": uid},
    ).mappings().all()

    # Account timeline — key events in chronological order
    timeline = []
    def _tl(dt, label, icon, color):
        if dt:
            try:
                ts = str(dt)
                timeline.append({"ts": ts, "label": label, "icon": icon, "color": color})
            except Exception:
                pass

    _tl(u.get("joined_at"),          "Account created",          "user",     "#64748B")
    _tl(u.get("email_verified_at"),   "Email verified",           "mailcheck","#22B07D")
    _tl(u.get("premium_since"),       "Upgraded to Premium",      "crown",    "#F59E0B")
    _tl(stats.get("first_lesson_at"), "First lesson completed",   "book",     "#0EA5E9")
    # Achievements claimed
    for a in achievements:
        _tl(a.get("claimed_at"), f"Achievement: {a['title']}", "award", "#8B5CF6")

    timeline.sort(key=lambda x: x["ts"])

    return {
        **dict(u),
        "total_xp": total_xp,
        "lessons_completed": int(stats.get("lessons_completed") or 0),
        "days_active": int(stats.get("days_active") or 0),
        "first_lesson_at": str(stats.get("first_lesson_at") or ""),
        "last_lesson_at": str(stats.get("last_lesson_at") or ""),
        "exercises_done": exercises_done,
        "correct_answers": correct,
        "accuracy_pct": accuracy,
        "friends_count": int(friends_count),
        "current_streak": int(streak),
        "days_since_active": days_since_active,
        "churn_risk": churn_level,
        "churn_reason": churn_reason,
        "hearts_current": hs["hearts_current"],
        "hearts_max": hs["hearts_max"],
        "achievements": [dict(a) for a in achievements],
        "activity": [{"day": str(a["day"]), "xp": int(a["xp"])} for a in activity],
        "activity90": [{"day": str(a["day"]), "xp": int(a["xp"])} for a in activity90],
        "notes": [
            {
                "id": n["id"],
                "author_email": n["author_email"],
                "body": n["body"],
                "created_at": str(n["created_at"]),
            }
            for n in notes
        ],
        "timeline": timeline,
        "lesson_history": [
            {
                "title": r["title"],
                "slug": r["slug"],
                "xp_earned": int(r["xp_earned"] or 0),
                "completed_at": str(r["completed_at"]),
                "chapter_title": r["chapter_title"] or "",
            }
            for r in lesson_history
        ],
    }


@router.get("/cms/support/users/{uid}/notes")
def get_user_notes(
    uid: int,
    _cms: dict = Depends(require_cms),
    db: Connection = Depends(get_db),
):
    rows = db.execute(
        text("SELECT id, author_email, body, created_at FROM admin_notes WHERE user_id = :u ORDER BY created_at DESC"),
        {"u": uid},
    ).mappings().all()
    return {"notes": [{"id": r["id"], "author_email": r["author_email"], "body": r["body"], "created_at": str(r["created_at"])} for r in rows]}


@router.post("/cms/support/users/{uid}/notes")
def add_user_note(
    uid: int,
    payload: Dict[str, Any] = Body(default=None),
    cms_user: dict = Depends(require_cms),
    db: Connection = Depends(get_db),
):
    body = ((payload or {}).get("body") or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Note body is required")
    author = cms_user.get("email") or "admin"
    row = db.execute(
        text("INSERT INTO admin_notes (user_id, author_email, body) VALUES (:u, :a, :b) RETURNING id, created_at"),
        {"u": uid, "a": author, "b": body},
    ).mappings().first()
    return {"id": row["id"], "author_email": author, "body": body, "created_at": str(row["created_at"])}


@router.delete("/cms/support/users/{uid}/notes/{note_id}")
def delete_user_note(
    uid: int,
    note_id: int,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    db.execute(text("DELETE FROM admin_notes WHERE id = :nid AND user_id = :u"), {"nid": note_id, "u": uid})
    return {"ok": True}


@router.post("/cms/support/users/{uid}/premium")
def support_set_premium(
    uid: int,
    payload: Dict[str, Any] = Body(default=None),
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    active = bool((payload or {}).get("active"))
    db.execute(
        text(
            """
            UPDATE users
            SET is_premium = :a,
                premium_since = CASE WHEN :a AND premium_since IS NULL THEN NOW() ELSE premium_since END
            WHERE id = :u
            """
        ),
        {"a": active, "u": uid},
    )
    return {"ok": True, "is_premium": active}


@router.post("/cms/support/users/{uid}/hearts-refill")
def support_refill_hearts(
    uid: int,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    db.execute(
        text("UPDATE users SET hearts_current = COALESCE(hearts_max, :mx), last_heart_lost_at = NULL WHERE id = :u"),
        {"u": uid, "mx": DEFAULT_HEARTS_MAX},
    )
    return {"ok": True, **_hearts_state(db, uid)}


@router.post("/cms/support/users/{uid}/verify-email")
def support_verify_email(
    uid: int,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    db.execute(
        text("UPDATE users SET email_verified = TRUE, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = :u"),
        {"u": uid},
    )
    return {"ok": True}


@router.get("/cms/support/reports")
def support_list_reports(
    status: Optional[str] = Query("open"),
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT r.id, r.exercise_id, r.lesson_id, r.reason, r.detail, r.answer_text,
                   r.status, r.created_at,
                   e.prompt AS exercise_prompt, e.kind AS exercise_kind,
                   l.title AS lesson_title
            FROM exercise_reports r
            LEFT JOIN exercises e ON e.id = r.exercise_id
            LEFT JOIN lessons l ON l.id = r.lesson_id
            WHERE (:status = 'all' OR r.status = :status)
            ORDER BY r.created_at DESC
            LIMIT 200
            """
        ),
        {"status": (status or "open")},
    ).mappings().all()
    return {"reports": [dict(r) for r in rows]}


@router.post("/cms/support/reports/{rid}/resolve")
def support_resolve_report(
    rid: int,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    db.execute(text("UPDATE exercise_reports SET status = 'resolved' WHERE id = :r"), {"r": rid})
    return {"ok": True}


def _run_league_rollover(db: Connection) -> Dict[str, Any]:
    """Promote the top of each cohort up a tier, demote the bottom down, then
    reset everyone so they re-join fresh next week (idempotent)."""
    cohorts = db.execute(
        text(
            """
            SELECT DISTINCT league_tier, league_week, league_cohort
            FROM users WHERE league_cohort IS NOT NULL AND league_week IS NOT NULL
            """
        )
    ).mappings().all()

    maxt = len(LEAGUE_TIERS) - 1
    promoted = demoted = 0
    for c in cohorts:
        tier = int(c["league_tier"]); wk = c["league_week"]; coh = int(c["league_cohort"])
        rows = db.execute(
            text(
                """
                SELECT id, COALESCE(weekly_xp, 0) AS weekly_xp FROM users
                WHERE league_tier = :t AND league_week = :wk AND league_cohort = :c
                ORDER BY weekly_xp DESC, id ASC
                """
            ),
            {"t": tier, "wk": wk, "c": coh},
        ).mappings().all()
        n = len(rows)
        for idx, r in enumerate(rows):
            if int(r["weekly_xp"]) <= 0:
                continue  # inactive users don't promote
            if idx < LEAGUE_PROMOTE_TOP and tier < maxt:
                db.execute(text("UPDATE users SET league_tier = :nt WHERE id = :i"), {"nt": tier + 1, "i": r["id"]})
                promoted += 1
            elif idx >= n - LEAGUE_DEMOTE_BOTTOM and tier > 0:
                db.execute(text("UPDATE users SET league_tier = :nt WHERE id = :i"), {"nt": tier - 1, "i": r["id"]})
                demoted += 1

    db.execute(text("UPDATE users SET weekly_xp = 0, league_cohort = NULL, league_week = NULL WHERE league_cohort IS NOT NULL"))
    return {"ok": True, "promoted": promoted, "demoted": demoted, "cohorts": len(cohorts)}


@router.post("/cms/support/leagues/rollover")
def leagues_rollover(
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    """Manual weekly promotion/relegation (CMS admin)."""
    return _run_league_rollover(db)


@router.post("/cron/leagues/rollover")
def leagues_rollover_cron(
    x_cron_secret: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Cron entry point for weekly promotion/relegation. Authenticated with a
    shared secret (CRON_SECRET) so a scheduler can call it without a login."""
    secret = (os.getenv("CRON_SECRET") or "").strip()
    if not secret or not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), secret):
        raise HTTPException(status_code=403, detail="Invalid cron secret")
    return _run_league_rollover(db)


@router.post("/cron/send-reminders")
def cron_send_reminders(
    x_cron_secret: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Send Telegram streak reminders to users who haven't practiced today.
    Authenticated with the shared CRON_SECRET. Schedule daily around 19:00 UTC."""
    secret = (os.getenv("CRON_SECRET") or "").strip()
    if not secret or not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), secret):
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    bot_token = (os.getenv("TELEGRAM_BOT_KEY") or "").strip()
    if not bot_token:
        return {"ok": False, "error": "TELEGRAM_BOT_KEY not set", "sent": 0}

    REMINDER_MESSAGES = [
        "🔥 Your Armenian streak is waiting! Do a quick lesson today and keep the flame alive.",
        "📚 Don't break your streak! Just 5 minutes of Armenian practice keeps you on track.",
        "🇦🇲 Your streak is counting on you! Open Haylingua and do today's lesson.",
        "⏰ One lesson a day keeps the streak alive! Come back to Haylingua today.",
        "✨ Small steps every day. Your Armenian is getting better — don't stop now!",
    ]

    rows = db.execute(
        text("""
            SELECT u.id, u.telegram_id, u.first_name, u.display_name, u.current_streak
            FROM users u
            WHERE u.telegram_id IS NOT NULL
              AND u.current_streak > 0
              AND NOT EXISTS (
                  SELECT 1 FROM lesson_progress lp
                  WHERE lp.user_id = u.id
                    AND lp.completed_at >= CURRENT_DATE
              )
            LIMIT 500
        """)
    ).mappings().all()

    import httpx as _httpx

    sent = 0
    for i, row in enumerate(rows):
        chat_id = int(row["telegram_id"])
        name = row.get("first_name") or row.get("display_name") or "learner"
        streak = int(row.get("current_streak") or 0)
        msg = REMINDER_MESSAGES[i % len(REMINDER_MESSAGES)]
        if streak > 1:
            msg += f"\n\n🔢 Your current streak: <b>{streak} days</b> — don't lose it!"
        try:
            r = _httpx.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"},
                timeout=10,
            )
            if r.status_code == 200:
                sent += 1
        except Exception:
            pass

    return {"ok": True, "eligible": len(rows), "sent": sent}


@router.get("/cms/analytics")
def cms_analytics(
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    """Advanced analytics dashboard for CMS admins.

    All queries are read-only aggregates. Returns in a single round-trip so the
    frontend can render the full dashboard without waterfall fetches.
    """
    import json as _json

    # ── Summary KPIs ─────────────────────────────────────────────────────────
    totals = db.execute(text("""
        SELECT
            COUNT(*)                                                 AS total_users,
            COUNT(*) FILTER (WHERE email_verified)                  AS verified_users,
            COUNT(*) FILTER (WHERE COALESCE(is_premium, FALSE))     AS premium_users,
            COUNT(*) FILTER (WHERE telegram_id IS NOT NULL)         AS telegram_users,
            COUNT(*) FILTER (WHERE google_id IS NOT NULL)           AS google_users,
            COUNT(*) FILTER (WHERE joined_at >= NOW() - INTERVAL '7 days')  AS new_7d,
            COUNT(*) FILTER (WHERE joined_at >= NOW() - INTERVAL '30 days') AS new_30d,
            COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '1 day')  AS dau,
            COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '7 days') AS wau,
            COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '30 days') AS mau
        FROM users
    """)).mappings().first() or {}

    lesson_totals = db.execute(text("""
        SELECT
            COUNT(*)                                         AS total_completions,
            COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '1 day')  AS completions_today,
            COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days') AS completions_7d,
            COALESCE(SUM(xp_earned), 0)                     AS total_xp_awarded
        FROM lesson_progress WHERE completed_at IS NOT NULL
    """)).mappings().first() or {}

    exercise_totals = db.execute(text("""
        SELECT
            COUNT(*)                                                AS total_attempts,
            COALESCE(AVG(CASE WHEN correct THEN 1.0 ELSE 0.0 END), 0) AS avg_accuracy,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS attempts_today
        FROM user_exercise_logs
    """)).mappings().first() or {}

    onboarding_totals = db.execute(text("""
        SELECT
            COUNT(*)                                                 AS onboarded,
            COUNT(*) FILTER (WHERE completed_at IS NOT NULL)        AS completed
        FROM user_onboarding
    """)).mappings().first() or {}

    # ── Time-series: last 30 days ─────────────────────────────────────────────
    new_users_daily = db.execute(text("""
        SELECT DATE(joined_at) AS day, COUNT(*) AS count
        FROM users
        WHERE joined_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
    """)).mappings().all()

    dau_daily = db.execute(text("""
        SELECT DATE(last_active_at) AS day, COUNT(*) AS count
        FROM users
        WHERE last_active_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
    """)).mappings().all()

    lessons_daily = db.execute(text("""
        SELECT DATE(completed_at) AS day, COUNT(*) AS count
        FROM lesson_progress
        WHERE completed_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
    """)).mappings().all()

    exercises_daily = db.execute(text("""
        SELECT DATE(created_at) AS day, COUNT(*) AS count,
               ROUND(AVG(CASE WHEN correct THEN 1.0 ELSE 0.0 END)::numeric, 3) AS accuracy
        FROM user_exercise_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
    """)).mappings().all()

    # ── Content performance ───────────────────────────────────────────────────
    top_lessons = db.execute(text("""
        SELECT l.title, l.id, COUNT(*) AS completions,
               ROUND(AVG(lp.xp_earned)::numeric, 1) AS avg_xp
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        WHERE lp.completed_at IS NOT NULL
        GROUP BY l.id, l.title
        ORDER BY completions DESC
        LIMIT 10
    """)).mappings().all()

    chapter_progress = db.execute(text("""
        SELECT c.title AS chapter, COUNT(DISTINCT lp.user_id) AS unique_learners,
               COUNT(DISTINCT lp.lesson_id) AS lessons_completed
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        JOIN chapters c ON c.id = l.chapter_id
        WHERE lp.completed_at IS NOT NULL
        GROUP BY c.id, c.title
        ORDER BY unique_learners DESC
        LIMIT 10
    """)).mappings().all()

    # ── Distribution / segmentation ───────────────────────────────────────────
    voice_dist = db.execute(text("""
        SELECT COALESCE(voice_pref, 'Random') AS voice_pref, COUNT(*) AS count
        FROM user_onboarding GROUP BY voice_pref ORDER BY count DESC
    """)).mappings().all()

    knowledge_dist = db.execute(text("""
        SELECT COALESCE(knowledge_level, 'unknown') AS level, COUNT(*) AS count
        FROM user_onboarding GROUP BY knowledge_level ORDER BY count DESC
    """)).mappings().all()

    goal_dist = db.execute(text("""
        SELECT COALESCE(daily_goal_min::text, 'unknown') AS goal_min, COUNT(*) AS count
        FROM user_onboarding GROUP BY daily_goal_min ORDER BY count DESC LIMIT 8
    """)).mappings().all()

    country_dist = db.execute(text("""
        SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
        FROM user_onboarding WHERE country IS NOT NULL AND country != ''
        GROUP BY country ORDER BY count DESC LIMIT 12
    """)).mappings().all()

    # ── Streak health ─────────────────────────────────────────────────────────
    streak_dist = db.execute(text("""
        SELECT
            CASE
                WHEN COALESCE(current_streak, 0) = 0 THEN '0'
                WHEN current_streak <= 3              THEN '1–3'
                WHEN current_streak <= 7              THEN '4–7'
                WHEN current_streak <= 14             THEN '8–14'
                WHEN current_streak <= 30             THEN '15–30'
                ELSE '30+'
            END AS bucket,
            COUNT(*) AS count
        FROM users
        GROUP BY bucket
        ORDER BY MIN(COALESCE(current_streak, 0))
    """)).mappings().all()

    # ── Churn / inactivity ────────────────────────────────────────────────────
    churn = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '7 days')   AS active_7d,
            COUNT(*) FILTER (WHERE last_active_at < NOW() - INTERVAL '7 days'
                               AND last_active_at >= NOW() - INTERVAL '30 days')  AS at_risk_30d,
            COUNT(*) FILTER (WHERE last_active_at < NOW() - INTERVAL '30 days'
                               AND last_active_at IS NOT NULL)                    AS churned,
            COUNT(*) FILTER (WHERE last_active_at IS NULL)                        AS never_active
        FROM users
    """)).mappings().first() or {}

    # ── Auth method breakdown ─────────────────────────────────────────────────
    auth_methods = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE google_id IS NOT NULL AND telegram_id IS NULL)    AS google_only,
            COUNT(*) FILTER (WHERE telegram_id IS NOT NULL AND google_id IS NULL)    AS telegram_only,
            COUNT(*) FILTER (WHERE google_id IS NOT NULL AND telegram_id IS NOT NULL) AS both_oauth,
            COUNT(*) FILTER (WHERE google_id IS NULL AND telegram_id IS NULL
                               AND password_hash != '' AND password_hash IS NOT NULL) AS password_only
        FROM users
    """)).mappings().first() or {}

    def _ser(rows):
        out = []
        for r in rows:
            d = {}
            for k, v in dict(r).items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
                else:
                    try:
                        d[k] = float(v) if v is not None else None
                    except (TypeError, ValueError):
                        d[k] = v
            out.append(d)
        return out

    def _ser1(row):
        if not row:
            return {}
        d = {}
        for k, v in dict(row).items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
            else:
                try:
                    d[k] = float(v) if v is not None else None
                except (TypeError, ValueError):
                    d[k] = v
        return d

    return {
        "summary": {
            **_ser1(totals),
            **_ser1(lesson_totals),
            **_ser1(exercise_totals),
            **_ser1(onboarding_totals),
        },
        "new_users_daily":   _ser(new_users_daily),
        "dau_daily":         _ser(dau_daily),
        "lessons_daily":     _ser(lessons_daily),
        "exercises_daily":   _ser(exercises_daily),
        "top_lessons":       _ser(top_lessons),
        "chapter_progress":  _ser(chapter_progress),
        "voice_dist":        _ser(voice_dist),
        "knowledge_dist":    _ser(knowledge_dist),
        "goal_dist":         _ser(goal_dist),
        "country_dist":      _ser(country_dist),
        "streak_dist":       _ser(streak_dist),
        "churn":             _ser1(churn),
        "auth_methods":      _ser1(auth_methods),
    }


def _send_invite_email(email: str, invite_url: str):  # Send email function, is a really helpful thing for email verification and overall systematic communication style.
    """
    Best-effort. If SMTP not configured, prints link to logs.
    """
    body = (
        "You were invited to Haylingua CMS.\n\n"
        f"Open this link to set your password and enable 2FA:\n{invite_url}\n\n"
        "This link expires soon."
    )
    # Route through the shared sender (Brevo HTTP API first, SMTP fallback) so an
    # invite never 500s when SMTP ports are blocked.
    sent = _send_email(to_email=email, subject="Haylingua CMS invitation", body=body)
    if not sent:
        print(f"[cms_invite] Invite for {email}: {invite_url}")

def _bootstrap_invite_if_needed(db):
    """
    If there are no cms_users and CMS_BOOTSTRAP_EMAIL is set, create/ensure a pending invite
    so the owner can onboard.
    """
    if not CMS_BOOTSTRAP_EMAIL:
        return
    existing_users = db.execute(text("SELECT 1 FROM cms_users LIMIT 1")).first()
    if existing_users:
        return

    # Ensure there's a non-expired invite
    now = datetime.utcnow()
    existing_inv = db.execute(
        text(
            """
            SELECT id FROM cms_invites
            WHERE lower(email)=:e AND accepted_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
            """
        ),
        {"e": CMS_BOOTSTRAP_EMAIL},
    ).first()
    if existing_inv:
        return

    raw = secrets.token_urlsafe(32)
    token_hash = _sha256_hex(raw)
    expires_at = now + timedelta(hours=CMS_INVITE_TTL_HOURS)
    db.execute(
        text(
            """
            INSERT INTO cms_invites (email, role, token_hash, invited_by, expires_at)
            VALUES (:email, 'admin', :token_hash, NULL, :expires_at)
            """
        ),
        {"email": CMS_BOOTSTRAP_EMAIL, "token_hash": token_hash, "expires_at": expires_at},
    )
    invite_url = f"{CMS_INVITE_BASE_URL}/cms/invite?token={raw}"
    _send_invite_email(CMS_BOOTSTRAP_EMAIL, invite_url)

# ---------- Public user pages ----------
class PublicUserOut(BaseModel):
    user_id: int
    username: str | None = None
    name: str
    bio: str | None = None
    avatar_url: str | None = None
    banner_url: str | None = None
    profile_theme: dict = {}
    joined_at: datetime | None = None
    xp: int
    level: int
    streak: int
    global_rank: int
    friends_count: int
    friendship: str = "none"  # none | friends | outgoing_pending | incoming_pending | self
    # When the viewer is authenticated and there is a pending friend request between
    # the viewer and this user, we include the request id so the FE can accept it.
    friend_request_id: int | None = None
    is_friend: bool
    friends_preview: list[dict] = []
    top_friends: list[dict] = []
    achievements: list[dict] = []
    lessons_completed: int = 0


def _get_user_public_by_id(db: Connection, uid: int) -> dict:
    r = db.execute(
        text(
            """
            WITH xp AS (
              SELECT
                u.id,
                u.email,
                u.username,
                u.display_name,
                u.bio,
                u.avatar_url,
                u.banner_url,
                u.profile_theme,
                u.joined_at,
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              WHERE u.id = :uid
              GROUP BY u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url, u.banner_url, u.profile_theme, u.joined_at
            ), ranked AS (
              SELECT
                u2.id,
                COALESCE(SUM(lp2.xp_earned), 0) AS total_xp
              FROM users u2
              LEFT JOIN lesson_progress lp2 ON lp2.user_id = u2.id
              GROUP BY u2.id
            ), ranks AS (
              SELECT
                id,
                RANK() OVER (ORDER BY total_xp DESC, id ASC) AS global_rank
              FROM ranked
            )
            SELECT
              xp.*,
              ranks.global_rank,
              (SELECT COUNT(1) FROM friends f WHERE (f.user_id = xp.id OR f.friend_id = xp.id)) AS friends_count
            FROM xp
            JOIN ranks ON ranks.id = xp.id
            """
        ),
        {"uid": uid},
    ).mappings().first()
    if not r:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(r)


def _get_user_public_friends(db: Connection, uid: int, limit: int = 6) -> list[dict]:
    """Small preview list of friends for public pages (only when friends_public=True)."""

    # Compute ranks based on SUM(lesson_progress.xp_earned) to avoid relying on a non-existent
    # users.xp_total column.
    rows = db.execute(
        text(
            """
            WITH totals AS (
              SELECT u.id, u.username,
                     COALESCE(NULLIF(u.display_name, ''), NULLIF(u.username, ''), split_part(u.email, '@', 1)) AS display_name,
                     u.avatar_url,
                     COALESCE(SUM(lp.xp_earned), 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.username, u.display_name, u.email, u.avatar_url
            ), ranks AS (
              SELECT id,
                     RANK() OVER (ORDER BY total_xp DESC, id ASC) AS global_rank
              FROM totals
            ), friend_ids AS (
              SELECT CASE
                       WHEN f.user_id = :uid THEN f.friend_id
                       ELSE f.user_id
                     END AS fid
              FROM friends f
              WHERE (f.user_id = :uid OR f.friend_id = :uid)

            )
            SELECT t.username, t.display_name, t.avatar_url, t.total_xp AS xp, r.global_rank
            FROM friend_ids fi
            JOIN totals t ON t.id = fi.fid
            JOIN ranks r ON r.id = fi.fid
            ORDER BY t.total_xp DESC, t.id ASC
            LIMIT :lim
            """
        ),
        {"uid": int(uid), "lim": int(limit)},
    ).mappings().all()
    return [dict(r) for r in rows]


@router.get("/users/{username}", response_model=PublicUserOut)
def get_public_user(
    username: str,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    # Public endpoint: auth is optional.
    # If a Bearer token is present, we use it to compute viewer-specific fields (like is_friend).
    viewer_id = _get_user_id_from_bearer(authorization, db)

    uname = (username or "").strip().lower()
    if not uname:
        raise HTTPException(status_code=400, detail="username is required")

    target = db.execute(
        text("SELECT id, friends_public, is_hidden FROM users WHERE lower(username) = :u LIMIT 1"),
        {"u": uname},
    ).mappings().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target_id = int(target["id"])

    # Respect hidden accounts.
    # If the profile is hidden, only the owner can view it.
    if bool(target.get("is_hidden")) and not (viewer_id is not None and int(viewer_id) == target_id):
        # Return 404 to avoid leaking that the user exists.
        raise HTTPException(status_code=404, detail="User not found")
    data = _get_user_public_by_id(db, target_id)

    # display name logic
    email = (data.get("email") or "").strip()
    u = (data.get("username") or "").strip() or None
    dn = (data.get("display_name") or "").strip()
    name = dn or u or (email.split('@')[0] if '@' in email else (email or 'User'))

    xp = int(data.get("total_xp") or 0)
    level = max(1, (xp // 500) + 1)
    streak = _compute_streak_days(db, target_id)

    # Relationship between viewer and target
    friendship = "none"
    is_friend = False
    friend_request_id: int | None = None
    if viewer_id is not None and int(viewer_id) == target_id:
        friendship = "self"
    elif viewer_id is not None:
        is_friend = bool(
            db.execute(
                text(
                    """
                    SELECT 1
                    FROM friends
                    WHERE (user_id = :a AND friend_id = :b)
                       OR (user_id = :b AND friend_id = :a)
                    LIMIT 1
                    """
                ),
                {"a": int(viewer_id), "b": target_id},
            ).first()
        )
        if is_friend:
            friendship = "friends"
        else:
            # Schema uses requester_id/addressee_id (not from_user_id/to_user_id)
            rr = db.execute(
                text(
                    """
                    SELECT id, requester_id, addressee_id
                    FROM friend_requests
                    WHERE status = 'pending'
                      AND ((requester_id = :a AND addressee_id = :b) OR (requester_id = :b AND addressee_id = :a))
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                {"a": int(viewer_id), "b": target_id},
            ).mappings().first()
            if rr:
                friend_request_id = int(rr["id"])
                friendship = (
                    "outgoing_pending" if int(rr["requester_id"]) == int(viewer_id) else "incoming_pending"
                )

    # Lessons completed count
    lc_row = db.execute(
        text(
            "SELECT COUNT(DISTINCT lesson_id)::int AS c FROM lesson_progress WHERE user_id = :uid AND completed_at IS NOT NULL"
        ),
        {"uid": target_id},
    ).mappings().first()
    lessons_completed = int(lc_row["c"]) if lc_row else 0

    # Top friends (3) by XP
    q_top = text(
        """
        WITH fr AS (
          SELECT CASE WHEN f.user_id = :uid THEN f.friend_id ELSE f.user_id END AS fid
          FROM friends f
          WHERE f.user_id = :uid OR f.friend_id = :uid
        ),
        xp AS (
          SELECT lp.user_id, COALESCE(SUM(lp.xp_earned), 0)::int AS xp
          FROM lesson_progress lp
          GROUP BY lp.user_id
        )
        SELECT u.username,
               COALESCE(NULLIF(u.display_name, ''), NULLIF(u.username, ''), split_part(u.email, '@', 1)) AS display_name,
               u.avatar_url,
               COALESCE(xp.xp, 0) AS xp
        FROM fr
        JOIN users u ON u.id = fr.fid
        LEFT JOIN xp ON xp.user_id = u.id
        ORDER BY COALESCE(xp.xp, 0) DESC
        LIMIT 3
        """
    )
    top_friends = [dict(r) for r in db.execute(q_top, {"uid": target_id}).mappings().all()]

    return PublicUserOut(
        user_id=target_id,
        username=u,
        name=name,
        bio=data.get("bio"),
        avatar_url=data.get("avatar_url"),
        banner_url=data.get("banner_url"),
        profile_theme=data.get("profile_theme") or {},
        joined_at=data.get("joined_at"),
        xp=xp,
        level=level,
        streak=streak,
        global_rank=int(data.get("global_rank") or 0),
        friends_count=int(data.get("friends_count") or 0),
        friendship=friendship,
        friend_request_id=friend_request_id,
        is_friend=is_friend,
        # Lightweight preview to avoid a second call on the FE.
        friends_preview=(
            _get_user_public_friends(db, target_id, limit=6)
            if bool(target.get("friends_public"))
            else []
        ),
        top_friends=top_friends,
        achievements=(
            [
                {"id": a["id"], "title": a["title"], "desc": a["desc"], "icon": a["icon"], "color": a.get("color")}
                for a in _compute_achievements(db, target_id)
                if a["earned"]
            ]
            if ((not bool(target.get("is_hidden"))) or is_friend or friendship == "self")
            else []
        ),
        lessons_completed=lessons_completed,
    )


@router.get("/users/{username}/friends", response_model=list[FriendOut])
def get_public_user_friends(
    username: str,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    viewer_id = _get_user_id_from_bearer(authorization, db)
    if viewer_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    uname = (username or "").strip().lower()
    target = db.execute(
        text("SELECT id, friends_public FROM users WHERE lower(username) = :u LIMIT 1"),
        {"u": uname},
    ).mappings().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target_id = int(target["id"])
    friends_public = bool(target.get("friends_public", True))

    is_friend = bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM friends
                WHERE ((user_id = :a AND friend_id = :b) OR (user_id = :b AND friend_id = :a))
                LIMIT 1
                """
            ),
            {"a": int(viewer_id), "b": target_id},
        ).first()
    )

    # Only allow if public or viewer is friend or same user
    if not friends_public and int(viewer_id) != target_id and not is_friend:
        raise HTTPException(status_code=403, detail="Friends list is private")

    rows = db.execute(
        text(
            """
            WITH xp AS (
              SELECT
                u.id,
                u.email,
                u.username,
                u.display_name,
                u.avatar_url,
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.email, u.username, u.display_name, u.avatar_url
            ), ranked AS (
              SELECT
                xp.*,
                RANK() OVER (ORDER BY xp.total_xp DESC, xp.id ASC) AS global_rank
              FROM xp
            ), friend_ids AS (
              SELECT CASE
                       WHEN f.user_id = :uid THEN f.friend_id
                       ELSE f.user_id
                     END AS fid
              FROM friends f
              WHERE (f.user_id = :uid OR f.friend_id = :uid)
            )
            SELECT r.*
            FROM ranked r
            JOIN friend_ids fi ON fi.fid = r.id
            ORDER BY r.global_rank ASC, r.id ASC
            """
        ),
        {"uid": target_id},
    ).mappings().all()

    out: list[FriendOut] = []
    for r in rows:
        email = (r.get("email") or "").strip()
        u = (r.get("username") or "").strip() or None
        dn = (r.get("display_name") or "").strip()
        name = dn or u or (email.split('@')[0] if '@' in email else (email or 'User'))
        xp = int(r.get("total_xp") or 0)
        level = max(1, (xp // 500) + 1)
        streak = _compute_streak_days(db, int(r["id"]))
        out.append(
            FriendOut(
                user_id=int(r["id"]),
                username=u,
                name=name,
                avatar_url=r.get("avatar_url"),
                xp=xp,
                level=level,
                streak=streak,
                global_rank=int(r.get("global_rank") or 0),
            )
        )

    return out


@router.get("/users/{username}/activity")
def public_user_activity(
    username: str,
    days: int = 7,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Public (privacy-respecting) activity for a user's profile.

    Uses friends_public as a proxy privacy toggle:
    - If friends_public is false, only the user themselves or their friends can view.
    - Hidden profiles are not accessible unless viewing self.
    """
    viewer_id = _get_user_id_from_bearer(authorization, db)

    uname = (username or "").strip().lower()
    if not uname:
        raise HTTPException(status_code=400, detail="username is required")

    target = db.execute(
        text("SELECT id, friends_public, is_hidden FROM users WHERE lower(username) = :u LIMIT 1"),
        {"u": uname},
    ).mappings().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target_id = int(target["id"])
    if bool(target.get("is_hidden")) and not (viewer_id is not None and int(viewer_id) == target_id):
        raise HTTPException(status_code=404, detail="User not found")

    friends_public = bool(target.get("friends_public", True))
    is_friend = False
    if viewer_id is not None and int(viewer_id) != target_id:
        is_friend = bool(
            db.execute(
                text(
                    """
                    SELECT 1
                    FROM friends
                    WHERE ((user_id = :a AND friend_id = :b) OR (user_id = :b AND friend_id = :a))
                    LIMIT 1
                    """
                ),
                {"a": int(viewer_id), "b": target_id},
            ).first()
        )

    if not friends_public and not (viewer_id is not None and int(viewer_id) == target_id) and not is_friend:
        raise HTTPException(status_code=403, detail="Activity is private")

    # Reuse the same logic as /me/activity
    if days < 1:
        days = 1
    if days > 30:
        days = 30

    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)

    rows = db.execute(
        text(
            """
            SELECT
              DATE(completed_at) AS d,
              COUNT(*)::int AS c
            FROM lesson_progress
            WHERE user_id = :user_id
              AND completed_at >= :start_dt
            GROUP BY DATE(completed_at)
            ORDER BY d ASC
            """
        ),
        {"user_id": target_id, "start_dt": start},
    ).mappings().all()

    counts_by_date = {r["d"]: int(r["c"]) for r in rows}
    labels = ["M", "T", "W", "T", "F", "S", "S"]

    out: List[Dict[str, int | str]] = []
    for i in range(days):
        d = start + timedelta(days=i)
        label = labels[d.weekday()]
        out.append({"date": d.isoformat(), "label": label, "value": counts_by_date.get(d, 0)})

    return {"days": out}


@router.get("/users/{username}/activity/last7days")
def public_user_activity_last7days(
    username: str,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    return public_user_activity(username=username, days=7, authorization=authorization, db=db)


@router.get("/cms/bootstrap/status")
def cms_bootstrap_status(db=Depends(get_db)):
    # Helps you see if bootstrap is needed
    u = db.execute(text("SELECT count(*) AS c FROM cms_users")).mappings().first()
    i = db.execute(text("SELECT count(*) AS c FROM cms_invites WHERE accepted_at IS NULL AND expires_at > NOW()")).mappings().first()
    return {"cms_users": int(u["c"]), "pending_invites": int(i["c"]), "bootstrap_email_set": bool(CMS_BOOTSTRAP_EMAIL)}

@router.post("/cms/bootstrap/invite")
def cms_bootstrap_invite(request: Request, db=Depends(get_db)):
    # One-time endpoint (optional). Only works if no cms_users exist.
    if not CMS_BOOTSTRAP_SECRET:
        raise HTTPException(status_code=400, detail="CMS_BOOTSTRAP_SECRET is not set on server")
    secret = request.headers.get("X-Bootstrap-Secret", "")
    if secret != CMS_BOOTSTRAP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid bootstrap secret")

    existing_users = db.execute(text("SELECT 1 FROM cms_users LIMIT 1")).first()
    if existing_users:
        raise HTTPException(status_code=400, detail="CMS already initialized")

    email = (CMS_BOOTSTRAP_EMAIL or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="CMS_BOOTSTRAP_EMAIL not set")

    raw = secrets.token_urlsafe(32)
    token_hash = _sha256_hex(raw)
    expires_at = datetime.utcnow() + timedelta(hours=CMS_INVITE_TTL_HOURS)

    db.execute(
        text(
            """
            INSERT INTO cms_invites (email, role, token_hash, invited_by, expires_at)
            VALUES (:email, 'admin', :token_hash, NULL, :expires_at)
            """
        ),
        {"email": email, "token_hash": token_hash, "expires_at": expires_at},
    )
    invite_url = f"{CMS_INVITE_BASE_URL}/cms/invite?token={raw}"
    _send_invite_email(email, invite_url)
    return {"ok": True}

@router.get("/cms/invites/verify")
def cms_invite_verify(token: str = Query(..., min_length=10)):
    try:
        token = token.strip()
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

        with engine.begin() as conn:
            row = conn.execute(text("""
                SELECT id, email, role, expires_at, accepted_at
                FROM cms_invites
                WHERE token_hash = :h
                LIMIT 1
            """), {"h": token_hash}).mappings().first()

        if not row:
            return JSONResponse({"ok": False, "error": "invalid_token"}, status_code=400)

        if row["accepted_at"] is not None:
            return JSONResponse({"ok": False, "error": "already_used"}, status_code=400)

        # expires_at may be stored as timestamp
        expires_at = row["expires_at"]
        if expires_at is not None:
            now = dt.datetime.utcnow()
            # if expires_at comes timezone-aware, convert now
            if getattr(expires_at, "tzinfo", None) is not None:
                now = dt.datetime.now(dt.timezone.utc)
            if expires_at < now:
                return JSONResponse({"ok": False, "error": "expired"}, status_code=400)

        return {
            "ok": True,
            "email": row["email"],
            "role": row.get("role", "admin"),
            "expires_at": row["expires_at"],
        }

    except Exception as e:
        print("CMS invite verify failed:", repr(e))
        print(traceback.format_exc())
        return JSONResponse({"ok": False, "error": "server_error"}, status_code=500)

@router.post("/cms/invites/accept")
def cms_invite_accept(payload: Dict[str, Any] = Body(...), db=Depends(get_db)):
    token = (payload.get("token") or "").strip()
    password = payload.get("password") or ""
    if not token or not password:
        raise HTTPException(status_code=400, detail="token and password required")

    th = _sha256_hex(token)
    inv = db.execute(
        text(
            """
            SELECT id, email, role, expires_at, accepted_at
            FROM cms_invites
            WHERE token_hash=:h
            """
        ),
        {"h": th},
    ).mappings().first()
    if not inv or inv["accepted_at"] is not None:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv["expires_at"] <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invite expired")

    # Create or update cms_user
    email = inv["email"].strip().lower()
    pw_hash = hash_password(password)

    existing = db.execute(
        text("SELECT id FROM cms_users WHERE lower(email)=:e"),
        {"e": email},
    ).mappings().first()

    if existing:
        cms_user_id = int(existing["id"])
        db.execute(
            text(
                """
                UPDATE cms_users
                SET password_hash=:ph, status='active', role='admin', updated_at=NOW()
                WHERE id=:id
                """
            ),
            {"ph": pw_hash, "id": cms_user_id},
        )
    else:
        row = db.execute(
            text(
                """
                INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
                VALUES (:email, 'admin', 'active', :ph, FALSE)
                RETURNING id
                """
            ),
            {"email": email, "ph": pw_hash},
        ).first()
        cms_user_id = int(row[0])

    db.execute(
        text("UPDATE cms_invites SET accepted_at=NOW() WHERE id=:id"),
        {"id": int(inv["id"])},
    )

    # Issue temp token for 2FA setup (strict)
    temp = _cms_jwt_encode({"sub": str(cms_user_id), "scope": "cms", "typ": "cms_temp", "role": "admin"}, minutes=15)
    return {"requires_2fa_setup": True, "temp_token": temp}

@router.post("/cms/auth/login")
def cms_login(payload: Dict[str, Any] = Body(...), db=Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    user = db.execute(
        text("SELECT id, password_hash, status, totp_enabled FROM cms_users WHERE lower(email)=:e"),
        {"e": email},
    ).mappings().first()
    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user["password_hash"] or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user["totp_enabled"]:
        # strict: must setup 2FA
        temp = _cms_jwt_encode({"sub": str(user["id"]), "scope": "cms", "typ": "cms_temp", "role": "admin"}, minutes=15)
        return {"needs_2fa_setup": True, "temp_token": temp}

    temp = _cms_jwt_encode({"sub": str(user["id"]), "scope": "cms", "typ": "cms_temp", "role": "admin"}, minutes=10)
    return {"needs_2fa": True, "temp_token": temp}

@router.post("/cms/auth/2fa")
def cms_login_2fa(payload: Dict[str, Any] = Body(...), db=Depends(get_db)):
    temp_token = (payload.get("temp_token") or "").strip()
    code = (payload.get("code") or "").strip().replace(" ", "")
    if not temp_token or not code:
        raise HTTPException(status_code=400, detail="temp_token and code required")
    p = _cms_jwt_decode(temp_token)
    if p.get("scope") != "cms" or p.get("typ") != "cms_temp":
        raise HTTPException(status_code=403, detail="Invalid temp token")
    cms_user_id = int(p.get("sub"))

    user = db.execute(
        text("SELECT id, totp_secret, totp_enabled, status FROM cms_users WHERE id=:id"),
        {"id": cms_user_id},
    ).mappings().first()
    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="Invalid user")

    if not user["totp_enabled"] or not user["totp_secret"]:
        raise HTTPException(status_code=403, detail="2FA not enabled")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    db.execute(text("UPDATE cms_users SET last_login_at=NOW() WHERE id=:id"), {"id": cms_user_id})
    access = _cms_jwt_encode({"sub": str(cms_user_id), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=60*24*30)
    return {"access_token": access}

@router.post("/cms/2fa/setup")
def cms_2fa_setup(_: dict = Depends(require_cms_temp), db=Depends(get_db), authorization: Optional[str] = Header(None)):
    # require_cms_temp already validated
    token = authorization.split(" ", 1)[1].strip()
    p = _cms_jwt_decode(token)
    cms_user_id = int(p.get("sub"))

    # Generate secret & save
    secret = pyotp.random_base32()
    db.execute(
        text("UPDATE cms_users SET totp_secret=:s, totp_enabled=FALSE, updated_at=NOW() WHERE id=:id"),
        {"s": secret, "id": cms_user_id},
    )

    email = db.execute(text("SELECT email FROM cms_users WHERE id=:id"), {"id": cms_user_id}).scalar()
    issuer = "Haylingua CMS"
    otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)
    return {"otpauth_url": otp_uri, "secret": secret, "issuer": issuer, "account": email}

@router.post("/cms/2fa/confirm")
def cms_2fa_confirm(payload: Dict[str, Any] = Body(...), u: dict = Depends(require_cms_temp), db=Depends(get_db), authorization: Optional[str] = Header(None)):
    code = (payload.get("code") or "").strip().replace(" ", "")
    if not code:
        raise HTTPException(status_code=400, detail="code required")

    cms_user_id = int(u["id"])
    secret = u.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA not initialized")

    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    db.execute(
        text("UPDATE cms_users SET totp_enabled=TRUE, updated_at=NOW() WHERE id=:id"),
        {"id": cms_user_id},
    )
    access = _cms_jwt_encode({"sub": str(cms_user_id), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=60*24*30)
    return {"access_token": access}

@router.get("/cms/team")
def cms_team_list(_: dict = Depends(require_cms_admin), db=Depends(get_db)):
    rows = db.execute(
        text("SELECT id, email, status, totp_enabled, created_at, last_login_at FROM cms_users ORDER BY id ASC")
    ).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/team/invite")
def cms_team_invite(payload: Dict[str, Any] = Body(...), me: dict = Depends(require_cms_admin), db=Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    raw = secrets.token_urlsafe(32)
    token_hash = _sha256_hex(raw)
    expires_at = datetime.utcnow() + timedelta(hours=CMS_INVITE_TTL_HOURS)

    db.execute(
        text(
            """
            INSERT INTO cms_invites (email, role, token_hash, invited_by, expires_at)
            VALUES (:email, 'admin', :h, :by, :exp)
            """
        ),
        {"email": email, "h": token_hash, "by": int(me["id"]), "exp": expires_at},
    )
    invite_url = f"{CMS_INVITE_BASE_URL}/cms/invite?token={raw}"
    _send_invite_email(email, invite_url)
    return {"ok": True}

# Backward-compatible legacy tokens (can be removed later)
CMS_TOKENS = set()

# -------------------- CHAPTERS --------------------

@router.get("/cms/chapters")
def cms_list_chapters(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT c.id, c.title, c.description, c.position, c.is_published,
               COALESCE(n.cnt, 0)::int AS lesson_count
        FROM chapters c
        LEFT JOIN (SELECT chapter_id, COUNT(*) AS cnt FROM lessons GROUP BY chapter_id) n
          ON n.chapter_id = c.id
        ORDER BY c.position ASC, c.id ASC
    """)).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/chapters")
async def cms_create_chapter(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    description = (body.get("description") or "").strip()
    is_published = bool(body.get("is_published", True))
    pos = body.get("position")
    if pos is None:
        pos = db.execute(text("SELECT COALESCE(MAX(position), 0) + 1 FROM chapters")).scalar() or 1
    new_id = db.execute(
        text("""
            INSERT INTO chapters (title, description, position, is_published)
            VALUES (:t, :d, :p, :pub) RETURNING id
        """),
        {"t": title, "d": description, "p": int(pos), "pub": is_published},
    ).scalar_one()
    return {"id": int(new_id)}

@router.put("/cms/chapters/{chapter_id}")
async def cms_update_chapter(chapter_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts = []
    params = {"id": chapter_id}
    for f in ["title", "description", "position", "is_published"]:
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = body[f]
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE chapters SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/chapters/{chapter_id}")
def cms_delete_chapter(chapter_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    # Keep the lessons; just detach them from the chapter.
    db.execute(text("UPDATE lessons SET chapter_id = NULL WHERE chapter_id = :id"), {"id": chapter_id})
    db.execute(text("DELETE FROM chapters WHERE id = :id"), {"id": chapter_id})
    return {"ok": True}

@router.post("/cms/chapters/reorder")
async def cms_reorder_chapters(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    order = body.get("order") or []
    for i, cid in enumerate(order):
        db.execute(text("UPDATE chapters SET position = :p WHERE id = :id"), {"p": i + 1, "id": int(cid)})
    return {"ok": True}

# -------------------- ACHIEVEMENTS (CMS builder) --------------------

ACHIEVEMENT_METRICS = {
    "lessons_completed", "streak_days", "total_xp", "correct_answers",
    "days_active", "friends_count", "chapters_completed", "gems",
}

@router.get("/cms/achievements")
def cms_list_achievements(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT id, key, title, description, icon, COALESCE(color, '#F59E0B') AS color,
               metric, threshold, reward_xp, sort_order, is_active
        FROM achievement_defs
        ORDER BY sort_order ASC, id ASC
    """)).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/achievements")
async def cms_create_achievement(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    key = (body.get("key") or "").strip()
    title = (body.get("title") or "").strip()
    metric = (body.get("metric") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if metric not in ACHIEVEMENT_METRICS:
        raise HTTPException(status_code=400, detail=f"metric must be one of {sorted(ACHIEVEMENT_METRICS)}")
    if not key:
        key = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_") or "achievement"
    # Ensure key is unique by suffixing if needed.
    base, n = key, 1
    while db.execute(text("SELECT 1 FROM achievement_defs WHERE key = :k"), {"k": key}).scalar():
        n += 1
        key = f"{base}_{n}"
    pos = db.execute(text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM achievement_defs")).scalar() or 1
    new_id = db.execute(
        text("""
            INSERT INTO achievement_defs (key, title, description, icon, color, metric, threshold, reward_xp, sort_order, is_active)
            VALUES (:k, :t, :d, :i, :color, :m, :thr, :r, :so, :act) RETURNING id
        """),
        {
            "k": key, "t": title, "d": (body.get("description") or "").strip(),
            "i": (body.get("icon") or "star").strip() or "star",
            "color": (body.get("color") or "#F59E0B").strip() or "#F59E0B",
            "m": metric,
            "thr": int(body.get("threshold") or 1), "r": int(body.get("reward_xp") or 0),
            "so": int(pos), "act": bool(body.get("is_active", True)),
        },
    ).scalar_one()
    return {"id": int(new_id), "key": key}

@router.put("/cms/achievements/{ach_id}")
async def cms_update_achievement(ach_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": ach_id}
    for f in ("title", "description", "icon", "color", "threshold", "reward_xp", "is_active"):
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = body[f]
    if "metric" in body:
        if body["metric"] not in ACHIEVEMENT_METRICS:
            raise HTTPException(status_code=400, detail="invalid metric")
        set_parts.append("metric = :metric")
        params["metric"] = body["metric"]
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE achievement_defs SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/achievements/{ach_id}")
def cms_delete_achievement(ach_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM achievement_defs WHERE id = :id"), {"id": ach_id})
    return {"ok": True}

@router.post("/cms/achievements/reorder")
async def cms_reorder_achievements(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    for i, aid in enumerate(body.get("order") or []):
        db.execute(text("UPDATE achievement_defs SET sort_order = :p WHERE id = :id"), {"p": i + 1, "id": int(aid)})
    return {"ok": True}

@router.post("/cms/exercises/reorder")
async def cms_reorder_exercises(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    # Persist the new sequence by rewriting each exercise's "order" field.
    for i, eid in enumerate(body.get("order") or []):
        db.execute(text('UPDATE exercises SET "order" = :p WHERE id = :id'), {"p": i + 1, "id": int(eid)})
    return {"ok": True}

@router.post("/cms/seed/curriculum")
def cms_seed_curriculum(request: Request, db=Depends(get_db)):
    """Populate the built-in 10-chapter starter curriculum on demand. Idempotent."""
    require_cms(request, db)
    from seed_curriculum import seed_curriculum
    try:
        res = seed_curriculum()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}

# -------------------- EMAIL DIAGNOSTICS (CMS) --------------------

@router.get("/cms/email/status")
def cms_email_status(request: Request, db=Depends(get_db)):
    """Report which email channel is configured (no secrets) so admins can debug delivery."""
    require_cms(request, db)
    brevo_key = bool((os.getenv("BREVO_API_KEY") or "").strip())
    sender = (os.getenv("BREVO_SENDER_EMAIL") or os.getenv("EMAIL_FROM") or "").strip() or None
    smtp = bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))
    return {
        "brevo_api_key_set": brevo_key,
        "brevo_enabled_flag": (os.getenv("BREVO_ENABLED") or "").strip().lower() in ("1", "true", "yes", "on"),
        "sender": sender,
        "smtp_configured": smtp,
        "ready": (brevo_key and bool(sender)) or smtp,
    }


@router.post("/cms/email/test")
async def cms_email_test(request: Request, db=Depends(get_db)):
    """Send a real test email and return the exact outcome (incl. the Brevo error)."""
    require_cms(request, db)
    body = await request.json()
    to = str((body or {}).get("to") or "").strip()
    if not to or "@" not in to:
        raise HTTPException(status_code=400, detail="A valid 'to' email is required")
    try:
        from integrations.brevo import send_transactional_email_result
    except Exception as e:
        return {"ok": False, "reason": "import_error", "error": repr(e)}
    res = send_transactional_email_result(
        to_email=to,
        subject="Haylingua — test email ✅",
        text="This is a test email from Haylingua. If you got this, email delivery works.",
        html="<div style='font-family:sans-serif'><h2>It works! ✅</h2><p>This is a test email from Haylingua. Email delivery is configured correctly.</p></div>",
    )
    return res


# -------------------- SHOP & ECONOMY (CMS) --------------------

@router.get("/cms/shop/items")
def cms_list_shop_items(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT id, title, description, icon, price, effect, effect_amount, sort_order, is_active
        FROM shop_items ORDER BY sort_order ASC, id ASC
    """)).mappings().all()
    return {"items": [dict(r) for r in rows], "effects": sorted(SHOP_EFFECTS)}

@router.post("/cms/shop/items")
async def cms_create_shop_item(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    title = (body.get("title") or "").strip()
    effect = (body.get("effect") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if effect not in SHOP_EFFECTS:
        raise HTTPException(status_code=400, detail=f"effect must be one of {sorted(SHOP_EFFECTS)}")
    pos = db.execute(text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shop_items")).scalar() or 1
    new_id = db.execute(
        text("""
            INSERT INTO shop_items (title, description, icon, price, effect, effect_amount, sort_order, is_active)
            VALUES (:t, :d, :ic, :pr, :eff, :amt, :so, :act) RETURNING id
        """),
        {
            "t": title, "d": (body.get("description") or "").strip(), "ic": (body.get("icon") or "gem").strip() or "gem",
            "pr": int(body.get("price") or 0), "eff": effect, "amt": int(body.get("effect_amount") or 0),
            "so": int(pos), "act": bool(body.get("is_active", True)),
        },
    ).scalar_one()
    return {"id": int(new_id)}

@router.put("/cms/shop/items/{item_id}")
async def cms_update_shop_item(item_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": item_id}
    for f in ("title", "description", "icon", "price", "effect_amount", "is_active"):
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = body[f]
    if "effect" in body:
        if body["effect"] not in SHOP_EFFECTS:
            raise HTTPException(status_code=400, detail="invalid effect")
        set_parts.append("effect = :effect")
        params["effect"] = body["effect"]
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE shop_items SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/shop/items/{item_id}")
def cms_delete_shop_item(item_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM shop_items WHERE id = :id"), {"id": item_id})
    return {"ok": True}

@router.post("/cms/shop/items/reorder")
async def cms_reorder_shop_items(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    for i, iid in enumerate(body.get("order") or []):
        db.execute(text("UPDATE shop_items SET sort_order = :p WHERE id = :id"), {"p": i + 1, "id": int(iid)})
    return {"ok": True}

@router.get("/cms/shop/chest")
def cms_get_chest(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("SELECT id, gems, weight FROM chest_rewards ORDER BY sort_order ASC, id ASC")).mappings().all()
    return {"rewards": [dict(r) for r in rows]}

@router.put("/cms/shop/chest")
async def cms_set_chest(request: Request, db=Depends(get_db)):
    """Replace the whole chest reward table with the posted rows: [{gems, weight}]."""
    require_cms(request, db)
    body = await request.json()
    rows = body.get("rewards") or []
    cleaned = []
    for r in rows:
        try:
            g = int(r.get("gems"))
            w = int(r.get("weight"))
        except (TypeError, ValueError):
            continue
        if g >= 0 and w > 0:
            cleaned.append((g, w))
    if not cleaned:
        raise HTTPException(status_code=400, detail="Provide at least one reward with weight > 0")
    db.execute(text("DELETE FROM chest_rewards"))
    for i, (g, w) in enumerate(cleaned):
        db.execute(text("INSERT INTO chest_rewards (gems, weight, sort_order) VALUES (:g, :w, :so)"), {"g": g, "w": w, "so": i})
    return {"ok": True, "count": len(cleaned)}

# -------------------- LESSONS --------------------

@router.get("/cms/lessons")
def cms_list_lessons(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    q = text("""
    SELECT id, slug, title, description, level, xp, xp_reward, is_published, chapter_id,
           COALESCE(lesson_type, 'standard') as lesson_type,
           COALESCE(config, '{}'::jsonb) as config
    FROM lessons
    ORDER BY level ASC, id ASC
    """)
    rows = db.execute(q).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/lessons")
async def cms_create_lesson(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()

    slug = (body.get("slug") or "").strip()
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip()
    level = int(body.get("level") or 1)
    xp = int(body.get("xp") or 40)
    xp_reward = int(body.get("xp_reward") or xp)

    # Reading lessons store additional structure in config.
    lesson_type = (body.get("lesson_type") or "standard").strip() or "standard"
    config = body.get("config") or {}

    # publish by default so it appears in /lessons
    is_published = bool(body.get("is_published", True))

    chapter_raw = body.get("chapter_id")
    chapter_id = int(chapter_raw) if chapter_raw not in (None, "", "null") else None

    if not slug or not title:
        raise HTTPException(400, detail="slug and title are required")

    new_id = db.execute(
        text("""
            INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config, chapter_id)
            VALUES (:slug, :title, :description, :level, :xp, :xp_reward, :is_published, :lesson_type, CAST(:config AS jsonb), :chapter_id)
            RETURNING id
        """),
        {
            "slug": slug,
            "title": title,
            "description": description,
            "level": level,
            "xp": xp,
            "xp_reward": xp_reward,
            "is_published": is_published,
            "lesson_type": lesson_type,
            "config": json.dumps(config),
            "chapter_id": chapter_id,
        },
    ).scalar_one()

    return {"id": int(new_id)}

@router.put("/cms/lessons/{lesson_id}")
async def cms_update_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()

    # IMPORTANT: include lesson_type + config so Reading lessons persist correctly.
    fields = ["slug", "title", "description", "level", "xp", "xp_reward", "is_published", "lesson_type", "config", "chapter_id"]
    updates = {}
    for f in fields:
        if f in body:
            updates[f] = body[f]
    if "chapter_id" in updates:
        cr = updates["chapter_id"]
        updates["chapter_id"] = int(cr) if cr not in (None, "", "null") else None

    if len(updates) == 0:
        return {"ok": True}

    # build SQL with loops/ifs (minimal helpers)
    set_parts = []
    params = {"id": lesson_id}
    for k, v in updates.items():
        if k == "config":
            set_parts.append("config = CAST(:config AS jsonb)")
            params["config"] = json.dumps(v or {})
        else:
            set_parts.append(f"{k} = :{k}")
            params[k] = v

    q = text(f"UPDATE lessons SET {', '.join(set_parts)} WHERE id = :id")
    db.execute(q, params)
    return {"ok": True}

@router.delete("/cms/lessons/{lesson_id}")
def cms_delete_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    # delete exercises/options first if you don’t have CASCADE
    db.execute(text("DELETE FROM exercise_options WHERE exercise_id IN (SELECT id FROM exercises WHERE lesson_id = :id)"), {"id": lesson_id})
    db.execute(text("DELETE FROM exercises WHERE lesson_id = :id"), {"id": lesson_id})
    db.execute(text("DELETE FROM lessons WHERE id = :id"), {"id": lesson_id})
    return {"ok": True}
    
@router.post("/cms/lessons/{lesson_id}/publish")
def cms_publish_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(
        text("UPDATE lessons SET is_published = true WHERE id = :id"),
        {"id": lesson_id},
    )
    return {"ok": True, "is_published": True}

@router.post("/cms/lessons/{lesson_id}/unpublish")
def cms_unpublish_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(
        text("UPDATE lessons SET is_published = false WHERE id = :id"),
        {"id": lesson_id},
    )
    return {"ok": True, "is_published": False}
# -------------------- EXERCISES --------------------

@router.get("/cms/lessons/{lesson_id}/exercises")
def cms_list_exercises(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    q = text("""
        SELECT id, lesson_id, kind, type, prompt, expected_answer, sentence_before, sentence_after, "order", xp, config
        FROM exercises
        WHERE lesson_id = :lesson_id
        ORDER BY "order" ASC, id ASC
    """)
    rows = db.execute(q, {"lesson_id": lesson_id}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/cms/exercises/{exercise_id}")
def cms_get_exercise(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    row = db.execute(text("""
        SELECT id, lesson_id, kind, type, prompt, expected_answer, sentence_before, sentence_after, "order", xp, config
        FROM exercises
        WHERE id = :id
    """), {"id": exercise_id}).mappings().first()
    if not row:
        raise HTTPException(404, detail="Exercise not found")
    return dict(row)


@router.post("/cms/exercises")
async def cms_create_exercise(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    # Defensive: if FE accidentally sends a raw number (e.g. just lesson_id)
    # FastAPI will parse it as int and our .get(...) calls would crash.
    body = await request.json()
    if not isinstance(body, dict):
        if isinstance(body, int):
            body = {"lesson_id": body}
        else:
            raise HTTPException(400, detail="Invalid JSON body; expected an object")

    lesson_id = int(body.get("lesson_id") or 0)
    kind = normalize_kind((body.get("kind") or "").strip())
    prompt = (body.get("prompt") or "").strip()
    expected_answer = body.get("expected_answer")
    order = int(body.get("order") or 1)
    config = body.get("config") or {}
    xp = int(body.get("xp") or 10)
    validate_exercise_config(kind, config)

    if not lesson_id or not kind:
        raise HTTPException(400, detail="lesson_id and kind are required")

    q = text("""
    INSERT INTO exercises (
        lesson_id,
        kind,
        prompt,
        expected_answer,
        "order",
        xp,
        config
    )
    VALUES (
        :lesson_id,
        :kind,
        :prompt,
        :expected_answer,
        :order,
        :xp,
        CAST(:config AS jsonb)
    )
    RETURNING id
""")

    params = {
        "lesson_id": lesson_id,
        "kind": kind,
        "prompt": prompt,
        "expected_answer": expected_answer,
        "order": order,
        "xp": xp,
        "config": json.dumps(config or {}),
    }

    new_id = db.execute(q, params).scalar_one()
    return {"id": new_id}

@router.put("/cms/exercises/{exercise_id}")
async def cms_update_exercise(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()

    allowed = ["kind", "type", "prompt", "expected_answer", "sentence_before", "sentence_after", "order", "xp", "config"]
    updates = {}
    for f in allowed:
        if f in body:
            updates[f] = body[f]

    if len(updates) == 0:
        return {"ok": True}

    # 1) Normalize kind early (so validation + DB write use the same string)
    if "kind" in updates and updates["kind"] is not None:
        updates["kind"] = normalize_kind(str(updates["kind"]))

    # 2) Validate multi_select when config is provided OR kind becomes multi_select
    if "config" in updates:
        cfg = updates["config"] or {}
        if not isinstance(cfg, dict):
            raise HTTPException(400, detail="config must be an object")

        kind_for_validation = updates.get("kind")  # new kind if updated
        if kind_for_validation is None:
            # kind not updated -> fetch current kind from DB
            row = db.execute(
                text("SELECT kind FROM exercises WHERE id = :id"),
                {"id": exercise_id},
            ).mappings().first()
            if not row:
                raise HTTPException(404, detail="Exercise not found")
            kind_for_validation = str(row["kind"] or "")

        validate_exercise_config(kind_for_validation, cfg)

    # 3) Build SQL + params
    set_parts = []
    params = {"id": exercise_id}

    for k, v in updates.items():
        if k == "config":
            set_parts.append("config = CAST(:config AS jsonb)")
            params["config"] = json.dumps(v or {})
        elif k == "order":
            set_parts.append("\"order\" = :order")
            params["order"] = int(v or 1)
        elif k == "xp":
            set_parts.append("xp = :xp")
            params["xp"] = int(v or 0)
        else:
            set_parts.append(f"{k} = :{k}")
            params[k] = v

    q = text(f"UPDATE exercises SET {', '.join(set_parts)} WHERE id = :id")
    db.execute(q, params)

    return {"ok": True}

@router.delete("/cms/exercises/{exercise_id}")
def cms_delete_exercise(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM exercise_options WHERE exercise_id = :id"), {"id": exercise_id})
    db.execute(text("DELETE FROM exercises WHERE id = :id"), {"id": exercise_id})
    return {"ok": True}





def recompute_lesson_progress(db, user_id: int, lesson_id: int):
    # 1) total exercises in lesson
    total_row = db.execute(
        text("SELECT COUNT(*) AS c FROM exercises WHERE lesson_id = :lid"),
        {"lid": lesson_id},
    ).mappings().first()

    total_ex = int(total_row["c"] or 0)

    # avoid division by zero
    if total_ex == 0:
        total_ex = 1

    # 2) how many exercises user has correct at least once
    correct_row = db.execute(
        text("""
            SELECT COUNT(DISTINCT uea.exercise_id) AS c
            FROM user_exercise_attempts uea
            JOIN exercises e ON e.id = uea.exercise_id
            WHERE uea.user_id = :uid
              AND e.lesson_id = :lid
              AND uea.is_correct = TRUE
        """),
        {"uid": user_id, "lid": lesson_id},
    ).mappings().first()

    correct_ex = int(correct_row["c"] or 0)

    # 3) earned XP = sum XP of DISTINCT correct exercises
    xp_row = db.execute(
        text("""
            SELECT COALESCE(SUM(t.xp), 0) AS xp
            FROM (
                SELECT DISTINCT e.id, e.xp
                FROM user_exercise_attempts uea
                JOIN exercises e ON e.id = uea.exercise_id
                WHERE uea.user_id = :uid
                  AND e.lesson_id = :lid
                  AND uea.is_correct = TRUE
            ) t
        """),
        {"uid": user_id, "lid": lesson_id},
    ).mappings().first()

    earned_xp = int(xp_row["xp"] or 0)

    # 4) completion
    completion_ratio = correct_ex / total_ex
    is_completed = completion_ratio >= 0.70

    # 5) store progress (use your existing table)
    # If your table is user_lesson_progress and it has these columns, do:
    db.execute(
        text("""
            INSERT INTO user_lesson_progress (
                user_id, lesson_id, exercises_total, exercises_completed, xp_earned, last_seen_at, completed_at
            )
            VALUES (
                :uid, :lid, :total, :completed, :xp, NOW(), CASE WHEN :done THEN NOW() ELSE NULL END
            )
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET
                exercises_total = EXCLUDED.exercises_total,
                exercises_completed = EXCLUDED.exercises_completed,
                xp_earned = EXCLUDED.xp_earned,
                last_seen_at = NOW(),
                completed_at = CASE WHEN :done THEN COALESCE(user_lesson_progress.completed_at, NOW()) ELSE NULL END
        """),
        {
            "uid": user_id,
            "lid": lesson_id,
            "total": total_ex,
            "completed": correct_ex,
            "xp": earned_xp,
            "done": is_completed,
        },
    )

    return {
        "total_exercises": total_ex,
        "correct_exercises": correct_ex,
        "earned_xp": earned_xp,
        "completion_ratio": completion_ratio,
        "completed": is_completed,
    }
# -------------------- OPTIONS --------------------

@router.get("/cms/exercises/{exercise_id}/options")
def cms_list_options(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT id, exercise_id, text, is_correct, side, match_key
        FROM exercise_options
        WHERE exercise_id = :id
        ORDER BY id ASC
    """), {"id": exercise_id}).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/options")
async def cms_create_option(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()

    exercise_id = int(body.get("exercise_id") or 0)
    text_val = (body.get("text") or "").strip()
    is_correct = bool(body.get("is_correct") or False)
    side = body.get("side")
    match_key = body.get("match_key")

    if not exercise_id or not text_val:
        raise HTTPException(400, detail="exercise_id and text are required")

    new_id = db.execute(text("""
        INSERT INTO exercise_options (exercise_id, text, is_correct, side, match_key)
        VALUES (:exercise_id, :text, :is_correct, :side, :match_key)
        RETURNING id
    """), {
        "exercise_id": exercise_id, "text": text_val,
        "is_correct": is_correct, "side": side, "match_key": match_key
    }).scalar_one()
    return {"id": new_id}

@router.put("/cms/options/{option_id}")
async def cms_update_option(option_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()

    allowed = ["text", "is_correct", "side", "match_key"]
    updates = {}
    for f in allowed:
        if f in body:
            updates[f] = body[f]

    if len(updates) == 0:
        return {"ok": True}

    set_parts = []
    params = {"id": option_id}
    for k, v in updates.items():
        set_parts.append(f"{k} = :{k}")
        params[k] = v

    db.execute(text(f"UPDATE exercise_options SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/options/{option_id}")
def cms_delete_option(option_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM exercise_options WHERE id = :id"), {"id": option_id})
    return {"ok": True}

# --------- ElevenLabs TTS ----------

# --------- Live stats SSE ----------

@router.get("/me/events")
async def me_live_events(
    token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Server-Sent Events stream: pushes xp/streak/gems/hearts every 10s."""
    bearer = authorization or (f"Bearer {token}" if token else None)
    user_id = _get_user_id_from_bearer(bearer)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async def generate():
        try:
            while True:
                try:
                    with engine.connect() as conn:
                        row = conn.execute(
                            text("""
                                SELECT u.gems, u.current_streak,
                                       COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS total_xp,
                                       u.hearts_current, u.hearts_max, u.is_premium
                                FROM users u
                                LEFT JOIN lesson_progress lp ON lp.user_id = u.id
                                WHERE u.id = :uid
                                GROUP BY u.id
                            """),
                            {"uid": int(user_id)},
                        ).mappings().first()
                    if row:
                        payload = {
                            "xp": int(row["total_xp"] or 0),
                            "streak": int(row["current_streak"] or 0),
                            "gems": int(row["gems"] or 0),
                            "hearts_current": int(row["hearts_current"] or 0),
                            "hearts_max": int(row["hearts_max"] or 5),
                            "is_premium": bool(row["is_premium"]),
                        }
                        yield f"data: {json.dumps(payload)}\n\n"
                except Exception:
                    pass
                await asyncio.sleep(10)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --------- ElevenLabs TTS ----------

"""Legacy /tts endpoint.

Reading mode and some older exercise kinds still call /tts directly.
We keep it, but:
  - default to Eleven v3 model (configurable via ELEVEN_MODEL_ID)
  - cache generated MP3 on disk so repeated requests are instant

ElevenLabs "Create speech" API: POST /v1/text-to-speech/{voice_id}
"""

import hashlib
from pathlib import Path


ELEVEN_MODEL_ID = os.getenv("ELEVEN_MODEL_ID", "eleven_v3") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence, Eleven Labs Model is used for male, female feature. 


def _tts_cache_dir() -> Path:
    base = os.getenv("AUDIO_DIR", "") # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence. 
    if base:
        return Path(base) / "tts_cache"
    return Path(__file__).resolve().parent / "uploads" / "tts_cache"


def _tts_cache_key(text_value: str, voice_id: str, model_id: str) -> str:
    h = hashlib.sha256()
    h.update(model_id.encode("utf-8"))
    h.update(b"\n")
    h.update(voice_id.encode("utf-8"))
    h.update(b"\n")
    h.update(text_value.encode("utf-8"))
    return h.hexdigest()


@router.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=500, detail="TTS not configured on server")

    text_value = (payload.text or "").strip()
    if not text_value:
        raise HTTPException(status_code=400, detail="Text is empty")

    voice_id = payload.voice_id or DEFAULT_VOICE_ID
    model_id = getattr(payload, "model_id", None) or ELEVEN_MODEL_ID

    cache_dir = _tts_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = _tts_cache_key(text_value, voice_id, model_id)
    mp3_path = cache_dir / f"{key}.mp3"

    if mp3_path.exists() and mp3_path.stat().st_size > 0:
        return Response(content=mp3_path.read_bytes(), media_type="audio/mpeg")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    params = {"output_format": "mp3_44100_128"}
    headers = {"xi-api-key": ELEVEN_API_KEY, "Content-Type": "application/json"}
    body = {"text": text_value, "model_id": model_id}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, params=params, headers=headers, json=body)
        if r.status_code != 200:
            err = (r.text or "").strip()
            if len(err) > 600:
                err = err[:600] + "…"
            print("ElevenLabs error:", r.status_code, err)
            raise HTTPException(status_code=502, detail=f"ElevenLabs error ({r.status_code})")
        audio_bytes = r.content
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e

    try:
        mp3_path.write_bytes(audio_bytes)
    except Exception:
        pass

    return Response(content=audio_bytes, media_type="audio/mpeg")
