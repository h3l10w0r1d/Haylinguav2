# backend/main.py
import os
import httpx
import jwt

from datetime import datetime, timedelta, date
from typing import List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import SessionLocal, engine, Base
from models import (
    User,
    Lesson,
    Exercise,
    ExerciseOption,      # unused but fine
    UserProfile,
    UserExerciseLog,
)
from auth import hash_password, verify_password, create_token, SECRET_KEY, ALGORITHM


# -------------------------------------------------------------------
# ElevenLabs TTS config
# -------------------------------------------------------------------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")  # your Render secret name
)

DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # example voice


class TTSPayload(BaseModel):
    text: str
    voice_id: str | None = None


# -------------------------------------------------------------------
# FastAPI app + CORS
# -------------------------------------------------------------------

app = FastAPI()

origins = [
    "http://localhost:5173",
    "https://haylinguav2.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------------
# DB dependency
# -------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------------------------------------------------
# Auth schemas
# -------------------------------------------------------------------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        # bcrypt supports up to 72 bytes
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
# Lesson / Exercise schemas for API
# -------------------------------------------------------------------

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


# -------------------------------------------------------------------
# Profile + stats schemas
# -------------------------------------------------------------------

class DayStat(BaseModel):
    date: str              # "YYYY-MM-DD"
    exercises_completed: int
    xp_earned: int


class UserProfileOut(BaseModel):
    email: str
    first_name: str | None
    last_name: str | None
    avatar_url: str | None
    total_xp: int
    current_streak: int
    level: int
    last_30_days: List[DayStat]


class UserProfileUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = None


class ExerciseCompletedPayload(BaseModel):
    lesson_slug: str
    exercise_id: int
    xp_earned: int = 10
    correct: bool = True


# -------------------------------------------------------------------
# Auth: get_current_user from JWT
# -------------------------------------------------------------------

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        user_id = int(sub)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# -------------------------------------------------------------------
# TTS endpoint (proxy to ElevenLabs)
# -------------------------------------------------------------------

@app.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
    """
    Proxy to ElevenLabs TTS so the frontend never sees the API key.
    Returns raw MP3 bytes.
    """
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=500, detail="TTS not configured on server")

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")

    voice_id = payload.voice_id or DEFAULT_VOICE_ID

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    params = {"output_format": "mp3_44100_128"}

    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
    }

    body = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, params=params, headers=headers, json=body)

        if r.status_code != 200:
            # log partial body for debugging
            print("ElevenLabs error:", r.status_code, r.text[:200])
            raise HTTPException(
                status_code=502,
                detail=f"ElevenLabs error ({r.status_code})",
            )
        audio_bytes = r.content
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e

    return Response(content=audio_bytes, media_type="audio/mpeg")


# -------------------------------------------------------------------
# Seeding helpers – alphabet lessons only
# -------------------------------------------------------------------

def _ensure_lesson(
    db: Session,
    *,
    slug: str,
    title: str,
    description: str,
    level: int,
    xp: int,
) -> Lesson:
    """
    Get or create a lesson by slug, wipe its exercises, and return it.
    Keeps lesson metadata in sync.
    """
    lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
    if not lesson:
        lesson = Lesson(
            slug=slug,
            title=title,
            description=description,
            level=level,
            xp=xp,
        )
        db.add(lesson)
        db.flush()
    else:
        lesson.title = title
        lesson.description = description
        lesson.level = level
        lesson.xp = xp
        db.flush()

    # Clear existing exercises for a clean slate
    db.query(Exercise).filter(Exercise.lesson_id == lesson.id).delete()
    db.flush()
    return lesson


