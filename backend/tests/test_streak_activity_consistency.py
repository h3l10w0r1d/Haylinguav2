# backend/tests/test_streak_activity_consistency.py
"""Regression: the streak widget's 7-day activity dots must agree with the
streak COUNT — both need to treat "practiced that day" the same way.

/me/activity/last7days used to count lesson_progress.completed_at rows (a
full lesson finish), while _compute_streak_days (the number shown next to
the flame) counts user_exercise_attempts (any attempt). A day with partial
practice — attempts logged, no lesson finished — incremented the streak
number but left that day's dot dark, so the widget visibly disagreed with
itself (e.g. "3 day streak" with only today's dot lit)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import text


def _log_attempt(db_conn, user_id, lesson_id, exercise_id, when):
    db_conn.execute(
        text("""
            INSERT INTO user_exercise_attempts (user_id, lesson_id, exercise_id, is_correct, created_at)
            VALUES (:u, :l, :e, TRUE, :t)
        """),
        {"u": user_id, "l": lesson_id, "e": exercise_id, "t": when},
    )


def test_activity_dots_reflect_practice_without_full_lesson_completion(client, db_conn, make_user):
    """A day with an exercise attempt but no lesson_progress.completed_at row
    (the partial-practice case) must still light up in /me/activity/last7days,
    since that's exactly what counts toward the streak."""
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    exercise_row = db_conn.execute(text("SELECT id FROM exercises LIMIT 1")).mappings().first()
    assert lesson_row and exercise_row, "fixture DB needs at least one lesson/exercise seeded"

    today = datetime.now(timezone.utc)
    _log_attempt(db_conn, user_id, lesson_row["id"], exercise_row["id"], today)

    r = client.get("/me/activity/last7days", headers=headers)
    assert r.status_code == 200, r.text
    days = r.json()["days"]
    today_entry = next(d for d in days if d["date"] == today.date().isoformat())
    assert today_entry["value"] > 0, "today's dot should be lit from the exercise attempt alone"


def test_activity_and_streak_agree_on_which_days_count(client, db_conn, make_user):
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    exercise_row = db_conn.execute(text("SELECT id FROM exercises LIMIT 1")).mappings().first()
    assert lesson_row and exercise_row

    now = datetime.now(timezone.utc)
    for offset in (0, 1, 2):
        _log_attempt(db_conn, user_id, lesson_row["id"], exercise_row["id"], now - timedelta(days=offset))

    streak_row = db_conn.execute(text("SELECT id FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert streak_row

    profile = client.get("/me/profile", headers=headers)
    assert profile.status_code == 200, profile.text
    streak = profile.json()["streak"]
    assert streak == 3, f"expected a 3-day streak from 3 consecutive days of attempts, got {streak}"

    activity = client.get("/me/activity/last7days", headers=headers)
    assert activity.status_code == 200, activity.text
    days = activity.json()["days"]
    lit_count = sum(1 for d in days if d["value"] > 0)
    assert lit_count == 3, f"expected 3 lit dots matching the 3-day streak, got {lit_count}: {days}"
