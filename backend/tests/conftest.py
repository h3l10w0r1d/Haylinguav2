# backend/tests/conftest.py — shared fixtures for the backend pytest suite.
#
# Boots the REAL FastAPI app (backend/main.py) against a real, disposable
# Postgres database and drives it over real HTTP via FastAPI's TestClient —
# not unit-testing internal functions in isolation. This is the same
# database + app-boot combination used in CI (see .github/workflows/ci.yml,
# which provides a Postgres service container) and can be pointed at a local
# scratch Postgres for development:
#
#   createdb haylingua_test
#   DATABASE_URL=postgresql://localhost/haylingua_test pytest backend/tests
import os
import sys
import uuid

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_TESTS_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# These must be set BEFORE importing any backend module: auth.py reads
# JWT_SECRET_KEY at import time, and main.py fails fast on startup if
# EMAIL_CODE_PEPPER is unset/default (see backend/main.py's security check).
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/haylingua_test")
os.environ.setdefault("EMAIL_CODE_PEPPER", "test-only-pepper-not-a-real-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-jwt-secret-not-a-real-secret")
os.environ.setdefault("CRON_SECRET", "test-only-cron-secret")

import pytest
from sqlalchemy import text, create_engine
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def db_engine():
    """Bootstrap the full schema once per test session: base ORM tables via
    models.py, then every incremental migration in ensure_schema() — the
    exact same two-step bootstrap used to verify the CAST() fix by hand."""
    from database import Base, engine
    import models  # noqa: F401 — registers ORM tables on Base.metadata
    from ensure_schema import ensure_schema

    Base.metadata.create_all(engine)
    ensure_schema()
    return engine


@pytest.fixture(scope="session")
def app(db_engine):
    from main import app as fastapi_app
    return fastapi_app


@pytest.fixture(scope="session")
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db_conn(db_engine):
    with db_engine.begin() as conn:
        yield conn


@pytest.fixture()
def make_user(db_conn):
    """Factory fixture: make_user(gems=0) -> (user_id, auth_headers).
    Inserts a verified user directly (bypassing signup/email-verification)
    and mints a real JWT via the app's own create_token(), so tests hit
    protected endpoints exactly as a real logged-in client would."""
    from auth import create_token, hash_password

    created_ids = []

    def _make(email=None, gems=0, password="testpass123"):
        email = email or f"pytest-{uuid.uuid4().hex[:12]}@example.test"
        row = db_conn.execute(
            text(
                """
                INSERT INTO users (email, password_hash, username, email_verified, gems, joined_at)
                VALUES (:email, :ph, :username, TRUE, :gems, NOW())
                RETURNING id
                """
            ),
            {
                "email": email,
                "ph": hash_password(password),
                "username": email.split("@")[0][:15],
                "gems": gems,
            },
        ).mappings().first()
        user_id = int(row["id"])
        created_ids.append(user_id)
        token = create_token(user_id, 0)
        return user_id, {"Authorization": f"Bearer {token}"}

    yield _make

    if created_ids:
        db_conn.execute(text("DELETE FROM users WHERE id = ANY(:ids)"), {"ids": created_ids})