def seed_alphabet_lessons():
    """
    Reset ONLY the alphabet lessons. Old lessons can stay in DB,
    but for now we only expose alphabet-1 and alphabet-2 via the API.
    """
    db = SessionLocal()
    try:
        # ------------------------------------------------------------
        # alphabet-1 – Ա / ա, with TTS + new exercise kinds
        # ------------------------------------------------------------
        lesson1 = _ensure_lesson(
            db,
            slug="alphabet-1",
            title="Armenian Alphabet – Part 1",
            description="Meet your first Armenian letter Ա and practice simple combinations.",
            level=1,
            xp=40,
        )

        ex1_1 = Exercise(
            lesson_id=lesson1.id,
            prompt="Meet your first Armenian letter!",
            expected_answer=None,
            sentence_before=None,
            sentence_after=None,
            order=1,
            kind="char_intro",
            config={
                "letter": "Ա",
                "lower": "ա",
                "transliteration": "a",
                "hint": "Like the 'a' in 'father'.",
            },
        )

        ex1_2 = Exercise(
            lesson_id=lesson1.id,
            prompt="Which sound does this letter make?",
            expected_answer="a",
            sentence_before=None,
            sentence_after=None,
            order=2,
            kind="char_mcq_sound",
            config={
                "letter": "Ա",
                "options": ["a", "o", "e", "u"],
                "correctIndex": 0,
                "showTransliteration": True,
            },
        )

        ex1_3 = Exercise(
            lesson_id=lesson1.id,
            prompt="Tap the letters to spell “Արա” (a common Armenian name).",
            expected_answer="Արա",
            sentence_before=None,
            sentence_after=None,
            order=3,
            kind="char_build_word",
            config={
                "targetWord": "Արա",
                "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
                "solutionIndices": [0, 1, 2],
            },
        )

        ex1_4 = Exercise(
            lesson_id=lesson1.id,
            prompt="Listen and build the word you hear.",
            expected_answer="Արա",
            sentence_before=None,
            sentence_after=None,
            order=4,
            kind="char_listen_build",
            config={
                "targetWord": "Արա",
                "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
                "hint": "You’ve seen this name before – listen carefully.",
            },
        )

        ex1_5 = Exercise(
            lesson_id=lesson1.id,
            prompt="Find all instances of Ա in the grid.",
            expected_answer=None,
            sentence_before=None,
            sentence_after=None,
            order=5,
            kind="char_find_in_grid",
            config={
                "targetLetter": "Ա",
                "grid": ["Ա", "Բ", "Ա", "Գ", "Դ", "Ա", "Ե", "Զ", "Ա", "Թ", "Ժ", "Ի"],
                "columns": 4,
            },
        )

        ex1_6 = Exercise(
            lesson_id=lesson1.id,
            prompt="Type how you would write this sound in Latin letters.",
            expected_answer="a",
            sentence_before=None,
            sentence_after=None,
            order=6,
            kind="char_type_translit",
            config={
                "letter": "Ա",
            },
        )

        db.add_all([ex1_1, ex1_2, ex1_3, ex1_4, ex1_5, ex1_6])

        # ------------------------------------------------------------
        # alphabet-2 – Բ / բ
        # ------------------------------------------------------------
        lesson2 = _ensure_lesson(
            db,
            slug="alphabet-2",
            title="Armenian Alphabet – Part 2",
            description="Learn the second Armenian letter Բ and build simple words.",
            level=1,
            xp=40,
        )

        ex2_1 = Exercise(
            lesson_id=lesson2.id,
            prompt="Here is a new letter!",
            expected_answer=None,
            sentence_before=None,
            sentence_after=None,
            order=1,
            kind="char_intro",
            config={
                "letter": "Բ",
                "lower": "բ",
                "transliteration": "b",
                "hint": "Like the 'b' in 'book'.",
            },
        )

        ex2_2 = Exercise(
            lesson_id=lesson2.id,
            prompt="Which is the correct sound for Բ?",
            expected_answer="b",
            sentence_before=None,
            sentence_after=None,
            order=2,
            kind="char_mcq_sound",
            config={
                "letter": "Բ",
                "options": ["p", "b", "v", "m"],
                "correctIndex": 1,
                "showTransliteration": True,
            },
        )

        ex2_3 = Exercise(
            lesson_id=lesson2.id,
            prompt="Tap the letters to spell “բար”.",
            expected_answer="բար",
            sentence_before=None,
            sentence_after=None,
            order=3,
            kind="char_build_word",
            config={
                "targetWord": "բար",
                "tiles": ["ա", "Բ", "բ", "ր", "ն"],
                "solutionIndices": [2, 0, 3],
            },
        )

        ex2_4 = Exercise(
            lesson_id=lesson2.id,
            prompt="Listen and build the word you hear.",
            expected_answer="բար",
            sentence_before=None,
            sentence_after=None,
            order=4,
            kind="char_listen_build",
            config={
                "targetWord": "բար",
                "tiles": ["ա", "բ", "ր", "ք", "ն"],
                "hint": "It’s a short word you’ve just seen.",
            },
        )

        ex2_5 = Exercise(
            lesson_id=lesson2.id,
            prompt="Find all instances of Բ in the grid.",
            expected_answer=None,
            sentence_before=None,
            sentence_after=None,
            order=5,
            kind="char_find_in_grid",
            config={
                "targetLetter": "Բ",
                "grid": ["Ա", "Բ", "Գ", "Բ", "Դ", "Ե", "Բ", "Զ", "Թ", "Բ", "Ժ", "Ի"],
                "columns": 4,
            },
        )

        ex2_6 = Exercise(
            lesson_id=lesson2.id,
            prompt="Type how you would write this sound in Latin letters.",
            expected_answer="b",
            sentence_before=None,
            sentence_after=None,
            order=6,
            kind="char_type_translit",
            config={
                "letter": "Բ",
            },
        )

        db.add_all([ex2_1, ex2_2, ex2_3, ex2_4, ex2_5, ex2_6])

        db.commit()
        print("Seeded alphabet-1 and alphabet-2 with exercises.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# -------------------------------------------------------------------
# Startup
# -------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_alphabet_lessons()


# -------------------------------------------------------------------
# Basic routes
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "Backend is running"}


@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == user.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        email=user.email,
        password_hash=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_token(new_user.id)
    return {"message": "User created", "access_token": token}


