from datetime import datetime
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from jose import jwt, JWTError
import os


router = APIRouter()


# --- JWT helpers (copy-compatible with your routes.py style) ---
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or ""
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM") or "HS256"


def _get_user_id_from_bearer(authorization: Optional[str]) -> Optional[int]:
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")

    if not JWT_SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Token missing 'sub'")
        return int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Could not validate credentials")


# --- Response schemas ---
class ExerciseAnalyticsOut(BaseModel):
    exercise_id: int
    order: int
    kind: Optional[str] = None
    prompt: str
    xp: int

    attempts: int
    correct: int
    wrong: int
    accuracy: float
    completed: bool
    last_attempt_at: Optional[datetime] = None


class LessonAnalyticsOut(BaseModel):
    lesson_id: int
    lesson_title: str
    lesson_slug: str

    lesson_total_xp: int
    earned_xp: int

    total_exercises: int
    completed_exercises: int
    completion_ratio: float
    completed: bool

    stars: int  # 1..3
    exercises: list[ExerciseAnalyticsOut]


def _stars_from_ratio(r: float) -> int:
    # tweak however you want
    # - 70% completed -> pass lesson (green)
    # - stars: 1 = >= 0.70, 2 = >= 0.85, 3 = 1.0
    if r >= 1.0:
        return 3
    if r >= 0.85:
        return 2
    if r >= 0.70:
        return 1
    return 0


@router.get("/me/lessons/{lesson_id}/analytics", response_model=LessonAnalyticsOut)
def lesson_analytics(
    lesson_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # 1) Load lesson
    lesson = db.execute(
        text("""
            SELECT id, title, slug
            FROM lessons
            WHERE id = :lid
        """),
        {"lid": lesson_id},
    ).mappings().first()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # 2) Exercises + per-exercise attempt stats
    rows = db.execute(
        text("""
            WITH ex AS (
                SELECT
                    e.id AS exercise_id,
                    COALESCE(e."order", 0)::int AS ord,
                    e.kind,
                    COALESCE(e.prompt, '') AS prompt,
                    COALESCE(e.xp, 0)::int AS xp
                FROM exercises e
                WHERE e.lesson_id = :lid
            ),
            st AS (
                SELECT
                    uea.exercise_id,
                    COUNT(*)::int AS attempts,
                    SUM(CASE WHEN uea.is_correct THEN 1 ELSE 0 END)::int AS correct,
                    SUM(CASE WHEN uea.is_correct THEN 0 ELSE 1 END)::int AS wrong,
                    MAX(uea.created_at) AS last_attempt_at,
                    MAX(CASE WHEN uea.is_correct THEN 1 ELSE 0 END)::int AS has_correct
                FROM user_exercise_attempts uea
                WHERE uea.user_id = :uid
                  AND uea.lesson_id = :lid
                GROUP BY uea.exercise_id
            )
            SELECT
                ex.exercise_id,
                ex.ord,
                ex.kind,
                ex.prompt,
                ex.xp,

                COALESCE(st.attempts, 0)::int AS attempts,
                COALESCE(st.correct, 0)::int AS correct,
                COALESCE(st.wrong, 0)::int AS wrong,
                st.last_attempt_at,
                COALESCE(st.has_correct, 0)::int AS has_correct
            FROM ex
            LEFT JOIN st ON st.exercise_id = ex.exercise_id
            ORDER BY ex.ord ASC, ex.exercise_id ASC
        """),
        {"uid": user_id, "lid": lesson_id},
    ).mappings().all()

    total_exercises = len(rows)
    lesson_total_xp = sum(int(r["xp"] or 0) for r in rows)

    exercises: list[ExerciseAnalyticsOut] = []
    completed_exercises = 0
    earned_xp = 0

    for r in rows:
        attempts = int(r["attempts"] or 0)
        correct = int(r["correct"] or 0)
        wrong = int(r["wrong"] or 0)
        xp = int(r["xp"] or 0)
        has_correct = int(r["has_correct"] or 0) == 1

        if has_correct:
            completed_exercises += 1
            earned_xp += xp

        acc = 0.0
        if attempts > 0:
            acc = round((correct / attempts) * 100.0, 2)

        exercises.append(
            ExerciseAnalyticsOut(
                exercise_id=int(r["exercise_id"]),
                order=int(r["ord"]),
                kind=r["kind"],
                prompt=r["prompt"],
                xp=xp,
                attempts=attempts,
                correct=correct,
                wrong=wrong,
                accuracy=acc,
                completed=bool(has_correct),
                last_attempt_at=r["last_attempt_at"],
            )
        )

    if total_exercises <= 0:
        # lesson exists but no exercises
        completion_ratio = 0.0
    else:
        completion_ratio = completed_exercises / total_exercises

    completed = completion_ratio >= 0.70
    stars = _stars_from_ratio(completion_ratio)

    return LessonAnalyticsOut(
        lesson_id=int(lesson["id"]),
        lesson_title=lesson["title"] or "",
        lesson_slug=lesson["slug"] or "",

        lesson_total_xp=int(lesson_total_xp),
        earned_xp=int(earned_xp),

        total_exercises=int(total_exercises),
        completed_exercises=int(completed_exercises),
        completion_ratio=float(round(completion_ratio, 4)),
        completed=bool(completed),

        stars=int(stars),
        exercises=exercises,
    )


@router.post("/me/lessons/{lesson_id}/reset")
def lesson_reset(
    lesson_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """
    Optional helper for your "Retry" button.
    This resets ONLY this lesson’s attempts/logs/progress for this user.
    """
    user_id = _get_user_id_from_bearer(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # delete attempts/logs for that lesson
    db.execute(
        text("DELETE FROM user_exercise_attempts WHERE user_id = :u AND lesson_id = :l"),
        {"u": user_id, "l": lesson_id},
    )
    db.execute(
        text("DELETE FROM user_exercise_logs WHERE user_id = :u AND lesson_id = :l"),
        {"u": user_id, "l": lesson_id},
    )

    # reset the progress row if you store it
    db.execute(
        text("""
            UPDATE user_lesson_progress
            SET
              total_attempts = 0,
              correct_attempts = 0,
              accuracy = 0,
              exercises_total = 0,
              exercises_completed = 0,
              xp_earned = 0,
              completed_at = NULL,
              review_queue = '[]'::jsonb
            WHERE user_id = :u AND lesson_id = :l
        """),
        {"u": user_id, "l": lesson_id},
    )

    return {"ok": True}
