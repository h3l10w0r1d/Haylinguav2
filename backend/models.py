from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)



class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)   # e.g. "lesson-1-greetings"
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    level = Column(Integer, nullable=False)
    xp = Column(Integer, nullable=False, default=50)

    exercises = relationship("Exercise", back_populates="lesson", cascade="all, delete-orphan")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    # "type-answer" | "fill-blank" | "matching" | "multi-select"
    type = Column(String, nullable=False)

    prompt = Column(Text, nullable=False)

    # For type-answer / fill-blank
    expected_answer = Column(String, nullable=True)
    case_sensitive = Column(Boolean, default=False)

    # For fill-blank
    sentence_before = Column(Text, nullable=True)
    sentence_after = Column(Text, nullable=True)

    # For matching (we’ll keep details in options + keys)
    extra_json = Column(Text, nullable=True)  # optional JSON for advanced stuff

    lesson = relationship("Lesson", back_populates="exercises")
    options = relationship("ExerciseOption", back_populates="exercise", cascade="all, delete-orphan")


class ExerciseOption(Base):
    __tablename__ = "exercise_options"

    id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    text = Column(Text, nullable=False)

    # For multi-select: which options are correct
    is_correct = Column(Boolean, default=False)

    # For matching:
    #   side: "left" or "right"
    #   match_key: some shared string like "hello", used to pair left/right
    side = Column(String, nullable=True)       # "left" | "right" | null
    match_key = Column(String, nullable=True)  # e.g. "pair1"

    exercise = relationship("Exercise", back_populates="options")


class UserLessonResult(Base):
    __tablename__ = "user_lesson_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    correct = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    stars = Column(Integer, nullable=False)

    # you can add created_at later if you want timestamps
