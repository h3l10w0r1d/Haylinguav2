# backend/tests/test_exercise_fail_rate.py
"""Per-exercise fail rate surfaced in the CMS Lesson editor: GET
/cms/lessons/{id}/exercise-stats, based on FIRST-attempt correctness only
(a retry doesn't indicate the exercise itself is the problem)."""
import uuid

from sqlalchemy import text


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-fail-rate@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def _make_lesson_with_exercise(db_conn):
    slug = f"fail-rate-lesson-{uuid.uuid4().hex[:8]}"
    lesson_id = db_conn.execute(
        text(
            "INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config) "
            "VALUES (:slug, 'Fail rate test', '', 1, 10, 10, TRUE, 'standard', '{}'::jsonb) RETURNING id"
        ),
        {"slug": slug},
    ).scalar()
    exercise_id = db_conn.execute(
        text(
            "INSERT INTO exercises (lesson_id, kind, prompt, config, \"order\") "
            "VALUES (:lid, 'true_false', 'p', '{}'::json, 1) RETURNING id"
        ),
        {"lid": lesson_id},
    ).scalar()
    return lesson_id, exercise_id


def _log_attempt(db_conn, user_id, lesson_id, exercise_id, attempt_no, is_correct):
    db_conn.execute(
        text(
            "INSERT INTO user_exercise_attempts (user_id, lesson_id, exercise_id, attempt_no, is_correct) "
            "VALUES (:u, :l, :e, :n, :ok)"
        ),
        {"u": user_id, "l": lesson_id, "e": exercise_id, "n": attempt_no, "ok": is_correct},
    )


def test_requires_cms_auth(client, db_conn):
    lesson_id, _ = _make_lesson_with_exercise(db_conn)
    r = client.get(f"/cms/lessons/{lesson_id}/exercise-stats")
    assert r.status_code == 401


def test_no_attempts_yet(client, db_conn):
    headers = _cms_headers(db_conn)
    lesson_id, exercise_id = _make_lesson_with_exercise(db_conn)
    r = client.get(f"/cms/lessons/{lesson_id}/exercise-stats", headers=headers)
    assert r.status_code == 200, r.text
    stats = {s["exercise_id"]: s for s in r.json()}
    assert stats[exercise_id]["attempts"] == 0
    assert stats[exercise_id]["first_attempts"] == 0
    assert stats[exercise_id]["fail_rate_pct"] is None


def test_fail_rate_computed_from_first_attempts_only(client, db_conn, make_user):
    headers = _cms_headers(db_conn)
    lesson_id, exercise_id = _make_lesson_with_exercise(db_conn)

    # 3 users get it wrong on the first try, 1 gets it right.
    for _ in range(3):
        uid, _h = make_user()
        _log_attempt(db_conn, uid, lesson_id, exercise_id, 1, False)
    uid, _h = make_user()
    _log_attempt(db_conn, uid, lesson_id, exercise_id, 1, True)

    # One of the failing users retries and gets it right — attempt_no=2,
    # must NOT count toward the first-attempt fail rate.
    _log_attempt(db_conn, uid, lesson_id, exercise_id, 2, True)

    r = client.get(f"/cms/lessons/{lesson_id}/exercise-stats", headers=headers)
    assert r.status_code == 200, r.text
    stats = {s["exercise_id"]: s for s in r.json()}
    s = stats[exercise_id]
    assert s["first_attempts"] == 4
    assert s["attempts"] == 5
    assert s["fail_rate_pct"] == 75.0


def test_perfect_first_try_zero_fail_rate(client, db_conn, make_user):
    headers = _cms_headers(db_conn)
    lesson_id, exercise_id = _make_lesson_with_exercise(db_conn)
    for _ in range(5):
        uid, _h = make_user()
        _log_attempt(db_conn, uid, lesson_id, exercise_id, 1, True)

    r = client.get(f"/cms/lessons/{lesson_id}/exercise-stats", headers=headers)
    assert r.status_code == 200, r.text
    stats = {s["exercise_id"]: s for s in r.json()}
    assert stats[exercise_id]["fail_rate_pct"] == 0.0


def test_multiple_exercises_scoped_independently(client, db_conn, make_user):
    headers = _cms_headers(db_conn)
    lesson_id, ex1 = _make_lesson_with_exercise(db_conn)
    ex2 = db_conn.execute(
        text(
            "INSERT INTO exercises (lesson_id, kind, prompt, config, \"order\") "
            "VALUES (:lid, 'flashcard', 'p2', '{}'::json, 2) RETURNING id"
        ),
        {"lid": lesson_id},
    ).scalar()

    uid, _h = make_user()
    _log_attempt(db_conn, uid, lesson_id, ex1, 1, False)
    _log_attempt(db_conn, uid, lesson_id, ex2, 1, True)

    r = client.get(f"/cms/lessons/{lesson_id}/exercise-stats", headers=headers)
    assert r.status_code == 200, r.text
    stats = {s["exercise_id"]: s for s in r.json()}
    assert stats[ex1]["fail_rate_pct"] == 100.0
    assert stats[ex2]["fail_rate_pct"] == 0.0
