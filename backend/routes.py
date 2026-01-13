# backend/routes.py
import os
from datetime import datetime, date

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, field_validator, ConfigDict
from typing import Any, Dict, List

from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, Lesson, Exercise, LessonProgress
from auth import hash_password, verify_password, create_access_token, get_current_user


router = APIRouter()

API_BASE_PREFIX = ""  # keep paths nice and short ("/lessons", "/me/stats", ...)

# ----------------------------------------------------
# TTS configuration
# ----------------------------------------------------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
)

DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


class TTSPayload(BaseModel):
    text: str
    voice_id: str | None = None


@router.post(f"{API_BASE_PREFIX}/tts", response_class=Response)
async def tts_speak(payload: TTSPayload) -> Response:
    """
    Proxy to ElevenLabs TTS so the frontend never sees the API key.
    Returns raw MP3 bytes.
    """
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


# ----------------------------------------------------
# Auth schemas
# ----------------------------------------------------

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


# ----------------------------------------------------
# Lesson / Exercise schemas
# ----------------------------------------------------

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
    config: Dict[str, Any] = {}


class LessonWithExercisesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int
    exercises: List[ExerciseOut]


# ----------------------------------------------------
# Simple stats model
# ----------------------------------------------------

class UserStatsOut(BaseModel):
    total_xp: int
    daily_streak: int
    lessons_completed: int


# ----------------------------------------------------
# Helper: compute stats for one user
# ----------------------------------------------------

def calculate_user_stats(db: Session, user_id: int) -> UserStatsOut:
    # total XP
    total_xp = (
        db.query(func.coalesce(func.sum(LessonProgress.xp_earned), 0))
        .filter(LessonProgress.user_id == user_id)
        .scalar()
        or 0
    )

    # lessons completed
    lessons_completed = (
        db.query(func.count(LessonProgress.id))
        .filter(LessonProgress.user_id == user_id)
        .scalar()
        or 0
    )

    # tiny streak: 1 if user has completion today, else 0
    today = date.today()
    has_today = (
        db.query(LessonProgress.id)
        .filter(
            LessonProgress.user_id == user_id,
            func.date(LessonProgress.completed_at) == today,
        )
        .first()
        is not None
    )
    daily_streak = 1 if has_today else 0

    return UserStatsOut(
        total_xp=int(total_xp),
        daily_streak=daily_streak,
        lessons_completed=int(lessons_completed),
    )


# ----------------------------------------------------
# Auth endpoints
# ----------------------------------------------------

@router.post(f"{API_BASE_PREFIX}/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        email=user.email,
        password_hash=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id)})

    return {"message": "User created", "access_token": token}


@router.post(f"{API_BASE_PREFIX}/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, email=user.email)


# ----------------------------------------------------
# Lessons + exercises
# ----------------------------------------------------

@router.get(f"{API_BASE_PREFIX}/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    lessons = (
        db.query(Lesson)
        .filter(Lesson.slug.in_(["alphabet-1", "alphabet-2"]))
        .order_by(Lesson.level.asc(), Lesson.id.asc())
        .all()
    )
    return lessons


@router.get(f"{API_BASE_PREFIX}/lessons/{{slug}}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Session = Depends(get_db)):
    lesson = (
        db.query(Lesson)
        .filter(Lesson.slug == slug)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # ensure exercises ordered
    lesson.exercises.sort(key=lambda e: e.order)
    return lesson


# ----------------------------------------------------
# NEW: mark lesson as completed (for Done button)
# ----------------------------------------------------

@router.post(f"{API_BASE_PREFIX}/lessons/{{slug}}/complete", response_model=UserStatsOut)
def complete_lesson(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1) find lesson
    lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # 2) check if already recorded (idempotent)
    existing = (
        db.query(LessonProgress)
        .filter(
            LessonProgress.user_id == current_user.id,
            LessonProgress.lesson_id == lesson.id,
        )
        .first()
    )

    if existing is None:
        # create new progress row
        progress = LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson.id,
            xp_earned=lesson.xp,
            completed_at=datetime.utcnow(),
        )
        db.add(progress)
        db.commit()

    # 3) always return up-to-date stats
    return calculate_user_stats(db, current_user.id)


# ----------------------------------------------------
# Current user stats endpoint (for dashboard)
# ----------------------------------------------------

@router.get(f"{API_BASE_PREFIX}/me/stats", response_model=UserStatsOut)
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return calculate_user_stats(db, current_user.id)
