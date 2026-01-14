# backend/auth.py
import os
from datetime import datetime, timedelta

from jose import jwt  # from python-jose
from passlib.context import CryptContext

# bcrypt via passlib
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-dev-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    """
    Hash a plain password using bcrypt.
    Make sure the password is <= 72 bytes BEFORE hashing (we enforce that in Pydantic).
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify that a plain password matches a stored bcrypt hash.
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_token(user_id: int) -> str:
    """
    Create a signed JWT token containing the user id in the 'sub' (subject) claim.
    Frontend receives this and stores it; we don't strictly *need* it for XP right now,
    but it keeps the login flow consistent.
    """
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
