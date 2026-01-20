# backend/auth.py
import os
from datetime import datetime, timedelta
from typing import Dict, Any

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext

from sqlalchemy import text
from sqlalchemy.engine import Connection
from database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ✅ Single source of truth for JWT config
JWT_SECRET_KEY = (os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or "").strip()
JWT_ALGORITHM = (os.getenv("JWT_ALGORITHM") or "HS256").strip()
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "43200")  # 30 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_token(user_id: int) -> str:
    if not JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY (or SECRET_KEY) is not set")

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    if not JWT_SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not configured on server")

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Connection = Depends(get_db),
) -> Dict[str, Any]:
    payload = decode_token(token)
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    try:
        user_id = int(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    user = db.execute(
        text("SELECT id, email FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().first()

    if user is None:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    return dict(user)
