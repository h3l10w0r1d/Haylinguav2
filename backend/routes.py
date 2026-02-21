# backend/routes.py
import os
import json
from datetime import datetime, timedelta
import uuid
from typing import List, Dict, Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Body, Header, Query, UploadFile, File
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine import Connection
import hashlib, traceback, datetime as dt
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

# Brevo (Sendinblue) integration (contacts + events)
try:
    from integrations.brevo import upsert_contact as _brevo_upsert_contact
    from integrations.brevo import track_event as _brevo_track_event
except Exception:
    _brevo_upsert_contact = None
    _brevo_track_event = None



import math


#CMS
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import text
from database import get_db
import json

router = APIRouter()

# ---------------- Email verification (6-digit code) ----------------
# Important: this project uses INTEGER user ids (users.id).

import hashlib
import random
import smtplib
from email.message import EmailMessage

EMAIL_CODE_PEPPER = os.getenv("EMAIL_CODE_PEPPER", "change_me")

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
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    email_from = os.getenv("EMAIL_FROM", smtp_user or "no-reply@haylingua.local")

    if not (smtp_host and smtp_user and smtp_pass):
        # Dev-safe fallback
        print("\n--- EMAIL (dev mode) ---")
        print("To:", to_email)
        print("Subject:", subject)
        print(body)
        print("--- END EMAIL ---\n")
        return False  # Email not sent, only logged

    try:
        msg = EmailMessage()
        msg["From"] = email_from
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.starttls()
            s.login(smtp_user, smtp_pass)
            s.send_message(msg)
        
        print(f"✅ Email sent successfully to {to_email}")
        return True  # Email sent successfully
    except Exception as e:
        print(f"❌ Email sending failed: {e}")
        # Still log to console in case of failure
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
    is_correct: bool
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


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


class VerifyEmailIn(BaseModel):
    code: str


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


def _compute_streak_days(db: Connection, user_id: int) -> int:
    """Compute current streak (consecutive days ending today) based on ANY exercise attempt.

    Uses UTC dates (DATE(created_at)).
    """
    # Last 365 days is plenty for streak calculation
    rows = db.execute(
        text(
            """
            SELECT DISTINCT DATE(created_at) AS d
            FROM user_exercise_attempts
            WHERE user_id = :u
              AND created_at >= NOW() - INTERVAL '365 days'
            """
        ),
        {"u": user_id},
    ).mappings().all()

    days = {r["d"] for r in rows if r.get("d") is not None}
    if not days:
        return 0

    today = datetime.utcnow().date()
    streak = 0
    cur = today
    while cur in days:
        streak += 1
        cur = cur - timedelta(days=1)
    return streak


def _brevo_sync_user(db: Connection, user_id: int, *, event: str | None = None, event_props: dict | None = None) -> None:
    """Best-effort sync to Brevo.

    This must NEVER break the API flow.
    """
    if _brevo_upsert_contact is None:
        return
    try:
        u = db.execute(
            text(
                """
                SELECT id, email, username, display_name, first_name, last_name, bio,
                       avatar_url, banner_url, friends_public, is_hidden, email_verified
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
                  COALESCE(SUM(lp.xp_earned), 0) AS total_xp,
                  COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.is_completed = TRUE) AS lessons_completed,
                  (SELECT COUNT(*) FROM user_exercise_logs l WHERE l.user_id = :u) AS exercises_done
                FROM lesson_progress lp
                WHERE lp.user_id = :u
                """
            ),
            {"u": int(user_id)},
        ).mappings().first() or {}

        streak = _compute_streak_days(db, int(user_id))

        # "As much data as possible" – send what we have today.
        attrs = {
            "HAYLINGUA_USER_ID": int(u.get("id")),
            "USERNAME": (u.get("username") or "") or None,
            "DISPLAY_NAME": (u.get("display_name") or "") or None,
            "FIRST_NAME": (u.get("first_name") or "") or None,
            "LAST_NAME": (u.get("last_name") or "") or None,
            "BIO": (u.get("bio") or "") or None,
            "AVATAR_URL": (u.get("avatar_url") or "") or None,
            "BANNER_URL": (u.get("banner_url") or "") or None,
            "FRIENDS_PUBLIC": bool(u.get("friends_public")),
            "IS_HIDDEN": bool(u.get("is_hidden")),
            "EMAIL_VERIFIED": bool(u.get("email_verified")),
            "XP_TOTAL": int(stats.get("total_xp") or 0),
            "LESSONS_COMPLETED": int(stats.get("lessons_completed") or 0),
            "EXERCISES_COMPLETED": int(stats.get("exercises_done") or 0),
            "STREAK_DAYS": int(streak),
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
                    "total_xp": int(stats.get("total_xp") or 0),
                    "streak_days": int(streak),
                }
            )
            _brevo_track_event(email=email, event=event, properties=props)
    except Exception:
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    requester_id = _get_user_id_from_bearer(authorization)
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
    requester_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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

    return {"ok": True, "status": "accepted"}

