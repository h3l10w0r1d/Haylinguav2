# backend/ensure_schema.py

from __future__ import annotations

import os
from sqlalchemy import create_engine, text


def ensure_schema() -> None:
    """
    Patches the Postgres schema in-place so the running code doesn't crash when
    older DBs are missing new columns.

    Safe to run on every startup (idempotent).
    """

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ensure_schema] DATABASE_URL is not set; skipping ❌")
        return

    engine = create_engine(db_url, pool_pre_ping=True)

    with engine.begin() as conn:
        # ---------- helpers ----------
        def table_exists(name: str) -> bool:
            return bool(
                conn.execute(
                    text(
                        """
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema='public' AND table_name=:t
                        LIMIT 1
                        """
                    ),
                    {"t": name},
                ).scalar()
            )

        def col_exists(table: str, col: str) -> bool:
            return bool(
                conn.execute(
                    text(
                        """
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema='public'
                          AND table_name=:t
                          AND column_name=:c
                        LIMIT 1
                        """
                    ),
                    {"t": table, "c": col},
                ).scalar()
            )

        def add_col_if_missing(table: str, ddl: str) -> None:
            # ddl must be like: "lesson_id integer"
            col = ddl.strip().split()[0].strip('"')
            if not col_exists(table, col):
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {ddl}'))
                print(f"[ensure_schema] added {table}.{col} ✅")

        def ensure_table(table: str, create_sql: str) -> None:
            if not table_exists(table):
                conn.execute(text(create_sql))
                print(f"[ensure_schema] created {table} ✅")

        def set_default(table: str, col: str, default_sql: str) -> None:
            if col_exists(table, col):
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT {default_sql}'))

        def set_nullable(table: str, col: str) -> None:
            if col_exists(table, col):
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" DROP NOT NULL'))

        def fill_nulls(table: str, col: str, value_sql: str) -> None:
            if col_exists(table, col):
                conn.execute(text(f'UPDATE "{table}" SET "{col}" = {value_sql} WHERE "{col}" IS NULL'))

        def ensure_unique_progress_constraint() -> None:
            # Needed for: ON CONFLICT (user_id, lesson_id)
            # Create a unique index if it doesn't exist.
            conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1
                        FROM pg_indexes
                        WHERE schemaname='public'
                          AND tablename='user_lesson_progress'
                          AND indexname='ux_user_lesson_progress_user_lesson'
                      ) THEN
                        CREATE UNIQUE INDEX ux_user_lesson_progress_user_lesson
                          ON user_lesson_progress (user_id, lesson_id);
                      END IF;
                    END$$;
                    """
                )
            )

        
        # ---------- cms_users / cms_invites ----------
        ensure_table(
            "cms_users",
            """
            CREATE TABLE cms_users (
              id             SERIAL PRIMARY KEY,
              email          TEXT UNIQUE NOT NULL,
              name           TEXT,
              role           TEXT NOT NULL DEFAULT 'admin',
              status         TEXT NOT NULL DEFAULT 'invited',
              password_hash  TEXT,
              totp_secret    TEXT,
              totp_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
              created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              last_login_at  TIMESTAMPTZ
            );
            """
        )

        ensure_table(
            "cms_invites",
            """
            CREATE TABLE cms_invites (
              id            SERIAL PRIMARY KEY,
              email         TEXT NOT NULL,
              role          TEXT NOT NULL DEFAULT 'admin',
              token_hash    TEXT UNIQUE NOT NULL,
              invited_by    INTEGER,
              expires_at    TIMESTAMPTZ NOT NULL,
              accepted_at   TIMESTAMPTZ,
              created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        # Index for lookup by email
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname='public'
                      AND tablename='cms_invites'
                      AND indexname='ix_cms_invites_email'
                  ) THEN
                    CREATE INDEX ix_cms_invites_email ON cms_invites (email);
                  END IF;
                END$$;
                """
            )
        )


        # ---------- cms bootstrap invite (optional) ----------
        bootstrap_email = (os.getenv("CMS_BOOTSTRAP_EMAIL") or "").strip().lower()
        invite_base = (os.getenv("CMS_INVITE_BASE_URL") or "https://cms.haylingua.am").rstrip("/")
        ttl_hours = int(os.getenv("CMS_INVITE_TTL_HOURS") or "72")

        if bootstrap_email:
            # Create a bootstrap invite only if CMS has no users yet
            has_any = conn.execute(text("SELECT 1 FROM cms_users LIMIT 1")).first()
            if not has_any:
                # ensure a non-expired invite exists
                existing = conn.execute(
                    text(
                        """
                        SELECT 1 FROM cms_invites
                        WHERE lower(email)=:e AND accepted_at IS NULL AND expires_at > NOW()
                        LIMIT 1
                        """
                    ),
                    {"e": bootstrap_email},
                ).first()
                if not existing:
                    import secrets as _secrets
                    import hashlib as _hashlib
                    from datetime import datetime as _dt, timedelta as _td

                    raw = _secrets.token_urlsafe(32)
                    token_hash = _hashlib.sha256(raw.encode("utf-8")).hexdigest()
                    expires_at = _dt.utcnow() + _td(hours=ttl_hours)

                    conn.execute(
                        text(
                            """
                            INSERT INTO cms_invites (email, role, token_hash, invited_by, expires_at)
                            VALUES (:email, 'admin', :h, NULL, :exp)
                            """
                        ),
                        {"email": bootstrap_email, "h": token_hash, "exp": expires_at},
                    )
                    print(f"[cms_bootstrap] Invite created for {bootstrap_email}: {invite_base}/cms/invite?token={raw}")

# ---------- user_exercise_logs ----------
        ensure_table(
            "user_exercise_logs",
            """
            CREATE TABLE user_exercise_logs (
              id            SERIAL PRIMARY KEY,
              user_id       INTEGER NOT NULL,
              lesson_id     INTEGER NOT NULL,
              exercise_id   INTEGER NOT NULL,
              created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              xp_earned     INTEGER NOT NULL DEFAULT 0,
              correct       BOOLEAN NOT NULL DEFAULT FALSE,
              event_type    TEXT NOT NULL DEFAULT 'unknown',
              meta          JSONB NOT NULL DEFAULT '{}'::jsonb
            );
            """,
        )

        # Patch missing cols (older DBs)
        add_col_if_missing("user_exercise_logs", "lesson_id integer")
        add_col_if_missing("user_exercise_logs", "exercise_id integer")
        add_col_if_missing("user_exercise_logs", "created_at timestamptz NOT NULL DEFAULT NOW()")
        add_col_if_missing("user_exercise_logs", "xp_earned integer NOT NULL DEFAULT 0")
        add_col_if_missing("user_exercise_logs", "correct boolean NOT NULL DEFAULT FALSE")
        add_col_if_missing("user_exercise_logs", "event_type text NOT NULL DEFAULT 'unknown'")
        add_col_if_missing("user_exercise_logs", "meta jsonb NOT NULL DEFAULT '{}'::jsonb")

        # Make sure inserts that don't send xp/correct/meta won't crash
        set_default("user_exercise_logs", "xp_earned", "0")
        set_default("user_exercise_logs", "correct", "FALSE")
        set_default("user_exercise_logs", "event_type", "'unknown'")
        set_default("user_exercise_logs", "meta", "'{}'::jsonb")
        fill_nulls("user_exercise_logs", "xp_earned", "0")
        fill_nulls("user_exercise_logs", "correct", "FALSE")
        fill_nulls("user_exercise_logs", "event_type", "'unknown'")
        fill_nulls("user_exercise_logs", "meta", "'{}'::jsonb")

        # ---------- user_exercise_attempts ----------
        ensure_table(
            "user_exercise_attempts",
            """
            CREATE TABLE user_exercise_attempts (
              id               SERIAL PRIMARY KEY,
              user_id          INTEGER NOT NULL,
              lesson_id        INTEGER NOT NULL,
              exercise_id      INTEGER NOT NULL,
              attempt_no       INTEGER NOT NULL DEFAULT 1,
              is_correct       BOOLEAN NOT NULL DEFAULT FALSE,
              answer_text      TEXT NULL,
              selected_indices JSONB NOT NULL DEFAULT '[]'::jsonb,
              time_ms          INTEGER NULL,
              created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              xp_earned        INTEGER NOT NULL DEFAULT 0
            );
            """,
        )

        add_col_if_missing("user_exercise_attempts", "lesson_id integer")
        add_col_if_missing("user_exercise_attempts", "exercise_id integer")
        add_col_if_missing("user_exercise_attempts", "attempt_no integer NOT NULL DEFAULT 1")
        add_col_if_missing("user_exercise_attempts", "is_correct boolean NOT NULL DEFAULT FALSE")
        add_col_if_missing("user_exercise_attempts", "answer_text text")
        add_col_if_missing("user_exercise_attempts", "selected_indices jsonb NOT NULL DEFAULT '[]'::jsonb")
        add_col_if_missing("user_exercise_attempts", "time_ms integer")
        add_col_if_missing("user_exercise_attempts", "created_at timestamptz NOT NULL DEFAULT NOW()")
        add_col_if_missing("user_exercise_attempts", "xp_earned integer NOT NULL DEFAULT 0")

        set_default("user_exercise_attempts", "attempt_no", "1")
        set_default("user_exercise_attempts", "is_correct", "FALSE")
        set_default("user_exercise_attempts", "selected_indices", "'[]'::jsonb")
        set_default("user_exercise_attempts", "xp_earned", "0")
        fill_nulls("user_exercise_attempts", "attempt_no", "1")
        fill_nulls("user_exercise_attempts", "is_correct", "FALSE")
        fill_nulls("user_exercise_attempts", "selected_indices", "'[]'::jsonb")
        fill_nulls("user_exercise_attempts", "xp_earned", "0")

        # If your old table had xp_earned NOT NULL without default -> crashes.
        # This ensures default exists and nulls are filled.

        # ---------- user_lesson_progress ----------
        ensure_table(
            "user_lesson_progress",
            """
            CREATE TABLE user_lesson_progress (
              id                 SERIAL PRIMARY KEY,
              user_id            INTEGER NOT NULL,
              lesson_id          INTEGER NOT NULL,

              -- lightweight tracking
              started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              last_exercise_id   INTEGER NULL,

              -- accuracy tracking
              total_attempts     INTEGER NOT NULL DEFAULT 0,
              correct_attempts   INTEGER NOT NULL DEFAULT 0,
              accuracy           NUMERIC(5,2) NOT NULL DEFAULT 0,

              -- recompute_lesson_progress fields
              exercises_total      INTEGER NOT NULL DEFAULT 0,
              exercises_completed  INTEGER NOT NULL DEFAULT 0,
              xp_earned            INTEGER NOT NULL DEFAULT 0,
              completed_at         TIMESTAMPTZ NULL
            );
            """,
        )

        # add missing cols
        add_col_if_missing("user_lesson_progress", "started_at timestamptz NOT NULL DEFAULT NOW()")
        add_col_if_missing("user_lesson_progress", "last_seen_at timestamptz NOT NULL DEFAULT NOW()")
        add_col_if_missing("user_lesson_progress", "last_exercise_id integer")
        add_col_if_missing("user_lesson_progress", "total_attempts integer NOT NULL DEFAULT 0")
        add_col_if_missing("user_lesson_progress", "correct_attempts integer NOT NULL DEFAULT 0")
        add_col_if_missing("user_lesson_progress", "accuracy numeric(5,2) NOT NULL DEFAULT 0")
        add_col_if_missing("user_lesson_progress", "exercises_total integer NOT NULL DEFAULT 0")
        add_col_if_missing("user_lesson_progress", "exercises_completed integer NOT NULL DEFAULT 0")
        add_col_if_missing("user_lesson_progress", "xp_earned integer NOT NULL DEFAULT 0")
        add_col_if_missing("user_lesson_progress", "completed_at timestamptz")

        # defaults + backfill
        set_default("user_lesson_progress", "started_at", "NOW()")
        set_default("user_lesson_progress", "last_seen_at", "NOW()")
        set_default("user_lesson_progress", "total_attempts", "0")
        set_default("user_lesson_progress", "correct_attempts", "0")
        set_default("user_lesson_progress", "accuracy", "0")
        set_default("user_lesson_progress", "exercises_total", "0")
        set_default("user_lesson_progress", "exercises_completed", "0")
        set_default("user_lesson_progress", "xp_earned", "0")

        fill_nulls("user_lesson_progress", "started_at", "NOW()")
        fill_nulls("user_lesson_progress", "last_seen_at", "NOW()")
        fill_nulls("user_lesson_progress", "total_attempts", "0")
        fill_nulls("user_lesson_progress", "correct_attempts", "0")
        fill_nulls("user_lesson_progress", "accuracy", "0")
        fill_nulls("user_lesson_progress", "exercises_total", "0")
        fill_nulls("user_lesson_progress", "exercises_completed", "0")
        fill_nulls("user_lesson_progress", "xp_earned", "0")

        # Make sure recompute_lesson_progress upsert works
        ensure_unique_progress_constraint()

    print("[ensure_schema] done ✅")
