# backend/routes_cms.py
"""
CMS ("Content Studio") admin routes — everything under /cms/* plus the two
/cron/* jobs the CMS support panel can also trigger by hand.

Extracted from routes.py (was ~11,200 lines covering auth, lessons, CMS,
shop, friends, chests, leagues, everything in one file) so CMS-focused work
— far and away the most frequently touched area — no longer collides with
unrelated edits elsewhere in the API on the same file. Behavior is
unchanged: every route, helper, and constant below is moved verbatim.

Shared primitives (CMS JWT encode/decode, the require_cms* auth
dependencies, streak/hearts/shop helpers, email senders, etc.) stay defined
in routes.py because non-CMS code needs them too — e.g. the public
GET /lessons/{slug} endpoint verifies CMS-minted lesson-preview tokens via
_cms_jwt_decode, and routes_audio.py already imports require_cms_admin the
same way this file does. Import them from there rather than duplicating.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import traceback
from datetime import datetime, timedelta
import datetime as dt
from typing import Any, Dict, List, Literal, Optional

import httpx
import pyotp
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import engine, get_db
from auth import hash_password, validate_password_simple, verify_password

from routes import (
    # CMS auth
    require_cms,
    require_cms_admin,
    require_cms_temp,
    _cms_jwt_encode,
    _cms_jwt_decode,
    _sha256_hex,
    CMS_INVITE_TTL_HOURS,
    CMS_INVITE_BASE_URL,
    CMS_BOOTSTRAP_EMAIL,
    CMS_BOOTSTRAP_SECRET,
    # Streak / hearts / league
    _compute_streak_days,
    _hearts_state,
    _award_weekly_xp,
    LEAGUE_TIERS,
    LEAGUE_PROMOTE_TOP,
    LEAGUE_DEMOTE_BOTTOM,
    # Shop / chests
    SHOP_EFFECTS,
    CHEST_RARITIES,
    DEFAULT_HEARTS_MAX,
    _load_chest_rarities,
    # Exercises
    normalize_kind,
    validate_exercise_config,
    # Careers: application file storage (shared with the public apply endpoint)
    _applications_upload_dir,
    # Email
    _send_email,
    _render_cms_invite_html,
    _render_streak_reminder_html,
    _render_test_email_html,
    _render_bonus_email_html,
    # Voice Lab / TTS (shared client + defaults)
    DEFAULT_VOICE_ID,
    ELEVEN_API_KEY,
    ELEVEN_MODEL_ID,
    _tts_http,
    _DEFAULT_TTS_VOICE_SETTINGS,
)
# _EXPLAIN_OPENAI_KEY is read via the module (not `from routes import
# _EXPLAIN_OPENAI_KEY`) because tests monkeypatch it as an attribute on the
# routes module at runtime — `from X import Y` copies the value once at
# import time, so a later monkeypatch.setattr(routes, "_EXPLAIN_OPENAI_KEY",
# ...) would silently never be seen here. Same pattern as reading
# routes.cmsApi-style live config elsewhere in the app.
import routes as _routes_mod

router = APIRouter()


# ==================== Support tools (CMS) ====================

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
                       (COALESCE(is_premium, FALSE) AND (premium_until IS NULL OR premium_until > NOW())) AS is_premium
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
                   (COALESCE(is_premium, FALSE) AND (premium_until IS NULL OR premium_until > NOW())) AS is_premium
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
            SELECT u.id, u.email, u.username,
                   -- display_name is only set via a profile-settings edit; the
                   -- name a learner picks during onboarding ("What's your
                   -- name?") is saved into users.name instead, so fall back to
                   -- that rather than showing blank for onboarded-only users.
                   COALESCE(u.display_name, u.name) AS display_name,
                   -- "First name" in the CMS is really "the name they chose to go
                   -- by" — that can land in any of first_name/display_name/name
                   -- depending on which flow set it (profile settings vs.
                   -- onboarding), so show whichever is actually populated instead
                   -- of only the literal first_name column.
                   COALESCE(u.first_name, u.display_name, u.name) AS first_name,
                   u.last_name,
                   u.bio, u.avatar_url,
                   -- users.country is never written to; onboarding's required
                   -- country picker saves into user_onboarding.country instead.
                   COALESCE(u.country, ob.country) AS country,
                   u.timezone,
                   u.email_verified, (COALESCE(u.is_premium, FALSE) AND (u.premium_until IS NULL OR u.premium_until > NOW())) AS is_premium, u.premium_since,
                   u.joined_at, u.last_active_at,
                   COALESCE(u.current_streak, 0) AS current_streak,
                   COALESCE(u.streak_freezes, 0) AS streak_freezes,
                   u.totp_enabled, u.is_hidden, u.friends_public,
                   COALESCE(u.gems, 0) AS gems,
                   COALESCE(u.chests, 0) AS chests,
                   COALESCE(u.weekly_xp, 0) AS weekly_xp,
                   COALESCE(u.league_tier, 0) AS league_tier,
                   COALESCE(u.bonus_xp, 0) AS bonus_xp
            FROM users u
            LEFT JOIN user_onboarding ob ON ob.user_id = u.id
            WHERE u.id = :u
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

# kind -> (users column to credit, human label used in notifications/emails).
# The column is picked from this fixed map, never from raw request input, so
# splicing it into the UPDATE below can't be an injection vector even though
# Pydantic's Literal type already rejects any other `kind` before we get here.
_BONUS_COLUMNS = {
    "gems": ("gems", "gems"),
    "xp": ("bonus_xp", "XP"),
    "chests": ("chests", "chests"),
    "streak_freeze": ("streak_freezes", "streak freezes"),
}


class GrantBonusIn(BaseModel):
    kind: Literal["gems", "xp", "chests", "streak_freeze"]
    amount: int
    notify_email: bool = False
    notify_inapp: bool = False
    message: Optional[str] = None


@router.post("/cms/support/users/{uid}/grant-bonus")
def support_grant_bonus(
    uid: int,
    payload: GrantBonusIn,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    """One admin action for every bonus type (gems/XP/chests/streak freezes),
    with an optional email + in-app notification so the learner actually
    finds out — replaces the old gems-only grant-gems endpoint."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be a positive integer")

    column, label = _BONUS_COLUMNS[payload.kind]
    db.execute(
        text(f"UPDATE users SET {column} = COALESCE({column}, 0) + :a WHERE id = :u"),
        {"a": payload.amount, "u": uid},
    )
    if payload.kind == "xp":
        _award_weekly_xp(db, uid, payload.amount)

    user_row = db.execute(
        text(
            f"SELECT email, COALESCE(first_name, display_name, name) AS name, "
            f"COALESCE({column}, 0) AS new_value FROM users WHERE id = :u"
        ),
        {"u": uid},
    ).mappings().first()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    message = (payload.message or "").strip() or None
    name = user_row["name"] or "there"

    if payload.notify_inapp:
        title = "You received a bonus! 🎁"
        body = f"+{payload.amount} {label}" + (f' — "{message}"' if message else "")
        db.execute(
            text("INSERT INTO user_notifications (user_id, title, body) VALUES (:u, :t, :b)"),
            {"u": uid, "t": title, "b": body},
        )

    email_sent = False
    if payload.notify_email and user_row["email"]:
        app_url = (os.getenv("APP_URL") or os.getenv("FRONTEND_URL") or "https://haylingua.am").rstrip("/")
        email_sent = _send_email(
            to_email=user_row["email"],
            subject="🎁 You got a bonus on Haylingua!",
            body=(
                f"Hi {name}, you just received +{payload.amount} {label} on Haylingua!"
                + (f'\n\n"{message}"' if message else "")
            ),
            html_body=_render_bonus_email_html(name, label, payload.amount, message, app_url),
        )

    return {
        "ok": True,
        "kind": payload.kind,
        "new_value": int(user_row["new_value"]),
        "email_sent": email_sent,
    }


@router.get("/cms/support/users/{uid}/notifications")
def support_list_notifications(
    uid: int,
    _: dict = Depends(require_cms_admin),
    db: Connection = Depends(get_db),
):
    """So an admin can confirm a granted bonus's notification actually landed."""
    rows = db.execute(
        text(
            "SELECT id, title, body, created_at, read_at FROM user_notifications "
            "WHERE user_id = :u ORDER BY created_at DESC LIMIT 50"
        ),
        {"u": uid},
    ).mappings().all()
    return {"notifications": [dict(r) for r in rows]}

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

# ==================== League rollover + cron jobs ====================

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

