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

        # ---------- exercise_audio ----------
        # caches TTS/custom recordings (optionally on Render disk)
        ensure_table(
            "exercise_audio",
            """
            CREATE TABLE exercise_audio (
                id SERIAL PRIMARY KEY,
                exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                voice_type TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'tts',
                tts_text TEXT,
                tts_voice_id TEXT,

                audio_data BYTEA,
                audio_format TEXT NOT NULL DEFAULT 'mp3',
                audio_size INTEGER NOT NULL DEFAULT 0,
                file_path TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (exercise_id, voice_type)
            );
            """,
        )

        # Add columns if deploying onto an older DB
        add_col_if_missing("exercise_audio", "file_path TEXT")
        add_col_if_missing("exercise_audio", "tts_text TEXT")
        add_col_if_missing("exercise_audio", "tts_voice_id TEXT")

        # ---------- exercise_audio_targets ----------
        # Per-exercise, per-target audio (e.g., sentence token, choice, whole sentence).
        # This enables Duolingo-like tap-to-hear behavior.
        ensure_table(
            "exercise_audio_targets",
            """
            CREATE TABLE exercise_audio_targets (
                id SERIAL PRIMARY KEY,
                exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                target_key TEXT NOT NULL,
                voice_type TEXT NOT NULL,

                -- 'recording' (user upload/record), 'tts' (generated)
                source_type TEXT NOT NULL DEFAULT 'tts',
                tts_text TEXT,
                tts_voice_id TEXT,

                audio_data BYTEA,
                audio_format TEXT NOT NULL DEFAULT 'mp3',
                audio_size INTEGER NOT NULL DEFAULT 0,
                file_path TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

                UNIQUE (exercise_id, target_key, voice_type)
            );
            """,
        )

        # Add columns if deploying onto an older DB
        add_col_if_missing("exercise_audio_targets", "source_type TEXT NOT NULL DEFAULT 'tts'")
        add_col_if_missing("exercise_audio_targets", "tts_text TEXT")
        add_col_if_missing("exercise_audio_targets", "tts_voice_id TEXT")
        add_col_if_missing("exercise_audio_targets", "audio_data BYTEA")
        add_col_if_missing("exercise_audio_targets", "audio_format TEXT NOT NULL DEFAULT 'mp3'")
        add_col_if_missing("exercise_audio_targets", "audio_size INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("exercise_audio_targets", "file_path TEXT")
        add_col_if_missing("exercise_audio_targets", "created_at TIMESTAMP NOT NULL DEFAULT NOW()")
        add_col_if_missing("exercise_audio_targets", "updated_at TIMESTAMP NOT NULL DEFAULT NOW()")

        # ---------- user_onboarding ----------
        # Stores post-verification onboarding answers so we can personalize the curriculum.
        ensure_table(
            "user_onboarding",
            """
            CREATE TABLE user_onboarding (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

                age_range TEXT,
                country TEXT,
                planning_visit_armenia BOOLEAN,

                knowledge_level TEXT,
                dialect TEXT,
                primary_goal TEXT,
                source_language TEXT,

                daily_goal_min INTEGER,
                reminder_time TEXT,
                voice_pref TEXT,

                marketing_opt_in BOOLEAN,
                accepted_terms BOOLEAN,

                completed_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """,
        )

        # Add columns if deploying onto an older DB
        add_col_if_missing("user_onboarding", "age_range TEXT")
        add_col_if_missing("user_onboarding", "country TEXT")
        add_col_if_missing("user_onboarding", "planning_visit_armenia BOOLEAN")
        add_col_if_missing("user_onboarding", "knowledge_level TEXT")
        add_col_if_missing("user_onboarding", "dialect TEXT")
        add_col_if_missing("user_onboarding", "primary_goal TEXT")
        add_col_if_missing("user_onboarding", "source_language TEXT")
        add_col_if_missing("user_onboarding", "daily_goal_min INTEGER")
        add_col_if_missing("user_onboarding", "reminder_time TEXT")
        add_col_if_missing("user_onboarding", "voice_pref TEXT")
        add_col_if_missing("user_onboarding", "marketing_opt_in BOOLEAN")
        add_col_if_missing("user_onboarding", "accepted_terms BOOLEAN")
        add_col_if_missing("user_onboarding", "completed_at TIMESTAMP")

        # ---------- lessons (reading lesson support) ----------
        add_col_if_missing("lessons", "lesson_type TEXT NOT NULL DEFAULT 'standard'")
        add_col_if_missing("lessons", "config JSONB NOT NULL DEFAULT '{}'::jsonb")

        # ---------- users (username support) ----------
        add_col_if_missing("users", "username TEXT")
        # Case-insensitive uniqueness for non-null usernames
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uniq
                ON users (LOWER(username))
                WHERE username IS NOT NULL AND username <> ''
                """
            )

        )
        # ---------- users (profile customization) ----------
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

    print("[ensure_schema] done ✅")
