# backend/main.py
import os
import json
import httpx

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from typing import List, Dict, Any
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import engine, Base
from models import User, Lesson, Exercise, ExerciseOption  # ensure tables are known
from auth import hash_password, verify_password, create_token


# -------------------------------------------------------------------
# ElevenLabs TTS config
# -------------------------------------------------------------------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
)

# Example default voice – swap for your own voice ID if you want
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


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
# DB dependency – RAW SQL via engine.begin
# -------------------------------------------------------------------

def get_db():
    """
    Provide a Connection with an automatic transaction.

    Every request using this dependency runs inside a transaction.
    On success, it's committed; on error, it's rolled back.
    """
    with engine.begin() as conn:
        yield conn


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
# Text-to-speech proxy endpoint
# -------------------------------------------------------------------

@app.post("/tts", response_class=Response)
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
            # log body server-side if needed
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
# Seeding helpers – RAW SQL, alphabet lessons only
# -------------------------------------------------------------------

def _ensure_lesson(
    conn: Connection,
    *,
    slug: str,
    title: str,
    description: str,
    level: int,
    xp: int,
) -> int:
    """
    Get or create a lesson by slug, keep metadata up to date,
    and return its id.
    """
    row = conn.execute(
        text(
            """
            SELECT id FROM lessons
            WHERE slug = :slug
            """
        ),
        {"slug": slug},
    ).mappings().first()

    if row is None:
        new_row = conn.execute(
            text(
                """
                INSERT INTO lessons (slug, title, description, level, xp)
                VALUES (:slug, :title, :description, :level, :xp)
                RETURNING id
                """
            ),
            {
                "slug": slug,
                "title": title,
                "description": description,
                "level": level,
                "xp": xp,
            },
        ).mappings().first()
        return new_row["id"]

    # update metadata if it changed
    conn.execute(
        text(
            """
            UPDATE lessons
            SET title = :title,
                description = :description,
                level = :level,
                xp = :xp
            WHERE slug = :slug
            """
        ),
        {
            "slug": slug,
            "title": title,
            "description": description,
            "level": level,
            "xp": xp,
        },
    )
    return row["id"]


def _reset_alphabet_1(conn: Connection) -> None:
    """
    Armenian Alphabet – Part 1 (Ա / ա)
    Several Duolingo-style exercises for the letter Ա.
    """
    lesson_id = _ensure_lesson(
        conn,
        slug="alphabet-1",
        title="Armenian Alphabet – Part 1",
        description="Meet your first Armenian letter Ա and practice simple combinations.",
        level=1,
        xp=40,
    )

    # wipe old exercises for this lesson
    conn.execute(
        text("DELETE FROM exercises WHERE lesson_id = :lesson_id"),
        {"lesson_id": lesson_id},
    )

    # 1) Intro
    ex1_config = {
        "letter": "Ա",
        "lower": "ա",
        "transliteration": "a",
        "hint": "Like the 'a' in 'father'.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_intro",
            "kind": "char_intro",
            "prompt": "Meet your first Armenian letter!",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 1,
            "config": json.dumps(ex1_config),
        },
    )

    # 2) MCQ: which sound?
    ex2_config = {
        "letter": "Ա",
        "options": ["a", "o", "e", "u"],
        "correctIndex": 0,
        "showTransliteration": True,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_mcq_sound",
            "kind": "char_mcq_sound",
            "prompt": "Which sound does this letter make?",
            "expected_answer": "a",
            "sentence_before": None,
            "sentence_after": None,
            "order": 2,
            "config": json.dumps(ex2_config),
        },
    )

    # 3) Build word "Արա"
    ex3_config = {
        "targetWord": "Արա",
        "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
        "solutionIndices": [0, 1, 2],
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_build_word",
            "kind": "char_build_word",
            "prompt": "Tap the letters to spell “Արա” (a common Armenian name).",
            "expected_answer": "Արա",
            "sentence_before": None,
            "sentence_after": None,
            "order": 3,
            "config": json.dumps(ex3_config),
        },
    )

    # 4) Listen & build "Արա"
    ex4_config = {
        "targetWord": "Արա",
        "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
        "solutionIndices": [0, 1, 2],
        "hint": "Listen to the word, then build it from the letters.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_listen_build",
            "kind": "char_listen_build",
            "prompt": "Listen and build the word you hear.",
            "expected_answer": "Արա",
            "sentence_before": None,
            "sentence_after": None,
            "order": 4,
            "config": json.dumps(ex4_config),
        },
    )

    # 5) Find letter Ա in grid
    ex5_config = {
        "targetLetter": "Ա",
        "grid": ["Ա", "Բ", "Ա", "Դ", "Ե", "Ա", "Զ", "Թ", "Ա", "Գ", "Ա", "Խ"],
        "columns": 4,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_find_in_grid",
            "kind": "char_find_in_grid",
            "prompt": "Tap every Ա in the grid.",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 5,
            "config": json.dumps(ex5_config),
        },
    )

    # 6) Type transliteration
    ex6_config = {
        "letter": "Ա",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_type_translit",
            "kind": "char_type_translit",
            "prompt": "Type the Latin sound for this letter.",
            "expected_answer": "a",
            "sentence_before": None,
            "sentence_after": None,
            "order": 6,
            "config": json.dumps(ex6_config),
        },
    )


