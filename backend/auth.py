# backend/auth.py
import os
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
import jwt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-env")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def _truncate_if_needed(password: str) -> str:
    """bcrypt only supports 72 bytes – truncate if necessary."""
    raw = password.encode("utf-8")
    if len(raw) > 72:
        raw = raw[:72]
        return raw.decode("utf-8", errors="ignore")
    return password


def hash_password(password: str) -> str:
    password = _truncate_if_needed(password)
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        plain_password = _truncate_if_needed(plain_password)
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
