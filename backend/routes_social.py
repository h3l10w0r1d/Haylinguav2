# backend/routes_social.py
"""Friends, leaderboard, and public-profile routes, split out of the
monolithic routes.py (mirroring the earlier routes_cms.py split) to shrink
the file every concurrent session had to touch for unrelated changes.

Kept in core routes.py (not moved here): the auth/JWT primitives and
shared helpers this module depends on (_get_user_id_from_bearer,
_require_verified, _compute_streak_days, _compute_achievements,
_brevo_sync_user) since those are used well beyond the social surface —
e.g. by lesson completion, CMS learner views, and the SSE stats stream.
"""
from datetime import datetime, timedelta
import datetime as dt
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from routes import (
    _get_user_id_from_bearer,
    _require_verified,
    _compute_streak_days,
    _compute_achievements,
    _brevo_sync_user,
)

router = APIRouter()


# === schemas:friends ===
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

class FriendSuggestionOut(BaseModel):
    user_id: int
    username: str | None = None
    name: str
    email: str | None = None
    avatar_url: str | None = None
    xp: int
    level: int
    streak: int
    score: int
    reasons: list[str] = []

class FriendRequestOut(BaseModel):

    id: int
    requester_id: int
    requester_email: str
    requester_name: str | None = None
    created_at: datetime

class FriendRequestCreateIn(BaseModel):
    query: str  # username or email


# === route:friends_list ===
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
                COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.email, u.username, u.display_name, u.avatar_url, u.bonus_xp
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


# === route:friends_leaderboard ===
@router.get("/friends/leaderboard", response_model=list[FriendOut])
def friends_leaderboard(
    authorization: Optional[str] = Header(default=None),
    limit: int = 200,
    db: Connection = Depends(get_db),
):
    friends = friends_list(authorization=authorization, db=db)
    limit = max(1, min(int(limit or 200), 200))
    return friends[:limit]


# === helper:score_friend_suggestion ===
_SUGGEST_PTS_SAME_LEAGUE = 40
_SUGGEST_PTS_REFERRAL_DIRECT = 50
_SUGGEST_PTS_SAME_REFERRER = 25
_SUGGEST_PTS_MUTUAL_FRIEND = 15
_SUGGEST_PTS_MUTUAL_FRIEND_CAP = 45  # 3 mutual friends
_SUGGEST_PTS_SAME_JOIN_WEEK = 10
_SUGGEST_PTS_SAME_COUNTRY = 10
_SUGGEST_PTS_SAME_DIALECT = 8
_SUGGEST_PTS_SAME_GOAL = 8
_SUGGEST_PTS_SAME_SOURCE_LANG = 5
_SUGGEST_PTS_SIMILAR_STREAK = 5
_SUGGEST_PTS_SIMILAR_LEVEL_CLOSE = 15   # within 300 XP
_SUGGEST_PTS_SIMILAR_LEVEL_NEAR = 7     # within 1000 XP
_SUGGEST_PTS_RECENTLY_ACTIVE = 5


