# backend/ensure_schema.py
from sqlalchemy import text

# IMPORTANT:
# This assumes your SQLAlchemy engine is defined in backend/database.py as `engine`.
# If your file name is different, change this import accordingly (e.g. from db import engine).
from database import engine


def ensure_schema() -> None:
    """
    Idempotent DB schema patcher.
    Safe to run on every deploy/startup.
    Fixes missing columns + NOT NULL traps that crash your endpoints.
    """
    print("[ensure_schema] starting...")

    with engine.begin() as conn:
        # Helps you verify this is running against the correct DB
        try:
            dbname = conn.execute(text("SELECT current_database()")).scalar_one()
            print(f"[ensure_schema] connected to database: {dbname}")
        except Exception as e:
            print(f"[ensure_schema] could not read current_database(): {e}")

        # -----------------------------
        # user_exercise_attempts
        # Errors seen:
        # - missing lesson_id
        # - missing attempt_no
        # - xp_earned NOT NULL -> code not inserting -> crash
        # -----------------------------
        conn.execute(text("""
            ALTER TABLE user_exercise_attempts
              ADD COLUMN IF NOT EXISTS lesson_id integer,
              ADD COLUMN IF NOT EXISTS attempt_no integer NOT NULL DEFAULT 1,
              ADD COLUMN IF NOT EXISTS answer_text text,
              ADD COLUMN IF NOT EXISTS selected_indices jsonb NOT NULL DEFAULT '[]'::jsonb,
              ADD COLUMN IF NOT EXISTS time_ms integer;
        """))

        # Make xp_earned safe even if code doesn't insert it
        conn.execute(text("""
            ALTER TABLE user_exercise_attempts
              ALTER COLUMN xp_earned SET DEFAULT 0;
        """))
        # Drop NOT NULL to avoid crashes on old rows / inserts that omit it
        conn.execute(text("""
            ALTER TABLE user_exercise_attempts
              ALTER COLUMN xp_earned DROP NOT NULL;
        """))

        print("[ensure_schema] patched user_exercise_attempts ✅")

        # -----------------------------
        # user_exercise_logs
        # Errors seen:
        # - missing event_type
        # - missing meta
        # - xp_earned NOT NULL -> crash
        # - correct NOT NULL -> crash
        # -----------------------------
        conn.execute(text("""
            ALTER TABLE user_exercise_logs
              ADD COLUMN IF NOT EXISTS lesson_id integer,
              ADD COLUMN IF NOT EXISTS event_type text,
              ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
        """))

        conn.execute(text("""
            ALTER TABLE user_exercise_logs
              ALTER COLUMN xp_earned SET DEFAULT 0;
        """))
        conn.execute(text("""
            ALTER TABLE user_exercise_logs
              ALTER COLUMN xp_earned DROP NOT NULL;
        """))

        conn.execute(text("""
            ALTER TABLE user_exercise_logs
              ALTER COLUMN correct SET DEFAULT false;
        """))
        conn.execute(text("""
            ALTER TABLE user_exercise_logs
              ALTER COLUMN correct DROP NOT NULL;
        """))

        print("[ensure_schema] patched user_exercise_logs ✅")

        # -----------------------------
        # user_lesson_progress
        # Errors seen:
        # - missing total_attempts
        # - missing last_exercise_id
        # Also code updates: correct_attempts, accuracy, last_seen_at
        # -----------------------------
        conn.execute(text("""
            ALTER TABLE user_lesson_progress
              ADD COLUMN IF NOT EXISTS total_attempts integer NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS correct_attempts integer NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS accuracy numeric(5,2) NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
              ADD COLUMN IF NOT EXISTS last_exercise_id integer;
        """))

        print("[ensure_schema] patched user_lesson_progress ✅")

    print("[ensure_schema] done ✅")
