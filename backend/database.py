# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine import Connection
from sqlalchemy.pool import QueuePool

DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@localhost:5432/postgres" # Envoirnmenal variable retrieval, Done for security purpouses, and github phishing defence.

# Create engine with improved connection pooling
engine = create_engine(
    DATABASE_URL,
    future=True,
    poolclass=QueuePool,
    pool_size=20,              # 
    max_overflow=40,           # 
    pool_timeout=15,           # 
    pool_recycle=3600,         # 
    pool_pre_ping=True,        # 
    echo_pool=False,           # 
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
