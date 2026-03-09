# backend/routes_cms.py
from fastapi import APIRouter, Header, HTTPException, Depends
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from models import Lesson, Exercise

router = APIRouter()

CMS_TOKENS = {
    "c5fe8f3d5aa14af2b7ddfbd22cc72d94",
}

def verify_cms_token(x_cms_token: Optional[str] = Header(None)):
    if not x_cms_token or x_cms_token not in CMS_TOKENS:
        raise HTTPException(status_code=403, detail="Invalid CMS token")

# -------- LESSONS --------

@router.get("/lessons")
def cms_list_lessons(
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    return db.query(Lesson).order_by(Lesson.level, Lesson.id).all()

@router.post("/lessons")
def cms_create_lesson(
    payload: dict,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    lesson = Lesson(**payload)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson

@router.put("/lessons/{lesson_id}")
def cms_update_lesson(
    lesson_id: int,
    payload: dict,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    for k, v in payload.items():
        setattr(lesson, k, v)

    db.commit()
    return lesson

@router.delete("/lessons/{lesson_id}")
def cms_delete_lesson(
    lesson_id: int,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    db.delete(lesson)
    db.commit()
    return {"ok": True}

# -------- EXERCISES --------

@router.get("/lessons/{lesson_id}/exercises")
def cms_list_exercises(
    lesson_id: int,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    return (
        db.query(Exercise)
        .filter(Exercise.lesson_id == lesson_id)
        .order_by(Exercise.order)
        .all()
    )

@router.post("/exercises")
def cms_create_exercise(
    payload: dict,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    exercise = Exercise(**payload)
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise

@router.put("/exercises/{exercise_id}")
def cms_update_exercise(
    exercise_id: int,
    payload: dict,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    exercise = db.query(Exercise).get(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    for k, v in payload.items():
        setattr(exercise, k, v)

    db.commit()
    return exercise

@router.delete("/exercises/{exercise_id}")
def cms_delete_exercise(
    exercise_id: int,
    _: None = Depends(verify_cms_token),
    db: Session = Depends(get_db),
):
    exercise = db.query(Exercise).get(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    db.delete(exercise)
    db.commit()
    return {"ok": True}