def _reset_alphabet_2(conn: Connection) -> None:
    """
    Armenian Alphabet – Part 2 (Բ / բ)
    Same exercise types, different letter.
    """
    lesson_id = _ensure_lesson(
        conn,
        slug="alphabet-2",
        title="Armenian Alphabet – Part 2",
        description="Meet the letter Բ and build simple words.",
        level=1,
        xp=40,
    )

    conn.execute(
        text("DELETE FROM exercises WHERE lesson_id = :lesson_id"),
        {"lesson_id": lesson_id},
    )

    # 1) Intro
    ex1_config = {
        "letter": "Բ",
        "lower": "բ",
        "transliteration": "b",
        "hint": "Like the 'b' in 'book'.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_intro",
            "kind": "char_intro",
            "prompt": "Here is a new letter!",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 1,
            "config": json.dumps(ex1_config),
        },
    )

    # 2) MCQ
    ex2_config = {
        "letter": "Բ",
        "options": ["p", "b", "v", "m"],
        "correctIndex": 1,
        "showTransliteration": True,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_mcq_sound",
            "kind": "char_mcq_sound",
            "prompt": "Which is the correct sound for Բ?",
            "expected_answer": "b",
            "sentence_before": None,
            "sentence_after": None,
            "order": 2,
            "config": json.dumps(ex2_config),
        },
    )

    # 3) Build word "բար"
    ex3_config = {
        "targetWord": "բար",
        "tiles": ["ա", "Բ", "բ", "ր", "ն"],
        "solutionIndices": [2, 0, 3],
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_build_word",
            "kind": "char_build_word",
            "prompt": "Tap the letters to spell “բար”.",
            "expected_answer": "բար",
            "sentence_before": None,
            "sentence_after": None,
            "order": 3,
            "config": json.dumps(ex3_config),
        },
    )

    # 4) Listen & build "բար"
    ex4_config = {
        "targetWord": "բար",
        "tiles": ["ա", "Բ", "բ", "ր", "ն"],
        "solutionIndices": [2, 0, 3],
        "hint": "Listen to the word, then build it from the letters.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_listen_build",
            "kind": "char_listen_build",
            "prompt": "Listen and build the word you hear.",
            "expected_answer": "բար",
            "sentence_before": None,
            "sentence_after": None,
            "order": 4,
            "config": json.dumps(ex4_config),
        },
    )

    # 5) Find Բ in grid
    ex5_config = {
        "targetLetter": "Բ",
        "grid": ["Բ", "Ա", "Գ", "Բ", "Դ", "Բ", "Ե", "Զ", "Բ", "Թ", "Բ", "Կ"],
        "columns": 4,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_find_in_grid",
            "kind": "char_find_in_grid",
            "prompt": "Tap every Բ in the grid.",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 5,
            "config": json.dumps(ex5_config),
        },
    )

    # 6) Type transliteration
    ex6_config = {
        "letter": "Բ",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_type_translit",
            "kind": "char_type_translit",
            "prompt": "Type the Latin sound for this letter.",
            "expected_answer": "b",
            "sentence_before": None,
            "sentence_after": None,
            "order": 6,
            "config": json.dumps(ex6_config),
        },
    )


def seed_alphabet_lessons():
    """
    Reset ONLY the alphabet lessons (alphabet-1, alphabet-2).
    Older "greetings" lessons can stay in DB, but we don't expose them.
    """
    with engine.begin() as conn:
        _reset_alphabet_1(conn)
        _reset_alphabet_2(conn)
        print("Seeded alphabet-1 and alphabet-2 with exercises.")


# -------------------------------------------------------------------
# Startup
# -------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    # Make sure all tables exist
    Base.metadata.create_all(bind=engine)
    # Seed alphabet lessons
    seed_alphabet_lessons()


# -------------------------------------------------------------------
# Basic routes
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "Backend is running"}


@app.post("/signup")
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


@app.post("/login", response_model=AuthResponse)
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

@app.get("/lessons", response_model=List[LessonOut])
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


@app.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
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
