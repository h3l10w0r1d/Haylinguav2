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


def create_token(user_id: int) -> str:
    """
    For now we just return a random opaque token.

    Frontend can store it and send it back later if/when we add
    real auth; the backend isn't validating it yet anyway.
    """
    return secrets.token_urlsafe(32)