@router.post("/cron/send-streak-emails")
def cron_send_streak_emails(
    x_cron_secret: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Email streak-at-risk reminders to users who have an active streak, a
    verified email, reminders enabled, and haven't practiced yet today.

    Authenticated with the shared CRON_SECRET. Idempotent per day via
    users.last_streak_email_at. Schedule in the evening (e.g. ~20:00 UTC)."""
    secret = (os.getenv("CRON_SECRET") or "").strip()
    if not secret or not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), secret):
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    app_url = (os.getenv("APP_URL") or os.getenv("FRONTEND_URL") or "https://haylingua.am").rstrip("/")

    rows = db.execute(
        text(
            """
            SELECT u.id, u.email, u.first_name, u.display_name, u.current_streak
            FROM users u
            WHERE u.email IS NOT NULL
              AND COALESCE(u.email_verified, FALSE) = TRUE
              AND COALESCE(u.email_reminders_enabled, TRUE) = TRUE
              AND COALESCE(u.current_streak, 0) > 0
              AND (u.last_streak_email_at IS NULL OR u.last_streak_email_at < CURRENT_DATE)
              AND NOT EXISTS (
                  SELECT 1 FROM user_exercise_attempts a
                  WHERE a.user_id = u.id AND DATE(a.created_at) = CURRENT_DATE
              )
            LIMIT 500
            """
        )
    ).mappings().all()

    sent = 0
    for row in rows:
        email = (row.get("email") or "").strip()
        if not email:
            continue
        name = row.get("first_name") or row.get("display_name") or "there"
        streak = int(row.get("current_streak") or 0)
        try:
            ok = _send_email(
                to_email=email,
                subject=f"🔥 Don't lose your {streak}-day streak!",
                body=(
                    f"Hi {name}, you haven't practiced Armenian yet today. "
                    f"Do a quick lesson to keep your {streak}-day streak alive: {app_url}/dashboard"
                ),
                html_body=_render_streak_reminder_html(name, streak, app_url),
            )
            if ok:
                sent += 1
            # Mark as emailed today regardless of transport success so we don't
            # retry-spam the same user if the provider is flaky within a run.
            db.execute(
                text("UPDATE users SET last_streak_email_at = NOW() WHERE id = :u"),
                {"u": int(row["id"])},
            )
        except Exception as exc:
            print(f"[streak-email] failed for user {row['id']}: {exc}")

    return {"ok": True, "eligible": len(rows), "sent": sent}

# ==================== Voices + Analytics ====================

@router.get("/cms/voices")
async def cms_list_voices(_: dict = Depends(require_cms_admin)):
    """List ElevenLabs voices available on this account, for the voice-lab
    comparison tool. CMS-admin gated since it exposes account voice IDs."""
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    try:
        resp = await _tts_http.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": ELEVEN_API_KEY},
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"ElevenLabs request failed: {e}") from e
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ElevenLabs error ({resp.status_code})")
    voices = (resp.json() or {}).get("voices") or []
    return {
        "voices": [
            {
                "voice_id": v.get("voice_id") or v.get("id"),
                "name": v.get("name"),
                "labels": v.get("labels") or {},
                "preview_url": v.get("preview_url"),
                "category": v.get("category"),
            }
            for v in voices
        ],
        "current_default_voice_id": DEFAULT_VOICE_ID,
        "current_model_id": ELEVEN_MODEL_ID,
        "current_voice_settings": _DEFAULT_TTS_VOICE_SETTINGS,
    }

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
            COUNT(*) FILTER (WHERE COALESCE(is_premium, FALSE) AND (premium_until IS NULL OR premium_until > NOW())) AS premium_users,
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

# ==================== Invite email helpers ====================

def _send_invite_email(email: str, invite_url: str):
    """Best-effort. If SMTP not configured, prints link to logs."""
    plain = (
        "You were invited to Haylingua CMS.\n\n"
        f"Open this link to set your password and enable 2FA:\n{invite_url}\n\n"
        "This link expires in 48 hours."
    )
    sent = _send_email(
        to_email=email,
        subject="You're invited to Haylingua CMS",
        body=plain,
        html_body=_render_cms_invite_html(invite_url),
    )
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

# ==================== Bootstrap, invites, CMS auth, team ====================

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
    if not secrets.compare_digest(secret.encode(), CMS_BOOTSTRAP_SECRET.encode()):
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
    if inv["expires_at"].astimezone(dt.timezone.utc).replace(tzinfo=None) <= datetime.utcnow():
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

# ==================== Chapters ====================

CMS_TOKENS = set()

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
    # Draft by default — same reasoning as lessons: don't surface a new,
    # still-empty chapter on the live roadmap until it's actually ready.
    is_published = bool(body.get("is_published", False))
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

# ==================== Achievements ====================

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
            # Draft by default — same reasoning as lessons/chapters: don't
            # surface a half-configured achievement to real users the
            # moment it's created.
            "so": int(pos), "act": bool(body.get("is_active", False)),
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

# ==================== Seed curriculum ====================

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

@router.post("/cms/seed/sounds")
def cms_seed_sounds(request: Request, db=Depends(get_db)):
    """Populate Phase 0 (Sounds) — pure audio-in/audio-out content that
    precedes the alphabet in the sounds-first curriculum redesign. Also hides
    (never deletes) the ad-hoc duplicate chapter track that collides in
    position with the canonical seeded curriculum, and shifts existing
    chapters back to make room. Idempotent."""
    require_cms(request, db)
    from seed_sounds import seed_sounds_phase
    try:
        res = seed_sounds_phase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/alphabet")
def cms_seed_alphabet(request: Request, db=Depends(get_db)):
    """Populate Phase 1 (Alphabet) — the remaining 33 letters beyond the
    6 already covered by hl-alphabet-1/2, plus a capstone review lesson.
    Idempotent."""
    require_cms(request, db)
    from seed_alphabet import seed_alphabet_phase
    try:
        res = seed_alphabet_phase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/words")
def cms_seed_words(request: Request, db=Depends(get_db)):
    """Populate Phase 2 (Words + sentence patterns) — adds a sentence-pattern
    lesson to each of the 8 existing vocabulary chapters. Idempotent."""
    require_cms(request, db)
    from seed_words import seed_words_phase
    try:
        res = seed_words_phase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/sentences")
def cms_seed_sentences(request: Request, db=Depends(get_db)):
    """Populate Phase 3 (Sentences) — full present-tense conjugation,
    negation, questions, and connectors, across 3 new chapters. Idempotent."""
    require_cms(request, db)
    from seed_sentences import seed_sentences_phase
    try:
        res = seed_sentences_phase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/fluency")
def cms_seed_fluency(request: Request, db=Depends(get_db)):
    """Populate Phase 4 (Functional fluency) — past/future tense, reading
    comprehension, and dialogue scenarios. Idempotent."""
    require_cms(request, db)
    from seed_fluency import seed_fluency_phase
    try:
        res = seed_fluency_phase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/demo")
def cms_seed_demo(request: Request, db=Depends(get_db)):
    """Teacher-facing demo lessons (not part of the learner curriculum):
    one showcasing every exercise kind, one showcasing reading
    comprehension. Idempotent."""
    require_cms(request, db)
    from seed_demo import seed_demo_lessons
    try:
        res = seed_demo_lessons()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/grammar")
def cms_seed_grammar(request: Request, db=Depends(get_db)):
    """Populate Phase 5 (Advanced grammar) — imperative mood, genitive-dative
    and instrumental cases, past/future for two more regular verbs. Idempotent."""
    require_cms(request, db)
    from seed_grammar import seed_grammar_phase
    try:
        res = seed_grammar_phase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/expand")
def cms_seed_expand(request: Request, db=Depends(get_db)):
    """Volume expansion — mechanically tops up the 8 core vocabulary lessons
    with extra drills built from their own already-verified word lists.
    Idempotent per lesson (skips any lesson with >= 10 exercises)."""
    require_cms(request, db)
    from seed_expand import seed_expand_vocab
    try:
        res = seed_expand_vocab()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/expand2")
def cms_seed_expand2(request: Request, db=Depends(get_db)):
    """Volume expansion round 2 — tops up the 22 lessons that stayed thin
    after Phases 2-5 (sentence patterns, Sentences/Grammar chapters,
    Fluency II). Idempotent per lesson (skips at >= 9 exercises)."""
    require_cms(request, db)
    from seed_expand2 import seed_expand2
    try:
        res = seed_expand2()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/expand3")
def cms_seed_expand3(request: Request, db=Depends(get_db)):
    """Volume expansion round 3 — reading exercises. Adds two new passages
    to flu-reading so it isn't the same paragraph reused for all 9 of its
    questions. Idempotent (skips at >= 18 exercises)."""
    require_cms(request, db)
    from seed_expand3 import seed_expand3
    try:
        res = seed_expand3()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/grammar2")
def cms_seed_grammar2(request: Request, db=Depends(get_db)):
    """Phase 6 grammar — definite article, possessive suffixes, ablative +
    locative cases, full գնալ/ուտել conjugation paradigms, formal/informal
    "you". Four new chapters (positions 25-28). Idempotent (skips if
    gr-article-1 exists)."""
    require_cms(request, db)
    from seed_grammar2 import seed_grammar2
    try:
        res = seed_grammar2()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/vocab2")
def cms_seed_vocab2(request: Request, db=Depends(get_db)):
    """Vocabulary Phase 2 — four new everyday topic chapters (Home &
    Objects, Body & Health, Clothing, Weather), positions 29-32. Idempotent
    (skips if hl-home exists)."""
    require_cms(request, db)
    from seed_vocab2 import seed_vocab2
    try:
        res = seed_vocab2()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/vocab3")
def cms_seed_vocab3(request: Request, db=Depends(get_db)):
    """Vocabulary Phase 3 — Jobs, Emotions, Shopping & Money, Dates/Months/
    Seasons (positions 33-35). Idempotent (skips if hl-jobs exists)."""
    require_cms(request, db)
    from seed_vocab3 import seed_vocab3
    try:
        res = seed_vocab3()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/enrich-alphabet")
def cms_seed_enrich_alphabet(request: Request, db=Depends(get_db)):
    """Adds an example word + emoji to each char_intro in the first 4
    alphabet lessons ("The Alphabet I-II" chapters, reached early in the
    course though not literally lesson #1 — see enrich-sounds for that).
    UPDATE-based, idempotent per exercise (skips ones already enriched)."""
    require_cms(request, db)
    from seed_enrich_alphabet import seed_enrich_alphabet
    try:
        res = seed_enrich_alphabet()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/enrich-sounds")
def cms_seed_enrich_sounds(request: Request, db=Depends(get_db)):
    """snd-vowels-1 is the TRUE first lesson (chapter position 1, ahead of
    the alphabet chapters) — varies its duplicated prompts and adds an
    emoji/meaning payoff to each minimal_pairs exercise. UPDATE-based,
    idempotent (skips exercises whose config already has "emoji")."""
    require_cms(request, db)
    from seed_enrich_sounds import seed_enrich_sounds
    try:
        res = seed_enrich_sounds()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/rework-vowels")
def cms_seed_rework_vowels(request: Request, db=Depends(get_db)):
    """Reworks snd-vowels-1's exercise TYPES, not just copy: adds the 2
    missing speak drills (water/meat had none) and 3 true_false meaning
    checks, then reorders everything into interleaved listen->speak pairs
    instead of running the same kind 2-3 times in a row. Idempotent (skips
    if a "jur" speak exercise already exists)."""
    require_cms(request, db)
    from seed_rework_vowels import seed_rework_vowels
    try:
        res = seed_rework_vowels()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/essentials")
def cms_seed_essentials(request: Request, db=Depends(get_db)):
    """Essential missing grammar: ունել (to have), ուզել (to want), and noun
    plurals (-եր/-ներ). Two chapters (positions 37-38). Idempotent (skips if
    gr-have exists)."""
    require_cms(request, db)
    from seed_essentials import seed_essentials
    try:
        res = seed_essentials()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/vowelintro")
def cms_seed_vowelintro(request: Request, db=Depends(get_db)):
    """Prepends picture+audio 'meet the word' intros (romanized front, no
    script) to snd-vowels-1, the very first lesson. Idempotent."""
    require_cms(request, db)
    from seed_vowelintro import seed_vowelintro
    try:
        res = seed_vowelintro()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/wordintro")
def cms_seed_wordintro(request: Request, db=Depends(get_db)):
    """Prepends 'meet the word' flashcard intros (picture + audio + meaning)
    to the start of the image-able vocab lessons. Idempotent per lesson."""
    require_cms(request, db)
    from seed_wordintro import seed_wordintro
    try:
        res = seed_wordintro()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/earlybuild")
def cms_seed_earlybuild(request: Request, db=Depends(get_db)):
    """Adds early 'build the sentence' word_bank exercises («Սա X է») to the
    earliest concrete-noun vocab lessons, so learners assemble a real
    sentence within their first few lessons. Idempotent per lesson."""
    require_cms(request, db)
    from seed_earlybuild import seed_earlybuild
    try:
        res = seed_earlybuild()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/imagewords")
def cms_seed_imagewords(request: Request, db=Depends(get_db)):
    """Adds Duolingo-style picture (emoji) word-select exercises to the
    image-able vocabulary lessons. Idempotent per lesson (skips lessons that
    already have an image_select)."""
    require_cms(request, db)
    from seed_imagewords import seed_imagewords
    try:
        res = seed_imagewords()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/hide-prealphabet-script")
def cms_seed_hide_prealphabet_script(request: Request, db=Depends(get_db)):
    """Marks every speak exercise in the 10 pre-alphabet "Sounds:" lessons
    with cfg.hideScript = true, so ExSpeak/ExSpeakLine show the romanized
    transliteration instead of untaught Armenian script as the thing to
    read aloud. Idempotent (skips exercises that already have the key)."""
    require_cms(request, db)
    from seed_hide_prealphabet_script import seed_hide_prealphabet_script
    try:
        res = seed_hide_prealphabet_script()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}


@router.post("/cms/seed/functional")
def cms_seed_functional(request: Request, db=Depends(get_db)):
    """Functional Conversations — café/shop/phone-call dialogue scenarios
    built from vocab/grammar already live elsewhere (position 36).
    Idempotent (skips if fs-cafe exists)."""
    require_cms(request, db)
    from seed_functional import seed_functional
    try:
        res = seed_functional()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {e}")
    return res or {"ok": True}

# ==================== Email diagnostics ====================

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
        html=_render_test_email_html(),
    )
    return res

# ==================== Shop items ====================

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
            # Draft by default — same reasoning as lessons/chapters.
            "so": int(pos), "act": bool(body.get("is_active", False)),
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

# ==================== Careers: job vacancies ====================

EMPLOYMENT_TYPES = {"full-time", "part-time", "contract", "internship"}

@router.get("/cms/vacancies")
def cms_list_vacancies(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT id, title, location, employment_type, summary, description, sort_order, is_active
        FROM job_vacancies ORDER BY sort_order ASC, id ASC
    """)).mappings().all()
    return {"vacancies": [dict(r) for r in rows], "employment_types": sorted(EMPLOYMENT_TYPES)}

