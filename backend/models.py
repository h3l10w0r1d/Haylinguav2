# backend/models.py
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    JSON,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    progresses = relationship("LessonProgress", back_populates="user")


class UserProfile(Base):
    """
    Separate table so we don't have to migrate the old users table columns.
    """
    __tablename__ = "user_profiles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    user = relationship("User", back_populates="profile")


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

    progresses = relationship("LessonProgress", back_populates="lesson")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # Kept for legacy: some old data might still have "type"
    type = Column(String, nullable=True)

    # Unified "kind" used by new frontend:
    # "char_intro", "char_mcq_sound", "char_build_word", etc.
    kind = Column(String, nullable=False, default="legacy")

    # Human-readable prompt/question shown at the top
    prompt = Column(Text, nullable=False)

    # Optional generic answer (for simple text / fill-blank, legacy support)
    expected_answer = Column(Text, nullable=True)

    # Optional sentence fragments for old fill-blank style
    sentence_before = Column(Text, nullable=True)
    sentence_after = Column(Text, nullable=True)

    # Order inside the lesson
    order = Column(Integer, nullable=False, default=1)

    # Flexible per-exercise data, stored as JSON
    config = Column(JSON, nullable=False, default=dict)

    lesson = relationship("Lesson", back_populates="exercises")

    options = relationship(
        "ExerciseOption",
        back_populates="exercise",
        cascade="all, delete-orphan",
        order_by="ExerciseOption.id",
    )


class ExerciseOption(Base):
    __tablename__ = "exercise_options"

    id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=None)
    side = Column(String)        # for match-style exercises
    match_key = Column(String)   # for match-style exercises

    exercise = relationship("Exercise", back_populates="options")


class LessonProgress(Base):
    """
    Single row per (user, lesson). We just store how much XP they got and when.
    """
    __tablename__ = "lesson_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    xp_earned = Column(Integer, nullable=False, default=0)
    completed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="progresses")
    lesson = relationship("Lesson", back_populates="progresses")

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_progress"),
    )
