#backend/routes_cms.py
from fastapi import APIRouter, Header, HTTPException
from typing import Optional

router = APIRouter()

CMS_TOKENS = {
    "c5fe8f3d5aa14af2b7ddfbd22cc72d94",
    # add others if needed
}

def verify_cms_token(x_cms_token: Optional[str]):
    if not x_cms_token or x_cms_token not in CMS_TOKENS:
        raise HTTPException(status_code=403, detail="Invalid CMS token")

@router.get("/lessons")
def cms_list_lessons(x_cms_token: Optional[str] = Header(None)):
    verify_cms_token(x_cms_token)
    # TEMP: replace with DB query
    return []

@router.get("/lessons/{lesson_id}/exercises")
def cms_list_exercises(
    lesson_id: int,
    x_cms_token: Optional[str] = Header(None),
):
    verify_cms_token(x_cms_token)
    return []
