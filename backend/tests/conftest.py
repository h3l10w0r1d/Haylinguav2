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
# The whole suite hits the app through one synthetic TestClient IP sharing a
# single in-memory rate-limit bucket — unrelated tests trip each other's
# limits once the suite grows past a few dozen requests (see
# middleware/rate_limit.py's DISABLE_RATE_LIMIT check). No test currently
# exercises rate-limiting behavior itself, so disabling it here costs no
# coverage; add a dedicated test against the middleware directly (bypassing
# this fixture) if that ever changes.
os.environ.setdefault("DISABLE_RATE_LIMIT", "true")

import pytest
from sqlalchemy import text, create_engine
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def db_engine():
    """Bootstrap the full schema once per test session: base ORM tables via
    models.py, then every incremental migration in ensure_schema() — the
    exact same two-step bootstrap used to verify the CAST() fix by hand.

    ensure_schema() assumes a few legacy tables (predating its own
    ensure_table() coverage, or never covered by it at all — e.g.
    user_exercise_attempts) already exist in production. A truly fresh
    database needs them created first or ensure_schema()/the app aborts
    with "relation does not exist"."""
    from database import Base, engine
    import models  # noqa: F401 — registers ORM tables on Base.metadata
    from ensure_schema import ensure_schema

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS cms_users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    role TEXT,
                    status TEXT,
                    password_hash TEXT,
                    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    totp_secret TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_login_at TIMESTAMPTZ
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS user_exercise_attempts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    lesson_id INTEGER NOT NULL,
                    exercise_id INTEGER NOT NULL,
                    attempt_no INTEGER NOT NULL DEFAULT 1,
                    is_correct BOOLEAN NOT NULL,
                    answer_text TEXT,
                    selected_indices JSONB,
                    time_ms INTEGER,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
    ensure_schema()

    # Several tests assume at least one lesson exists without creating their
    # own (e.g. "SELECT id FROM lessons LIMIT 1"). That was always true
    # against the old shared local scratch DB (years of leftover rows) but
    # not against a genuinely fresh database — nothing seeds the lessons
    # table by default (SEED_ON_STARTUP is off in tests). Guarantee the
    # invariant once here rather than patching every test that assumes it.
    with engine.begin() as conn:
        if not conn.execute(text("SELECT 1 FROM lessons LIMIT 1")).scalar():
            conn.execute(
                text(
                    """
                    INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config)
                    VALUES ('pytest-baseline-lesson', 'Baseline lesson', '', 1, 10, 10, TRUE, 'standard', CAST('{}' AS jsonb))
                    """
                )
            )
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
    """Autocommit connection — each statement is immediately visible to the
    SEPARATE connection FastAPI opens per request (via Depends(get_db)).
    A single held-open transaction here would hide inserts (e.g. make_user's)
    from the real request until this fixture's transaction eventually
    committed at teardown, well after the test's assertions already ran."""
    with db_engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
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
