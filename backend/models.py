from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    # IMPORTANT: no created_at here, to avoid the "users.created_at does not exist" error


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


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # e.g. "type-answer", "fill-blank", "multi-select", "match-pairs"
    type = Column(String, nullable=False)

    prompt = Column(Text, nullable=False)

    # for type-answer / fill-blank
    expected_answer = Column(Text)
    sentence_before = Column(Text)
    sentence_after = Column(Text)

    # order inside the lesson
    order = Column(Integer, nullable=False, default=1)

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

    # text on the card / button
    text = Column(Text, nullable=False)

    # for multi-select (correct answers)
    is_correct = Column(Boolean, default=None)

    # for match-pairs: "left" or "right"
    side = Column(String)

    # for match-pairs: same match_key = belongs together
    match_key = Column(String)

    exercise = relationship("Exercise", back_populates="options")


class UserLessonProgress(Base):
    __tablename__ = "user_lesson_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # total XP earned for this lesson (capped by lesson.xp)
    xp_earned = Column(Integer, nullable=False, default=0)

    # mark if lesson is considered "completed"
    completed = Column(Boolean, nullable=False, default=False)

    # you can store latest score %, stars, etc later if you want
    # score_percent = Column(Integer)

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_progress"),
    )

    user = relationship("User")
    lesson = relationship("Lesson")
