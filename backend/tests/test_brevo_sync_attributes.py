# backend/tests/test_brevo_sync_attributes.py
"""Two field-name mismatches and a type mismatch meant _brevo_sync_user's
payload silently never populated three real Brevo contact attributes:

- sent "TOTP_ENABLED" but Brevo's attribute is named TWO_FA_ENABLED
- sent "JOINED_AT" but Brevo's attribute is named REGISTERED_AT
- sent EMAIL_VERIFIED as a Python bool, but Brevo's EMAIL_VERIFIED attribute
  is date-typed — the API silently coerced it to 1970-01-01 instead of
  erroring, so it looked "synced" but showed garbage.

Also: POST /login (email/password — the primary signup path) never called
_brevo_sync_user or updated last_active_at at all, unlike the OAuth login
handlers — so a password-login user's Brevo data froze at signup and their
activity timestamp stayed permanently empty. No test caught any of this
because nothing exercised the actual outgoing attributes dict."""
from sqlalchemy import text


def test_login_syncs_to_brevo_and_updates_last_active_at(client, db_conn, make_user, monkeypatch):
    import routes as routes_mod

    user_id, _ = make_user(password="testpass123")
    email = db_conn.execute(text("SELECT email FROM users WHERE id = :u"), {"u": user_id}).scalar()

    captured = {}

    def fake_upsert(*, email, attributes):
        captured["email"] = email
        captured["attributes"] = attributes

    monkeypatch.setattr(routes_mod, "_brevo_upsert_contact", fake_upsert)

    r = client.post("/login", json={"email": email, "password": "testpass123"})
    assert r.status_code == 200, r.text

    assert captured.get("email") == email, "POST /login must sync the user to Brevo (only OAuth logins did before)"

    row = db_conn.execute(text("SELECT last_active_at FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row["last_active_at"] is not None, "POST /login must update last_active_at like the OAuth login paths do"


def test_brevo_attributes_use_the_real_attribute_names(client, db_conn, make_user, monkeypatch):
    import routes as routes_mod

    # totp_enabled stays FALSE here (a TRUE value would gate /login behind an
    # OTP this test doesn't provide) — the point is the attribute *key name*
    # Brevo receives, not the boolean's value.
    user_id, headers = make_user(password="testpass123")
    db_conn.execute(
        text("UPDATE users SET email_verified_at = NOW() WHERE id = :u"),
        {"u": user_id},
    )
    email = db_conn.execute(text("SELECT email FROM users WHERE id = :u"), {"u": user_id}).scalar()

    captured = {}

    def fake_upsert(*, email, attributes):
        captured["attributes"] = attributes

    monkeypatch.setattr(routes_mod, "_brevo_upsert_contact", fake_upsert)

    r = client.post("/login", json={"email": email, "password": "testpass123"})
    assert r.status_code == 200, r.text

    attrs = captured["attributes"]
    assert "TWO_FA_ENABLED" in attrs and attrs["TWO_FA_ENABLED"] is False, (
        "must send the TOTP flag under Brevo's actual attribute name TWO_FA_ENABLED"
    )
    assert "TOTP_ENABLED" not in attrs, "the old, wrong key name must not be sent"

    assert "REGISTERED_AT" in attrs and attrs["REGISTERED_AT"], (
        "must send the signup date under Brevo's actual attribute name REGISTERED_AT"
    )
    assert "JOINED_AT" not in attrs, "the old, wrong key name must not be sent"

    assert isinstance(attrs.get("EMAIL_VERIFIED"), str), (
        "EMAIL_VERIFIED is a date-typed Brevo attribute — must send an ISO date string, "
        f"not a bool (got {attrs.get('EMAIL_VERIFIED')!r})"
    )
