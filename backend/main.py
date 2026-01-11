# backend/main.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session, joinedload

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise
from auth import hash_password, verify_password, create_token


# ---------------------------
#  FASTAPI APP + CORS
# ---------------------------

app = FastAPI()

origins = [
    "http://localhost:5173",
    "https://haylinguav2.vercel.app",
    # add preview / custom domains here if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------
#  DB DEPENDENCY
# ---------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------
#  AUTH SCHEMAS
# ---------------------------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        # bcrypt is limited to 72 bytes
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


# ---------------------------
#  LESSON / EXERCISE SCHEMAS
# ---------------------------

class LessonSummaryOut(BaseModel):
    """For /lessons list endpoint."""

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int
    total_exercises: int


class ExerciseOut(BaseModel):
    """Single exercise inside a lesson."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str                 # e.g. "char_intro", "char_mcq_sound", "char_build_word"
    prompt: str
    expected_answer: str | None = None
    sentence_before: str | None = None
    sentence_after: str | None = None
    order: int
    config: Dict[str, Any] = {}   # JSON config for Duolingo-style types


class LessonWithExercisesOut(BaseModel):
    """Full lesson with exercises for /lessons/{slug}."""

    id: int
    slug: str
    title: str
    description: str | None = None
    level: int
    xp: int
    exercises: List[ExerciseOut]


# ---------------------------
#  SEED DATA
# ---------------------------

def seed_lessons():
    """
    Create demo lessons if they don't exist:
    - alphabet-1: Armenian alphabet intro (Duolingo-style)
    """
    db = SessionLocal()
    try:
        existing = db.query(Lesson).filter(Lesson.slug == "alphabet-1").first()
        if existing:
            print("Lesson 'alphabet-1' already exists, skipping seed.")
            return

        # ---- Lesson: Armenian Alphabet – Part 1 ----
        alphabet = Lesson(
            slug="alphabet-1",
            title="Armenian Alphabet – Part 1",
            description="Learn your first Armenian letters with simple steps.",
            level=1,
            xp=30,
        )
        db.add(alphabet)
        db.flush()  # alphabet.id is now available

        # Exercise 1: introduce the letter Ա
        ex1 = Exercise(
            lesson_id=alphabet.id,
            kind="char_intro",
            order=1,
            prompt="Meet your first Armenian letter!",
            expected_answer=None,
            sentence_before=None,
            sentence_after=None,
            config={
                "letter": "Ա",
                "lower": "ա",
                "transliteration": "a",
                "hint": "Like the 'a' in 'father'.",
            },
        )

        # Exercise 2: multiple choice – which sound?
        ex2 = Exercise(
            lesson_id=alphabet.id,
            kind="char_mcq_sound",
            order=2,
            prompt="Which sound does this letter make?",
            expected_answer=None,
            sentence_before=None,
            sentence_after=None,
            config={
                "letter": "Ա",
                "options": ["a", "o", "e", "u"],
                "correctIndex": 0,
                "showTransliteration": True,
            },
        )

        # Exercise 3: build a simple word
        ex3 = Exercise(
            lesson_id=alphabet.id,
            kind="char_build_word",
            order=3,
            prompt="Tap the letters to spell 'Արա' (a common Armenian name).",
            expected_answer="Արա",
            sentence_before=None,
            sentence_after=None,
            config={
                "targetWord": "Արա",
                "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],  # includes distractors
                "solutionIndices": [0, 1, 2],
            },
        )

        db.add_all([ex1, ex2, ex3])
        db.commit()
        print("Seeded lesson 'alphabet-1' with 3 exercises.")

    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    # Create tables and seed exactly once at startup
    Base.metadata.create_all(bind=engine)
    seed_lessons()


# ---------------------------
#  BASIC ROUTES
# ---------------------------

@app.get("/")
def root():
    return {"status": "Backend is running"}


# ---------------------------
#  AUTH ROUTES
# ---------------------------

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

    # we *can* return token here, but FE currently logs in after signup anyway
    token = create_token(new_user.id)
    return {"message": "User created", "access_token": token}


@app.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == payload.email).first()

    if not db_user or not verify_password(payload.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token(db_user.id)
    return AuthResponse(access_token=token, email=db_user.email)


# ---------------------------
#  LESSON API
# ---------------------------

@app.get("/lessons", response_model=List[LessonSummaryOut])
def list_lessons(db: Session = Depends(get_db)):
    lessons = (
        db.query(Lesson)
        .options(joinedload(Lesson.exercises))
        .order_by(Lesson.level.asc(), Lesson.id.asc())
        .all()
    )

    result: List[LessonSummaryOut] = []
    for lesson in lessons:
        total_exercises = len(lesson.exercises) if hasattr(lesson, "exercises") else 0
        result.append(
            LessonSummaryOut(
                id=lesson.id,
                slug=lesson.slug,
                title=lesson.title,
                description=lesson.description,
                level=lesson.level,
                xp=lesson.xp,
                total_exercises=total_exercises,
            )
        )
    return result


@app.get("/lessons/{slug}", response_model=LessonWithExercisesOut)
def get_lesson(slug: str, db: Session = Depends(get_db)):
    lesson = (
        db.query(Lesson)
        .options(joinedload(Lesson.exercises))
        .filter(Lesson.slug == slug)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    exercises_out: List[ExerciseOut] = []
    for ex in sorted(lesson.exercises, key=lambda e: e.order):
        exercises_out.append(
            ExerciseOut(
                id=ex.id,
                kind=ex.kind,
                prompt=ex.prompt,
                expected_answer=ex.expected_answer,
                sentence_before=ex.sentence_before,
                sentence_after=ex.sentence_after,
                order=ex.order,
                config=ex.config or {},
            )
        )

    return LessonWithExercisesOut(
        id=lesson.id,
        slug=lesson.slug,
        title=lesson.title,
        description=lesson.description,
        level=lesson.level,
        xp=lesson.xp,
        exercises=exercises_out,
    )
