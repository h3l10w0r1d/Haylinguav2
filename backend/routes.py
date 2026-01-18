# backend/routes.py
import os
import logging
from datetime import datetime
from typing import List, Dict, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from auth import hash_password, verify_password, create_token

# Optional auth helper – if not present, we fall back to email-based lookups
try:
    from auth import get_current_user  # type: ignore
except ImportError:  # pragma: no cover
    def get_current_user():
        return None


logger = logging.getLogger(__name__)
router = APIRouter()

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


# ---------- Routes ----------

@router.get("/")
def root():
    logger.info("Root health check hit")
    return {"status": "Backend is running"}


@router.post("/signup")
def signup(user: UserCreate, db: Connection = Depends(get_db)):
    logger.info("Signup attempt email=%s", user.email)

    existing = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": user.email},
    ).mappings().first()

    if existing is not None:
        logger.warning("Signup failed (email exists) email=%s", user.email)
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
    logger.info("Signup success user_id=%s email=%s", user_id, user.email)
    return {"message": "User created", "access_token": token}


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Connection = Depends(get_db)):
    logger.info("Login attempt email=%s", payload.email)

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
        logger.warning("Login failed (no user) email=%s", payload.email)
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not verify_password(payload.password, row["password_hash"]):
        logger.warning("Login failed (bad password) email=%s", payload.email)
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token(row["id"])
    logger.info("Login success user_id=%s email=%s", row["id"], row["email"])
    return AuthResponse(access_token=token, email=row["email"])


@router.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Connection = Depends(get_db)):
    logger.info("Listing lessons")
    rows = db.execute(
        text(
            """
            SELECT id, slug, title, description, level, xp
            FROM lessons
            WHERE slug IN ('alphabet-1', 'alphabet-2')
            ORDER BY level ASC, id ASC
            """
        )
    ).mappings().all()

    logger.debug("Lessons found: %s", [r["slug"] for r in rows])
    return [LessonOut(**dict(row)) for row in rows]


@router.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Connection = Depends(get_db)):
    logger.info("Get lesson slug=%s", slug)

    lesson_row = db.execute(
        text(
            """
            SELECT id, slug, title, description, level, xp
            FROM lessons
            WHERE slug = :slug
            """
        ),
        {"slug": slug},
    ).mappings().first()

    if lesson_row is None:
        logger.warning("Lesson not found slug=%s", slug)
        raise HTTPException(status_code=404, detail="Lesson not found")

    exercises_rows = db.execute(
        text(
            """
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
            """
        ),
        {"lesson_id": lesson_row["id"]},
    ).mappings().all()

    logger.debug(
        "Lesson %s has %d exercises, kinds=%s",
        slug,
        len(exercises_rows),
        [r["kind"] for r in exercises_rows],
    )

    lesson_dict: Dict[str, Any] = dict(lesson_row)
    lesson_dict["exercises"] = [ExerciseOut(**dict(r)) for r in exercises_rows]

    return LessonWithExercisesOut(**lesson_dict)


# --------- "Done" button: complete lesson & earn XP ---------

class LessonCompletePayload(BaseModel):
    # Optional: kept for backwards compatibility if the frontend sends it
    email: str | None = None  # frontend may send the logged-in user's email


@router.post("/lessons/{slug}/complete", response_model=StatsOut)
def complete_lesson(
    slug: str,
    payload: LessonCompletePayload | None = None,
    db: Connection = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Mark a lesson as completed and award XP.

    Backwards compatible:
    - If `payload.email` is provided, use that (old behaviour).
    - Otherwise, try to use `current_user` from auth (JWT-based).
    """
    logger.info(
        "complete_lesson called slug=%s payload_email=%s current_user_email=%s",
        slug,
        getattr(payload, "email", None) if payload else None,
        getattr(current_user, "email", None) if current_user is not None else None,
    )

    # Determine which email to use
    email: str | None = None
    if payload and payload.email:
        email = payload.email
        logger.debug("Using email from payload: %s", email)
    elif current_user is not None:
        email = getattr(current_user, "email", None)
        if email is None and isinstance(current_user, dict):
            email = current_user.get("email")
        logger.debug("Using email from current_user: %s", email)

    if not email:
        logger.warning("complete_lesson: no email available -> 401")
        raise HTTPException(status_code=401, detail="Authentication required")

    # find user
    user_row = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": email},
    ).mappings().first()

    if user_row is None:
        logger.warning("complete_lesson: user not found email=%s", email)
        raise HTTPException(status_code=400, detail="User not found")

    user_id = user_row["id"]

    # find lesson
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
        logger.warning("complete_lesson: lesson not found slug=%s", slug)
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson_id = lesson_row["id"]
    xp_value = lesson_row["xp"]
    logger.info(
        "complete_lesson: awarding xp user_id=%s lesson_id=%s xp=%s",
        user_id,
        lesson_id,
        xp_value,
    )

    # upsert into lesson_progress
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

    # recompute stats
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

    logger.info(
        "complete_lesson: stats user_id=%s total_xp=%s lessons_completed=%s",
        user_id,
        stats_row["total_xp"],
        stats_row["lessons_completed"],
    )

    return StatsOut(
        total_xp=stats_row["total_xp"],
        lessons_completed=stats_row["lessons_completed"],
    )


@router.get("/me/stats", response_model=StatsOut)
def get_stats(
    email: str | None = None,
    db: Connection = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Return aggregate stats for the current user.

    Backwards compatible:
    - If `email` query param is provided, use it.
    - Otherwise, fall back to the authenticated user from get_current_user.
    """
    selected_email = email
    if selected_email is None and current_user is not None:
        selected_email = getattr(current_user, "email", None)
        if selected_email is None and isinstance(current_user, dict):
            selected_email = current_user.get("email")

    logger.info("get_stats called email_param=%s resolved_email=%s", email, selected_email)

    if not selected_email:
        logger.warning("get_stats: no email -> returning zeros")
        return StatsOut(total_xp=0, lessons_completed=0)

    user_row = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": selected_email},
    ).mappings().first()

    if user_row is None:
        logger.warning("get_stats: user not found email=%s", selected_email)
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

    logger.info(
        "get_stats: user_id=%s total_xp=%s lessons_completed=%s",
        user_id,
        stats_row["total_xp"],
        stats_row["lessons_completed"],
    )

    return StatsOut(
        total_xp=stats_row["total_xp"],
        lessons_completed=stats_row["lessons_completed"],
    )


# --------- ElevenLabs TTS ----------

@router.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
    logger.info("TTS request text_len=%s", len((payload.text or "").strip()))

    if not ELEVEN_API_KEY:
        logger.error("TTS not configured (missing ELEVENLABS_API_KEY)")
        raise HTTPException(status_code=500, detail="TTS not configured on server")

    text_value = (payload.text or "").strip()
    if not text_value:
        logger.warning("TTS called with empty text")
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
            logger.error("ElevenLabs error status=%s body=%s", r.status_code, r.text)
            raise HTTPException(
                status_code=502,
                detail=f"ElevenLabs error ({r.status_code})",
            )
        audio_bytes = r.content
    except httpx.RequestError as e:
        logger.exception("TTS request failed: %s", e)
        raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e

    return Response(content=audio_bytes, media_type="audio/mpeg")
