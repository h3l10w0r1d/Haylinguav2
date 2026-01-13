# backend/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    JSON,
    Date,
    DateTime,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Profile fields
    first_name = Column(Text, nullable=True)
    last_name = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)

    # Stats
    total_xp = Column(Integer, nullable=False, default=0)
    current_streak = Column(Integer, nullable=False, default=0)
    longest_streak = Column(Integer, nullable=False, default=0)
    last_active = Column(Date, nullable=True)

    # relationships (optional, not required by raw SQL code)
    lesson_progress = relationship(
        "UserLessonProgress",
        back_populates="user",
        cascade="all, delete-orphan",
    )


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

    lesson_progress = relationship(
        "UserLessonProgress",
        back_populates="lesson",
        cascade="all, delete-orphan",
    )


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # Legacy column (used in raw SQL seed); keep simple string
    type = Column(String, nullable=True)

    # Unified kind for frontend logic, e.g. "char_intro", "char_mcq_sound", etc.
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
    side = Column(String)        # for match-type
    match_key = Column(String)   # for match-type

    exercise = relationship("Exercise", back_populates="options")


class UserLessonProgress(Base):
    """
    Tracks user progress and XP per lesson.
    The backend currently uses raw-SQL for this table, but we
    define it in ORM so Base.metadata.create_all can create it
    on a fresh DB if needed.
    """
    __tablename__ = "user_lesson_progress"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    last_exercise_index = Column(Integer, nullable=False, default=0)
    xp_earned = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="lesson_progress")
    lesson = relationship("Lesson", back_populates="lesson_progress")
