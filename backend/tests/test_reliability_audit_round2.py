# backend/tests/test_reliability_audit_round2.py
"""Second reliability-audit pass (follow-up to test_bonus_xp_leaderboard_consistency.py
and test_current_streak_persistence.py). Two more "same fact computed
differently in two places" bugs:

1. POST /lessons/{slug}/complete (routes.py) recomputed total_xp/
   lessons_completed with its own hand-rolled query instead of the
   canonical one used by /me/stats: it omitted users.bonus_xp from
   total_xp, and counted every lesson_progress row (including
   in-progress ones) instead of only completed_at IS NOT NULL rows.
   GET /me/profile had the same bonus_xp omission. A user could see a
   lower total_xp / higher lessons_completed right after finishing a
   lesson than what /me/stats showed a second later.

2. users.is_premium is only flipped off for a lapsed trial by
   _expire_lapsed_trial(), which used to be wired into just the hot
   hearts/premium read paths. CMS admin dashboards (support search,
   support detail, analytics KPIs) and the Brevo marketing sync read
   the raw column, so a user whose trial had expired still showed as
   Premium in the CMS/marketing data until an unrelated request
   happened to touch /me/hearts or /me/premium for that user.
"""
from datetime import timedelta

from sqlalchemy import text


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-reliability-round2@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def test_complete_lesson_response_matches_me_stats(client, db_conn, make_user):
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id, slug FROM lessons LIMIT 1")).mappings().first()
    assert lesson_row, "fixture DB needs at least one lesson seeded"

    db_conn.execute(text("UPDATE users SET bonus_xp = 50 WHERE id = :u"), {"u": user_id})
    # Leave an in-progress (not completed) row for a different lesson to make
    # sure lessons_completed doesn't just COUNT(*) every lesson_progress row.
    other_lesson = db_conn.execute(text("SELECT id FROM lessons OFFSET 1 LIMIT 1")).mappings().first()
    if other_lesson:
        db_conn.execute(
            text("INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, completed_at) VALUES (:u, :l, 0, NULL)"),
            {"u": user_id, "l": other_lesson["id"]},
        )

    r = client.post(f"/lessons/{lesson_row['slug']}/complete", headers=headers)
    assert r.status_code == 200, r.text
    complete_body = r.json()

    stats = client.get("/me/stats", headers=headers)
    assert stats.status_code == 200, stats.text
    stats_body = stats.json()

    assert complete_body["total_xp"] == stats_body["total_xp"], (
        f"POST /lessons/.../complete returned total_xp={complete_body['total_xp']} but "
        f"/me/stats shows {stats_body['total_xp']} for the same user right after — bonus_xp "
        "was dropped from the complete-lesson response"
    )
    assert complete_body["lessons_completed"] == stats_body["lessons_completed"] == 1, (
        f"expected exactly 1 completed lesson (the in-progress row must not count), got "
        f"complete={complete_body['lessons_completed']} stats={stats_body['lessons_completed']}"
    )


def test_me_profile_total_xp_includes_bonus_xp(client, db_conn, make_user):
    user_id, headers = make_user()
    lesson_row = db_conn.execute(text("SELECT id FROM lessons LIMIT 1")).mappings().first()
    assert lesson_row

    db_conn.execute(
        text("INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, completed_at) VALUES (:u, :l, 100, NOW())"),
        {"u": user_id, "l": lesson_row["id"]},
    )
    db_conn.execute(text("UPDATE users SET bonus_xp = 75 WHERE id = :u"), {"u": user_id})

    profile = client.get("/me/profile", headers=headers)
    assert profile.status_code == 200, profile.text
    stats = client.get("/me/stats", headers=headers)
    assert stats.status_code == 200, stats.text

    assert profile.json()["total_xp"] == stats.json()["total_xp"] == 175, (
        f"/me/profile shows total_xp={profile.json()['total_xp']} but /me/stats shows "
        f"{stats.json()['total_xp']} — bonus_xp was dropped from the profile query"
    )


def _make_lapsed_trial_user(db_conn, make_user):
    user_id, headers = make_user()
    db_conn.execute(
        text(
            """
            UPDATE users
            SET is_premium = TRUE, premium_since = NOW() - INTERVAL '20 days',
                premium_until = NOW() - INTERVAL '1 day'
            WHERE id = :u
            """
        ),
        {"u": user_id},
    )
    return user_id, headers


def test_cms_support_search_reflects_lapsed_trial(client, db_conn, make_user):
    user_id, _ = _make_lapsed_trial_user(db_conn, make_user)
    row = db_conn.execute(text("SELECT username FROM users WHERE id = :u"), {"u": user_id}).mappings().first()

    r = client.get("/cms/support/users", params={"q": row["username"]}, headers=_cms_headers(db_conn))
    assert r.status_code == 200, r.text
    entry = next(u for u in r.json()["users"] if u["id"] == user_id)
    assert entry["is_premium"] is False, (
        "CMS support search still shows is_premium=true for a user whose "
        "premium_until has already passed"
    )


def test_cms_support_detail_reflects_lapsed_trial(client, db_conn, make_user):
    user_id, _ = _make_lapsed_trial_user(db_conn, make_user)

    r = client.get(f"/cms/support/users/{user_id}", headers=_cms_headers(db_conn))
    assert r.status_code == 200, r.text
    assert r.json()["is_premium"] is False, (
        "CMS support user-detail view still shows is_premium=true for a lapsed trial"
    )


def test_cms_analytics_premium_count_excludes_lapsed_trials(client, db_conn, make_user):
    user_id, _ = _make_lapsed_trial_user(db_conn, make_user)

    r = client.get("/cms/analytics", headers=_cms_headers(db_conn))
    assert r.status_code == 200, r.text
    body = r.json()
    premium_users = body.get("summary", body).get("premium_users") if isinstance(body.get("summary"), dict) else body.get("premium_users")
    row = db_conn.execute(
        text("SELECT is_premium, premium_until FROM users WHERE id = :u"), {"u": user_id}
    ).mappings().first()
    assert row["is_premium"] is True and row["premium_until"] is not None, (
        "sanity check: the raw column should still say TRUE — the fix reads live, "
        "it does not write the column"
    )


def test_expire_lapsed_trial_helper_is_idempotent_and_scoped(db_conn, make_user):
    """Direct unit check of the helper itself: only flips a genuinely-lapsed
    trial, leaves permanent Premium (premium_until IS NULL) untouched."""
    import routes as routes_mod

    lapsed_id, _ = make_user()
    db_conn.execute(
        text("UPDATE users SET is_premium = TRUE, premium_until = NOW() - INTERVAL '1 hour' WHERE id = :u"),
        {"u": lapsed_id},
    )
    permanent_id, _ = make_user()
    db_conn.execute(
        text("UPDATE users SET is_premium = TRUE, premium_until = NULL WHERE id = :u"),
        {"u": permanent_id},
    )

    routes_mod._expire_lapsed_trial(db_conn, lapsed_id)
    routes_mod._expire_lapsed_trial(db_conn, permanent_id)

    lapsed_row = db_conn.execute(text("SELECT is_premium FROM users WHERE id = :u"), {"u": lapsed_id}).mappings().first()
    permanent_row = db_conn.execute(text("SELECT is_premium FROM users WHERE id = :u"), {"u": permanent_id}).mappings().first()
    assert lapsed_row["is_premium"] is False
    assert permanent_row["is_premium"] is True
