# backend/tests/test_achievement_shop_draft_default.py
"""New achievements/shop items default to inactive (draft) on create —
same reasoning as the lessons/chapters staging fix: don't surface a
half-configured item to real users the moment it's created."""
import uuid

from sqlalchemy import text


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-draft-default@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def test_new_achievement_defaults_to_inactive(client, db_conn):
    headers = _cms_headers(db_conn)
    r = client.post(
        "/cms/achievements",
        json={"title": f"Draft-default test achievement {uuid.uuid4().hex[:8]}", "metric": "lessons_completed", "threshold": 5},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    row = db_conn.execute(text("SELECT is_active FROM achievement_defs WHERE id = :id"), {"id": r.json()["id"]}).mappings().first()
    assert row["is_active"] is False


def test_achievement_can_still_be_created_active_explicitly(client, db_conn):
    headers = _cms_headers(db_conn)
    r = client.post(
        "/cms/achievements",
        json={"title": f"Explicit-active test achievement {uuid.uuid4().hex[:8]}", "metric": "streak_days", "threshold": 3, "is_active": True},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    row = db_conn.execute(text("SELECT is_active FROM achievement_defs WHERE id = :id"), {"id": r.json()["id"]}).mappings().first()
    assert row["is_active"] is True


def test_new_shop_item_defaults_to_inactive(client, db_conn):
    headers = _cms_headers(db_conn)
    r = client.post(
        "/cms/shop/items",
        json={"title": f"Draft-default test item {uuid.uuid4().hex[:8]}", "effect": "streak_freeze", "price": 10},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    row = db_conn.execute(text("SELECT is_active FROM shop_items WHERE id = :id"), {"id": r.json()["id"]}).mappings().first()
    assert row["is_active"] is False


def test_shop_item_can_still_be_created_active_explicitly(client, db_conn):
    headers = _cms_headers(db_conn)
    r = client.post(
        "/cms/shop/items",
        json={"title": f"Explicit-active test item {uuid.uuid4().hex[:8]}", "effect": "streak_freeze", "price": 10, "is_active": True},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    row = db_conn.execute(text("SELECT is_active FROM shop_items WHERE id = :id"), {"id": r.json()["id"]}).mappings().first()
    assert row["is_active"] is True