@router.post("/friends/requests/{request_id}/reject")
def friends_request_reject(
    request_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
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
    xp: int
    lesson_type: str = "standard"
    config: Dict[str, Any] = {}
    streak: int
    level: int
    rank: int



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

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or ""
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM") or "HS256"


def _get_user_id_from_bearer(authorization: Optional[str]) -> Optional[int]:
    """
    Reads Authorization: Bearer <token>, decodes JWT, returns user_id from 'sub'.
    Returns None if header missing.
    Raises 401 if header present but invalid.
    """
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
        return int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Could not validate credentials")



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


def _get_hearts(db: Connection, user_id: int) -> tuple[int, int]:
    _ensure_hearts_initialized(db, user_id)
    row = db.execute(
        text("SELECT hearts_current, hearts_max FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first()
    if not row:
        return (DEFAULT_HEARTS_MAX, DEFAULT_HEARTS_MAX)
    cur = int(row.get("hearts_current") or DEFAULT_HEARTS_MAX)
    mx = int(row.get("hearts_max") or DEFAULT_HEARTS_MAX)
    return (cur, mx)

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
    
    # In dev mode (when email wasn't actually sent), include the code in response
    # This allows the frontend to display it to the user
    if not email_sent:
        response_data["verification_code"] = code
        print(f"⚠️  DEV MODE: Including verification code in response: {code}")

    # Best-effort Brevo sync (contacts + events). Never blocks signup.
    _brevo_sync_user(db, int(user_id), event="user_registered")

    return response_data


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Connection = Depends(get_db)):
    # 1) clean inputs
    identifier = (payload.email or "").strip()
    password = (payload.password or "")

    # 2) validate inputs (inline)
    if identifier == "":
        raise HTTPException(status_code=400, detail={"field": "email", "errors": ["Email or username is required"]})
    if password.strip() == "":
        raise HTTPException(status_code=400, detail={"field": "password", "errors": ["Password is required"]})

    # Determine if identifier is email by counting '@'
    at_count = 0
    for ch in identifier:
        if ch == "@":
            at_count += 1

    is_email = at_count == 1

    # 3) load user from DB using email OR username
    if is_email:
        key = identifier.lower()
        row = db.execute(
            text(
                """
                SELECT id, email, password_hash
                FROM users
                WHERE email = :email
                """
            ),
            {"email": key},
        ).mappings().first()
    else:
        key = identifier
        row = db.execute(
            text(
                """
                SELECT id, email, password_hash
                FROM users
                WHERE LOWER(username) = LOWER(:u)
                """
            ),
            {"u": key},
        ).mappings().first()

    if row is None:
        raise HTTPException(status_code=400, detail="Invalid email/username or password")

    # 5) check password
    ok = verify_password(password, row["password_hash"])
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid email/username or password")

    # 6) token
    token = create_token(row["id"])
    return AuthResponse(access_token=token, email=row["email"])


@router.post("/auth/verify-email")
def verify_email(
    payload: VerifyEmailIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    code = (payload.code or "").strip()
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
    user_id = _get_user_id_from_bearer(authorization)
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
    
    # In dev mode, add the code to the response
    if not email_sent:
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

    # 1) Determine user_id (prefer JWT if present)
    user_id = _get_user_id_from_bearer(authorization)

    if user_id is None:
        # fallback to email payload
        if payload is None or not payload.email:
            raise HTTPException(status_code=401, detail="Missing credentials (token or email)")

        user_row = db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": payload.email},
        ).mappings().first()

        if user_row is None:
            raise HTTPException(status_code=400, detail="User not found")

        user_id = user_row["id"]

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

    # Prefer auth-based lookup (safer, avoids leaking emails in URLs)
    user_id = _get_user_id_from_bearer(authorization)

    email = (email or "").strip()

    # If no valid token and no email provided, we can't resolve a user.
    if not user_id and not email:
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")

    if email:
        user = db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email},
        ).mappings().first()
        if not user:
            return StatsOut(total_xp=0, lessons_completed=0, streak=0)
        user_id = int(user["id"])

    r = db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(lp.xp_earned), 0) AS total_xp,
              COALESCE(SUM(CASE WHEN lp.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS lessons_completed
            FROM lesson_progress lp
            WHERE lp.user_id = :uid
            """
        ),
        {"uid": user_id},
    ).mappings().first()

    total_xp = int(r["total_xp"] or 0) if r else 0
    lessons_completed = int(r["lessons_completed"] or 0) if r else 0

    streak = _compute_streak_days(db, user_id)

    return StatsOut(total_xp=total_xp, lessons_completed=lessons_completed, streak=streak)


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


@router.get("/me/lessons/progress", response_model=list[LessonProgressOut])
def me_lessons_progress(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Dashboard helper: lessons joined with per-user progress and unlock state."""
    user_id = _get_user_id_from_bearer(authorization)
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
              ulp.completed_at
            FROM lessons l
            LEFT JOIN ex ON ex.lesson_id = l.id
            LEFT JOIN user_lesson_progress ulp
              ON ulp.lesson_id = l.id
             AND ulp.user_id = :u
            ORDER BY l.level ASC, l.id ASC
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
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # Derive lesson_id from the exercise (FE historically didn't send it)
    ex_row = db.execute(
        text("SELECT lesson_id FROM exercises WHERE id = :ex"),
        {"ex": exercise_id},
    ).mappings().first()
    if not ex_row:
        raise HTTPException(status_code=404, detail="Exercise not found")

    lesson_id = int(ex_row["lesson_id"])
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
            "ok": bool(payload.is_correct),
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
        is_correct=bool(payload.is_correct),
    )
    _update_review_queue(db, user_id, lesson_id, exercise_id, bool(payload.is_correct))
    acc = _get_accuracy(db, user_id, lesson_id)

    # Snapshot XP before recompute so we can return per-attempt delta
    prev_xp = db.execute(
        text("SELECT xp_earned FROM user_lesson_progress WHERE user_id = :uid AND lesson_id = :lid"),
        {"uid": user_id, "lid": lesson_id},
    ).scalar_one_or_none()
    prev_xp = int(prev_xp or 0)

    # ✅ NEW: recompute lesson completion / xp-based progress
    progress = recompute_lesson_progress(db, user_id, lesson_id)

    earned_xp_delta = int(progress.get("earned_xp", 0)) - prev_xp
    if earned_xp_delta < 0:
        earned_xp_delta = 0

    # Hearts: decrement on wrong answers (keep DB as source of truth)
    _ensure_hearts_initialized(db, user_id)
    if not bool(payload.is_correct):
        db.execute(
            text(
                """
                UPDATE users
                SET hearts_current = GREATEST(COALESCE(hearts_current, hearts_max, :mx) - 1, 0)
                WHERE id = :uid
                """
            ),
            {"uid": user_id, "mx": DEFAULT_HEARTS_MAX},
        )

    hearts = db.execute(
        text("SELECT COALESCE(hearts_current, :mx) AS hearts_current, COALESCE(hearts_max, :mx) AS hearts_max FROM users WHERE id = :uid"),
        {"uid": user_id, "mx": DEFAULT_HEARTS_MAX},
    ).mappings().first() or {"hearts_current": DEFAULT_HEARTS_MAX, "hearts_max": DEFAULT_HEARTS_MAX}

    return AttemptOut(
        ok=True,
        attempt_id=int(attempt_id),
        accuracy=acc,
        earned_xp=int(progress["earned_xp"]),
        earned_xp_delta=int(earned_xp_delta),
        completion_ratio=float(progress["completion_ratio"]),
        completed=bool(progress["completed"]),
        hearts_current=int(hearts["hearts_current"]),
        hearts_max=int(hearts["hearts_max"]),
        )


@router.post("/me/exercises/{exercise_id}/log", response_model=LogOut)
def record_exercise_log(
    exercise_id: int,
    payload: LogIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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

    # Stats
    total_xp: int = 0
    streak: int = 0


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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    row = db.execute(
        text("SELECT id, email, username, display_name, first_name, last_name, bio, avatar_url, banner_url, profile_theme, friends_public, is_hidden, email_verified FROM users WHERE id = :id"),
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

    streak = _compute_streak_days(db, int(user_id))
    payload = dict(row)
    payload["total_xp"] = int(stats_row["total_xp"] or 0)
    payload["streak"] = int(streak)
    return MeOut(**payload)


@router.get("/me/hearts")
def me_hearts(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Returns the current hearts (lives) state for the logged-in user."""
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    cur, mx = _get_hearts(db, user_id)
    return {"hearts_current": cur, "hearts_max": mx}


@router.put("/me/profile", response_model=MeOut)
def me_profile_put(
    payload: MeProfileUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
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

    row = db.execute(
        text("SELECT id, email, username, display_name, first_name, last_name, bio, avatar_url, banner_url, profile_theme, friends_public, is_hidden, email_verified FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()

    # Best-effort Brevo sync for profile changes.
    _brevo_sync_user(db, int(user_id), event="profile_updated")

    return MeOut(**dict(row))


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
    user_id = _get_user_id_from_bearer(authorization)
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
        text("UPDATE users SET password_hash=:ph, updated_at=NOW() WHERE id=:id"),
        {"ph": hash_password(new_password), "id": int(user_id)},
    )
    return {"ok": True}


@router.post("/me/change-email/start")
def me_change_email_start(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
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
    # Dev fallback (same as signup verify): include code when email didn't send.
    if not email_sent:
        resp["verification_code"] = code
    return resp


@router.post("/me/change-email/confirm")
def me_change_email_confirm(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
        env = os.getenv("UPLOADS_DIR")
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
    user_id = _get_user_id_from_bearer(authorization)
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
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
            FROM users u
            LEFT JOIN lesson_progress lp ON lp.user_id = u.id
            GROUP BY u.id, u.email, u.username
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
                xp=xp,
                streak=streak,
                level=level,
                rank=i,
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

CMS_INVITE_TTL_HOURS = int(os.getenv("CMS_INVITE_TTL_HOURS") or "72")
CMS_INVITE_BASE_URL = (os.getenv("CMS_INVITE_BASE_URL") or "https://cms.haylingua.am").rstrip("/")
CMS_BOOTSTRAP_EMAIL = (os.getenv("CMS_BOOTSTRAP_EMAIL") or "").strip().lower()
CMS_BOOTSTRAP_SECRET = (os.getenv("CMS_BOOTSTRAP_SECRET") or "").strip()

def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _cms_jwt_encode(payload: dict, minutes: int) -> str:
    # Reuse the same JWT secret as main auth
    secret = (os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")
    alg = (os.getenv("JWT_ALGORITHM") or "HS256").strip()
    exp = datetime.utcnow() + timedelta(minutes=minutes)
    full = {**payload, "exp": exp}
    return jwt.encode(full, secret, algorithm=alg)

def _cms_jwt_decode(token: str) -> dict:
    secret = (os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")
    alg = (os.getenv("JWT_ALGORITHM") or "HS256").strip()
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

def _send_invite_email(email: str, invite_url: str):
    """
    Best-effort. If SMTP not configured, prints link to logs.
    """
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT") or "587")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("EMAIL_FROM") or user or "no-reply@haylingua.am"

    if not host or not user or not password:
        print(f"[cms_invite] Invite for {email}: {invite_url}")
        return

    import smtplib
    from email.mime.text import MIMEText

    msg = MIMEText(
        f"You were invited to Haylingua CMS.\n\nOpen this link to set your password and enable 2FA:\n{invite_url}\n\nThis link expires soon.",
        "plain",
        "utf-8",
    )
    msg["Subject"] = "Haylingua CMS invitation"
    msg["From"] = from_addr
    msg["To"] = email

    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, password)
        s.sendmail(from_addr, [email], msg.as_string())

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
                u.profile_theme,
                u.joined_at,
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              WHERE u.id = :uid
              GROUP BY u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url, u.profile_theme, u.joined_at
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
              SELECT u.id, u.username, u.display_name,
                     COALESCE(SUM(lp.xp_earned), 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.username, u.display_name
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
            SELECT t.username, t.display_name, r.global_rank
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
    viewer_id = _get_user_id_from_bearer(authorization)

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
               COALESCE(u.display_name, u.username) AS display_name,
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
    )


@router.get("/users/{username}/friends", response_model=list[FriendOut])
def get_public_user_friends(
    username: str,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    viewer_id = _get_user_id_from_bearer(authorization)
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
    viewer_id = _get_user_id_from_bearer(authorization)

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

# -------------------- LESSONS --------------------

@router.get("/cms/lessons")
def cms_list_lessons(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    q = text("""
    SELECT id, slug, title, description, level, xp, xp_reward, is_published,
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

    if not slug or not title:
        raise HTTPException(400, detail="slug and title are required")

    new_id = db.execute(
        text("""
            INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config)
            VALUES (:slug, :title, :description, :level, :xp, :xp_reward, :is_published, :lesson_type, CAST(:config AS jsonb))
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
        },
    ).scalar_one()

    return {"id": int(new_id)}

@router.put("/cms/lessons/{lesson_id}")
async def cms_update_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()

    # IMPORTANT: include lesson_type + config so Reading lessons persist correctly.
    fields = ["slug", "title", "description", "level", "xp", "xp_reward", "is_published", "lesson_type", "config"]
    updates = {}
    for f in fields:
        if f in body:
            updates[f] = body[f]

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


ELEVEN_MODEL_ID = os.getenv("ELEVEN_MODEL_ID", "eleven_v3")


def _tts_cache_dir() -> Path:
    base = os.getenv("AUDIO_DIR", "")
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
