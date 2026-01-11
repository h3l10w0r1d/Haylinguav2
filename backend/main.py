# backend/main.py

from typing import List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise
from auth import hash_password, verify_password, create_token


# ---------------------------------------------------------------------
# FastAPI app + CORS
# ---------------------------------------------------------------------

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://haylinguav2.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------
# DB dependency
# ---------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        # bcrypt hard limit
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


# ---------------------------------------------------------------------
# Lesson / exercise schemas
# ---------------------------------------------------------------------

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
    type: str          # generic category, e.g. "alphabet"
    kind: str          # specific UI type, e.g. "char_intro"
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


# ---------------------------------------------------------------------
# Seeding – ONLY alphabet lessons
# ---------------------------------------------------------------------

def _reset_alphabet_1(db: Session) -> None:
    """
    alphabet-1: first letters & one simple word.
    Kinds used:
      - char_intro
      - char_mcq_sound
      - char_build_word
    """
    lesson = db.query(Lesson).filter(Lesson.slug == "alphabet-1").first()
    if not lesson:
        lesson = Lesson(
            slug="alphabet-1",
            title="Armenian Alphabet – Part 1",
            description="Meet your first Armenian letter and build a simple word.",
            level=1,
            xp=30,
        )
        db.add(lesson)
        db.flush()

    # wipe existing exercises for a clean seed
    db.query(Exercise).filter(Exercise.lesson_id == lesson.id).delete()

    ex1 = Exercise(
        lesson_id=lesson.id,
        type="alphabet",
        kind="char_intro",
        prompt="Meet your first Armenian letter!",
        expected_answer=None,
        sentence_before=None,
        sentence_after=None,
        order=1,
        config={
            "letter": "Ա",
            "lower": "ա",
            "transliteration": "a",
            "hint": "Like the 'a' in 'father'.",
        },
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
        type="alphabet",
        kind="char_mcq_sound",
        prompt="Which sound does this letter make?",
        expected_answer="a",
        sentence_before=None,
        sentence_after=None,
        order=2,
        config={
            "letter": "Ա",
            "options": ["a", "o", "e", "u"],
            "correctIndex": 0,
            "showTransliteration": True,
        },
    )

    ex3 = Exercise(
        lesson_id=lesson.id,
        type="alphabet",
        kind="char_build_word",
        prompt="Tap the letters to spell «Արա» (a common Armenian name).",
        expected_answer="Արա",
        sentence_before=None,
        sentence_after=None,
        order=3,
        config={
            "targetWord": "Արա",
            "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],  # with distractors
            "solutionIndices": [0, 1, 2],
        },
    )

    db.add_all([ex1, ex2, ex3])


def _reset_alphabet_2(db: Session) -> None:
    """
    alphabet-2: second letter, plus another build exercise.
    """
    lesson = db.query(Lesson).filter(Lesson.slug == "alphabet-2").first()
    if not lesson:
        lesson = Lesson(
            slug="alphabet-2",
            title="Armenian Alphabet – Part 2",
            description="Learn the next Armenian letter and build another word.",
            level=1,
            xp=40,
        )
        db.add(lesson)
        db.flush()

    db.query(Exercise).filter(Exercise.lesson_id == lesson.id).delete()

    ex1 = Exercise(
        lesson_id=lesson.id,
        type="alphabet",
        kind="char_intro",
        prompt="Here is another Armenian letter.",
        expected_answer=None,
        order=1,
        config={
            "letter": "Բ",
            "lower": "բ",
            "transliteration": "b",
            "hint": "Like the 'b' in 'book'.",
        },
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
        type="alphabet",
        kind="char_mcq_sound",
        prompt="Which sound does this letter make?",
        expected_answer="b",
        order=2,
        config={
            "letter": "Բ",
            "options": ["b", "v", "p", "g"],
            "correctIndex": 0,
            "showTransliteration": True,
        },
    )

    ex3 = Exercise(
        lesson_id=lesson.id,
        type="alphabet",
        kind="char_build_word",
        prompt="Tap the letters to spell «Բարև» (hello).",
        expected_answer="Բարև",
        order=3,
        config={
            "targetWord": "Բարև",
            "tiles": ["Բ", "ա", "ր", "և", "ն", "կ"],
            "solutionIndices": [0, 1, 2, 3],
        },
    )

    db.add_all([ex1, ex2, ex3])


def seed_alphabet_lessons() -> None:
    """
    Called on startup. Safe to run repeatedly:
    it only resets the two alphabet lessons.
    """
    db = SessionLocal()
    try:
        _reset_alphabet_1(db)
        _reset_alphabet_2(db)
        db.commit()
        print("Seeded alphabet lessons (alphabet-1, alphabet-2).")
    finally:
        db.close()


# ---------------------------------------------------------------------
# Startup hook
# ---------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_alphabet_lessons()


# ---------------------------------------------------------------------
# Basic routes
# ---------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "Backend is running", "scope": "alphabet-only"}


# ---------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------

@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    db_user = User(
        email=user.email,
        password_hash=hash_password(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    token = create_token(db_user.id)
    return {"message": "User created", "access_token": token}


@app.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user or not verify_password(payload.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token(db_user.id)
    return AuthResponse(access_token=token, email=db_user.email)


# ---------------------------------------------------------------------
# Lessons API (alphabet only for now)
# ---------------------------------------------------------------------

@app.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    # Only expose the alphabet lessons for now,
    # even if old lessons still exist in the DB.
    lessons = (
        db.query(Lesson)
        .filter(Lesson.slug.in_(["alphabet-1", "alphabet-2"]))
        .order_by(Lesson.level.asc(), Lesson.id.asc())
        .all()
    )
    return lessons


@app.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Session = Depends(get_db)):
    lesson = (
        db.query(Lesson)
        .filter(Lesson.slug == slug)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    # exercises relationship will be serialized via LessonWithExercisesOut
    return lesson
