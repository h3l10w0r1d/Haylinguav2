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

        # ---------- Premium ----------
        add_col_if_missing("users", "is_premium BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "premium_since TIMESTAMPTZ")
        fill_nulls("users", "is_premium", "FALSE")

        # ---------- Leagues (Duolingo-style weekly divisions) ----------
        add_col_if_missing("users", "league_tier INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "weekly_xp INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "league_week TEXT")
        add_col_if_missing("users", "league_cohort INTEGER")
        fill_nulls("users", "league_tier", "0")
        fill_nulls("users", "weekly_xp", "0")

        # ---------- StreakManager ----------
        add_col_if_missing("users", "current_streak INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "streak_last_activity_date DATE")
        fill_nulls("users", "current_streak", "0")
        # Streak freezes: an owned protection that bridges one missed day so the
        # streak doesn't reset. streak_frozen_days records days already covered.
        add_col_if_missing("users", "streak_freezes INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "streak_frozen_days JSONB NOT NULL DEFAULT '[]'::jsonb")
        fill_nulls("users", "streak_freezes", "0")
        fill_nulls("users", "streak_frozen_days", "'[]'::jsonb")

        # ---------- Account management audit columns ----------
        # These are referenced by UPDATE statements in routes.py (2FA setup/disable,
        add_col_if_missing("users", "updated_at TIMESTAMPTZ")
        add_col_if_missing("users", "pending_email TEXT")
        add_col_if_missing("users", "pending_email_code_hash TEXT")
        add_col_if_missing("users", "pending_email_expires_at TIMESTAMPTZ")
        add_col_if_missing("users", "email_verified BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "email_verified_at TIMESTAMPTZ")
        add_col_if_missing("users", "totp_recovery_hashes JSONB NOT NULL DEFAULT '[]'::jsonb")
        fill_nulls("users", "email_verified", "FALSE")
        fill_nulls("users", "totp_recovery_hashes", "'[]'::jsonb")

        # ---------- Token revocation ----------
        add_col_if_missing("users", "token_version INTEGER NOT NULL DEFAULT 0")
        fill_nulls("users", "token_version", "0")

        # ---------- Reward XP (quests / achievements) ----------
        add_col_if_missing("users", "bonus_xp INTEGER NOT NULL DEFAULT 0")
        fill_nulls("users", "bonus_xp", "0")

        # ---------- Economy: gems currency + chests ----------
        add_col_if_missing("users", "gems INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "chests INTEGER NOT NULL DEFAULT 0")
        fill_nulls("users", "gems", "0")
        fill_nulls("users", "chests", "0")

        # ---------- Economy: CMS-editable shop items + chest odds ----------
        shop_existed = table_exists("shop_items")
        ensure_table(
            "shop_items",
            """
            CREATE TABLE shop_items (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                icon TEXT NOT NULL DEFAULT 'gem',
                price INTEGER NOT NULL DEFAULT 10,
                effect TEXT NOT NULL,
                effect_amount INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        if not shop_existed:
            seed_items = [
                ("Streak Freeze", "Protects your streak from one missed day.", "snowflake", 50, "streak_freeze", 0),
                ("Refill Hearts", "Restore all your hearts instantly.", "heart", 30, "hearts_refill", 0),
                ("XP Boost", "Instantly add 15 XP to your total.", "zap", 20, "xp_boost", 15),
            ]
            for i, (t, d, ic, pr, eff, amt) in enumerate(seed_items):
                conn.execute(
                    text(
                        """
                        INSERT INTO shop_items (title, description, icon, price, effect, effect_amount, sort_order)
                        VALUES (:t, :d, :ic, :pr, :eff, :amt, :so)
                        """
                    ),
                    {"t": t, "d": d, "ic": ic, "pr": pr, "eff": eff, "amt": amt, "so": i},
                )
            print("[ensure_schema] seeded shop_items")

        chest_existed = table_exists("chest_rewards")
        ensure_table(
            "chest_rewards",
            """
            CREATE TABLE chest_rewards (
                id SERIAL PRIMARY KEY,
                gems INTEGER NOT NULL,
                weight INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
            """,
        )
        if not chest_existed:
            for i, (g, w) in enumerate([(10, 30), (15, 25), (20, 18), (25, 12), (30, 8), (40, 5), (60, 2)]):
                conn.execute(
                    text("INSERT INTO chest_rewards (gems, weight, sort_order) VALUES (:g, :w, :so)"),
                    {"g": g, "w": w, "so": i},
                )
            print("[ensure_schema] seeded chest_rewards")
        ensure_table(
            "reward_claims",
            """
            CREATE TABLE reward_claims (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                kind TEXT NOT NULL,
                claim_key TEXT NOT NULL,
                reward_xp INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, kind, claim_key)
            )
            """,
        )

        # ---------- Chapters (lesson grouping on the learner roadmap) ----------
        chapters_existed = table_exists("chapters")
        ensure_table(
            "chapters",
            """
            CREATE TABLE chapters (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                is_published BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        add_col_if_missing("lessons", "chapter_id INTEGER")
        # One-time backfill: turn the existing implicit "level" groups into real
        # chapters so the learner roadmap looks identical right after migration.
        if not chapters_existed and table_exists("lessons"):
            levels = [
                int(r[0])
                for r in conn.execute(
                    text("SELECT DISTINCT level FROM lessons WHERE level IS NOT NULL ORDER BY level")
                ).all()
            ]
            for lvl in levels:
                cid = conn.execute(
                    text(
                        "INSERT INTO chapters (title, description, position, is_published) "
                        "VALUES (:t, '', :p, TRUE) RETURNING id"
                    ),
                    {"t": f"Chapter {lvl}", "p": int(lvl)},
                ).scalar()
                conn.execute(
                    text("UPDATE lessons SET chapter_id = :c WHERE level = :l AND chapter_id IS NULL"),
                    {"c": int(cid), "l": int(lvl)},
                )
            if levels:
                print(f"[ensure_schema] backfilled {len(levels)} chapters from lesson levels")

        # ---------- Achievement definitions (CMS-editable badges) ----------
        ach_existed = table_exists("achievement_defs")
        ensure_table(
            "achievement_defs",
            """
            CREATE TABLE achievement_defs (
                id SERIAL PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                icon TEXT NOT NULL DEFAULT 'star',
                metric TEXT NOT NULL,
                threshold INTEGER NOT NULL DEFAULT 1,
                reward_xp INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        # Seed the original built-in achievements so behaviour is unchanged.
        if not ach_existed:
            seeds = [
                ("first_lesson", "First Steps", "Complete your first lesson", "star", "lessons_completed", 1, 20),
                ("five_lessons", "Getting Going", "Complete 5 lessons", "crown", "lessons_completed", 5, 40),
                ("streak7", "On Fire", "Reach a 7-day streak", "flame", "streak_days", 7, 50),
                ("streak30", "Unstoppable", "Reach a 30-day streak", "flame", "streak_days", 30, 150),
                ("xp500", "Word Collector", "Earn 500 XP", "zap", "total_xp", 500, 30),
                ("xp2000", "Scholar", "Earn 2000 XP", "zap", "total_xp", 2000, 80),
                ("correct100", "Sharp Mind", "Answer 100 questions correctly", "target", "correct_answers", 100, 40),
            ]
            for i, (k, title, desc, icon, metric, thr, reward) in enumerate(seeds):
                conn.execute(
                    text(
                        """
                        INSERT INTO achievement_defs (key, title, description, icon, metric, threshold, reward_xp, sort_order)
                        VALUES (:k, :t, :d, :i, :m, :thr, :r, :so)
                        ON CONFLICT (key) DO NOTHING
                        """
                    ),
                    {"k": k, "t": title, "d": desc, "i": icon, "m": metric, "thr": thr, "r": reward, "so": i},
                )
            print(f"[ensure_schema] seeded {len(seeds)} achievement_defs")
        # Per-badge colour (icon tile background), added after the table existed.
        add_col_if_missing("achievement_defs", "color TEXT NOT NULL DEFAULT '#F59E0B'")
        fill_nulls("achievement_defs", "color", "'#F59E0B'")

        # ---------- Exercise problem reports ----------
        ensure_table(
            "exercise_reports",
            """
            CREATE TABLE exercise_reports (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                exercise_id INTEGER,
                lesson_id INTEGER,
                reason TEXT,
                detail TEXT,
                answer_text TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

        # ---------- Google / Telegram OAuth ----------
        add_col_if_missing("users", "google_id TEXT")
        add_col_if_missing("users", "telegram_id TEXT")
        add_col_if_missing("users", "oauth_provider TEXT")
        # Ensure google_id / telegram_id are unique.
        # Each attempt needs its own savepoint: if the constraint already exists
        # PostgreSQL aborts the whole transaction, so a bare try/except is not enough.
        for constraint_sql, sp in [
            ("ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id)", "sp_gid"),
            ("ALTER TABLE users ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id)", "sp_tid"),
        ]:
            try:
                conn.execute(text(f"SAVEPOINT {sp}"))
                conn.execute(text(constraint_sql))
                conn.execute(text(f"RELEASE SAVEPOINT {sp}"))
            except Exception:
                conn.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))

        # ---------- Admin notes on learners ----------
        ensure_table(
            "admin_notes",
            """
            CREATE TABLE admin_notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                author_email TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

    print("[ensure_schema] done")
