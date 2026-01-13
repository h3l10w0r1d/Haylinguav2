# backend/models.py

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    JSON,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


# ------------------------------------------------------
# USERS
# ------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Auth
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Profile (for /profile page – these are *extra* fields;
    # they won't break anything even if you haven't ALTER TABLE'd yet,
    # since we don't use ORM for inserts/updates)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    # Gamification stats
    level = Column(Integer, nullable=False, default=1)
    total_xp = Column(Integer, nullable=False, default=0)
    streak_current = Column(Integer, nullable=False, default=0)
    streak_best = Column(Integer, nullable=False, default=0)

    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    # Relationships (not used by raw SQL, but handy if you ever go back to ORM)
    lesson_progress = relationship(
        "UserLessonProgress",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    exercise_attempts = relationship(
        "UserExerciseAttempt",
        back_populates="user",
        cascade="all, delete-orphan",
    )


# ------------------------------------------------------
# LESSONS
# ------------------------------------------------------

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    level = Column(Integer, nullable=False, default=1)
    xp = Column(Integer, nullable=False, default=0)

    exercises = relationship(
        "Exercise",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="Exercise.order",
    )

    user_progress = relationship(
        "UserLessonProgress",
        back_populates="lesson",
        cascade="all, delete-orphan",
    )


# ------------------------------------------------------
# EXERCISES
# ------------------------------------------------------

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # IMPORTANT: this matches the existing DB column
    # NOT NULL, used by old code. We keep it for compatibility.
    # You can set it to something like "char" or "legacy" in raw SQL seeds.
    type = Column(String, nullable=False, default="legacy")

    # New unified "kind" for Duolingo-style types:
    # "char_intro", "char_mcq_sound", "char_build_word",
    # "char_listen_build", "char_find_in_grid", "char_type_translit", etc.
    kind = Column(String, nullable=True)

    # Human-readable prompt/question shown at the top
    prompt = Column(Text, nullable=False)

    # Optional generic answer (for simple text / fill-blank, legacy support)
    expected_answer = Column(Text, nullable=True)

    # Optional sentence fragments for old fill-blank style
    sentence_before = Column(Text, nullable=True)
    sentence_after = Column(Text, nullable=True)

    # Order inside the lesson
    order = Column(Integer, nullable=False, default=1)

    # Flexible per-exercise data, stored as JSON.
    # For example, for char_mcq_sound:
    # {
    #   "letter": "Ա",
    #   "options": ["a", "o", "e", "u"],
    #   "correctIndex": 0,
    #   "transliteration": "a",
    #   "ttsText": "The Armenian letter Ա, pronounced a."
    # }
    config = Column(JSON, nullable=False, default=dict)

    lesson = relationship("Lesson", back_populates="exercises")

    options = relationship(
        "ExerciseOption",
        back_populates="exercise",
        cascade="all, delete-orphan",
        order_by="ExerciseOption.id",
    )

    attempts = relationship(
        "UserExerciseAttempt",
        back_populates="exercise",
        cascade="all, delete-orphan",
    )


# ------------------------------------------------------
# EXERCISE OPTIONS (legacy / multiple-choice)
# ------------------------------------------------------

class ExerciseOption(Base):
    __tablename__ = "exercise_options"

    id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=None)

    # For matching-pairs style exercises (if you reuse them later)
    side = Column(String)        # "left" or "right"
    match_key = Column(String)   # same key = pair

    exercise = relationship("Exercise", back_populates="options")


# ------------------------------------------------------
# USER PROGRESS: lesson-level
# ------------------------------------------------------

class UserLessonProgress(Base):
    """
    Tracks how a user is doing in a given lesson.

    This is the natural place to store:
    - xp_earned so far in this lesson
    - whether lesson is completed/unlocked
    - which exercise index they reached
    """

    __tablename__ = "user_lesson_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # XP earned in THIS lesson
    xp_earned = Column(Integer, nullable=False, default=0)

    # Whether lesson is marked as completed
    completed = Column(Boolean, nullable=False, default=False)

    # Last exercise index reached (0-based or 1-based – up to you in raw SQL)
    last_exercise_index = Column(Integer, nullable=False, default=0)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="lesson_progress")
    lesson = relationship("Lesson", back_populates="user_progress")


# ------------------------------------------------------
# USER PROGRESS: exercise-level attempts
# ------------------------------------------------------

class UserExerciseAttempt(Base):
    """
    Optional: if you want detailed history per exercise attempt
    (for analytics / graphs).
    """

    __tablename__ = "user_exercise_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    # Whether this particular attempt was correct
    is_correct = Column(Boolean, nullable=False, default=False)

    # XP gained from this attempt (if any)
    xp_earned = Column(Integer, nullable=False, default=0)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="exercise_attempts")
    exercise = relationship("Exercise", back_populates="attempts")
