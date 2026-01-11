# backend/main.py (only the schemas + seed_lessons parts)

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from pydantic import BaseModel, field_validator, ConfigDict
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User, Lesson, Exercise, ExerciseOption
from auth import hash_password, verify_password, create_token

# ... CORS + get_db + auth schemas stay as you already have ...


# ---------- LESSON / EXERCISE SCHEMAS ----------

class ExerciseOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  kind: str
  prompt: str
  expected_answer: str | None = None
  sentence_before: str | None = None
  sentence_after: str | None = None
  order: int
  config: Dict[str, Any] = {}
  # keep options here for old multi-select / match exercises if you want
  # For now we don't expose options – we’ll use config for new types.


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
  """
  Create demo lessons if they don't exist:
  - alphabet-1: Armenian alphabet intro (Duolingo-style)
  """
  db = SessionLocal()
  try:
    # 1) Alphabet lesson
    existing = db.query(Lesson).filter(Lesson.slug == "alphabet-1").first()
    if not existing:
      alphabet = Lesson(
        slug="alphabet-1",
        title="Armenian Alphabet – Part 1",
        description="Learn your first Armenian letters with simple steps.",
        level=1,
        xp=30,
      )
      db.add(alphabet)
      db.flush()  # alphabet.id ready

      ex1 = Exercise(
        lesson_id=alphabet.id,
        kind="char_intro",
        order=1,
        prompt="Meet your first Armenian letter!",
        config={
          "letter": "Ա",
          "lower": "ա",
          "transliteration": "a",
          "hint": "Like the 'a' in 'father'."
        },
      )

      ex2 = Exercise(
        lesson_id=alphabet.id,
        kind="char_mcq_sound",
        order=2,
        prompt="Which sound does this letter make?",
        config={
          "letter": "Ա",
          "options": ["a", "o", "e", "u"],
          "correctIndex": 0,
          "showTransliteration": True,
        },
      )

      ex3 = Exercise(
        lesson_id=alphabet.id,
        kind="char_build_word",
        order=3,
        prompt="Tap the letters to spell 'Արա' (a common Armenian name).",
        config={
          "targetWord": "Արա",
          "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],  # extra distractors OK
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
  Base.metadata.create_all(bind=engine)
  seed_lessons()
