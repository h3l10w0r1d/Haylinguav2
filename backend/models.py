from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    Text,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # not used yet, but ready for later
    lesson_results = relationship("UserLessonResult", back_populates="user")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(Integer, nullable=False, default=1)
    xp = Column(Integer, nullable=False, default=50)

    exercises = relationship(
        "Exercise",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="Exercise.order",
    )
    results = relationship("UserLessonResult", back_populates="lesson")


class Exercise(Base):
    """
    One exercise inside a lesson.

    type values:
      - "type-answer"  → user types whole answer
      - "fill-blank"   → sentence_before + [blank] + sentence_after
      - "matching"     → pairs; options have side + match_key
      - "multi-select" → options with is_correct True/False
    """

    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)

    type = Column(String(50), nullable=False)
    prompt = Column(Text, nullable=False)

    expected_answer = Column(Text, nullable=True)
    case_sensitive = Column(Boolean, default=False)

    sentence_before = Column(Text, nullable=True)
    sentence_after = Column(Text, nullable=True)

    order = Column(Integer, nullable=False, default=0)

    lesson = relationship("Lesson", back_populates="exercises")
    options = relationship(
        "ExerciseOption",
        back_populates="exercise",
        cascade="all, delete-orphan",
    )


class ExerciseOption(Base):
    """
    For matching / multi-select:

    - multi-select: use text + is_correct
    - matching:     use text + side ("left"/"right") + match_key
    """

    __tablename__ = "exercise_options"

    id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)

    text = Column(Text, nullable=False)

    # for multi-select
    is_correct = Column(Boolean, nullable=True)

    # for matching
    side = Column(String(10), nullable=True)       # "left" or "right"
    match_key = Column(String(50), nullable=True)  # same key = matching pair

    exercise = relationship("Exercise", back_populates="options")


class UserLessonResult(Base):
    """
    Aggregate result per user per lesson.
    (We don’t fully use it yet, but it’s ready.)
    """

    __tablename__ = "user_lesson_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)

    correct = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    stars = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="lesson_results")
    lesson = relationship("Lesson", back_populates="results")
