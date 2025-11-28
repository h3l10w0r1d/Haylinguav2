from passlib.context import CryptContext
from jose import jwt
import os

# Use pbkdf2_sha256 instead of bcrypt
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)

SECRET_KEY = os.getenv("SECRET_KEY", "supersecret")  # set a real one in Render
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: int) -> str:
    return jwt.encode({"user_id": user_id}, SECRET_KEY, algorithm=ALGORITHM)
