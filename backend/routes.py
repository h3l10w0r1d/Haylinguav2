# backend/routes.py
import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from db_utils import get_db
from models import User, UserProfile, Lesson, Exercise, LessonProgress
from auth import hash_password, verify_password, create_token


router = APIRouter()

# ---------- TTS CONFIG ----------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
)

DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


class TTSPayload(BaseModel):
    text: str
    voice_id: str | None = None


# ---------- AUTH SCHEMAS ----------

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
    user_id: int


# ---------- LESSON / EXERCISE SCHEMAS ----------

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


# ---------- PROFILE / STATS SCHEMAS ----------

class UserProfileIn(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserProfileOut(UserProfileIn):
    user_id: int


class LessonCompletePayload(BaseModel):
    user_id: int
    lesson_slug: str
    xp_awarded: Optional[int] = None  # if None, use lesson.xp


class StatsOut(BaseModel):
    user_id: int
    total_xp: int
    daily_streak: int
    lessons_completed: int


# -------------------------------------------------------------------
# BASIC / AUTH ROUTES
# -------------------------------------------------------------------

@router.get("/")
def root():
    return {"status": "Backend is running"}


@router.post("/signup", response_model=AuthResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        email=user.email,
        password_hash=hash_password(user.password),
    )
    db.add(new_user)
    db.flush()  # new_user.id available

    token = create_token()

    # Simple: store token in profile table's avatar_url for now? No.
    # Better: client just stores token; we don't need to store it on backend yet.
    # For now token is NOT validated – it's an opaque client-side thing.

    db.commit()

    return AuthResponse(
        access_token=token,
        email=new_user.email,
        user_id=new_user.id,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user or not verify_password(payload.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token()

    return AuthResponse(
        access_token=token,
        email=db_user.email,
        user_id=db_user.id,
    )


# -------------------------------------------------------------------
# TTS – ElevenLabs proxy
# -------------------------------------------------------------------

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


# -------------------------------------------------------------------
# LESSON ROUTES
# -------------------------------------------------------------------

@router.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    lessons = (
        db.query(Lesson)
        .filter(Lesson.slug.in_(["alphabet-1", "alphabet-2"]))
        .order_by(Lesson.level.asc(), Lesson.id.asc())
        .all()
    )
    return lessons


@router.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
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


# -------------------------------------------------------------------
# PROFILE ROUTES
# -------------------------------------------------------------------

@router.get("/profile/{user_id}", response_model=UserProfileOut)
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.flush()

    return UserProfileOut(
        user_id=user.id,
        first_name=profile.first_name,
        last_name=profile.last_name,
        avatar_url=profile.avatar_url,
    )


@router.put("/profile/{user_id}", response_model=UserProfileOut)
def update_profile(
    user_id: int,
    payload: UserProfileIn,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    profile.first_name = payload.first_name
    profile.last_name = payload.last_name
    profile.avatar_url = payload.avatar_url

    db.commit()
    db.refresh(profile)

    return UserProfileOut(
        user_id=user.id,
        first_name=profile.first_name,
        last_name=profile.last_name,
        avatar_url=profile.avatar_url,
    )


# -------------------------------------------------------------------
# PROGRESS / XP ROUTES
# -------------------------------------------------------------------

@router.post("/progress/lesson-complete", response_model=StatsOut)
def complete_lesson(
    payload: LessonCompletePayload,
    db: Session = Depends(get_db),
):
    """
    Called when the user taps the 'Done' button on a lesson.
    - Finds the lesson by slug.
    - Upserts a LessonProgress row for (user, lesson).
    - Recalculates dashboard stats and returns them.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    lesson = db.query(Lesson).filter(Lesson.slug == payload.lesson_slug).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    xp = payload.xp_awarded if payload.xp_awarded is not None else lesson.xp

    progress = (
        db.query(LessonProgress)
        .filter(
            LessonProgress.user_id == user.id,
            LessonProgress.lesson_id == lesson.id,
        )
        .first()
    )

    now = datetime.utcnow()

    if progress:
        progress.xp_earned = xp
        progress.completed_at = now
    else:
        progress = LessonProgress(
            user_id=user.id,
            lesson_id=lesson.id,
            xp_earned=xp,
            completed_at=now,
        )
        db.add(progress)

    db.commit()

    # Return updated stats
    return _calculate_stats(db, user.id)


@router.get("/dashboard/stats/{user_id}", response_model=StatsOut)
def get_dashboard_stats(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return _calculate_stats(db, user.id)


# ---------- internal stats helper (no extra endpoints) ----------

def _calculate_stats(db: Session, user_id: int) -> StatsOut:
    # Total XP
    total_xp = (
        db.query(func.coalesce(func.sum(LessonProgress.xp_earned), 0))
        .filter(LessonProgress.user_id == user_id)
        .scalar()
    )

    # Lessons completed (at least some XP)
    lessons_completed = (
        db.query(func.count(distinct(LessonProgress.lesson_id)))
        .filter(LessonProgress.user_id == user_id,
                LessonProgress.xp_earned > 0)
        .scalar()
    )

    # Daily streak: count how many consecutive days (ending today)
    # have at least one completion.
    today = date.today()
    completions = (
        db.query(distinct(func.date(LessonProgress.completed_at)))
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.completed_at >= today - timedelta(days=30),
        )
        .all()
    )
    days_with_activity = {d[0] for d in completions}  # each row is (date,)

    streak = 0
    cursor = today
    while cursor in days_with_activity:
        streak += 1
        cursor = cursor - timedelta(days=1)

    return StatsOut(
        user_id=user_id,
        total_xp=total_xp or 0,
        daily_streak=streak,
        lessons_completed=lessons_completed or 0,
    )
