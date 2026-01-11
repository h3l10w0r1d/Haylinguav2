# backend/main.py
import os
import httpx

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from typing import List, Dict, Any
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise, ExerciseOption
from auth import hash_password, verify_password, create_token





# Try several env var names – you said you used 'eleven_labs.io'
ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
)

# Default ElevenLabs voice – you can swap this for your own voice ID
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # example from docs



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
# Text to speech API 
# -------------------------------------------------------------------

@app.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
    """
    Proxy to ElevenLabs TTS so the frontend never sees the API key.
    Returns raw MP3 bytes.
    """
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=500, detail="TTS not configured on server")

    text = payload.text.strip()
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
            # Log r.text on server if you need more detail
            raise HTTPException(
                status_code=502,
                detail=f"ElevenLabs error ({r.status_code})",
            )
        audio_bytes = r.content
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e

    # MP3 back to the browser
    return Response(content=audio_bytes, media_type="audio/mpeg")

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
# Seeding helpers – ALPHABET ONLY
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
    """Get or create a lesson by slug, wipe its exercises, and return it."""
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
        # keep metadata up to date
        lesson.title = title
        lesson.description = description
        lesson.level = level
        lesson.xp = xp
        db.flush()

    # Clear existing exercises for a clean slate
    db.query(Exercise).filter(Exercise.lesson_id == lesson.id).delete()
    return lesson


def _reset_alphabet_1(db: Session) -> None:
    """
    Armenian Alphabet – Part 1
    Letter: Ա / ա
    """
    lesson = _ensure_lesson(
        db,
        slug="alphabet-1",
        title="Armenian Alphabet – Part 1",
        description="Meet your first Armenian letter Ա and practice simple combinations.",
        level=1,
        xp=40,
    )

    ex1 = Exercise(
        lesson_id=lesson.id,
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

    ex2 = Exercise(
        lesson_id=lesson.id,
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

    ex3 = Exercise(
        lesson_id=lesson.id,
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

    db.add_all([ex1, ex2, ex3])


def _reset_alphabet_2(db: Session) -> None:
    """
    Armenian Alphabet – Part 2
    Letter: Բ / բ
    """
    lesson = _ensure_lesson(
        db,
        slug="alphabet-2",
        title="Armenian Alphabet – Part 2",
        description="Learn the second Armenian letter Բ and build simple words.",
        level=1,
        xp=40,
    )

    ex1 = Exercise(
        lesson_id=lesson.id,
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
            "hint": "Like the 'b' in 'boy'.",
        },
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
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

    ex3 = Exercise(
        lesson_id=lesson.id,
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

    db.add_all([ex1, ex2, ex3])


def seed_alphabet_lessons():
    """
    Reset ONLY the alphabet lessons. Other old lessons can stay in DB,
    but we don't touch them or expose them in /lessons.
    """
    db = SessionLocal()
    try:
        _reset_alphabet_1(db)
        _reset_alphabet_2(db)
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
# Lesson API
# -------------------------------------------------------------------

@app.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    """
    For now we *only* expose the alphabet lessons,
    even if the DB contains old “greetings” rows.
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
    """
    Return a lesson + its exercises by slug.
    """
    lesson = (
        db.query(Lesson)
        .filter(Lesson.slug == slug)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Ensure exercises are ordered
    lesson.exercises.sort(key=lambda e: e.order)
    return lesson
