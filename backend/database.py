# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine import Connection
from sqlalchemy.pool import QueuePool

DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@localhost:5432/postgres"

# Create engine with improved connection pooling
engine = create_engine(
    DATABASE_URL,
    future=True,
    poolclass=QueuePool,
    pool_size=20,              # Increased from default 5
    max_overflow=40,           # Increased from default 10
    pool_timeout=15,           # Keep at 30 seconds
    pool_recycle=3600,         # Recycle connections after 1 hour
    pool_pre_ping=True,        # Test connections before using them
    echo_pool=False,           # Set to True for debugging connection issues
)

Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI routes.
    Yields a SQLAlchemy Connection inside a transaction.
    The connection is automatically committed/rolled back when context exits.
    """
    with engine.begin() as conn:  # type: Connection
        try:
            yield conn
        except Exception as e:
            # Transaction will auto-rollback on exception
            raise e
        # Transaction auto-commits on successful exit
