# backend/ensure_schema.py
from __future__ import annotations
import os
from sqlalchemy import create_engine, text

def ensure_schema() -> None:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ensure_schema] DATABASE_URL is not set; skipping")
        return
    engine = create_engine(db_url, pool_pre_ping=True)
    with engine.begin() as conn:
        def table_exists(name):
            return bool(conn.execute(text("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:t LIMIT 1"), {"t": name}).scalar())
        def col_exists(table, col):
            return bool(conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=:t AND column_name=:c LIMIT 1"), {"t": table, "c": col}).scalar())
        def add_col_if_missing(table, ddl):
            col = ddl.strip().split()[0].strip('"')
            if not col_exists(table, col):
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {ddl}'))
                print(f"[ensure_schema] added {table}.{col}")
        def ensure_table(table, create_sql):
            if not table_exists(table):
                conn.execute(text(create_sql))
                print(f"[ensure_schema] created {table}")
        def set_default(table, col, default_sql):
            if col_exists(table, col):
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT {default_sql}'))
        def set_nullable(table, col):
            if col_exists(table, col):
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" DROP NOT NULL'))
        def fill_nulls(table, col, value_sql):
            if col_exists(table, col):
                conn.execute(text(f'UPDATE "{table}" SET "{col}" = {value_sql} WHERE "{col}" IS NULL'))

        # ---------- users (existing columns) ----------
        add_col_if_missing("users", "username TEXT")
        add_col_if_missing("users", "display_name TEXT")
        add_col_if_missing("users", "first_name TEXT")
        add_col_if_missing("users", "last_name TEXT")
        add_col_if_missing("users", "bio TEXT")
        add_col_if_missing("users", "profile_theme JSONB NOT NULL DEFAULT '{}'::jsonb")
        add_col_if_missing("users", "friends_public BOOLEAN NOT NULL DEFAULT TRUE")
        add_col_if_missing("users", "avatar_url TEXT")
        add_col_if_missing("users", "banner_url TEXT")
        add_col_if_missing("users", "is_hidden BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
        add_col_if_missing("users", "country TEXT")
        add_col_if_missing("users", "timezone TEXT")
        add_col_if_missing("users", "last_active_at TIMESTAMPTZ")
        add_col_if_missing("users", "totp_enabled BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "totp_secret TEXT")
        add_col_if_missing("users", "totp_confirmed_at TIMESTAMPTZ")
        add_col_if_missing("users", "recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb")
        add_col_if_missing("users", "hearts_current INTEGER")
        add_col_if_missing("users", "hearts_max INTEGER")
        set_default("users", "totp_enabled", "FALSE")
        set_default("users", "recovery_codes", "'[]'::jsonb")
        fill_nulls("users", "totp_enabled", "FALSE")
        fill_nulls("users", "recovery_codes", "'[]'::jsonb")

        # ---------- HeartSystem ----------
        add_col_if_missing("users", "last_heart_lost_at TIMESTAMPTZ")

        # ---------- StreakManager ----------
        add_col_if_missing("users", "current_streak INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "streak_last_activity_date DATE")
        fill_nulls("users", "current_streak", "0")

        # ---------- Account management audit columns ----------
        # These are referenced by UPDATE statements in routes.py (2FA setup/disable,
        # password change, email change).  Adding them as nullable with no default so
        # existing rows stay valid and new writes succeed immediately.
        add_col_if_missing("users", "updated_at TIMESTAMPTZ")
        add_col_if_missing("users", "pending_email TEXT")
        add_col_if_missing("users", "pending_email_code_hash TEXT")
        add_col_if_missing("users", "pending_email_expires_at TIMESTAMPTZ")
        add_col_if_missing("users", "email_verified BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "email_verified_at TIMESTAMPTZ")
        add_col_if_missing("users", "totp_recovery_hashes JSONB NOT NULL DEFAULT '[]'::jsonb")
        fill_nulls("users", "email_verified", "FALSE")
        fill_nulls("users", "totp_recovery_hashes", "'[]'::jsonb")

    print("[ensure_schema] done")
