from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import random
from pydantic import BaseModel, field_validator 
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import User
from auth import hash_password, verify_password, create_token

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS FIX ---
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

# Dependency: database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------- MODELS -------------

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    def validate_password(cls, v):
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or less")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


# ----------- ROUTES -------------

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
        password_hash=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created"}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")


# ------------------------------
#   HARD-CODED LEARNING LEVELS
# ------------------------------

class ExerciseOut(BaseModel):
  id: int
  letter: str
  expected_answer: str


class LevelOut(BaseModel):
  id: int
  name: str
  description: str
  exercises: List[ExerciseOut]


LETTER_POOL = [
  ("Ա", "a"),
  ("Բ", "b"),
  ("Գ", "g"),
  ("Դ", "d"),
  ("Ե", "ye"),
  ("Զ", "z"),
  ("Է", "e"),
  ("Ը", "uh"),
  ("Թ", "t"),
]


def build_level(level_id: int) -> LevelOut:
  size = random.randint(5, 7)
  sample = random.sample(LETTER_POOL, size)
  exercises = [
    ExerciseOut(id=i + 1, letter=letter, expected_answer=answer)
    for i, (letter, answer) in enumerate(sample)
  ]
  return LevelOut(
    id=level_id,
    name=f"Level {level_id} — Basic letters",
    description="Pronounce the Armenian letter out loud using its Latin transcription.",
    exercises=exercises,
  )


@app.get("/levels", response_model=List[LevelOut])
def get_levels():
  # For now we just return two levels built from the same pool
  return [build_level(1), build_level(2)]


class LevelScoreRequest(BaseModel):
  level_id: int
  total_exercises: int
  correct: int


class LevelScoreResponse(BaseModel):
  stars: int
  message: str


@app.post("/levels/score", response_model=LevelScoreResponse)
def score_level(payload: LevelScoreRequest):
  c = payload.correct

  if c <= 0:
    stars = 0
  elif 1 <= c <= 2:
    stars = 1
  elif 3 <= c <= 4:
    stars = 2
  else:       # 5–7 correct
    stars = 3

  msg = f"You answered {c} out of {payload.total_exercises} correctly."

  return LevelScoreResponse(stars=stars, message=msg)

    token = create_token(db_user.id)
    return {"token": token}
