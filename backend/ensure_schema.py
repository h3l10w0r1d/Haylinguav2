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
            if not table_exists(table):
                # Some tables (e.g. cms_users) predate ensure_table() coverage
                # and are assumed to already exist in production. Don't let a
                # missing table abort the whole migration — and the whole app
                # startup with it — for unrelated features.
                print(f"[ensure_schema] skipped {table}.{col}: table does not exist")
                return
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

        # ---------- exercises (per-exercise XP, used by the roadmap's
        # per-lesson XP total; not part of the models.py ORM definition) ----------
        add_col_if_missing("exercises", "xp INTEGER NOT NULL DEFAULT 0")
        fill_nulls("exercises", "xp", "0")

        # ---------- users (existing columns) ----------
        # Optional display name captured at signup — see SignupIn.name in
        # routes.py ("Stored in users.name"). Never had a migration anywhere.
        add_col_if_missing("users", "name TEXT")
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
        # Clock for "practice to earn a heart": correct attempts newer than this
        # count toward the next earned heart; set to NOW() each time one is granted.
        add_col_if_missing("users", "last_heart_earned_at TIMESTAMPTZ")

        # ---------- Email streak reminders ----------
        add_col_if_missing("users", "email_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE")
        fill_nulls("users", "email_reminders_enabled", "TRUE")
        # Guard so the streak-risk email is sent at most once per day per user.
        add_col_if_missing("users", "last_streak_email_at TIMESTAMPTZ")

        # ---------- SR review streak ----------
        add_col_if_missing("users", "review_streak INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "last_review_date DATE")
        fill_nulls("users", "review_streak", "0")

        # ---------- Word hints (GPT-4o gloss cache, shared across users) ----------
        ensure_table("word_hints", """
            CREATE TABLE word_hints (
                word_norm   TEXT PRIMARY KEY,
                hint        TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        # ---------- Exercise mistake explanations (GPT-4o cache, shared across
        # users) — same pattern as word_hints. Keyed on (exercise_id, answer_norm)
        # since the explanation depends only on the exercise + wrong answer, not
        # on who asked. correct_answer is a snapshot for self-healing cache
        # invalidation: if a CMS edit changes the answer, a hit whose snapshot
        # no longer matches is treated as a miss and regenerated. ----------
        ensure_table("exercise_explanations", """
            CREATE TABLE exercise_explanations (
                exercise_id    INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                answer_norm    TEXT NOT NULL,
                explanation    TEXT NOT NULL,
                correct_answer TEXT,
                hit_count      INTEGER NOT NULL DEFAULT 0,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (exercise_id, answer_norm)
            )
        """)

        # ---------- Per-user word exposure (drives NEW-word badges) ----------
        ensure_table("user_word_exposure", """
            CREATE TABLE user_word_exposure (
                user_id       INTEGER NOT NULL,
                word_norm     TEXT NOT NULL,
                first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, word_norm)
            )
        """)

        # ---------- Premium ----------
        add_col_if_missing("users", "is_premium BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "premium_since TIMESTAMPTZ")
        # NULL = permanent Premium (a real purchase); a timestamp = a trial
        # that expires (the 14-day free welcome bonus). See _grant_welcome_trial
        # / _expire_lapsed_trial in routes.py.
        add_col_if_missing("users", "premium_until TIMESTAMPTZ")
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
        add_col_if_missing("users", "best_streak INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "streak_last_activity_date DATE")
        fill_nulls("users", "current_streak", "0")
        fill_nulls("users", "best_streak", "0")
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

        # ---------- Password reset ----------
        add_col_if_missing("users", "password_reset_token TEXT")
        add_col_if_missing("users", "password_reset_expires_at TIMESTAMPTZ")

        # ---------- Reward XP (quests / achievements) ----------
        add_col_if_missing("users", "bonus_xp INTEGER NOT NULL DEFAULT 0")
        fill_nulls("users", "bonus_xp", "0")

        # ---------- Economy: gems currency + chests ----------
        add_col_if_missing("users", "gems INTEGER NOT NULL DEFAULT 0")
        add_col_if_missing("users", "chests INTEGER NOT NULL DEFAULT 0")
        fill_nulls("users", "gems", "0")
        fill_nulls("users", "chests", "0")

        # ---------- Shop power-ups (single-use active states) ----------
        add_col_if_missing("users", "heart_shield_active BOOLEAN NOT NULL DEFAULT FALSE")
        add_col_if_missing("users", "xp_multiplier_active BOOLEAN NOT NULL DEFAULT FALSE")

        # ---------- Cosmetics (owned inventory) ----------
        add_col_if_missing("users", "owned_frames JSONB NOT NULL DEFAULT '[]'::jsonb")
        add_col_if_missing("users", "owned_themes JSONB NOT NULL DEFAULT '[]'::jsonb")
        add_col_if_missing("users", "active_frame TEXT")

        # ---------- Economy: CMS-editable shop items + chest odds ----------
        shop_existed = table_exists("shop_items")
        ensure_table(
            "shop_items",
            """
            CREATE TABLE shop_items (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL UNIQUE,
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
        # Ensure unique constraint exists on existing tables (idempotent).
        conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'shop_items_title_unique' AND conrelid = 'shop_items'::regclass
                ) THEN
                    ALTER TABLE shop_items ADD CONSTRAINT shop_items_title_unique UNIQUE (title);
                END IF;
            END $$;
        """))

        # Always upsert the canonical item catalogue (title is the natural key).
        # New items added here will appear in existing databases on next boot.
        all_seed_items = [
            ("Streak Freeze",  "Protects your streak from one missed day.",          "snowflake",    50,  "streak_freeze",  1),
            ("Refill Hearts",  "Restore all your hearts instantly.",                  "heart",        30,  "hearts_refill",  0),
            ("XP Boost",       "Instantly add 15 XP to your total.",                 "zap",          20,  "xp_boost",       15),
            ("Mega XP Surge",  "Instantly earn 50 XP.",                              "zap",          60,  "xp_boost",       50),
            ("Weekend Pack",   "Protect your streak for 2 consecutive days.",        "snowflake",    80,  "streak_freeze",  2),
            ("Streak Repair",  "Restore a streak you lost in the last 3 days.",      "shield",       150, "streak_repair",  0),
            ("Heart Shield",   "Your next lesson won't cost any hearts.",            "shield-check", 45,  "heart_shield",   0),
            ("Double XP",      "Earn 2× XP on your next lesson.",              "trending-up",  80,  "xp_multiplier",  0),
            ("Gold Frame",     "A gleaming gold border around your avatar.",         "award",        200, "avatar_frame",   0),
            ("Ararat Banner",  "Mount Ararat profile banner for your public page.",  "image",        300, "profile_theme",  0),
        ]
        for i, (t, d, ic, pr, eff, amt) in enumerate(all_seed_items):
            conn.execute(
                text(
                    """
                    INSERT INTO shop_items (title, description, icon, price, effect, effect_amount, sort_order)
                    VALUES (:t, :d, :ic, :pr, :eff, :amt, :so)
                    ON CONFLICT (title) DO NOTHING
                    """
                ),
                {"t": t, "d": d, "ic": ic, "pr": pr, "eff": eff, "amt": amt, "so": i},
            )
        print("[ensure_schema] upserted shop_items catalogue")

        # ---------- Premium pricing plans (CMS-editable, replaces the
        # hardcoded single plan in src/Premium.jsx) ----------
        ensure_table(
            "pricing_plans",
            """
            CREATE TABLE pricing_plans (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                subtitle TEXT,
                price INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'AMD',
                interval TEXT NOT NULL DEFAULT 'month',
                perks JSONB NOT NULL DEFAULT '[]'::jsonb,
                badge_label TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'pricing_plans_title_unique' AND conrelid = 'pricing_plans'::regclass
                ) THEN
                    ALTER TABLE pricing_plans ADD CONSTRAINT pricing_plans_title_unique UNIQUE (title);
                END IF;
            END $$;
        """))
        _default_perks = (
            "[\"Unlimited hearts — never wait to learn again\","
            "\"Mistakes don't stop you mid-lesson\","
            "\"Support Haylingua and help us build more\"]"
        )
        for t, sub, pr, iv, badge, so in [
            ("Monthly", "Billed every month", 1490, "month", None, 1),
            ("Annual", "Billed once a year", 12900, "year", "Best value · Save 28%", 2),
        ]:
            conn.execute(
                text(
                    """
                    INSERT INTO pricing_plans (title, subtitle, price, interval, perks, badge_label, sort_order)
                    VALUES (:t, :sub, :pr, :iv, CAST(:perks AS jsonb), :badge, :so)
                    ON CONFLICT (title) DO NOTHING
                    """
                ),
                {"t": t, "sub": sub, "pr": pr, "iv": iv, "perks": _default_perks, "badge": badge, "so": so},
            )
        print("[ensure_schema] seeded pricing_plans")

        # Track which plan a (simulated, for now) premium purchase was for —
        # no functional effect yet, but the data is captured ahead of real
        # Stripe billing so historical purchases aren't lost.
        add_col_if_missing("users", "premium_plan_id INTEGER")

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

        # ---------- Chest rarities (tier weights + per-tier xp-boost chance) ----
        # Rarity is rolled server-side at open time. Existing reward rows become
        # the 'wooden' tier via the column default; higher tiers get their own
        # reward tables seeded below (only when that tier has no rows yet).
        add_col_if_missing("chest_rewards", "rarity TEXT NOT NULL DEFAULT 'wooden'")
        fill_nulls("chest_rewards", "rarity", "'wooden'")

        rarities_existed = table_exists("chest_rarities")
        ensure_table(
            "chest_rarities",
            """
            CREATE TABLE chest_rarities (
                rarity TEXT PRIMARY KEY,
                weight INTEGER NOT NULL DEFAULT 1,
                xp_boost_chance INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
            """,
        )
        if not rarities_existed:
            for i, (r, w, xb) in enumerate(
                [("wooden", 55, 25), ("silver", 30, 20), ("golden", 12, 10), ("legendary", 3, 0)]
            ):
                conn.execute(
                    text(
                        "INSERT INTO chest_rarities (rarity, weight, xp_boost_chance, sort_order) "
                        "VALUES (:r, :w, :xb, :so)"
                    ),
                    {"r": r, "w": w, "xb": xb, "so": i},
                )
            print("[ensure_schema] seeded chest_rarities")

        for _rarity, _rows in {
            "silver": [(25, 20), (30, 15), (40, 8), (50, 3)],
            "golden": [(50, 15), (60, 10), (80, 5), (100, 2)],
            "legendary": [(150, 10), (200, 6), (300, 2)],
        }.items():
            _n = conn.execute(
                text("SELECT COUNT(*) FROM chest_rewards WHERE rarity = :r"), {"r": _rarity}
            ).scalar()
            if not _n:
                for i, (g, w) in enumerate(_rows):
                    conn.execute(
                        text(
                            "INSERT INTO chest_rewards (gems, weight, sort_order, rarity) "
                            "VALUES (:g, :w, :so, :r)"
                        ),
                        {"g": g, "w": w, "so": i, "r": _rarity},
                    )
                print(f"[ensure_schema] seeded chest_rewards for {_rarity}")
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
        # xp / xp_reward used to only be added by seed_alphabet_lessons(), which
        # only runs when SEED_ON_STARTUP=true — unset in CI, so a fresh database
        # (CI's Postgres service container, or any deploy without that flag)
        # never got these columns and every lesson-insert/CMS query referencing
        # xp_reward failed with "column does not exist".
        add_col_if_missing("lessons", "xp INTEGER")
        set_default("lessons", "xp", "40")
        add_col_if_missing("lessons", "xp_reward INTEGER NOT NULL DEFAULT 40")
        # lesson_type/config: non-standard lesson kinds (e.g. Reading) — never
        # had a migration anywhere, assumed pre-existing like several other
        # lessons columns.
        add_col_if_missing("lessons", "lesson_type TEXT NOT NULL DEFAULT 'standard'")
        add_col_if_missing("lessons", "config JSONB NOT NULL DEFAULT '{}'::jsonb")
        fill_nulls("lessons", "lesson_type", "'standard'")
        fill_nulls("lessons", "config", "'{}'::jsonb")
        # Draft/published status for the CMS staging workflow (see
        # GET /lessons/{slug} + POST /cms/lessons/{id}/preview-link in
        # routes.py). DEFAULT TRUE preserves current behavior for any
        # pre-existing lesson row that predates this column; the CMS's
        # create-lesson endpoint explicitly defaults NEW rows to draft.
        add_col_if_missing("lessons", "is_published BOOLEAN NOT NULL DEFAULT TRUE")
        fill_nulls("lessons", "is_published", "TRUE")
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

        # ---------- Google / Telegram / Facebook OAuth ----------
        add_col_if_missing("users", "google_id TEXT")
        add_col_if_missing("users", "telegram_id TEXT")
        add_col_if_missing("users", "facebook_id TEXT")
        add_col_if_missing("users", "oauth_provider TEXT")
        # Ensure google_id / telegram_id / facebook_id are unique.
        # Each attempt needs its own savepoint: if the constraint already exists
        # PostgreSQL aborts the whole transaction, so a bare try/except is not enough.
        for constraint_sql, sp in [
            ("ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id)", "sp_gid"),
            ("ALTER TABLE users ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id)", "sp_tid"),
            ("ALTER TABLE users ADD CONSTRAINT users_facebook_id_unique UNIQUE (facebook_id)", "sp_fid"),
        ]:
            try:
                conn.execute(text(f"SAVEPOINT {sp}"))
                conn.execute(text(constraint_sql))
                conn.execute(text(f"RELEASE SAVEPOINT {sp}"))
            except Exception:
                conn.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))

        # ---------- Referrals ----------
        add_col_if_missing("users", "referral_code TEXT")
        add_col_if_missing("users", "referred_by INTEGER")
        try:
            conn.execute(text("SAVEPOINT sp_ref_code"))
            conn.execute(text("ALTER TABLE users ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code)"))
            conn.execute(text("RELEASE SAVEPOINT sp_ref_code"))
        except Exception:
            conn.execute(text("ROLLBACK TO SAVEPOINT sp_ref_code"))

        # ---------- Spaced-repetition cards ----------
        # One row per (user, exercise). Created automatically on first lesson
        # answer; updated by the dedicated /me/review/submit endpoint.
        ensure_table(
            "sr_cards",
            """
            CREATE TABLE sr_cards (
                id               SERIAL PRIMARY KEY,
                user_id          INTEGER NOT NULL,
                exercise_id      INTEGER NOT NULL,
                lesson_id        INTEGER NOT NULL,
                ease_factor      REAL    NOT NULL DEFAULT 2.5,
                interval_days    INTEGER NOT NULL DEFAULT 1,
                repetitions      INTEGER NOT NULL DEFAULT 0,
                due_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_reviewed_at TIMESTAMPTZ,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, exercise_id)
            )
            """,
        )
        # Fast lookup of cards due today per user
        conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename='sr_cards' AND indexname='sr_cards_user_due_idx'
                ) THEN
                    CREATE INDEX sr_cards_user_due_idx ON sr_cards (user_id, due_at);
                END IF;
            END $$;
        """))

        # ---------- CMS users: display name + timezone ----------
        add_col_if_missing("cms_users", "display_name TEXT")
        add_col_if_missing("cms_users", "timezone TEXT")

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

        # Status monitoring moved to a third-party uptime service (UptimeRobot /
        # Better Stack) that pings /health directly — drop the short-lived
        # self-hosted health-log table from the earlier custom implementation.
        conn.execute(text("DROP TABLE IF EXISTS service_health_log"))

        # ---------- Core tables that predate ensure_schema.py's coverage ----------
        # These were never captured in any committed migration (created directly
        # on production at some point). ensure_table() is a no-op wherever the
        # table already exists, so this section only matters for a *fresh*
        # database (new local/dev/staging setup) — it changes nothing in
        # production. Reliability-audit follow-up: found via a full cross-check
        # of every application SQL statement against this file's coverage.
        ensure_table(
            "lesson_progress",
            """
            CREATE TABLE lesson_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                completed_at TIMESTAMPTZ,
                UNIQUE (user_id, lesson_id)
            )
            """,
        )
        conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'lesson_progress_user_id_lesson_id_key' AND conrelid = 'lesson_progress'::regclass
                ) THEN
                    ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id);
                END IF;
            END $$;
        """))

        ensure_table(
            "user_lesson_progress",
            """
            CREATE TABLE user_lesson_progress (
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                started_at TIMESTAMPTZ,
                last_seen_at TIMESTAMPTZ,
                last_exercise_id INTEGER,
                total_attempts INTEGER NOT NULL DEFAULT 0,
                correct_attempts INTEGER NOT NULL DEFAULT 0,
                accuracy REAL,
                exercises_total INTEGER NOT NULL DEFAULT 0,
                exercises_completed INTEGER NOT NULL DEFAULT 0,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                completed_at TIMESTAMPTZ,
                review_queue JSONB NOT NULL DEFAULT '[]'::jsonb,
                UNIQUE (user_id, lesson_id)
            )
            """,
        )
        add_col_if_missing("user_lesson_progress", "exercises_total INTEGER NOT NULL DEFAULT 0")
        fill_nulls("user_lesson_progress", "exercises_total", "0")

        ensure_table(
            "friends",
            """
            CREATE TABLE friends (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, friend_id)
            )
            """,
        )

        ensure_table(
            "friend_requests",
            """
            CREATE TABLE friend_requests (
                id SERIAL PRIMARY KEY,
                requester_id INTEGER NOT NULL,
                addressee_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                responded_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

        ensure_table(
            "user_onboarding",
            """
            CREATE TABLE user_onboarding (
                user_id INTEGER PRIMARY KEY,
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
                completed_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ
            )
            """,
        )

        ensure_table(
            "user_exercise_attempts",
            """
            CREATE TABLE user_exercise_attempts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER,
                exercise_id INTEGER,
                attempt_no INTEGER,
                is_correct BOOLEAN,
                answer_text TEXT,
                selected_indices JSONB,
                time_ms INTEGER,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

        ensure_table(
            "user_exercise_logs",
            """
            CREATE TABLE user_exercise_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER,
                exercise_id INTEGER,
                event_type TEXT,
                correct BOOLEAN,
                meta JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        add_col_if_missing("user_exercise_logs", "lesson_id INTEGER")
        add_col_if_missing("user_exercise_logs", "exercise_id INTEGER")
        add_col_if_missing("user_exercise_logs", "event_type TEXT")
        add_col_if_missing("user_exercise_logs", "meta JSONB")
        add_col_if_missing("user_exercise_logs", "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
        fill_nulls("user_exercise_logs", "created_at", "NOW()")

        ensure_table(
            "cms_invites",
            """
            CREATE TABLE cms_invites (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                role TEXT,
                token_hash TEXT NOT NULL,
                invited_by INTEGER,
                accepted_at TIMESTAMPTZ,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

        ensure_table(
            "email_verification_codes",
            """
            CREATE TABLE email_verification_codes (
                user_id INTEGER PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                last_sent_at TIMESTAMPTZ,
                attempts INTEGER NOT NULL DEFAULT 0
            )
            """,
        )

        ensure_table(
            "exercise_audio",
            """
            CREATE TABLE exercise_audio (
                id SERIAL PRIMARY KEY,
                exercise_id INTEGER NOT NULL,
                voice_type TEXT NOT NULL,
                source_type TEXT,
                tts_text TEXT,
                tts_voice_id TEXT,
                audio_data BYTEA,
                audio_format TEXT,
                audio_size INTEGER,
                duration_seconds REAL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                UNIQUE (exercise_id, voice_type)
            )
            """,
        )

        ensure_table(
            "exercise_audio_targets",
            """
            CREATE TABLE exercise_audio_targets (
                id SERIAL PRIMARY KEY,
                exercise_id INTEGER NOT NULL,
                target_key TEXT NOT NULL,
                voice_type TEXT NOT NULL,
                source_type TEXT,
                tts_text TEXT,
                tts_voice_id TEXT,
                audio_data BYTEA,
                audio_format TEXT,
                audio_size INTEGER,
                file_path TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                UNIQUE (exercise_id, target_key, voice_type)
            )
            """,
        )

        # ---------- Careers: CMS-editable job vacancies ----------
        ensure_table(
            "job_vacancies",
            """
            CREATE TABLE job_vacancies (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                location TEXT,
                employment_type TEXT NOT NULL DEFAULT 'full-time',
                summary TEXT,
                description TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

        # ---------- Community forum ----------
        ensure_table(
            "forum_categories",
            """
            CREATE TABLE forum_categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                icon TEXT NOT NULL DEFAULT 'message-circle',
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        ensure_table(
            "forum_threads",
            """
            CREATE TABLE forum_threads (
                id SERIAL PRIMARY KEY,
                category_id INTEGER NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
                is_locked BOOLEAN NOT NULL DEFAULT FALSE,
                reply_count INTEGER NOT NULL DEFAULT 0,
                last_reply_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        ensure_table(
            "forum_posts",
            """
            CREATE TABLE forum_posts (
                id SERIAL PRIMARY KEY,
                thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )

        # Seed a starter set of categories so the forum isn't empty at launch.
        # slug is the natural key — safe to re-run.
        seed_categories = [
            ("Introduce yourself", "introductions", "New here? Say hello and tell us what brought you to Armenian.", "hand"),
            ("General discussion", "general", "Anything about learning Armenian, the app, or the language itself.", "message-circle"),
            ("Learning tips", "tips", "Share what's working for you — mnemonics, resources, study habits.", "lightbulb"),
            ("Feedback & bugs", "feedback", "Found a bug or have an idea? Tell us here — we read every post.", "bug"),
        ]
        for i, (name, slug, desc, icon) in enumerate(seed_categories):
            conn.execute(
                text("""
                    INSERT INTO forum_categories (name, slug, description, icon, sort_order)
                    VALUES (:n, :s, :d, :ic, :so)
                    ON CONFLICT (slug) DO NOTHING
                """),
                {"n": name, "s": slug, "d": desc, "ic": icon, "so": i},
            )
        print("[ensure_schema] upserted forum_categories")

    print("[ensure_schema] done")
