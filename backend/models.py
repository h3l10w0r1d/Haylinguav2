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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # profile: 1–1
    profile = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # progress: 1–many
    lesson_progress = relationship(
        "LessonProgress",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

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

    progress = relationship(
        "LessonProgress",
        back_populates="lesson",
        cascade="all, delete-orphan",
    )


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # legacy + new: we keep both `type` and `kind` so old rows don't break
    type = Column(String, nullable=True)

    # unified "kind" – e.g. "char_intro", "char_mcq_sound", "char_build_word"
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
    # Examples:
    #  - char_mcq_sound:
    #      { "letter": "Ա", "options": ["a","o","e","u"], "correctIndex": 0 }
    #  - char_build_word:
    #      { "targetWord": "Արա", "tiles": ["Ա","Ր","Ա","Ն","Կ"] }
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
    side = Column(String)       # for matching / pairing
    match_key = Column(String)  # for matching / pairing

    exercise = relationship("Exercise", back_populates="options")


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    # IMPORTANT: no explicit name= on UniqueConstraint, to avoid your error
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # XP earned for that lesson completion (from lesson.xp at the time)
    xp_earned = Column(Integer, nullable=False, default=0)

    # when the user clicked "Done"
    completed_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="lesson_progress")
    lesson = relationship("Lesson", back_populates="progress")
