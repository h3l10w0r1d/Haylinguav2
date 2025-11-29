from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise, ExerciseOption, UserLessonResult
from auth import hash_password, verify_password, create_token

# --- DB setup ---
Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS ---
origins = [
    "http://localhost:5173",
    "https://haylinguav2.vercel.app",
    "https://haylinguav2-q0zl01lg0-armens-projects-0d6d5877.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- DB dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- AUTH SCHEMAS ----------------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    def validate_password(cls, v: str):
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or less")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


# ---------------- LESSON / EXERCISE SCHEMAS ----------------

class ExerciseOptionOut(BaseModel):
    id: int
    text: str
    is_correct: bool | None = None
    side: str | None = None
    match_key: str | None = None

    class Config:
        from_attributes = True


class ExerciseOut(BaseModel):
    id: int
    type: str
    prompt: str

    expected_answer: str | None = None
    case_sensitive: bool | None = None

    sentence_before: str | None = None
    sentence_after: str | None = None

    options: List[ExerciseOptionOut] = []

    class Config:
        from_attributes = True


class LessonOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None
    level: int
    xp: int
    exercises: List[ExerciseOut] = []

    class Config:
        from_attributes = True


# ----- Answer payloads -----

class MatchingPairAnswer(BaseModel):
    left_option_id: int
    right_option_id: int


class ExerciseAnswer(BaseModel):
    exercise_id: int
    # type-answer / fill-blank
    answer_text: str | None = None
    # multi-select
    selected_option_ids: List[int] | None = None
    # matching
    pairs: List[MatchingPairAnswer] | None = None


class LessonSubmitRequest(BaseModel):
    lesson_id: int
    answers: List[ExerciseAnswer]
    # optional, if you want to later store per-user history
    user_id: int | None = None


class LessonSubmitResponse(BaseModel):
    correct: int
    total: int
    stars: int


# ----- helper -----

def compute_stars(correct: int, total: int) -> int:
    if correct <= 0:
        return 0
    if 1 <= correct <= 2:
        return 1
    if 3 <= correct <= 4:
        return 2
    return 3  # 5–7 correct


# ---------------- BASIC ROUTES ----------------

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

    return {"message": "User created", "user_id": new_user.id}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token(db_user.id)
    return {"token": token, "user_id": db_user.id}
    

# ---------------- SEED LESSON DATA ----------------

def seed_lessons(db: Session):
    """Create one demo lesson with B, C, D, E exercise types if DB is empty."""
    if db.query(Lesson).count() > 0:
        return

    # Lesson 1: Greetings
    lesson1 = Lesson(
        slug="greetings-basics",
        title="Greetings Basics",
        description="Learn basic Armenian greetings and polite expressions.",
        level=1,
        xp=120,
    )
    db.add(lesson1)
    db.flush()  # get lesson1.id

    # B: type-answer
    ex1 = Exercise(
        lesson_id=lesson1.id,
        type="type-answer",
        prompt='How do you say "Hello" in Armenian? (type the Armenian word)',
        expected_answer="Բարև",
        case_sensitive=False,
        order=1,
    )
    db.add(ex1)

    # C: fill-blank
    ex2 = Exercise(
        lesson_id=lesson1.id,
        type="fill-blank",
        prompt="Complete the Armenian phrase for “Good morning”.",
        sentence_before="Բարի ",
        sentence_after="",
        expected_answer="լույս",
        case_sensitive=False,
        order=2,
    )
    db.add(ex2)

    # E: multi-select
    ex3 = Exercise(
        lesson_id=lesson1.id,
        type="multi-select",
        prompt="Which of these are greetings in Armenian?",
        order=3,
    )
    db.add(ex3)
    db.flush()

    ms_options = [
        ExerciseOption(exercise_id=ex3.id, text="Բարև", is_correct=True),
        ExerciseOption(exercise_id=ex3.id, text="Բարի լույս", is_correct=True),
        ExerciseOption(exercise_id=ex3.id, text="Շնորհակալություն", is_correct=False),
        ExerciseOption(exercise_id=ex3.id, text="Կաթ", is_correct=False),
    ]
    db.add_all(ms_options)

    # D: matching
    ex4 = Exercise(
        lesson_id=lesson1.id,
        type="matching",
        prompt="Match the Armenian words to their English meanings.",
        order=4,
    )
    db.add(ex4)
    db.flush()

    pairs = [
        ("Բարև", "Hello", "hello"),
        ("Շնորհակալություն", "Thank you", "thanks"),
        ("Ցտեսություն", "Goodbye", "bye"),
    ]
    for hy, en, key in pairs:
        db.add(ExerciseOption(exercise_id=ex4.id, text=hy, side="left", match_key=key))
        db.add(ExerciseOption(exercise_id=ex4.id, text=en, side="right", match_key=key))

    db.commit()


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_lessons(db)
    finally:
        db.close()


# ---------------- LESSON ENDPOINTS ----------------

@app.get("/lessons", response_model=List[LessonOut])
def list_lessons(db: Session = Depends(get_db)):
    lessons = db.query(Lesson).all()
    return lessons


@app.get("/lessons/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@app.post("/lessons/{lesson_id}/submit", response_model=LessonSubmitResponse)
def submit_lesson(
    lesson_id: int,
    payload: LessonSubmitRequest,
    db: Session = Depends(get_db),
):
    # small sanity check
    if payload.lesson_id != lesson_id:
        raise HTTPException(status_code=400, detail="lesson_id mismatch")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    exercises_by_id = {ex.id: ex for ex in lesson.exercises}
    correct = 0
    total = len(lesson.exercises)

    for ans in payload.answers:
        ex = exercises_by_id.get(ans.exercise_id)
        if not ex:
            continue  # ignore unknown id

        # type B: type-answer
        if ex.type == "type-answer":
            user = (ans.answer_text or "").strip()
            expected = (ex.expected_answer or "").strip()
            if not ex.case_sensitive:
                user = user.lower()
                expected = expected.lower()
            if user == expected:
                correct += 1

        # type C: fill-blank
        elif ex.type == "fill-blank":
            user = (ans.answer_text or "").strip()
            expected = (ex.expected_answer or "").strip()
            if not ex.case_sensitive:
                user = user.lower()
                expected = expected.lower()
            if user == expected:
                correct += 1

        # type E: multi-select
        elif ex.type == "multi-select":
            correct_ids = {opt.id for opt in ex.options if opt.is_correct}
            selected_ids = set(ans.selected_option_ids or [])
            if selected_ids == correct_ids:
                correct += 1

        # type D: matching
        elif ex.type == "matching":
            opt_by_id = {opt.id: opt for opt in ex.options}
            pairs = ans.pairs or []
            if not pairs:
                continue
            all_ok = True
            for p in pairs:
                left_opt = opt_by_id.get(p.left_option_id)
                right_opt = opt_by_id.get(p.right_option_id)
                if not left_opt or not right_opt:
                    all_ok = False
                    break
                if left_opt.match_key is None or right_opt.match_key is None:
                    all_ok = False
                    break
                if left_opt.match_key != right_opt.match_key:
                    all_ok = False
                    break
            if all_ok:
                correct += 1

    stars = compute_stars(correct, total)

    # Optional: store a result row if user_id provided
    if payload.user_id is not None:
        result = UserLessonResult(
            user_id=payload.user_id,
            lesson_id=lesson.id,
            correct=correct,
            total=total,
            stars=stars,
        )
        db.add(result)
        db.commit()

    return LessonSubmitResponse(correct=correct, total=total, stars=stars)
