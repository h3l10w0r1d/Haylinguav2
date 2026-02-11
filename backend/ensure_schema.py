# backend/ensure_schema.py
from sqlalchemy import text

# Import your SQLAlchemy engine from wherever you define it.
# Common names: engine in backend/database.py or backend/db.py
from backend.database import engine  # <-- adjust this import if needed


def ensure_schema() -> None:
    """
    Idempotent schema patcher.
    Runs safe ALTER TABLE statements so code + DB stay compatible across deploys.
    """
    with engine.begin() as conn:
        # --- user_exercise_attempts ---
        # Make sure columns exist that your INSERT uses
        conn.execute(text("""
            ALTER TABLE user_exercise_attempts
              ADD COLUMN IF NOT EXISTS lesson_id integer,
              ADD COLUMN IF NOT EXISTS attempt_no integer NOT NULL DEFAULT 1,
              ADD COLUMN IF NOT EXISTS answer_text text,
              ADD COLUMN IF NOT EXISTS selected_indices jsonb NOT NULL DEFAULT '[]'::jsonb,
              ADD COLUMN IF NOT EXISTS time_ms integer;
        """))

        # Your DB currently has xp_earned NOT NULL, but your code doesn't insert it.
        # Make it safe: default 0 and allow null (or keep not null if default is enough).
        conn.execute(text("""
            ALTER TABLE user_exercise_attempts
              ALTER COLUMN xp_earned SET DEFAULT 0;
        """))
        conn.execute(text("""
            ALTER TABLE user_exercise_attempts
              ALTER COLUMN xp_earned DROP NOT NULL;
        """))

        # --- user_exercise_logs ---
        conn.execute(text("""
            ALTER TABLE user_exercise_logs
              ADD COLUMN IF NOT EXISTS lesson_id integer,
              ADD COLUMN IF NOT EXISTS event_type text,
              ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
        """))

        # Your logs table has xp_earned/correct NOT NULL but your code doesn't insert them.
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

        # --- user_lesson_progress ---
        # Your code updates total_attempts/correct_attempts/accuracy/last_seen_at/last_exercise_id
        conn.execute(text("""
            ALTER TABLE user_lesson_progress
              ADD COLUMN IF NOT EXISTS total_attempts integer NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS correct_attempts integer NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS accuracy numeric(5,2) NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
              ADD COLUMN IF NOT EXISTS last_exercise_id integer;
        """))
