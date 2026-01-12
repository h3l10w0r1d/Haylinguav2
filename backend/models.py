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
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    # no created_at on purpose – avoids the old error


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

    # Unified kind instead of the old "type"
    # Examples: "char_intro", "char_mcq_sound", "char_build_word",
    #           "char_listen_build", "char_find_in_grid", "char_type_translit"
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

    # Flexible per-exercise data, stored as JSON.
    # For example, for char_mcq_sound:
    # {
    #   "letter": "Ա",
    #   "options": ["a", "o", "e", "u"],
    #   "correctIndex": 0,
    #   "showTransliteration": true
    # }
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
    side = Column(String)
    match_key = Column(String)

    exercise = relationship("Exercise", back_populates="options")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    # 1-to-1 with User
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    avatar_url = Column(String)

    user = relationship("User", backref="profile_rel", uselist=False)


class UserExerciseLog(Base):
    __tablename__ = "user_exercise_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    completed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    xp_earned = Column(Integer, nullable=False, default=0)
    correct = Column(Boolean, nullable=False, default=True)

    user = relationship("User", backref="exercise_logs")
    lesson = relationship("Lesson")
    exercise = relationship("Exercise")
