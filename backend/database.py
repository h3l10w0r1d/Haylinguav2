# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine import Connection

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./haylingua.db")

# Handle sqlite vs postgres automatically
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    future=True,
    echo=False,
    connect_args=connect_args,
)

Base = declarative_base()


def get_db():
    """
    Dependency that yields a SQLAlchemy Connection inside a transaction.
    We use raw SQL on this connection.
    """
    with engine.begin() as conn:  # implicit commit / rollback
        yield conn  # type: Connection
