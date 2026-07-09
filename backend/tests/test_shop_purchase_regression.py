# backend/tests/test_shop_purchase_regression.py
"""Regression test for the production incident fixed in commit 8ad6b37:
SQLAlchemy's text() bind-parameter parser fails to recognize ':name' when
immediately followed by '::type' with no space, so
'UPDATE users SET owned_themes = :v::jsonb ...' silently left ':v::jsonb'
as literal SQL and crashed every theme/frame purchase with a 500.

Buys the two seeded shop items that hit this code path (see
ensure_schema.py's shop_items catalogue) through the real HTTP endpoint and
asserts both the response and the resulting DB state."""
from sqlalchemy import text


def _shop_item_id(db_conn, effect: str) -> int:
    row = db_conn.execute(
        text("SELECT id FROM shop_items WHERE effect = :e ORDER BY id LIMIT 1"),
        {"e": effect},
    ).mappings().first()
    assert row, f"no seeded shop item with effect={effect!r} — did ensure_schema() run?"
    return int(row["id"])


def test_buy_avatar_frame(client, db_conn, make_user):
    user_id, headers = make_user(gems=500)
    item_id = _shop_item_id(db_conn, "avatar_frame")

    r = client.post("/me/shop/buy", json={"item": item_id}, headers=headers)
    assert r.status_code == 200, r.text

    owned = db_conn.execute(text("SELECT owned_frames FROM users WHERE id = :u"), {"u": user_id}).scalar()
    assert owned is not None
    assert str(item_id) in [str(x) for x in owned]


def test_buy_profile_theme(client, db_conn, make_user):
    user_id, headers = make_user(gems=500)
    item_id = _shop_item_id(db_conn, "profile_theme")

    r = client.post("/me/shop/buy", json={"item": item_id}, headers=headers)
    assert r.status_code == 200, r.text

    owned = db_conn.execute(text("SELECT owned_themes FROM users WHERE id = :u"), {"u": user_id}).scalar()
    assert owned is not None
    assert str(item_id) in [str(x) for x in owned]


def test_buy_without_enough_gems_is_rejected(client, db_conn, make_user):
    user_id, headers = make_user(gems=1)
    item_id = _shop_item_id(db_conn, "avatar_frame")

    r = client.post("/me/shop/buy", json={"item": item_id}, headers=headers)
    assert r.status_code == 400
