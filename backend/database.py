# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine import Connection

DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@localhost:5432/postgres"

engine = create_engine(DATABASE_URL, future=True)

Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI routes.
    Yields a SQLAlchemy Connection inside a transaction.
    """
    with engine.begin() as conn:  # type: Connection
        yield conn
