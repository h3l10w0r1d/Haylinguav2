# backend/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import random

from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise, ExerciseOption
from auth import hash_password, verify_password, create_token


# ---------- FastAPI APP + CORS ----------

app = FastAPI()

origins = [
    "http://localhost:5173",
    "https://haylinguav2.vercel.app",
    # you can add preview URLs here if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- DB DEPENDENCY ----------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


# ---------- LESSON / EXERCISE SCHEMAS ----------

class ExerciseOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    is_correct: bool | None = None
    side: str | None = None
    match_key: str | None = None


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    prompt: str
    expected_answer: str | None = None
    sentence_before: str | None = None
    sentence_after: str | None = None
    order: int
    options: List[ExerciseOptionOut] = []


class LessonWithExercisesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int
    exercises: List[ExerciseOut]


# ---------- SEED DATA ----------

def seed_lessons():
    """Create a demo 'Greetings' lesson with exercises if DB is empty."""
    db = SessionLocal()
    try:
        if db.query(Lesson).count() > 0:
            return

        greetings = Lesson(
            slug="lesson-1",
            title="Greetings",
            description="Learn basic Armenian greetings",
            level=1,
            xp=50,
        )
        db.add(greetings)
        db.flush()  # greetings.id ready

        # Exercise 1: type-answer
        ex1 = Exercise(
            lesson_id=greetings.id,
            type="type-answer",
            prompt='Type the Armenian word for "Hello".',
            expected_answer="Բարև",
            order=1,
        )

        # Exercise 2: fill-blank
        ex2 = Exercise(
            lesson_id=greetings.id,
            type="fill-blank",
            prompt='Complete the phrase "Բարի _____" (Good morning).',
            sentence_before="Բարի ",
            sentence_after="",
            expected_answer="լույս",
            order=2,
        )

        # Exercise 3: multi-select
        ex3 = Exercise(
            lesson_id=greetings.id,
            type="multi-select",
            prompt='Select all ways to say "goodbye".',
            order=3,
        )

        db.add_all([ex1, ex2, ex3])
        db.flush()

        # Options for multi-select
        db.add_all(
            [
                ExerciseOption(
                    exercise_id=ex3.id,
                    text="Ցտեսություն",
                    is_correct=True,
                ),
                ExerciseOption(
                    exercise_id=ex3.id,
                    text="Պայփայի",
                    is_correct=True,
                ),
                ExerciseOption(
                    exercise_id=ex3.id,
                    text="Բարև",
                    is_correct=False,
                ),
                ExerciseOption(
                    exercise_id=ex3.id,
                    text="Շնորհակալություն",
                    is_correct=False,
                ),
            ]
        )

        db.commit()
        print("Seeded demo lessons and exercises.")
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    # Create tables and seed exactly once at startup
    Base.metadata.create_all(bind=engine)
    seed_lessons()


# ---------- BASIC ROUTES ----------

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


# ---------- LESSON API ----------

@app.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Session = Depends(get_db)):
    lesson = (
        db.query(Lesson)
        .filter(Lesson.slug == slug)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
