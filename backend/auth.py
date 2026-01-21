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




# ----------------------------
# Email and pasword validation functions
# ----------------------------

def validate_email_simple(email: str):
    errors = []

    if email is None:
        errors.append("Email is required")
        return errors

    email = email.strip()

    if email == "":
        errors.append("Email is required")
        return errors

    # No spaces
    for ch in email:
        if ch == " ":
            errors.append("Email must not contain spaces")
            break

    # Exactly one @
    at_count = 0
    for ch in email:
        if ch == "@":
            at_count += 1

    if at_count != 1:
        errors.append("Email must contain exactly one '@'")
        return errors

    parts = email.split("@")
    local = parts[0]
    domain = parts[1]

    if local == "" or domain == "":
        errors.append("Email must have text before and after '@'")
        return errors

    # Domain must contain a dot (.)
    dot_found = False
    for ch in domain:
        if ch == ".":
            dot_found = True
            break

    if not dot_found:
        errors.append("Email domain must contain a '.' (example: gmail.com)")
        return errors

    # Very simple domain end check: last part length >= 2
    domain_parts = domain.split(".")
    tld = domain_parts[-1]
    if len(tld) < 2:
        errors.append("Email domain ending is not valid (example: .com)")
        return errors

    return errors


def validate_password_simple(password: str):
    errors = []

    if password is None:
        errors.append("Password is required")
        return errors

    if len(password) < 8:
        errors.append("Password must be at least 8 characters")

    # No spaces
    for ch in password:
        if ch == " ":
            errors.append("Password must not contain spaces")
            break

    has_upper = False
    has_lower = False
    has_digit = False

    for ch in password:
        # uppercase
        if "A" <= ch <= "Z":
            has_upper = True
        # lowercase
        elif "a" <= ch <= "z":
            has_lower = True
        # digit
        elif "0" <= ch <= "9":
            has_digit = True

    if not has_upper:
        errors.append("Password must contain at least 1 uppercase letter (A-Z)")
    if not has_lower:
        errors.append("Password must contain at least 1 lowercase letter (a-z)")
    if not has_digit:
        errors.append("Password must contain at least 1 number (0-9)")

    return errors
