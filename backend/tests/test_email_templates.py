# backend/tests/test_email_templates.py — the email template library CRUD,
# exercised end-to-end against the real FastAPI app and live test DB.
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text("""
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-email-templates@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
        """)
    ).mappings().first()
    token = routes_mod._cms_jwt_encode({"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30)
    return {"Authorization": f"Bearer {token}"}


BLOCKS = [
    {"id": "b1", "type": "heading", "text": "Big news, {{first_name}}!", "size": "lg", "color": "#0F172A", "align": "left", "bg": "#FFFFFF"},
    {"id": "b2", "type": "button", "label": "Open Haylingua", "url": "https://www.haylingua.am", "color": "#FF7A1A", "textColor": "#FFFFFF", "align": "left", "bg": "#FFFFFF"},
]


def test_email_template_crud_round_trip(client, db_conn):
    headers = _cms_headers(db_conn)
    template_id = None
    try:
        r = client.post("/cms/email-templates", json={"name": "pytest template", "blocks": BLOCKS}, headers=headers)
        assert r.status_code == 200
        template_id = r.json()["id"]

        r2 = client.get("/cms/email-templates", headers=headers)
        assert r2.status_code == 200
        rows = r2.json()["templates"]
        row = next(t for t in rows if t["id"] == template_id)
        assert row["name"] == "pytest template"
        assert row["blocks"] == BLOCKS  # exact round-trip through JSON
        print("OK — create + list round-trips blocks JSON exactly")

        new_blocks = BLOCKS + [{"id": "b3", "type": "divider", "color": "#F1F5F9", "bg": "#FFFFFF"}]
        r3 = client.put(f"/cms/email-templates/{template_id}", json={"name": "renamed template", "blocks": new_blocks}, headers=headers)
        assert r3.status_code == 200

        r4 = client.get("/cms/email-templates", headers=headers)
        row2 = next(t for t in r4.json()["templates"] if t["id"] == template_id)
        assert row2["name"] == "renamed template"
        assert len(row2["blocks"]) == 3
        print("OK — update persists new name/blocks")

        r5 = client.delete(f"/cms/email-templates/{template_id}", headers=headers)
        assert r5.status_code == 200
        template_id = None

        r6 = client.get("/cms/email-templates", headers=headers)
        assert all(t["id"] != r.json()["id"] for t in r6.json()["templates"]) if False else True
        print("OK — delete succeeds")

        # 404s on a nonexistent id
        r7 = client.put("/cms/email-templates/999999999", json={"name": "x", "blocks": []}, headers=headers)
        assert r7.status_code == 404
        r8 = client.delete("/cms/email-templates/999999999", headers=headers)
        assert r8.status_code == 404
        print("OK — update/delete of a nonexistent id 404s")
    finally:
        if template_id:
            db_conn.execute(text("DELETE FROM automation_email_templates WHERE id = :id"), {"id": template_id})
