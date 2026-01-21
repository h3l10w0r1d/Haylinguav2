# backend/routes.py
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from auth import hash_password, verify_password, create_token

# JWT decode (for Bearer auth on /complete)
from jose import jwt, JWTError

#CMS
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import text
from database import get_db
import json

router = APIRouter()

KIND_MAP = {
    "fill-blank": "fill_blank",
    "multiple_choice": "translate_mcq",  # change if you want a different mapping
    "multi-select": "multi_select",
}

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

# ---------- Auth schemas ----------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or less")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


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
    exercises: List[ExerciseOut]


class StatsOut(BaseModel):
    total_xp: int
    lessons_completed: int

# ---------- Friends schemas + API ----------
class FriendOut(BaseModel):
    id: int
    email: str
    name: str | None = None
    avatar_url: str | None = None

class FriendRequestOut(BaseModel):
    id: int
    requester_id: int
    requester_email: str
    requester_name: str | None = None
    created_at: datetime

class FriendRequestCreateIn(BaseModel):
    email: str  # add friend by email

@router.get("/friends", response_model=list[FriendOut])
def friends_list(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text("""
            SELECT u.id, u.email, u.name, u.avatar_url
            FROM friends f
            JOIN users u ON u.id = f.friend_id
            WHERE f.user_id = :uid
            ORDER BY COALESCE(u.name, u.email) ASC
        """),
        {"uid": user_id},
    ).mappings().all()

    return [FriendOut(**dict(r)) for r in rows]


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

    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    addressee = db.execute(
        text("SELECT id FROM users WHERE lower(email) = :email"),
        {"email": email},
    ).mappings().first()

    if not addressee:
        raise HTTPException(status_code=404, detail="User not found")

    addressee_id = int(addressee["id"])
    if addressee_id == requester_id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    # already friends?
    existing_friend = db.execute(
        text("""
            SELECT 1 FROM friends
            WHERE user_id = :a AND friend_id = :b
            LIMIT 1
        """),
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
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None

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


# ---------- Routes ----------

@router.get("/")
def root():
    return {"status": "Backend is running"}


@router.post("/signup")
def signup(user: UserCreate, db: Connection = Depends(get_db)):
    existing = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": user.email},
    ).mappings().first()

    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already exists")

    password_hash = hash_password(user.password)

    row = db.execute(
        text(
            """
            INSERT INTO users (email, password_hash)
            VALUES (:email, :password_hash)
            RETURNING id
            """
        ),
        {"email": user.email, "password_hash": password_hash},
    ).mappings().first()

    user_id = row["id"]
    token = create_token(user_id)
    return {"message": "User created", "access_token": token}


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Connection = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT id, email, password_hash
            FROM users
            WHERE email = :email
            """
        ),
        {"email": payload.email},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token(row["id"])
    return AuthResponse(access_token=token, email=row["email"])


@router.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Connection = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT id, slug, title, description, level, xp
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
            SELECT id, slug, title, description, level, xp
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

    lesson_dict: Dict[str, Any] = dict(lesson_row)
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

    lesson_id = lesson_row["id"]
    xp_value = int(lesson_row["xp"] or 0)

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

    return StatsOut(
        total_xp=int(stats_row["total_xp"]),
        lessons_completed=int(stats_row["lessons_completed"]),
    )


@router.get("/me/stats", response_model=StatsOut)
def get_stats(email: str, db: Connection = Depends(get_db)):
    user_row = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": email},
    ).mappings().first()

    if user_row is None:
        return StatsOut(total_xp=0, lessons_completed=0)

    user_id = user_row["id"]

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

    return StatsOut(
        total_xp=int(stats_row["total_xp"]),
        lessons_completed=int(stats_row["lessons_completed"]),
    )

class MeOut(BaseModel):
    id: int
    email: str
    name: str | None = None
    avatar_url: str | None = None

class MeUpdateIn(BaseModel):
    name: str | None = None
    avatar_url: str | None = None



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
        out.append({"day": label, "value": counts_by_date.get(d, 0)})

    return out

@router.get("/me/profile", response_model=MeOut)
def me_profile_get(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    row = db.execute(
        text("SELECT id, email, name, avatar_url FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="User not found")

    return MeOut(**dict(row))


class MeProfileUpdateIn(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None

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
    new_name = " ".join([x for x in [fn, ln] if x]) or None

    updates = {}
    # if user is trying to update name (even empty strings), update name
    if payload.first_name is not None or payload.last_name is not None:
        updates["name"] = new_name

    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url.strip() or None

    if updates:
        set_parts = []
        params = {"id": user_id}
        for k, v in updates.items():
            set_parts.append(f"{k} = :{k}")
            params[k] = v

        db.execute(text(f"UPDATE users SET {', '.join(set_parts)} WHERE id = :id"), params)

    row = db.execute(
        text("SELECT id, email, name, avatar_url FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()

    return MeOut(**dict(row))


@router.get("/me/activity/last7days")
def me_activity_last7days(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    return me_activity(days=7, authorization=authorization, db=db)
    

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
                COALESCE(SUM(lp.xp_earned), 0) AS total_xp
            FROM users u
            LEFT JOIN lesson_progress lp ON lp.user_id = u.id
            GROUP BY u.id, u.email
            ORDER BY total_xp DESC, u.id ASC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings().all()

    out: List[LeaderboardEntryOut] = []
    for i, r in enumerate(rows, start=1):
        email = r["email"] or ""
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



CMS_TOKENS = {
    "c5fe8f3d5aa14af2b7ddfbd22cc72d94",
    "d7c88020e1ea95dd060d90414b4da77e",
    "07112370d92c4301262c47d0d9f4096d",
    "f63b4c0e48b3abfc4e898de035655bab",
    "e1d7a392d68e2e8290ac3cd06a0884aa",
    "42ddc20c92e70d4398b55e30fe1c765e",
    "b0440e852e0e5455b1917bfcaedf31cf",
    "d207f151bdfdb299700ee3b201b71f1e",
    "387d06eb745fbf1c88d5533dc4aad2f5",
    "aa835a34b64a318f39ce9e34ee374c3b",
}

def require_cms(request: Request):
    token = request.headers.get("X-CMS-Token", "")
    ok = False
    for t in CMS_TOKENS:
        if token == t:
            ok = True
            break
    if not ok:
        raise HTTPException(status_code=401, detail="Unauthorized CMS token")

# -------------------- LESSONS --------------------

@router.get("/cms/lessons")
def cms_list_lessons(request: Request, db=Depends(get_db)):
    require_cms(request)
    q = text("""
        SELECT id, slug, title, description, level, xp, xp_reward
        FROM lessons
        ORDER BY level ASC, id ASC
    """)
    rows = db.execute(q).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/lessons")
async def cms_create_lesson(request: Request, db=Depends(get_db)):
    require_cms(request)
    body = await request.json()
    slug = (body.get("slug") or "").strip()
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip()
    level = int(body.get("level") or 1)
    xp = int(body.get("xp") or 40)
    xp_reward = int(body.get("xp_reward") or xp)

    if not slug or not title:
        raise HTTPException(400, detail="slug and title are required")

    q = text("""
        INSERT INTO lessons (slug, title, description, level, xp, xp_reward)
        VALUES (:slug, :title, :description, :level, :xp, :xp_reward)
        RETURNING id
    """)
    new_id = db.execute(q, {
        "slug": slug, "title": title, "description": description,
        "level": level, "xp": xp, "xp_reward": xp_reward
    }).scalar_one()
    return {"id": new_id}

@router.put("/cms/lessons/{lesson_id}")
async def cms_update_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    body = await request.json()

    fields = ["slug", "title", "description", "level", "xp", "xp_reward"]
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
        set_parts.append(f"{k} = :{k}")
        params[k] = v

    q = text(f"UPDATE lessons SET {', '.join(set_parts)} WHERE id = :id")
    db.execute(q, params)
    return {"ok": True}

@router.delete("/cms/lessons/{lesson_id}")
def cms_delete_lesson(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    # delete exercises/options first if you don’t have CASCADE
    db.execute(text("DELETE FROM exercise_options WHERE exercise_id IN (SELECT id FROM exercises WHERE lesson_id = :id)"), {"id": lesson_id})
    db.execute(text("DELETE FROM exercises WHERE lesson_id = :id"), {"id": lesson_id})
    db.execute(text("DELETE FROM lessons WHERE id = :id"), {"id": lesson_id})
    return {"ok": True}

# -------------------- EXERCISES --------------------

@router.get("/cms/lessons/{lesson_id}/exercises")
def cms_list_exercises(lesson_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    q = text("""
        SELECT id, lesson_id, kind, type, prompt, expected_answer, sentence_before, sentence_after, "order", config
        FROM exercises
        WHERE lesson_id = :lesson_id
        ORDER BY "order" ASC, id ASC
    """)
    rows = db.execute(q, {"lesson_id": lesson_id}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/cms/exercises/{exercise_id}")
def cms_get_exercise(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    row = db.execute(text("""
        SELECT id, lesson_id, kind, type, prompt, expected_answer, sentence_before, sentence_after, "order", config
        FROM exercises
        WHERE id = :id
    """), {"id": exercise_id}).mappings().first()
    if not row:
        raise HTTPException(404, detail="Exercise not found")
    return dict(row)


@router.post("/cms/exercises")
async def cms_create_exercise(request: Request, db=Depends(get_db)):
    require_cms(request)
    body = await request.json()

    lesson_id = int(body.get("lesson_id") or 0)
    kind = normalize_kind((body.get("kind") or "").strip())
    prompt = (body.get("prompt") or "").strip()
    expected_answer = body.get("expected_answer")
    order = int(body.get("order") or 1)
    config = body.get("config") or {}
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
            config
        )
        VALUES (
            :lesson_id,
            :kind,
            :prompt,
            :expected_answer,
            :order,
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
        "config": json.dumps(config),
    }

    new_id = db.execute(q, params).scalar_one()
    return {"id": new_id}

@router.put("/cms/exercises/{exercise_id}")
async def cms_update_exercise(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    body = await request.json()

    allowed = ["kind", "type", "prompt", "expected_answer", "sentence_before", "sentence_after", "order", "config"]
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
        else:
            set_parts.append(f"{k} = :{k}")
            params[k] = v

    q = text(f"UPDATE exercises SET {', '.join(set_parts)} WHERE id = :id")
    db.execute(q, params)

    return {"ok": True}

@router.delete("/cms/exercises/{exercise_id}")
def cms_delete_exercise(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    db.execute(text("DELETE FROM exercise_options WHERE exercise_id = :id"), {"id": exercise_id})
    db.execute(text("DELETE FROM exercises WHERE id = :id"), {"id": exercise_id})
    return {"ok": True}

# -------------------- OPTIONS --------------------

@router.get("/cms/exercises/{exercise_id}/options")
def cms_list_options(exercise_id: int, request: Request, db=Depends(get_db)):
    require_cms(request)
    rows = db.execute(text("""
        SELECT id, exercise_id, text, is_correct, side, match_key
        FROM exercise_options
        WHERE exercise_id = :id
        ORDER BY id ASC
    """), {"id": exercise_id}).mappings().all()
    return [dict(r) for r in rows]

@router.post("/cms/options")
async def cms_create_option(request: Request, db=Depends(get_db)):
    require_cms(request)
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
    require_cms(request)
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
    require_cms(request)
    db.execute(text("DELETE FROM exercise_options WHERE id = :id"), {"id": option_id})
    return {"ok": True}
    
# --------- ElevenLabs TTS ----------

@router.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=500, detail="TTS not configured on server")

    text_value = (payload.text or "").strip()
    if not text_value:
        raise HTTPException(status_code=400, detail="Text is empty")

    voice_id = payload.voice_id or DEFAULT_VOICE_ID

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    params = {"output_format": "mp3_44100_128"}

    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
    }

    body = {
        "text": text_value,
        "model_id": "eleven_multilingual_v2",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, params=params, headers=headers, json=body)
        if r.status_code != 200:
            print("ElevenLabs error:", r.status_code, r.text)
            raise HTTPException(
                status_code=502,
                detail=f"ElevenLabs error ({r.status_code})",
            )
        audio_bytes = r.content
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e

    return Response(content=audio_bytes, media_type="audio/mpeg")
