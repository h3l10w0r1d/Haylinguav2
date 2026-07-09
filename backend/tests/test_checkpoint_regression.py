# backend/tests/test_checkpoint_regression.py
"""Regression test for the production incident fixed in commit 8ad6b37:
GET /me/checkpoint crashed with the same SQLAlchemy ':name::type' bind-
parameter ambiguity whenever it needed to supplement with unattempted
exercises — i.e. most real checkpoint runs, since a fresh user has no
attempts and the query always executes with an empty :tried list."""
from sqlalchemy import text


def test_checkpoint_returns_exercises_for_a_fresh_user(client, db_conn, make_user):
    user_id, headers = make_user()

    lesson_id = db_conn.execute(
        text(
            """
            INSERT INTO lessons (slug, title, level, xp)
            VALUES (:slug, 'Pytest Checkpoint Lesson', 1, 10)
            RETURNING id
            """
        ),
        {"slug": f"pytest-checkpoint-{user_id}"},
    ).scalar()

    for i in range(3):
        db_conn.execute(
            text(
                """
                INSERT INTO exercises (lesson_id, kind, prompt, "order", config)
                VALUES (:lid, 'fill_blank', :prompt, :ord, '{}')
                """
            ),
            {"lid": lesson_id, "prompt": f"Prompt {i}", "ord": i + 1},
        )

    # A fresh user has zero attempts, so ex_ids starts empty and the endpoint
    # must take the "supplement with unattempted exercises" branch — the
    # exact code path that used to crash.
    r = client.get(f"/me/checkpoint?lesson_ids={lesson_id}&count=5", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body.get("exercises", [])) == 3
