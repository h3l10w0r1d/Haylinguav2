# backend/routes.py
import os
from datetime import datetime
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
            WHERE slug IN ('alphabet-1', 'alphabet-2')
            ORDER BY level ASC, id ASC
            """
        )
    ).mappings().all()

    return [LessonOut(**dict(row)) for row in rows]


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
