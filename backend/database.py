# backend/database.py
import os
from sqlalchemy import create_engine, event
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


@event.listens_for(engine, "connect")
def _force_utc_session(dbapi_connection, connection_record):
    """Every SQL date/time function (NOW(), CURRENT_DATE, etc.) and every
    TIMESTAMPTZ value read back must agree with the app's own UTC-based
    Python logic (datetime.utcnow() throughout routes.py). Without this, a
    Postgres server whose default session timezone isn't UTC computes
    CURRENT_DATE up to a day off from the real UTC date near midnight in
    that timezone, and TIMESTAMPTZ values round-trip through a non-UTC
    offset — silent, environment-dependent bugs that only show up when the
    server's timezone happens to differ from UTC."""
    with dbapi_connection.cursor() as cursor:
        cursor.execute("SET TIME ZONE 'UTC'")
    # psycopg2 opens an implicit transaction on the first statement; without
    # committing here, a later rollback (e.g. SQLAlchemy's pool "reset on
    # return", or an app-level exception) undoes this SET and the physical
    # connection silently reverts to the server's default session timezone
    # for the rest of its pooled lifetime.
    dbapi_connection.commit()

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