def _score_friend_suggestion(me: dict, cand: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    # Same weekly league cohort — the strongest "active peer, right now" signal.
    if (
        me.get("league_week")
        and me["league_week"] == cand.get("league_week")
        and me.get("league_cohort") is not None
        and me["league_cohort"] == cand.get("league_cohort")
        and me.get("league_tier") == cand.get("league_tier")
    ):
        score += _SUGGEST_PTS_SAME_LEAGUE
        reasons.append("In your league this week")

    # Referral graph — a direct invite link beats a shared-referrer coincidence.
    me_id = me.get("id")
    cand_id = cand.get("id")
    if cand.get("referred_by") == me_id:
        score += _SUGGEST_PTS_REFERRAL_DIRECT
        reasons.append("You invited them")
    elif me.get("referred_by") == cand_id:
        score += _SUGGEST_PTS_REFERRAL_DIRECT
        reasons.append("They invited you")
    elif me.get("referred_by") is not None and me.get("referred_by") == cand.get("referred_by"):
        score += _SUGGEST_PTS_SAME_REFERRER
        reasons.append("Invited by the same person")

    # Mutual friends — capped so a single super-connected user can't dominate.
    mutual = int(cand.get("mutual_count") or 0)
    if mutual > 0:
        score += min(mutual * _SUGGEST_PTS_MUTUAL_FRIEND, _SUGGEST_PTS_MUTUAL_FRIEND_CAP)
        reasons.append(f"{mutual} mutual friend{'s' if mutual != 1 else ''}")

    # Same onboarding cohort — new users bond better with other new users.
    if me.get("joined_week") and me["joined_week"] == cand.get("joined_week"):
        score += _SUGGEST_PTS_SAME_JOIN_WEEK
        reasons.append("Joined the same week as you")

    # Shared learning profile (only when BOTH sides actually filled it in —
    # NULL == NULL would otherwise falsely match everyone with an empty profile).
    if me.get("country") and me["country"] == cand.get("country"):
        score += _SUGGEST_PTS_SAME_COUNTRY
        reasons.append(f"Also learning from {me['country']}")
    if me.get("dialect") and me["dialect"] == cand.get("dialect"):
        score += _SUGGEST_PTS_SAME_DIALECT
        reasons.append("Same dialect focus")
    if me.get("primary_goal") and me["primary_goal"] == cand.get("primary_goal"):
        score += _SUGGEST_PTS_SAME_GOAL
        reasons.append("Same learning goal")
    if me.get("source_language") and me["source_language"] == cand.get("source_language"):
        score += _SUGGEST_PTS_SAME_SOURCE_LANG
        reasons.append("Speaks the same language as you")

    # Similarly engaged: comparable streak length, both actually practicing.
    me_streak = int(me.get("current_streak") or 0)
    cand_streak = int(cand.get("current_streak") or 0)
    if me_streak > 0 and cand_streak > 0 and abs(me_streak - cand_streak) <= 2:
        score += _SUGGEST_PTS_SIMILAR_STREAK
        reasons.append("Similar streak to yours")

    # Similar progress stage — a peer, not the all-time XP leaderboard.
    xp_diff = abs(int(me.get("xp") or 0) - int(cand.get("xp") or 0))
    if xp_diff <= 300:
        score += _SUGGEST_PTS_SIMILAR_LEVEL_CLOSE
        reasons.append("Around your level")
    elif xp_diff <= 1000:
        score += _SUGGEST_PTS_SIMILAR_LEVEL_NEAR

    # Recently active — don't surface a suggestion who churned months ago.
    last_active = cand.get("last_active_at")
    if last_active and (datetime.utcnow() - last_active.astimezone(dt.timezone.utc).replace(tzinfo=None)) <= timedelta(days=3):
        score += _SUGGEST_PTS_RECENTLY_ACTIVE

    return score, reasons


# === route:friends_suggestions ===
@router.get("/friends/suggestions", response_model=list[FriendSuggestionOut])
def friends_suggestions(
    authorization: Optional[str] = Header(default=None),
    limit: int = 20,
    db: Connection = Depends(get_db),
):
    """Ranked friend suggestions — a weighted, explainable score across
    league cohort, referral graph, mutual friends, onboarding cohort,
    shared learning profile, and progress proximity. See
    _score_friend_suggestion for the point values."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    limit = max(1, min(int(limit or 20), 50))

    me_row = db.execute(
        text(
            """
            SELECT
                u.id, u.league_tier, u.league_week, u.league_cohort, u.referred_by,
                u.current_streak, DATE_TRUNC('week', u.joined_at) AS joined_week,
                ob.country, ob.dialect, ob.primary_goal, ob.source_language,
                COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS xp
            FROM users u
            LEFT JOIN user_onboarding ob ON ob.user_id = u.id
            LEFT JOIN lesson_progress lp ON lp.user_id = u.id
            WHERE u.id = :me
            GROUP BY u.id, u.league_tier, u.league_week, u.league_cohort, u.referred_by,
                     u.current_streak, u.joined_at, ob.country, ob.dialect,
                     ob.primary_goal, ob.source_language, u.bonus_xp
            """
        ),
        {"me": int(user_id)},
    ).mappings().first()
    if me_row is None:
        raise HTTPException(status_code=404, detail="User not found")
    me = dict(me_row)

    # Bounded, pre-filtered candidate pool: excludes self, existing friends, and
    # anyone with a request between us in either direction/status (no point
    # re-suggesting someone already pending or who declined). Capped to the
    # 400 most recently active eligible users before scoring in Python — this
    # app's scale doesn't need the scoring itself to happen in SQL, and doing
    # it in Python keeps the weighting logic in one readable place.
    rows = db.execute(
        text(
            """
            WITH my_friends AS (
                SELECT friend_id FROM friends WHERE user_id = :me
            ),
            excluded AS (
                SELECT :me AS id
                UNION SELECT friend_id FROM my_friends
                UNION SELECT addressee_id FROM friend_requests WHERE requester_id = :me
                UNION SELECT requester_id FROM friend_requests WHERE addressee_id = :me
            ),
            mutuals AS (
                SELECT f.user_id AS candidate_id, COUNT(*) AS mutual_count
                FROM friends f
                WHERE f.friend_id IN (SELECT friend_id FROM my_friends)
                GROUP BY f.user_id
            )
            SELECT
                u.id, u.username, u.display_name, u.email, u.avatar_url,
                u.league_tier, u.league_week, u.league_cohort, u.referred_by,
                u.current_streak, u.last_active_at,
                DATE_TRUNC('week', u.joined_at) AS joined_week,
                ob.country, ob.dialect, ob.primary_goal, ob.source_language,
                COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS xp,
                COALESCE(m.mutual_count, 0) AS mutual_count
            FROM users u
            LEFT JOIN user_onboarding ob ON ob.user_id = u.id
            LEFT JOIN lesson_progress lp ON lp.user_id = u.id
            LEFT JOIN mutuals m ON m.candidate_id = u.id
            WHERE u.id NOT IN (SELECT id FROM excluded)
              AND COALESCE(u.is_hidden, FALSE) = FALSE
            GROUP BY u.id, u.username, u.display_name, u.email, u.avatar_url,
                     u.league_tier, u.league_week, u.league_cohort, u.referred_by,
                     u.current_streak, u.last_active_at, u.joined_at, u.bonus_xp,
                     ob.country, ob.dialect, ob.primary_goal, ob.source_language,
                     m.mutual_count
            ORDER BY u.last_active_at DESC NULLS LAST
            LIMIT 400
            """
        ),
        {"me": int(user_id)},
    ).mappings().all()

    scored: list[tuple[int, list[str], dict]] = []
    for r in rows:
        cand = dict(r)
        score, reasons = _score_friend_suggestion(me, cand)
        scored.append((score, reasons, cand))

    scored.sort(key=lambda t: (-t[0], t[2]["id"]))

    out: list[FriendSuggestionOut] = []
    for score, reasons, cand in scored[:limit]:
        email = (cand.get("email") or "").strip()
        username = (cand.get("username") or "").strip() or None
        display_name = (cand.get("display_name") or "").strip()
        if display_name:
            name = display_name
        elif username:
            name = username
        else:
            name = email.split("@")[0] if "@" in email else (email or "User")

        xp = int(cand.get("xp") or 0)
        out.append(
            FriendSuggestionOut(
                user_id=int(cand["id"]),
                username=username,
                name=name,
                email=email or None,
                avatar_url=cand.get("avatar_url"),
                xp=xp,
                level=max(1, (xp // 500) + 1),
                streak=int(cand.get("current_streak") or 0),
                score=score,
                reasons=reasons[:3],
            )
        )

    return out


# === route:friends_requests_outgoing ===
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


# === route:friends_requests_incoming ===
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


# === route:friends_requests_sent ===
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


# === route:friends_request_create ===
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


# === route:friends_request_accept ===
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


# === route:friends_request_reject ===
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


# === route:friends_remove ===
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


# === route:friends_activity ===
@router.get("/friends/activity")
def friends_activity(
    days: int = 7,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Recent lesson completions from the current user's friends (last N days)."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text("""
            SELECT
                u.id        AS friend_id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.email,
                l.title     AS lesson_title,
                ulp.xp_earned,
                ulp.completed_at
            FROM user_lesson_progress ulp
            JOIN users   u ON u.id  = ulp.user_id
            JOIN lessons l ON l.id  = ulp.lesson_id
            JOIN friends f ON f.friend_id = ulp.user_id AND f.user_id = :uid
            WHERE ulp.completed_at >= NOW() - (:days || ' days')::INTERVAL
            ORDER BY ulp.completed_at DESC
            LIMIT 60
        """),
        {"uid": int(user_id), "days": int(days)},
    ).mappings().all()

    out = []
    for r in rows:
        email = (r.get("email") or "").strip()
        display_name = (r.get("display_name") or "").strip()
        username = (r.get("username") or "").strip() or None
        name = display_name or username or (email.split("@")[0] if "@" in email else "Someone")
        out.append({
            "friend_id": int(r["friend_id"]),
            "name": name,
            "username": username,
            "avatar_url": r.get("avatar_url"),
            "lesson_title": r.get("lesson_title") or "a lesson",
            "xp_earned": int(r.get("xp_earned") or 0),
            "completed_at": r["completed_at"].isoformat() if r.get("completed_at") else None,
        })
    return out


# === schema:leaderboard ===
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


# === route:get_leaderboard ===
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
                COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS total_xp
            FROM users u
            LEFT JOIN lesson_progress lp ON lp.user_id = u.id
            GROUP BY u.id, u.email, u.username, u.avatar_url, u.bonus_xp
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


# === schema+helper:public_user ===
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
    friends_public: bool = True
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
                COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              WHERE u.id = :uid
              GROUP BY u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url, u.banner_url, u.profile_theme, u.joined_at, u.bonus_xp
            ), ranked AS (
              SELECT
                u2.id,
                COALESCE(SUM(lp2.xp_earned), 0) + COALESCE(u2.bonus_xp, 0) AS total_xp
              FROM users u2
              LEFT JOIN lesson_progress lp2 ON lp2.user_id = u2.id
              GROUP BY u2.id, u2.bonus_xp
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
                     COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.username, u.display_name, u.email, u.avatar_url, u.bonus_xp
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


# === route:get_public_user ===
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
        friends_public=bool(target.get("friends_public", True)),
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


# === route:get_public_user_friends ===
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
                COALESCE(SUM(lp.xp_earned), 0) + COALESCE(u.bonus_xp, 0) AS total_xp
              FROM users u
              LEFT JOIN lesson_progress lp ON lp.user_id = u.id
              GROUP BY u.id, u.email, u.username, u.display_name, u.avatar_url, u.bonus_xp
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


# === route:public_user_activity ===
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

    # Same source as _compute_streak_days / /me/activity — see that function's
    # docstring for why this isn't lesson_progress.completed_at.
    rows = db.execute(
        text(
            """
            SELECT
              DATE(created_at) AS d,
              COUNT(*)::int AS c
            FROM user_exercise_attempts
            WHERE user_id = :user_id
              AND created_at >= :start_dt
            GROUP BY DATE(created_at)
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


# === route:public_user_activity_last7days ===
@router.get("/users/{username}/activity/last7days")
def public_user_activity_last7days(
    username: str,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    return public_user_activity(username=username, days=7, authorization=authorization, db=db)


