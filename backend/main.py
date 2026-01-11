# backend/main.py

from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise, ExerciseOption
from auth import hash_password, verify_password, create_token


# ---------------------------------------------------------
# FastAPI app + CORS
# ---------------------------------------------------------

app = FastAPI()

# Frontend origins that are allowed to call this API
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


# ---------------------------------------------------------
# DB dependency
# ---------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        # bcrypt only supports 72 bytes
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


# ---------------------------------------------------------
# Lesson / Exercise schemas (for responses)
# ---------------------------------------------------------

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


class LessonOut(BaseModel):
    """
    Lightweight lesson model used for the /lessons list.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int


# ---------------------------------------------------------
# Seed data
# ---------------------------------------------------------

def seed_lessons_if_empty() -> None:
    """
    Create default lessons (and sample exercises) if the lessons table is empty.
    This runs on every startup but only modifies the DB when there are 0 lessons.
    """
    db = SessionLocal()
    try:
        count = db.query(Lesson).count()
        if count > 0:
            print(f"Lessons already present ({count}), skipping seed.")
            return

        # --- Create lessons ---
        greetings_basics = Lesson(
            slug="greetings-basics",
            title="Greetings Basics",
            description="Learn basic Armenian greetings and polite expressions.",
            level=1,
            xp=120,
        )

        greetings = Lesson(
            slug="greetings",
            title="Greetings",
            description="Learn basic Armenian greetings.",
            level=1,
            xp=50,
        )

        db.add_all([greetings_basics, greetings])
        db.flush()  # Now greetings_basics.id and greetings.id are available

        # --- Sample exercises for 'greetings' lesson ---
        ex1 = Exercise(
            lesson_id=greetings.id,
            type="type-answer",
            prompt='Type the Armenian word for "Hello".',
            expected_answer="Բարև",
            order=1,
        )

        ex2 = Exercise(
            lesson_id=greetings.id,
            type="fill-blank",
            prompt='Complete the phrase "Բարի _____" (Good morning).',
            sentence_before="Բարի ",
            sentence_after="",
            expected_answer="լույս",
            order=2,
        )

        ex3 = Exercise(
            lesson_id=greetings.id,
            type="multi-select",
            prompt='Select all ways to say "goodbye".',
            order=3,
        )

        db.add_all([ex1, ex2, ex3])
        db.flush()

        # Options for the multi-select exercise
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
        print("Seeded default lessons and exercises.")
    finally:
        db.close()


# ---------------------------------------------------------
# Startup: create tables + seed if needed
# ---------------------------------------------------------

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_lessons_if_empty()


# ---------------------------------------------------------
# Basic routes
# ---------------------------------------------------------

@app.get("/")
def root():
    return {"status": "Backend is running"}


# ---------------------------------------------------------
# Auth routes
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Lessons API
# ---------------------------------------------------------

@app.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    """
    Return all lessons. Frontend uses this to build the roadmap.
    """
    lessons = db.query(Lesson).order_by(Lesson.level, Lesson.id).all()
    return lessons


@app.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Session = Depends(get_db)):
    """
    Return a single lesson with all its exercises and options.
    Frontend calls this when user taps "Start lesson".
    """
    lesson = (
        db.query(Lesson)
        .filter(Lesson.slug == slug)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
