# backend/auth.py
from passlib.context import CryptContext
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


def create_token() -> str:
    """
    Simple opaque token – frontend stores this and sends it back as Authorization.
    We don't decode it, just look it up in the DB.
    """
    return secrets.token_urlsafe(32)