@router.post("/cms/vacancies")
async def cms_create_vacancy(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    employment_type = (body.get("employment_type") or "full-time").strip()
    if employment_type not in EMPLOYMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"employment_type must be one of {sorted(EMPLOYMENT_TYPES)}")
    pos = db.execute(text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM job_vacancies")).scalar() or 1
    new_id = db.execute(
        text("""
            INSERT INTO job_vacancies (title, location, employment_type, summary, description, sort_order, is_active)
            VALUES (:t, :loc, :et, :sum, :desc, :so, :act) RETURNING id
        """),
        {
            "t": title, "loc": (body.get("location") or "").strip(), "et": employment_type,
            "sum": (body.get("summary") or "").strip(), "desc": (body.get("description") or "").strip(),
            "so": int(pos), "act": bool(body.get("is_active", False)),
        },
    ).scalar_one()
    return {"id": int(new_id)}

@router.put("/cms/vacancies/{vacancy_id}")
async def cms_update_vacancy(vacancy_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": vacancy_id}
    for f in ("title", "location", "summary", "description", "is_active"):
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = body[f]
    if "employment_type" in body:
        if body["employment_type"] not in EMPLOYMENT_TYPES:
            raise HTTPException(status_code=400, detail="invalid employment_type")
        set_parts.append("employment_type = :employment_type")
        params["employment_type"] = body["employment_type"]
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE job_vacancies SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/vacancies/{vacancy_id}")
def cms_delete_vacancy(vacancy_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM job_vacancies WHERE id = :id"), {"id": vacancy_id})
    return {"ok": True}

@router.post("/cms/vacancies/reorder")
async def cms_reorder_vacancies(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    for i, vid in enumerate(body.get("order") or []):
        db.execute(text("UPDATE job_vacancies SET sort_order = :p WHERE id = :id"), {"p": i + 1, "id": int(vid)})
    return {"ok": True}

# ==================== Careers: application form fields ====================

FIELD_TYPES = {"text", "textarea", "url", "file"}

@router.get("/cms/vacancies/{vacancy_id}/fields")
def cms_list_vacancy_fields(vacancy_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(
        text("SELECT id, label, field_type, is_required, sort_order FROM job_vacancy_fields WHERE vacancy_id = :id ORDER BY sort_order ASC, id ASC"),
        {"id": vacancy_id},
    ).mappings().all()
    return {"fields": [dict(r) for r in rows], "field_types": sorted(FIELD_TYPES)}

@router.post("/cms/vacancies/{vacancy_id}/fields")
async def cms_create_vacancy_field(vacancy_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    label = (body.get("label") or "").strip()
    field_type = (body.get("field_type") or "text").strip()
    if not label:
        raise HTTPException(status_code=400, detail="label is required")
    if field_type not in FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"field_type must be one of {sorted(FIELD_TYPES)}")
    pos = db.execute(text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM job_vacancy_fields WHERE vacancy_id = :id"), {"id": vacancy_id}).scalar() or 1
    new_id = db.execute(
        text("""
            INSERT INTO job_vacancy_fields (vacancy_id, label, field_type, is_required, sort_order)
            VALUES (:vid, :l, :ft, :req, :so) RETURNING id
        """),
        {"vid": vacancy_id, "l": label, "ft": field_type, "req": bool(body.get("is_required", False)), "so": int(pos)},
    ).scalar_one()
    return {"id": int(new_id)}

@router.put("/cms/vacancy-fields/{field_id}")
async def cms_update_vacancy_field(field_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": field_id}
    if "label" in body:
        set_parts.append("label = :label")
        params["label"] = (body["label"] or "").strip()
    if "is_required" in body:
        set_parts.append("is_required = :is_required")
        params["is_required"] = bool(body["is_required"])
    if "field_type" in body:
        if body["field_type"] not in FIELD_TYPES:
            raise HTTPException(status_code=400, detail="invalid field_type")
        set_parts.append("field_type = :field_type")
        params["field_type"] = body["field_type"]
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE job_vacancy_fields SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/vacancy-fields/{field_id}")
def cms_delete_vacancy_field(field_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM job_vacancy_fields WHERE id = :id"), {"id": field_id})
    return {"ok": True}

@router.post("/cms/vacancies/{vacancy_id}/fields/reorder")
async def cms_reorder_vacancy_fields(vacancy_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    for i, fid in enumerate(body.get("order") or []):
        db.execute(text("UPDATE job_vacancy_fields SET sort_order = :p WHERE id = :id AND vacancy_id = :vid"), {"p": i + 1, "id": int(fid), "vid": vacancy_id})
    return {"ok": True}

# ==================== Careers: applications ====================

@router.get("/cms/vacancies/{vacancy_id}/applications")
def cms_list_applications(vacancy_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(
        text("""
            SELECT id, applicant_name, applicant_email, linkedin_url, status, created_at,
                   cv_filename IS NOT NULL AS has_cv, cover_letter_filename IS NOT NULL AS has_cover_letter
            FROM job_applications WHERE vacancy_id = :id ORDER BY created_at DESC
        """),
        {"id": vacancy_id},
    ).mappings().all()
    return {"applications": [dict(r) for r in rows]}

@router.get("/cms/applications/{application_id}")
def cms_get_application(application_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    app_row = db.execute(
        text("""
            SELECT a.id, a.vacancy_id, a.applicant_name, a.applicant_email, a.linkedin_url, a.status, a.created_at,
                   a.cv_filename, a.cover_letter_filename, v.title AS vacancy_title
            FROM job_applications a JOIN job_vacancies v ON v.id = a.vacancy_id
            WHERE a.id = :id
        """),
        {"id": application_id},
    ).mappings().first()
    if app_row is None:
        raise HTTPException(status_code=404, detail="Application not found")
    answers = db.execute(
        text("""
            SELECT f.id AS field_id, f.label, f.field_type, ans.value, ans.file_name
            FROM job_vacancy_fields f
            LEFT JOIN job_application_answers ans ON ans.field_id = f.id AND ans.application_id = :aid
            WHERE f.vacancy_id = :vid
            ORDER BY f.sort_order ASC, f.id ASC
        """),
        {"aid": application_id, "vid": app_row["vacancy_id"]},
    ).mappings().all()
    return {"application": dict(app_row), "answers": [dict(a) for a in answers]}

APPLICATION_STATUSES = {"new", "reviewed", "shortlisted", "rejected", "hired"}

@router.put("/cms/applications/{application_id}")
async def cms_update_application(application_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    status_val = (body.get("status") or "").strip()
    if status_val not in APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(APPLICATION_STATUSES)}")
    db.execute(text("UPDATE job_applications SET status = :s WHERE id = :id"), {"s": status_val, "id": application_id})
    return {"ok": True}

@router.get("/cms/applications/{application_id}/files/{kind}")
def cms_download_application_file(application_id: int, kind: str, request: Request, db=Depends(get_db)):
    """kind is 'cv', 'cover_letter', or 'answer:<field_id>'. Files live in a
    private (non-static-mounted) directory — this authenticated endpoint is
    the only way to fetch an applicant's documents."""
    require_cms(request, db)
    if kind == "cv":
        row = db.execute(text("SELECT cv_path AS path, cv_filename AS filename FROM job_applications WHERE id = :id"), {"id": application_id}).mappings().first()
    elif kind == "cover_letter":
        row = db.execute(text("SELECT cover_letter_path AS path, cover_letter_filename AS filename FROM job_applications WHERE id = :id"), {"id": application_id}).mappings().first()
    elif kind.startswith("answer:"):
        field_id = kind.split(":", 1)[1]
        row = db.execute(
            text("SELECT file_path AS path, file_name AS filename FROM job_application_answers WHERE application_id = :aid AND field_id = :fid"),
            {"aid": application_id, "fid": field_id},
        ).mappings().first()
    else:
        raise HTTPException(status_code=400, detail="Invalid file kind")

    if row is None or not row["path"] or not os.path.exists(row["path"]):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(row["path"], filename=row["filename"] or os.path.basename(row["path"]))

# ==================== Affiliate program ====================

def _generate_referral_code(db, base_name: str) -> str:
    """A short, memorable, unique code derived from the applicant's name,
    with a random suffix appended only if the plain slug is already taken."""
    slug = re.sub(r"[^a-z0-9]+", "", (base_name or "affiliate").lower())[:16] or "affiliate"
    candidate = slug
    while db.execute(text("SELECT 1 FROM affiliates WHERE referral_code = :c"), {"c": candidate}).scalar():
        candidate = f"{slug}{secrets.token_hex(2)}"
    return candidate

@router.get("/cms/affiliates")
def cms_list_affiliates(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT a.id, a.user_id, a.referral_code, a.commission_rate, a.status,
               a.payout_email, a.payout_requested_at,
               a.applied_name, a.applied_email, a.applied_platform, a.applied_audience, a.applied_message,
               a.created_at, a.approved_at,
               COALESCE((SELECT COUNT(*) FROM referral_clicks c WHERE c.affiliate_id = a.id), 0) AS click_count,
               COALESCE((SELECT COUNT(*) FROM affiliate_referrals r WHERE r.affiliate_id = a.id), 0) AS referred_count,
               COALESCE((SELECT COUNT(*) FROM affiliate_referrals r WHERE r.affiliate_id = a.id AND r.converted_at IS NOT NULL), 0) AS converted_count,
               COALESCE((SELECT SUM(commission_amount) FROM affiliate_referrals r WHERE r.affiliate_id = a.id AND r.payout_status = 'unpaid'), 0) AS pending_commission
        FROM affiliates a
        ORDER BY (a.status = 'pending') DESC, a.payout_requested_at DESC NULLS LAST, a.created_at DESC
    """)).mappings().all()
    return {"affiliates": [dict(r) for r in rows]}

@router.get("/cms/affiliates/analytics")
def cms_affiliates_analytics(request: Request, db=Depends(get_db)):
    """Site-wide affiliate program totals + a 30-day daily trend, for the
    summary bar and chart at the top of the CMS Affiliates page."""
    require_cms(request, db)
    totals = db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM affiliates WHERE status = 'approved') AS approved_count,
            (SELECT COUNT(*) FROM affiliates WHERE status = 'pending') AS pending_count,
            (SELECT COUNT(*) FROM referral_clicks) AS total_clicks,
            (SELECT COUNT(*) FROM affiliate_referrals) AS total_referred,
            (SELECT COUNT(*) FROM affiliate_referrals WHERE converted_at IS NOT NULL) AS total_converted,
            (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_referrals WHERE payout_status = 'unpaid') AS total_pending_commission,
            (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_referrals WHERE payout_status = 'paid') AS total_paid_commission
    """)).mappings().first()

    clicks_daily = db.execute(text("""
        SELECT DATE(created_at) AS day, COUNT(*) AS count FROM referral_clicks
        WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day
    """)).mappings().all()
    signups_daily = db.execute(text("""
        SELECT DATE(referred_at) AS day, COUNT(*) AS count FROM affiliate_referrals
        WHERE referred_at >= NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day
    """)).mappings().all()

    return {
        "approved_count": int(totals["approved_count"]),
        "pending_count": int(totals["pending_count"]),
        "total_clicks": int(totals["total_clicks"]),
        "total_referred": int(totals["total_referred"]),
        "total_converted": int(totals["total_converted"]),
        "total_pending_commission": float(totals["total_pending_commission"]),
        "total_paid_commission": float(totals["total_paid_commission"]),
        "clicks_daily": [dict(r) for r in clicks_daily],
        "signups_daily": [dict(r) for r in signups_daily],
    }

@router.post("/cms/affiliates/{affiliate_id}/approve")
def cms_approve_affiliate(affiliate_id: int, request: Request, db=Depends(get_db)):
    """Approving links the application to an existing Haylingua account
    (matched by the email they applied with) and mints a referral code —
    without an account there's no user_id to attribute referrals to, so
    approval is blocked until they've signed up with that email."""
    require_cms(request, db)
    aff = db.execute(text("SELECT id, applied_name, applied_email FROM affiliates WHERE id = :id"), {"id": affiliate_id}).mappings().first()
    if aff is None:
        raise HTTPException(status_code=404, detail="Application not found")
    user = db.execute(text("SELECT id FROM users WHERE LOWER(email) = LOWER(:e)"), {"e": aff["applied_email"]}).mappings().first()
    if user is None:
        raise HTTPException(status_code=400, detail=f"No Haylingua account found for {aff['applied_email']} yet — ask them to sign up with that email first")
    code = _generate_referral_code(db, aff["applied_name"])
    db.execute(
        text("UPDATE affiliates SET user_id = :uid, referral_code = :code, status = 'approved', approved_at = NOW() WHERE id = :id"),
        {"uid": user["id"], "code": code, "id": affiliate_id},
    )

    app_url = (os.getenv("FRONTEND_URL") or "https://haylingua.am").rstrip("/")
    referral_link = f"{app_url}/?ref={code}"
    _send_email(
        to_email=aff["applied_email"],
        subject="You're in — your Haylingua affiliate link is live",
        body=(
            f"Hey {aff['applied_name']},\n\n"
            f"Your affiliate application was approved. Your referral link:\n{referral_link}\n\n"
            f"Track clicks, signups, and commission from your dashboard: {app_url}/affiliate-dashboard"
        ),
        html_body=f"""
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#1c1917;">You're in! 🎉</h2>
          <p style="color:#57534e;">Your affiliate application was approved. Here's your referral link:</p>
          <p style="background:#f5f5f4;border-radius:12px;padding:16px;color:#292524;word-break:break-all;">{referral_link}</p>
          <p style="color:#57534e;">Track clicks, signups, and commission any time from your <a href="{app_url}/affiliate-dashboard">affiliate dashboard</a>.</p>
        </div>""",
    )
    return {"ok": True, "referral_code": code}

@router.put("/cms/affiliates/{affiliate_id}")
async def cms_update_affiliate(affiliate_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": affiliate_id}
    if "commission_rate" in body:
        set_parts.append("commission_rate = :rate")
        params["rate"] = float(body["commission_rate"])
    if "status" in body:
        if body["status"] not in {"approved", "suspended", "rejected"}:
            raise HTTPException(status_code=400, detail="invalid status")
        set_parts.append("status = :status")
        params["status"] = body["status"]
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE affiliates SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.get("/cms/affiliates/{affiliate_id}/referrals")
def cms_list_affiliate_referrals(affiliate_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT r.id, r.referred_at, r.converted_at, r.commission_amount, r.payout_status,
               u.username, u.email
        FROM affiliate_referrals r JOIN users u ON u.id = r.user_id
        WHERE r.affiliate_id = :id
        ORDER BY r.referred_at DESC
    """), {"id": affiliate_id}).mappings().all()
    return {"referrals": [dict(r) for r in rows]}

@router.post("/cms/affiliate-referrals/{referral_id}/mark-paid")
def cms_mark_referral_paid(referral_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    referral = db.execute(text("SELECT affiliate_id FROM affiliate_referrals WHERE id = :id"), {"id": referral_id}).mappings().first()
    if referral is None:
        raise HTTPException(status_code=404, detail="Referral not found")
    db.execute(text("UPDATE affiliate_referrals SET payout_status = 'paid' WHERE id = :id"), {"id": referral_id})
    remaining_unpaid = db.execute(
        text("SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id = :id AND payout_status = 'unpaid' AND commission_amount IS NOT NULL"),
        {"id": referral["affiliate_id"]},
    ).scalar() or 0
    if remaining_unpaid == 0:
        db.execute(text("UPDATE affiliates SET payout_requested_at = NULL WHERE id = :id"), {"id": referral["affiliate_id"]})

        # Notify the affiliate only once the whole outstanding balance has
        # cleared, rather than once per referral — avoids spamming them when
        # several payouts are settled in the same batch.
        aff = db.execute(
            text("""
                SELECT a.applied_name, COALESCE(u.email, a.applied_email) AS email
                FROM affiliates a LEFT JOIN users u ON u.id = a.user_id
                WHERE a.id = :id
            """),
            {"id": referral["affiliate_id"]},
        ).mappings().first()
        total_paid = db.execute(
            text("SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_referrals WHERE affiliate_id = :id AND payout_status = 'paid'"),
            {"id": referral["affiliate_id"]},
        ).scalar() or 0
        if aff and aff["email"]:
            _send_email(
                to_email=aff["email"],
                subject="Your Haylingua affiliate payout is on its way",
                body=f"Hey {aff['applied_name']},\n\nYour outstanding affiliate commission (֏{float(total_paid):,.0f} total paid to date) has been marked as sent.",
                html_body=f"""
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
                  <h2 style="color:#1c1917;">Payout sent 💸</h2>
                  <p style="color:#57534e;">Your outstanding affiliate commission has been marked as sent. ֏{float(total_paid):,.0f} paid to date.</p>
                </div>""",
            )
    return {"ok": True}

# ==================== Community forum (moderation) ====================

@router.get("/cms/forum/categories")
def cms_list_forum_categories(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT id, name, slug, description, icon, sort_order, is_active
        FROM forum_categories ORDER BY sort_order ASC, id ASC
    """)).mappings().all()
    return {"categories": [dict(r) for r in rows]}

@router.post("/cms/forum/categories")
async def cms_create_forum_category(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    name = (body.get("name") or "").strip()
    slug = (body.get("slug") or "").strip().lower()
    if not name or not slug:
        raise HTTPException(status_code=400, detail="name and slug are required")
    if not re.match(r"^[a-z0-9-]+$", slug):
        raise HTTPException(status_code=400, detail="slug may only contain lowercase letters, numbers, and hyphens")
    pos = db.execute(text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM forum_categories")).scalar() or 1
    try:
        new_id = db.execute(
            text("""
                INSERT INTO forum_categories (name, slug, description, icon, sort_order, is_active)
                VALUES (:n, :s, :d, :ic, :so, :act) RETURNING id
            """),
            {
                "n": name, "s": slug, "d": (body.get("description") or "").strip(),
                "ic": (body.get("icon") or "message-circle").strip() or "message-circle",
                "so": int(pos), "act": bool(body.get("is_active", True)),
            },
        ).scalar_one()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="A category with that name or slug already exists")
    return {"id": int(new_id)}

@router.put("/cms/forum/categories/{category_id}")
async def cms_update_forum_category(category_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": category_id}
    for f in ("name", "description", "icon", "is_active"):
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = body[f]
    if "slug" in body:
        slug = (body["slug"] or "").strip().lower()
        if not re.match(r"^[a-z0-9-]+$", slug):
            raise HTTPException(status_code=400, detail="slug may only contain lowercase letters, numbers, and hyphens")
        set_parts.append("slug = :slug")
        params["slug"] = slug
    if not set_parts:
        return {"ok": True}
    try:
        db.execute(text(f"UPDATE forum_categories SET {', '.join(set_parts)} WHERE id = :id"), params)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="A category with that name or slug already exists")
    return {"ok": True}

@router.delete("/cms/forum/categories/{category_id}")
def cms_delete_forum_category(category_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM forum_categories WHERE id = :id"), {"id": category_id})
    return {"ok": True}

@router.post("/cms/forum/categories/reorder")
async def cms_reorder_forum_categories(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    for i, cid in enumerate(body.get("order") or []):
        db.execute(text("UPDATE forum_categories SET sort_order = :p WHERE id = :id"), {"p": i + 1, "id": int(cid)})
    return {"ok": True}

@router.get("/cms/forum/threads")
def cms_list_forum_threads(request: Request, category_id: Optional[int] = None, db=Depends(get_db)):
    require_cms(request, db)
    where = "WHERE t.category_id = :cid" if category_id else ""
    rows = db.execute(
        text(f"""
            SELECT t.id, t.title, t.is_pinned, t.is_locked, t.reply_count, t.last_reply_at, t.created_at,
                   c.name AS category_name, c.slug AS category_slug,
                   COALESCE(u.display_name, u.username, split_part(u.email, '@', 1)) AS author_name
            FROM forum_threads t
            JOIN forum_categories c ON c.id = t.category_id
            JOIN users u ON u.id = t.user_id
            {where}
            ORDER BY t.last_reply_at DESC
            LIMIT 100
        """),
        {"cid": category_id} if category_id else {},
    ).mappings().all()
    return {"threads": [dict(r) for r in rows]}

@router.put("/cms/forum/threads/{thread_id}")
async def cms_update_forum_thread(thread_id: int, request: Request, db=Depends(get_db)):
    """Moderation: pin/unpin, lock/unlock, or move to another category."""
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": thread_id}
    for f in ("is_pinned", "is_locked"):
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = bool(body[f])
    if "category_id" in body:
        set_parts.append("category_id = :category_id")
        params["category_id"] = int(body["category_id"])
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE forum_threads SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/forum/threads/{thread_id}")
def cms_delete_forum_thread(thread_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM forum_threads WHERE id = :id"), {"id": thread_id})
    return {"ok": True}

@router.get("/cms/forum/threads/{thread_id}/posts")
def cms_list_forum_posts(thread_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(
        text("""
            SELECT p.id, p.body, p.created_at,
                   COALESCE(u.display_name, u.username, split_part(u.email, '@', 1)) AS author_name
            FROM forum_posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.thread_id = :tid
            ORDER BY p.id ASC
        """),
        {"tid": thread_id},
    ).mappings().all()
    return {"posts": [dict(r) for r in rows]}

@router.delete("/cms/forum/posts/{post_id}")
def cms_delete_forum_post(post_id: int, request: Request, db=Depends(get_db)):
    """Moderation delete of a single reply. To remove a whole thread
    (including its first post), delete the thread instead."""
    require_cms(request, db)
    post = db.execute(text("SELECT thread_id FROM forum_posts WHERE id = :id"), {"id": post_id}).mappings().first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    db.execute(text("DELETE FROM forum_posts WHERE id = :id"), {"id": post_id})
    db.execute(
        text("UPDATE forum_threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = :id"),
        {"id": post["thread_id"]},
    )
    return {"ok": True}

# ==================== Premium plans ====================

PLAN_INTERVALS = {"month", "year", "lifetime"}

@router.get("/cms/premium-plans")
def cms_list_premium_plans(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(text("""
        SELECT id, title, subtitle, price, currency, interval, perks, badge_label, sort_order, is_active
        FROM pricing_plans ORDER BY sort_order ASC, id ASC
    """)).mappings().all()
    return {"plans": [dict(r) for r in rows], "intervals": sorted(PLAN_INTERVALS)}

@router.post("/cms/premium-plans")
async def cms_create_premium_plan(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    title = (body.get("title") or "").strip()
    interval = (body.get("interval") or "month").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if interval not in PLAN_INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {sorted(PLAN_INTERVALS)}")
    perks = body.get("perks")
    if not isinstance(perks, list):
        perks = []
    pos = db.execute(text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM pricing_plans")).scalar() or 1
    new_id = db.execute(
        text("""
            INSERT INTO pricing_plans (title, subtitle, price, currency, interval, perks, badge_label, sort_order, is_active)
            VALUES (:t, :sub, :pr, :cur, :iv, CAST(:perks AS jsonb), :badge, :so, :act) RETURNING id
        """),
        {
            "t": title, "sub": (body.get("subtitle") or "").strip() or None,
            "pr": int(body.get("price") or 0), "cur": (body.get("currency") or "AMD").strip() or "AMD",
            "iv": interval, "perks": json.dumps(perks), "badge": (body.get("badge_label") or "").strip() or None,
            # Draft by default — same reasoning as shop items/lessons/chapters.
            "so": int(pos), "act": bool(body.get("is_active", False)),
        },
    ).scalar_one()
    return {"id": int(new_id)}

@router.put("/cms/premium-plans/{plan_id}")
async def cms_update_premium_plan(plan_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    set_parts, params = [], {"id": plan_id}
    for f in ("title", "subtitle", "price", "currency", "badge_label", "is_active"):
        if f in body:
            set_parts.append(f"{f} = :{f}")
            params[f] = body[f]
    if "interval" in body:
        if body["interval"] not in PLAN_INTERVALS:
            raise HTTPException(status_code=400, detail=f"interval must be one of {sorted(PLAN_INTERVALS)}")
        set_parts.append("interval = :interval")
        params["interval"] = body["interval"]
    if "perks" in body:
        if not isinstance(body["perks"], list):
            raise HTTPException(status_code=400, detail="perks must be a list of strings")
        set_parts.append("perks = CAST(:perks AS jsonb)")
        params["perks"] = json.dumps(body["perks"])
    if not set_parts:
        return {"ok": True}
    db.execute(text(f"UPDATE pricing_plans SET {', '.join(set_parts)} WHERE id = :id"), params)
    return {"ok": True}

@router.delete("/cms/premium-plans/{plan_id}")
def cms_delete_premium_plan(plan_id: int, request: Request, db=Depends(get_db)):
    require_cms(request, db)
    db.execute(text("DELETE FROM pricing_plans WHERE id = :id"), {"id": plan_id})
    return {"ok": True}

@router.post("/cms/premium-plans/reorder")
async def cms_reorder_premium_plans(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    body = await request.json()
    for i, pid in enumerate(body.get("order") or []):
        db.execute(text("UPDATE pricing_plans SET sort_order = :p WHERE id = :id"), {"p": i + 1, "id": int(pid)})
    return {"ok": True}

# ==================== Chest config ====================

@router.get("/cms/shop/chest")
def cms_get_chest(request: Request, db=Depends(get_db)):
    require_cms(request, db)
    rows = db.execute(
        text(
            "SELECT id, gems, weight, COALESCE(rarity, 'wooden') AS rarity "
            "FROM chest_rewards ORDER BY rarity ASC, sort_order ASC, id ASC"
        )
    ).mappings().all()
    rarities = [
        {"rarity": r, "weight": w, "xp_boost_chance": xb}
        for r, w, xb in _load_chest_rarities(db)
    ]
    return {"rewards": [dict(r) for r in rows], "rarities": rarities}

@router.put("/cms/shop/chest")
async def cms_set_chest(request: Request, db=Depends(get_db)):
    """Replace the chest reward rows ([{gems, weight, rarity?}] — rarity
    defaults to 'wooden') and optionally update the rarity odds
    ([{rarity, weight, xp_boost_chance}] over the fixed 4-tier set)."""
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
        rarity = str(r.get("rarity") or "wooden")
        if rarity not in CHEST_RARITIES:
            raise HTTPException(status_code=400, detail=f"Unknown rarity: {rarity}")
        if g >= 0 and w > 0:
            cleaned.append((g, w, rarity))
    if not cleaned:
        raise HTTPException(status_code=400, detail="Provide at least one reward with weight > 0")

    rarity_rows = body.get("rarities")
    cleaned_rarities = []
    if rarity_rows is not None:
        seen = set()
        for r in rarity_rows:
            name = str(r.get("rarity") or "")
            if name not in CHEST_RARITIES:
                raise HTTPException(status_code=400, detail=f"Unknown rarity: {name}")
            try:
                w = int(r.get("weight"))
                xb = int(r.get("xp_boost_chance"))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Invalid numbers for rarity {name}")
            if w <= 0:
                raise HTTPException(status_code=400, detail=f"Weight must be > 0 for {name}")
            if not (0 <= xb <= 100):
                raise HTTPException(status_code=400, detail=f"xp_boost_chance must be 0-100 for {name}")
            seen.add(name)
            cleaned_rarities.append((name, w, xb))
        if seen != set(CHEST_RARITIES):
            raise HTTPException(status_code=400, detail="Rarity odds must cover exactly: " + ", ".join(CHEST_RARITIES))

    db.execute(text("DELETE FROM chest_rewards"))
    for i, (g, w, rarity) in enumerate(cleaned):
        db.execute(
            text("INSERT INTO chest_rewards (gems, weight, sort_order, rarity) VALUES (:g, :w, :so, :r)"),
            {"g": g, "w": w, "so": i, "r": rarity},
        )
    for name, w, xb in cleaned_rarities:
        db.execute(
            text("UPDATE chest_rarities SET weight = :w, xp_boost_chance = :xb WHERE rarity = :r"),
            {"w": w, "xb": xb, "r": name},
        )
    return {"ok": True, "count": len(cleaned)}

# ==================== Lessons ====================

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

class BulkImportLessonRow(BaseModel):
    chapter: Optional[str] = None
    title: str
    slug: Optional[str] = None
    level: Optional[int] = None
    xp: Optional[int] = None
    description: Optional[str] = None

class BulkImportLessonsIn(BaseModel):
    rows: List[BulkImportLessonRow]

@router.post("/cms/lessons/bulk-import")
async def cms_bulk_import_lessons(payload: BulkImportLessonsIn, request: Request, db=Depends(get_db)):
    """CSV/spreadsheet -> lessons, scoped to lesson metadata only (not
    exercises — their config shape varies too much per kind to fit a flat
    CSV row; use the AI generator or the normal editor for those). Each row
    is created inside its own SAVEPOINT so one bad row (duplicate slug,
    missing title, ...) doesn't roll back the rest of a large batch — the
    request's outer transaction (see database.get_db) would otherwise abort
    entirely on the first failed INSERT."""
    require_cms(request, db)
    if not payload.rows:
        raise HTTPException(status_code=400, detail="rows is required")
    if len(payload.rows) > 500:
        raise HTTPException(status_code=400, detail="Max 500 rows per import")

    chapter_cache: Dict[str, int] = {}

    def get_or_create_chapter(title: str) -> int:
        key = title.strip().lower()
        if key in chapter_cache:
            return chapter_cache[key]
        row = db.execute(
            text("SELECT id FROM chapters WHERE LOWER(title) = :t LIMIT 1"), {"t": key}
        ).mappings().first()
        if row:
            chapter_cache[key] = int(row["id"])
            return chapter_cache[key]
        pos = db.execute(text("SELECT COALESCE(MAX(position), 0) + 1 FROM chapters")).scalar() or 1
        # Draft by default, same as everywhere else — a chapter auto-created
        # mid-import shouldn't appear on the live roadmap until reviewed.
        new_id = db.execute(
            text(
                "INSERT INTO chapters (title, description, position, is_published) "
                "VALUES (:t, '', :p, FALSE) RETURNING id"
            ),
            {"t": title.strip(), "p": int(pos)},
        ).scalar_one()
        chapter_cache[key] = int(new_id)
        return int(new_id)

    results: list[dict] = []
    for i, row in enumerate(payload.rows):
        title = (row.title or "").strip()
        if not title:
            results.append({"row": i, "status": "error", "error": "title is required"})
            continue

        sp = f"sp_bulk_lesson_{i}"
        try:
            db.execute(text(f"SAVEPOINT {sp}"))

            slug = (row.slug or "").strip()
            if not slug:
                slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "lesson"
            base_slug, n = slug, 1
            while db.execute(text("SELECT 1 FROM lessons WHERE slug = :s"), {"s": slug}).scalar():
                n += 1
                slug = f"{base_slug}-{n}"

            chapter_id = get_or_create_chapter(row.chapter) if (row.chapter or "").strip() else None
            level = int(row.level) if row.level else 1
            xp = int(row.xp) if row.xp else 10

            new_id = db.execute(
                text(
                    """
                    INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config, chapter_id)
                    VALUES (:slug, :title, :description, :level, :xp, :xp, FALSE, 'standard', '{}'::jsonb, :chapter_id)
                    RETURNING id
                    """
                ),
                {
                    "slug": slug,
                    "title": title,
                    "description": (row.description or "").strip(),
                    "level": level,
                    "xp": xp,
                    "chapter_id": chapter_id,
                },
            ).scalar_one()

            db.execute(text(f"RELEASE SAVEPOINT {sp}"))
            results.append({"row": i, "status": "created", "lesson_id": int(new_id), "slug": slug})
        except Exception as exc:
            db.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
            results.append({"row": i, "status": "error", "error": str(exc)[:200]})

    created = sum(1 for r in results if r["status"] == "created")
    return {"created": created, "total": len(payload.rows), "results": results}

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

    # Draft by default — new lessons are built incrementally in the CMS and
    # shouldn't appear to real students until the admin explicitly publishes.
    is_published = bool(body.get("is_published", False))

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
    # delete exercises/options first if you don't have CASCADE
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

@router.post("/cms/lessons/{lesson_id}/preview-link")
def cms_lesson_preview_link(lesson_id: int, request: Request, db=Depends(get_db)):
    """Mint a short-lived, lesson-scoped preview URL so an admin can walk
    through a DRAFT lesson in the real LessonPlayer exactly as a student
    would see it once published — without exposing the draft to anyone
    else. See the preview-token check in GET /lessons/{slug}."""
    require_cms(request, db)
    row = db.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": lesson_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lesson not found")

    token = _cms_jwt_encode({"scope": "lesson_preview", "lesson_id": lesson_id}, minutes=30)
    frontend_url = (os.getenv("FRONTEND_URL") or "https://haylingua.am").rstrip("/")
    return {
        "url": f"{frontend_url}/lesson/{row['slug']}?preview={token}",
        "expires_in_minutes": 30,
    }

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

@router.get("/cms/lessons/{lesson_id}/exercise-stats")
def cms_lesson_exercise_stats(lesson_id: int, request: Request, db=Depends(get_db)):
    """Per-exercise fail rate for this lesson, surfaced right next to the
    editor so content quality issues are visible where you'd fix them —
    rather than requiring a trip to the separate Analytics tab. Based on
    FIRST-attempt correctness only: a student retrying after a mistake
    doesn't indicate the exercise itself is the problem the way a high
    first-try failure rate does."""
    require_cms(request, db)
    rows = db.execute(
        text(
            """
            SELECT
              e.id AS exercise_id,
              COUNT(a.id) AS attempts,
              COUNT(a.id) FILTER (WHERE a.attempt_no = 1) AS first_attempts,
              COUNT(a.id) FILTER (WHERE a.attempt_no = 1 AND a.is_correct) AS first_attempts_correct
            FROM exercises e
            LEFT JOIN user_exercise_attempts a ON a.exercise_id = e.id
            WHERE e.lesson_id = :lid
            GROUP BY e.id
            """
        ),
        {"lid": lesson_id},
    ).mappings().all()

    out = []
    for r in rows:
        first_attempts = int(r["first_attempts"] or 0)
        first_correct = int(r["first_attempts_correct"] or 0)
        fail_rate_pct = round(100 * (1 - first_correct / first_attempts), 1) if first_attempts > 0 else None
        out.append(
            {
                "exercise_id": int(r["exercise_id"]),
                "attempts": int(r["attempts"] or 0),
                "first_attempts": first_attempts,
                "fail_rate_pct": fail_rate_pct,
            }
        )
    return out

# ==================== Exercises ====================

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


# Mirrors grading.grade_attempt's handled kinds (backend/grading.py) — an
# exercise whose kind isn't graded anywhere is silently never answerable
# (grade_attempt's fallthrough is `return False` with no error), so bulk
# import rejects unknown kinds up front instead of that failing invisibly
# the first time a learner answers it.
_BULK_IMPORT_KNOWN_KINDS = {
    "char_intro", "reading_section", "flashcard",
    "letter_typing", "word_spelling", "fill_blank", "listen_type", "write_translate",
    "speak", "speech_to_text", "pronounce", "speak_line",
    "true_false",
    "categorize",
    "conjugation",
    "letter_recognition", "multi_select", "highlight_grammar",
    "translate_mcq", "char_mcq_sound", "audio_choice_tts", "multiple_choice", "select_missing_word",
    "dialogue_mcq", "image_select", "reading_comprehension", "minimal_pairs",
    "sentence_order", "word_bank", "listen_word_bank", "dialogue_order",
    "char_build_word",
    "match_pairs",
}


class BulkImportExerciseRow(BaseModel):
    kind: str
    prompt: Optional[str] = None
    expected_answer: Optional[str] = None
    order: Optional[int] = None
    xp: Optional[int] = None
    config: Optional[dict] = None
    # For kinds that use exercise_options rows (translate_mcq, match_pairs, ...)
    # rather than config.choices — same shape as POST /cms/options.
    options: Optional[List[dict]] = None


class BulkImportLessonExercises(BaseModel):
    lesson_slug: str
    exercises: List[BulkImportExerciseRow]


class BulkImportExercisesIn(BaseModel):
    lessons: List[BulkImportLessonExercises]


@router.post("/cms/exercises/bulk-import")
async def cms_bulk_import_exercises(payload: BulkImportExercisesIn, request: Request, db=Depends(get_db)):
    """JSON -> exercises, grouped by lesson slug. Exists because the CSV
    lesson importer (POST /cms/lessons/bulk-import) explicitly excludes
    exercises — config shape varies too much per kind for a flat CSV row —
    which otherwise leaves no path to create exercises at scale besides one
    POST /cms/exercises call per exercise. Each exercise gets its own
    SAVEPOINT, same pattern as the lesson importer, so one bad kind or
    malformed config doesn't roll back the rest of a large batch."""
    require_cms(request, db)
    if not payload.lessons:
        raise HTTPException(status_code=400, detail="lessons is required")
    total_exercises = sum(len(l.exercises) for l in payload.lessons)
    if total_exercises == 0:
        raise HTTPException(status_code=400, detail="At least one exercise is required")
    if total_exercises > 2000:
        raise HTTPException(status_code=400, detail="Max 2000 exercises per import")

    lesson_results: list[dict] = []
    for lesson_entry in payload.lessons:
        slug = (lesson_entry.lesson_slug or "").strip()
        lesson_row = db.execute(text("SELECT id FROM lessons WHERE slug = :s"), {"s": slug}).mappings().first()
        if not lesson_row:
            lesson_results.append({
                "lesson_slug": slug, "created": 0, "total": len(lesson_entry.exercises),
                "results": [{"index": i, "status": "error", "error": "lesson not found"} for i in range(len(lesson_entry.exercises))],
            })
            continue
        lesson_id = int(lesson_row["id"])

        # New exercises append after whatever's already in the lesson unless
        # a row explicitly sets its own order.
        next_order = int(db.execute(
            text('SELECT COALESCE(MAX("order"), 0) + 1 FROM exercises WHERE lesson_id = :l'), {"l": lesson_id}
        ).scalar() or 1)

        results: list[dict] = []
        for i, ex in enumerate(lesson_entry.exercises):
            sp = f"sp_bulk_ex_{lesson_id}_{i}"
            try:
                db.execute(text(f"SAVEPOINT {sp}"))

                kind = normalize_kind((ex.kind or "").strip())
                if kind not in _BULK_IMPORT_KNOWN_KINDS:
                    raise ValueError(f"unknown exercise kind {kind!r}")
                config = ex.config or {}
                validate_exercise_config(kind, config)

                order = int(ex.order) if ex.order is not None else next_order
                next_order = (order + 1) if ex.order is not None else (next_order + 1)
                xp = int(ex.xp) if ex.xp is not None else 10

                new_id = db.execute(
                    text(
                        'INSERT INTO exercises (lesson_id, kind, prompt, expected_answer, "order", xp, config) '
                        'VALUES (:lesson_id, :kind, :prompt, :expected_answer, :order, :xp, CAST(:config AS jsonb)) '
                        "RETURNING id"
                    ),
                    {
                        "lesson_id": lesson_id,
                        "kind": kind,
                        "prompt": (ex.prompt or "").strip(),
                        "expected_answer": ex.expected_answer,
                        "order": order,
                        "xp": xp,
                        "config": json.dumps(config),
                    },
                ).scalar_one()

                for opt in (ex.options or []):
                    opt_text = (opt.get("text") or "").strip()
                    if not opt_text:
                        continue
                    db.execute(
                        text(
                            "INSERT INTO exercise_options (exercise_id, text, is_correct, side, match_key) "
                            "VALUES (:eid, :text, :is_correct, :side, :match_key)"
                        ),
                        {
                            "eid": new_id, "text": opt_text,
                            "is_correct": bool(opt.get("is_correct") or False),
                            "side": opt.get("side"), "match_key": opt.get("match_key"),
                        },
                    )

                db.execute(text(f"RELEASE SAVEPOINT {sp}"))
                results.append({"index": i, "status": "created", "exercise_id": int(new_id), "kind": kind})
            except HTTPException as exc:
                db.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
                results.append({"index": i, "status": "error", "error": str(exc.detail)[:200]})
            except Exception as exc:
                db.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
                results.append({"index": i, "status": "error", "error": str(exc)[:200]})

        created = sum(1 for r in results if r["status"] == "created")
        lesson_results.append({
            "lesson_slug": slug, "created": created, "total": len(lesson_entry.exercises), "results": results,
        })

    total_created = sum(l["created"] for l in lesson_results)
    return {"created": total_created, "total": total_exercises, "lessons": lesson_results}


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

# ==================== AI-assisted exercise generation ====================

AI_EXERCISE_KINDS = {"translate_mcq", "true_false", "word_bank", "flashcard"}

_AI_EXERCISE_DEFAULT_PROMPT = {
    "translate_mcq": "Translate this sentence",
    "true_false": "True or false?",
    "word_bank": "Tap the words to translate this sentence",
    "flashcard": "Learn this word",
}

_AI_EXERCISE_SYSTEM_PROMPT = """You are an Armenian-language curriculum writer for Haylingua, an app that teaches Armenian to English speakers. Generate beginner-friendly exercises for the given topic or vocabulary list.

Output STRICT JSON only (no prose, no markdown fences), matching exactly this shape:
{"exercises": [
  {"kind": "translate_mcq" | "true_false" | "word_bank" | "flashcard", "prompt": "short instruction shown above the exercise", "xp": 10, "config": { ...kind-specific fields, see below... }}
]}

Kind-specific "config" fields:
- translate_mcq: {"sentence": "English sentence to translate", "choices": ["Armenian option", ...4 total, one correct], "answerIndex": 0-based index of the correct choice}
- true_false: {"statement": "a statement in Armenian (or about Armenian) the learner judges", "correct": true or false}
- word_bank: {"sentence": "English sentence to translate", "tiles": ["Armenian word", ...include 2-3 extra distractor words not in the solution], "solution": ["Armenian word", ...in correct order, every one must also appear in tiles]}
- flashcard: {"front": "Armenian word or short phrase", "back": "English translation", "hint": "optional short hint, or omit"}

Rules: use real Armenian script (Հայերեն), never transliteration. Keep everything beginner-appropriate and directly grounded in the given topic/vocabulary. Don't repeat the same word or sentence across exercises. Return exactly the requested count, spread across only the allowed kinds listed in the user message."""

class AiGenerateExercisesIn(BaseModel):
    topic: str
    kinds: Optional[List[str]] = None
    count: int = 6

@router.post("/cms/ai/generate-exercises")
async def cms_ai_generate_exercises(payload: AiGenerateExercisesIn, request: Request, db=Depends(get_db)):
    """Generate draft exercises from a topic/vocab list via GPT-4o. Returns
    them for CMS review/editing — nothing is persisted here; the admin adds
    accepted drafts individually through the existing POST /cms/exercises."""
    require_cms(request, db)
    if not _routes_mod._EXPLAIN_OPENAI_KEY:
        raise HTTPException(status_code=503, detail="AI generation is not available: OPENAI_API_KEY is not configured.")

    topic = (payload.topic or "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")
    if len(topic) > 2000:
        raise HTTPException(status_code=400, detail="topic is too long (max 2000 characters)")

    count = max(1, min(int(payload.count or 6), 15))
    kinds = [k for k in (payload.kinds or []) if k in AI_EXERCISE_KINDS] or sorted(AI_EXERCISE_KINDS)

    user_msg = (
        f"Topic / vocabulary: {topic}\n"
        f"Allowed exercise kinds: {', '.join(kinds)}\n"
        f"Number of exercises to generate: {count}"
    )

    try:
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {_routes_mod._EXPLAIN_OPENAI_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 2500,
                "temperature": 0.6,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": _AI_EXERCISE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
            },
            timeout=45,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation request failed: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="AI generation failed — please try again.")

    raw = ((resp.json().get("choices") or [{}])[0].get("message", {}).get("content") or "").strip()
    try:
        parsed = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=502, detail="AI returned malformed output — please try again.")

    raw_exercises = parsed.get("exercises") if isinstance(parsed, dict) else None
    if not isinstance(raw_exercises, list):
        raise HTTPException(status_code=502, detail="AI returned no exercises — please try again.")

    out: list[dict] = []
    for item in raw_exercises:
        if not isinstance(item, dict):
            continue
        kind = item.get("kind")
        if kind not in kinds:
            continue
        cfg = item.get("config")
        if not isinstance(cfg, dict):
            continue

        # Minimal per-kind shape validation so a malformed row doesn't
        # silently reach the editor looking "generated" when it can't
        # actually render or grade correctly.
        if kind == "translate_mcq":
            choices = cfg.get("choices")
            idx = cfg.get("answerIndex")
            if not (cfg.get("sentence") and isinstance(choices, list) and len(choices) >= 2):
                continue
            if not isinstance(idx, int) or not (0 <= idx < len(choices)):
                continue
        elif kind == "true_false":
            if not cfg.get("statement") or not isinstance(cfg.get("correct"), bool):
                continue
        elif kind == "word_bank":
            tiles, solution = cfg.get("tiles"), cfg.get("solution")
            if not (cfg.get("sentence") and isinstance(tiles, list) and isinstance(solution, list) and solution):
                continue
        elif kind == "flashcard":
            if not cfg.get("front") or not cfg.get("back"):
                continue
        else:
            continue

        out.append(
            {
                "kind": kind,
                "prompt": str(item.get("prompt") or "").strip() or _AI_EXERCISE_DEFAULT_PROMPT.get(kind, ""),
                "expected_answer": None,
                "xp": max(0, min(int(item.get("xp") or 10), 100)),
                "config": cfg,
            }
        )

    if not out:
        raise HTTPException(status_code=502, detail="AI did not return any usable exercises — try rephrasing the topic.")

    return {"exercises": out[:count]}

# ==================== Exercise options ====================

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

# ==================== CMS account management ====================

@router.get("/cms/account")
def cms_account_get(u: dict = Depends(require_cms_admin), db=Depends(get_db)):
    row = db.execute(
        text("SELECT id, email, display_name, timezone, totp_enabled, last_login_at FROM cms_users WHERE id=:id"),
        {"id": u["id"]},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row.get("display_name") or "",
        "timezone": row.get("timezone") or "UTC",
        "totp_enabled": bool(row.get("totp_enabled")),
        "last_login_at": row["last_login_at"].isoformat() if row.get("last_login_at") else None,
    }

@router.put("/cms/account")
def cms_account_update(payload: Dict[str, Any] = Body(...), u: dict = Depends(require_cms_admin), db=Depends(get_db)):
    display_name = (payload.get("display_name") or "").strip()
    timezone = (payload.get("timezone") or "UTC").strip()
    db.execute(
        text("UPDATE cms_users SET display_name=:n, timezone=:tz, updated_at=NOW() WHERE id=:id"),
        {"n": display_name or None, "tz": timezone, "id": u["id"]},
    )
    return {"ok": True}

@router.post("/cms/account/change-password")
def cms_account_change_password(payload: Dict[str, Any] = Body(...), u: dict = Depends(require_cms_admin), db=Depends(get_db)):
    current = payload.get("current_password") or ""
    new_pw = payload.get("new_password") or ""
    if not current or not new_pw:
        raise HTTPException(status_code=400, detail="current_password and new_password required")
    row = db.execute(
        text("SELECT password_hash FROM cms_users WHERE id=:id"),
        {"id": u["id"]},
    ).mappings().first()
    if not row or not verify_password(current, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    errs = validate_password_simple(new_pw)
    if errs:
        raise HTTPException(status_code=400, detail="; ".join(errs))
    db.execute(
        text("UPDATE cms_users SET password_hash=:h, updated_at=NOW() WHERE id=:id"),
        {"h": hash_password(new_pw), "id": u["id"]},
    )
    return {"ok": True}

@router.post("/cms/account/change-email")
def cms_account_change_email(payload: Dict[str, Any] = Body(...), u: dict = Depends(require_cms_admin), db=Depends(get_db)):
    new_email = (payload.get("new_email") or "").strip().lower()
    password = payload.get("password") or ""
    if not new_email or not password:
        raise HTTPException(status_code=400, detail="new_email and password required")
    row = db.execute(
        text("SELECT password_hash FROM cms_users WHERE id=:id"),
        {"id": u["id"]},
    ).mappings().first()
    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    conflict = db.execute(
        text("SELECT id FROM cms_users WHERE lower(email)=:e AND id!=:id"),
        {"e": new_email, "id": u["id"]},
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="That email is already used by another CMS user")
    db.execute(
        text("UPDATE cms_users SET email=:e, updated_at=NOW() WHERE id=:id"),
        {"e": new_email, "id": u["id"]},
    )
    return {"ok": True}

@router.post("/cms/account/2fa/disable")
def cms_account_2fa_disable(payload: Dict[str, Any] = Body(...), u: dict = Depends(require_cms_admin), db=Depends(get_db)):
    code = (payload.get("code") or "").strip().replace(" ", "")
    if not code:
        raise HTTPException(status_code=400, detail="TOTP code required")
    row = db.execute(
        text("SELECT totp_secret, totp_enabled FROM cms_users WHERE id=:id"),
        {"id": u["id"]},
    ).mappings().first()
    if not row or not row.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not currently enabled")
    totp = pyotp.TOTP(row["totp_secret"])
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    db.execute(
        text("UPDATE cms_users SET totp_enabled=FALSE, totp_secret=NULL, updated_at=NOW() WHERE id=:id"),
        {"id": u["id"]},
    )
    return {"ok": True}