@app.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == payload.email).first()

    if not db_user or not verify_password(payload.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token(db_user.id)
    return AuthResponse(access_token=token, email=db_user.email)


# -------------------------------------------------------------------
# Lessons API
# -------------------------------------------------------------------

@app.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    """
    For now we *only* expose the alphabet lessons,
    even if the DB contains old rows from previous experiments.
    """
    lessons = (
        db.query(Lesson)
        .filter(Lesson.slug.in_(["alphabet-1", "alphabet-2"]))
        .order_by(Lesson.level.asc(), Lesson.id.asc())
        .all()
    )
    return lessons


@app.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson.exercises.sort(key=lambda e: e.order)
    return lesson


# -------------------------------------------------------------------
# Progress & profile helpers
# -------------------------------------------------------------------

def _get_or_create_profile(db: Session, user: User) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(
            user_id=user.id,
            first_name=None,
            last_name=None,
            avatar_url=None,
        )
        db.add(profile)
        db.flush()
    return profile


def _compute_stats(db: Session, user: User) -> tuple[int, int, List[DayStat]]:
    """
    Returns (total_xp, current_streak, last_30_days_stats)
    """
    # total XP
    total_xp = (
        db.query(func.coalesce(func.sum(UserExerciseLog.xp_earned), 0))
        .filter(UserExerciseLog.user_id == user.id)
        .scalar()
        or 0
    )

    # last 30 days (including today)
    today = date.today()
    start_date = today - timedelta(days=29)

    rows = (
        db.query(
            func.date(UserExerciseLog.completed_at).label("day"),
            func.count(UserExerciseLog.id).label("count"),
            func.coalesce(func.sum(UserExerciseLog.xp_earned), 0).label("xp"),
        )
        .filter(
            UserExerciseLog.user_id == user.id,
            UserExerciseLog.completed_at >= start_date,
        )
        .group_by(func.date(UserExerciseLog.completed_at))
        .all()
    )

    by_day: Dict[date, Dict[str, int]] = {}
    for row in rows:
        day = row.day
        by_day[day] = {"count": row.count, "xp": row.xp}

    day_stats: List[DayStat] = []
    for i in range(30):
        d = start_date + timedelta(days=i)
        data = by_day.get(d, {"count": 0, "xp": 0})
        day_stats.append(
            DayStat(
                date=d.isoformat(),
                exercises_completed=data["count"],
                xp_earned=data["xp"],
            )
        )

    # streak: count consecutive days ending at today
    activity_days = sorted(by_day.keys())
    activity_set = set(activity_days)

    streak = 0
    cursor = today
    while cursor in activity_set:
        streak += 1
        cursor = cursor - timedelta(days=1)

    return total_xp, streak, day_stats


# -------------------------------------------------------------------
# Progress & profile endpoints
# -------------------------------------------------------------------

@app.post("/progress/exercise-completed")
def exercise_completed(
    payload: ExerciseCompletedPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.slug == payload.lesson_slug).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    exercise = (
        db.query(Exercise)
        .filter(Exercise.id == payload.exercise_id, Exercise.lesson_id == lesson.id)
        .first()
    )
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found for this lesson")

    log = UserExerciseLog(
        user_id=current_user.id,
        lesson_id=lesson.id,
        exercise_id=exercise.id,
        xp_earned=payload.xp_earned,
        correct=payload.correct,
    )
    db.add(log)
    db.commit()

    return {"status": "ok"}


@app.get("/me", response_model=UserProfileOut)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_or_create_profile(db, current_user)
    total_xp, streak, last_30 = _compute_stats(db, current_user)

    # simple level formula: every 100 XP = +1 level
    level = max(1, total_xp // 100 + 1)

    return UserProfileOut(
        email=current_user.email,
        first_name=profile.first_name,
        last_name=profile.last_name,
        avatar_url=profile.avatar_url,
        total_xp=total_xp,
        current_streak=streak,
        level=level,
        last_30_days=last_30,
    )


@app.put("/me", response_model=UserProfileOut)
def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_or_create_profile(db, current_user)

    # Basic profile fields
    if payload.first_name is not None:
        profile.first_name = payload.first_name.strip() or None
    if payload.last_name is not None:
        profile.last_name = payload.last_name.strip() or None
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url.strip() or None

    # Email change
    if payload.email is not None:
        new_email = payload.email.strip()
        if new_email != current_user.email:
            exists = (
                db.query(User)
                .filter(User.email == new_email, User.id != current_user.id)
                .first()
            )
            if exists:
                raise HTTPException(status_code=400, detail="Email already in use")
            current_user.email = new_email

    # Password change
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(
                status_code=400, detail="Current password is required to change password"
            )
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if len(payload.new_password.encode("utf-8")) > 72:
            raise HTTPException(status_code=400, detail="Password must be 72 bytes or less")

        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    total_xp, streak, last_30 = _compute_stats(db, current_user)
    level = max(1, total_xp // 100 + 1)

    return UserProfileOut(
        email=current_user.email,
        first_name=profile.first_name,
        last_name=profile.last_name,
        avatar_url=profile.avatar_url,
        total_xp=total_xp,
        current_streak=streak,
        level=level,
        last_30_days=last_30,
    )
