# backend/routes.py
import os
from datetime import date, timedelta
from typing import List, Dict, Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()

API_BASE_ORIGINS = [
    "http://localhost:5173",
    "https://haylinguav2.vercel.app",
]

# -------------------------------------------------------------------
# TTS config
# -------------------------------------------------------------------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
)

DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


class TTSPayload(BaseModel):
    text: str
    voice_id: Optional[str] = None


# -------------------------------------------------------------------
# Auth schemas
# -------------------------------------------------------------------

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


# -------------------------------------------------------------------
# Lesson schemas
# -------------------------------------------------------------------

class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    level: int
    xp: int


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: Optional[str] = None
    prompt: str
    expected_answer: Optional[str] = None
    sentence_before: Optional[str] = None
    sentence_after: Optional[str] = None
    order: int
    config: Dict[str, Any] = {}


class LessonWithExercisesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    level: int
    xp: int
    exercises: List[ExerciseOut]


class StatsOut(BaseModel):
    total_xp: int
    daily_streak: int
    lessons_completed: int


class CompleteLessonIn(BaseModel):
    xp_earned: Optional[int] = None


# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------

@router.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
    """Proxy to ElevenLabs TTS so the frontend never sees the API key."""
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=500, detail="TTS not configured on server")

    text_value = (payload.text or "").trim() if hasattr(payload.text, "trim") else (payload.text or "").strip()
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


# ------------------------ AUTH ------------------------ #

@router.post("/signup", response_model=AuthResponse)
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

    token = create_access_token({"sub": str(row["id"])})
    return AuthResponse(access_token=token, email=user.email)


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Connection = Depends(get_db)):
    row = db.execute(
        text("SELECT id, email, password_hash FROM users WHERE email = :email"),
        {"email": payload.email},
    ).mappings().first()

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_access_token({"sub": str(row["id"])})
    return AuthResponse(access_token=token, email=row["email"])


# ------------------------ LESSONS ------------------------ #

@router.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Connection = Depends(get_db)):
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

    return [LessonOut(**dict(r)) for r in rows]


@router.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Connection = Depends(get_db)):
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

    lesson_dict: Dict[str, Any] = dict(lesson_row)
    lesson_dict["exercises"] = [ExerciseOut(**dict(r)) for r in exercises_rows]

    return LessonWithExercisesOut(**lesson_dict)


# ------------------------ XP / STATS ------------------------ #

@router.post("/lessons/{slug}/complete")
def complete_lesson(
    slug: str,
    payload: CompleteLessonIn,
    db: Connection = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]

    lesson_row = db.execute(
        text("SELECT id, xp FROM lessons WHERE slug = :slug"),
        {"slug": slug},
    ).mappings().first()

    if lesson_row is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    xp_value = payload.xp_earned if payload.xp_earned is not None else (lesson_row["xp"] or 0)

    # Upsert into lesson_progress using the unique index (user_id, lesson_id)
    db.execute(
        text(
            """
            INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, completed_at)
            VALUES (:uid, :lid, :xp, NOW())
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET
                xp_earned = EXCLUDED.xp_earned,
                completed_at = EXCLUDED.completed_at
            """
        ),
        {"uid": user_id, "lid": lesson_row["id"], "xp": xp_value},
    )

    # Return fresh aggregates
    totals = db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(xp_earned), 0) AS total_xp,
              COUNT(*) AS lessons_completed
            FROM lesson_progress
            WHERE user_id = :uid
            """
        ),
        {"uid": user_id},
    ).mappings().first()

    return {
        "status": "ok",
        "xp_earned": xp_value,
        "total_xp": totals["total_xp"] or 0,
        "lessons_completed": totals["lessons_completed"] or 0,
    }


@router.get("/me/stats", response_model=StatsOut)
def me_stats(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    user_id = current_user["id"]

    totals = db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(xp_earned), 0) AS total_xp,
              COUNT(*) AS lessons_completed
            FROM lesson_progress
            WHERE user_id = :uid
            """
        ),
        {"uid": user_id},
    ).mappings().first()

    # Compute streak from completion dates
    date_rows = db.execute(
        text(
            """
            SELECT DISTINCT DATE(completed_at) AS d
            FROM lesson_progress
            WHERE user_id = :uid
            ORDER BY d DESC
            """
        ),
        {"uid": user_id},
    ).mappings().all()

    today = date.today()
    expected = today
    streak = 0

    for r in date_rows:
        d = r["d"]
        if d == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif d < expected:
            break

    return StatsOut(
        total_xp=totals["total_xp"] or 0,
        daily_streak=streak,
        lessons_completed=totals["lessons_completed"] or 0,
    )
