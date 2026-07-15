# backend/tests/test_bonus_xp_leaderboard_consistency.py
"""Reliability audit finding: users.bonus_xp (combo-streak bonuses, chest/
achievement XP rewards — see the `xp_boost` shop effect and the combo-bonus
grant in the exercise-attempt endpoint) is included in every "your own
stats" total_xp calculation (/me/stats, /me/profile, the Brevo sync, the SSE
live-stats stream, the CMS learner detail view) but was OMITTED from every
RANK()-based leaderboard/ranking query: /leaderboard, /friends,
/users/{username}, and this session's own /friends/suggestions. A user with
real bonus_xp would see a higher "my XP" number on their own profile than
what actually ranked them on the leaderboard, and could be mis-ranked
relative to a friend whose bonus_xp differs."""
from sqlalchemy import text


def _grant_bonus_xp(db_conn, user_id, amount):
    db_conn.execute(
        text("UPDATE users SET bonus_xp = COALESCE(bonus_xp, 0) + :a WHERE id = :u"),
        {"a": amount, "u": user_id},
    )


def _log_lesson_xp(db_conn, user_id, lesson_id, xp):
    db_conn.execute(
        text("""
            INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, completed_at)
            VALUES (:u, :l, :xp, NOW())
        """),
        {"u": user_id, "l": lesson_id, "xp": xp},
    )


def test_me_stats_and_leaderboard_agree_on_total_xp(client, db_conn, make_user):
    """The number a user sees as "my XP" on their own stats must match what
    the public leaderboard used to rank them — otherwise the two disagree
    about the same fact for the same user at the same moment."""
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    assert lesson_row, "fixture DB needs at least one lesson seeded"

    _log_lesson_xp(db_conn, user_id, lesson_row["id"], 100)
    _grant_bonus_xp(db_conn, user_id, 50)

    stats = client.get("/me/stats", headers=headers)
    assert stats.status_code == 200, stats.text
    my_total_xp = stats.json()["total_xp"]
    assert my_total_xp == 150, f"expected lesson XP + bonus_xp = 150, got {my_total_xp}"

    lb = client.get("/leaderboard", params={"limit": 200})
    assert lb.status_code == 200, lb.text
    entry = next((e for e in lb.json() if e["user_id"] == user_id), None)
    assert entry is not None, "user should appear on the leaderboard"
    assert entry["xp"] == my_total_xp, (
        f"leaderboard shows {entry['xp']} XP but /me/stats shows {my_total_xp} "
        "for the same user — bonus_xp was dropped from the leaderboard query"
    )


def test_leaderboard_rank_order_reflects_bonus_xp(client, db_conn, make_user):
    """A user with less lesson XP but enough bonus_xp to have a higher real
    total must outrank a user with more raw lesson XP but no bonus."""
    lower_id, lower_headers = make_user()
    higher_id, higher_headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    assert lesson_row

    # "lower" has more raw lesson XP...
    _log_lesson_xp(db_conn, lower_id, lesson_row["id"], 200)
    # ...but "higher" has enough bonus_xp to have a bigger real total.
    _log_lesson_xp(db_conn, higher_id, lesson_row["id"], 100)
    _grant_bonus_xp(db_conn, higher_id, 500)

    lb = client.get("/leaderboard", params={"limit": 200})
    assert lb.status_code == 200, lb.text
    entries = {e["user_id"]: e for e in lb.json()}
    assert entries[higher_id]["xp"] == 600
    assert entries[lower_id]["xp"] == 200
    assert entries[higher_id]["rank"] < entries[lower_id]["rank"], (
        "the user with the higher real total_xp (including bonus_xp) should "
        "rank above the user with only more raw lesson XP"
    )


def test_friends_list_ranking_includes_bonus_xp(client, db_conn, make_user):
    user_id, headers = make_user()
    friend_id, _ = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    assert lesson_row

    db_conn.execute(text("INSERT INTO friends (user_id, friend_id) VALUES (:a, :b), (:b, :a)"), {"a": user_id, "b": friend_id})
    _log_lesson_xp(db_conn, friend_id, lesson_row["id"], 40)
    _grant_bonus_xp(db_conn, friend_id, 60)

    r = client.get("/friends", headers=headers)
    assert r.status_code == 200, r.text
    friend_entry = next(f for f in r.json() if f["user_id"] == friend_id)
    assert friend_entry["xp"] == 100, (
        f"friends list shows {friend_entry['xp']} XP for a friend with 40 "
        "lesson XP + 60 bonus_xp — bonus_xp was dropped from the ranking query"
    )
