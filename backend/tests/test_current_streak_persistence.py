# backend/tests/test_current_streak_persistence.py
"""Reliability audit finding: users.current_streak was written in exactly
ONE place in the whole backend (the "Streak Repair" shop purchase) and
otherwise sat at its schema DEFAULT 0 forever. Meanwhile _compute_streak_days
— the actual, live, authoritative streak calculation used by /me/profile,
/me/stats, and the Dashboard — recomputed the real streak on every request
without ever saving it back.

Several things read users.current_streak directly instead of calling
_compute_streak_days: the streak-at-risk reminder cron jobs (email +
Telegram), which filter candidates with `current_streak > 0`, the Brevo
marketing sync attributes, and the CMS learner detail view. For any user who
never bought Streak Repair, all of those were silently seeing 0 — meaning
the streak-reminder retention feature effectively never fired for anyone.

Fix: _compute_streak_days now persists its result to current_streak in the
same lazy UPDATE it already used for best_streak."""
from sqlalchemy import text


def _log_attempt_today(db_conn, user_id, lesson_id, exercise_id):
    db_conn.execute(
        text("""
            INSERT INTO user_exercise_attempts (user_id, lesson_id, exercise_id, is_correct, created_at)
            VALUES (:u, :l, :e, TRUE, NOW())
        """),
        {"u": user_id, "l": lesson_id, "e": exercise_id},
    )


def test_current_streak_column_starts_at_zero_by_default(db_conn, make_user):
    """Sanity check on the premise: a freshly-created user (who obviously
    never bought Streak Repair) has current_streak = 0 even with no other
    activity — confirming the column really does default to 0 and isn't
    populated by anything at signup."""
    user_id, _headers = make_user()
    row = db_conn.execute(text("SELECT current_streak FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row["current_streak"] == 0


def test_computing_the_streak_persists_it_to_current_streak(client, db_conn, make_user):
    """Merely fetching a user's own profile (which calls _compute_streak_days)
    must write the live streak back to users.current_streak — the column any
    reminder job or marketing sync reads directly."""
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    exercise_row = db_conn.execute(text("SELECT id FROM exercises LIMIT 1")).mappings().first()
    assert lesson_row and exercise_row

    _log_attempt_today(db_conn, user_id, lesson_row["id"], exercise_row["id"])

    before = db_conn.execute(text("SELECT current_streak FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert before["current_streak"] == 0, "should still be 0 before anything computes the live streak"

    profile = client.get("/me/profile", headers=headers)
    assert profile.status_code == 200, profile.text
    live_streak = profile.json()["streak"]
    assert live_streak == 1

    after = db_conn.execute(text("SELECT current_streak FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert after["current_streak"] == live_streak, (
        "users.current_streak should now match the live computed streak — "
        "this is the column reminder crons / Brevo / CMS read directly"
    )


def test_reminder_style_query_finds_the_user_after_streak_is_computed(client, db_conn, make_user):
    """Simulates the exact filter the streak-reminder cron jobs use
    (`current_streak > 0`) to prove a real user with an active streak is
    actually findable by it once their streak has been computed at least
    once — the concrete symptom of the bug being fixed."""
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    exercise_row = db_conn.execute(text("SELECT id FROM exercises LIMIT 1")).mappings().first()
    assert lesson_row and exercise_row
    _log_attempt_today(db_conn, user_id, lesson_row["id"], exercise_row["id"])

    # Before ever computing the streak, the reminder query would miss this user.
    missed = db_conn.execute(
        text("SELECT id FROM users WHERE id = :u AND current_streak > 0"), {"u": user_id}
    ).first()
    assert missed is None

    client.get("/me/profile", headers=headers)  # triggers _compute_streak_days

    found = db_conn.execute(
        text("SELECT id FROM users WHERE id = :u AND current_streak > 0"), {"u": user_id}
    ).first()
    assert found is not None, "reminder-style query should now find this user"
