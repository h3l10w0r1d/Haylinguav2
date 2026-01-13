# backend/routes.py
import os
import httpx
from typing import List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy import text
from sqlalchemy.engine import Connection

from auth import hash_password, verify_password, create_token
from db_utils import get_db


router = APIRouter()


# -------------------------------------------------------------------
# ElevenLabs TTS config
# -------------------------------------------------------------------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
)

DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


class TTSPayload(BaseModel):
    text: str
    voice_id: str | None = None


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
# TTS route
# -------------------------------------------------------------------

@router.post("/tts", response_class=Response)
async def tts_speak(payload: TTSPayload):
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


# -------------------------------------------------------------------
# Auth routes
# -------------------------------------------------------------------

@router.post("/signup")
def signup(user: UserCreate, db: Connection = Depends(get_db)):
    # check if email is taken
    existing = db.execute(
        text(
            """
            SELECT id FROM users
            WHERE email = :email
            """
        ),
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


# -------------------------------------------------------------------
# Lesson API – RAW SQL
# -------------------------------------------------------------------

@router.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Connection = Depends(get_db)):
    """
    For now we *only* expose the alphabet lessons,
    even if the DB contains old “greetings” rows.
    """
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

    return [LessonOut(**dict(row)) for row in rows]


@router.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Connection = Depends(get_db)):
    """
    Return a lesson + its exercises by slug.
    """
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
