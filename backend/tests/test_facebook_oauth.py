# backend/tests/test_facebook_oauth.py
"""Facebook OAuth login/link, mirroring the shape of /auth/google.

Exercises the real HTTP endpoints against a real Postgres, with Facebook's
Graph API calls monkeypatched (no live Facebook credentials in CI)."""
import httpx
import pytest
from sqlalchemy import text


class _FakeResponse:
    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json


def _mock_facebook(monkeypatch, *, fb_id="fb_12345", email="fbuser@example.test", name="FB User"):
    def fake_get(url, params=None, timeout=None, **kwargs):
        if "oauth/access_token" in url:
            return _FakeResponse(200, {"access_token": "fake-fb-access-token"})
        if url.endswith("graph.facebook.com/me"):
            return _FakeResponse(200, {"id": fb_id, "name": name, "email": email, "picture": {"data": {"url": "https://example.test/pic.jpg"}}})
        raise AssertionError(f"unexpected URL: {url}")

    monkeypatch.setattr(httpx, "get", fake_get)


def test_auth_facebook_not_configured(client, monkeypatch):
    monkeypatch.delenv("FACEBOOK_APP_ID", raising=False)
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    r = client.post("/auth/facebook", json={"code": "irrelevant"})
    assert r.status_code == 503


def test_auth_facebook_missing_code(client, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test-app-id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test-app-secret")
    r = client.post("/auth/facebook", json={})
    assert r.status_code == 400


def test_auth_facebook_creates_new_user(client, db_conn, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test-app-id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test-app-secret")
    _mock_facebook(monkeypatch, fb_id="fb_new_user", email="brandnew@example.test")

    r = client.post("/auth/facebook", json={"code": "abc123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "brandnew@example.test"
    assert data["access_token"]
    assert data["needs_onboarding"] is True

    row = db_conn.execute(
        text("SELECT facebook_id, oauth_provider, email_verified FROM users WHERE id = :id"),
        {"id": data["id"]},
    ).mappings().first()
    assert row["facebook_id"] == "fb_new_user"
    assert row["oauth_provider"] == "facebook"
    assert row["email_verified"] is True

    db_conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": data["id"]})


def test_auth_facebook_existing_facebook_id_logs_in(client, db_conn, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test-app-id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test-app-secret")
    _mock_facebook(monkeypatch, fb_id="fb_repeat_login", email="repeat@example.test")

    r1 = client.post("/auth/facebook", json={"code": "abc123"})
    assert r1.status_code == 200, r1.text
    user_id = r1.json()["id"]

    r2 = client.post("/auth/facebook", json={"code": "xyz789"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["id"] == user_id

    db_conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})


def test_auth_facebook_links_by_matching_email(client, db_conn, make_user, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test-app-id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test-app-secret")

    user_id, _headers = make_user(email="linkme@example.test")
    _mock_facebook(monkeypatch, fb_id="fb_link_target", email="linkme@example.test")

    r = client.post("/auth/facebook", json={"code": "abc123"})
    assert r.status_code == 200, r.text
    assert r.json()["id"] == user_id

    row = db_conn.execute(text("SELECT facebook_id FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row["facebook_id"] == "fb_link_target"


def test_me_link_facebook_requires_auth(client):
    r = client.post("/me/link/facebook", json={"code": "abc"})
    assert r.status_code == 401


def test_me_link_and_unlink_facebook(client, db_conn, make_user, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test-app-id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test-app-secret")
    user_id, headers = make_user()
    _mock_facebook(monkeypatch, fb_id="fb_linked_acct")

    r = client.post("/me/link/facebook", json={"code": "abc123"}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["facebook_linked"] is True

    row = db_conn.execute(text("SELECT facebook_id FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row["facebook_id"] == "fb_linked_acct"

    me = client.get("/me/profile", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["facebook_linked"] is True

    r2 = client.delete("/me/link/facebook", headers=headers)
    assert r2.status_code == 200, r2.text

    row2 = db_conn.execute(text("SELECT facebook_id FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row2["facebook_id"] is None


def test_me_link_facebook_conflict_when_already_linked_elsewhere(client, db_conn, make_user, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test-app-id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test-app-secret")

    _owner_id, owner_headers = make_user()
    _mock_facebook(monkeypatch, fb_id="fb_taken")
    r1 = client.post("/me/link/facebook", json={"code": "abc123"}, headers=owner_headers)
    assert r1.status_code == 200, r1.text

    _other_id, other_headers = make_user()
    r2 = client.post("/me/link/facebook", json={"code": "def456"}, headers=other_headers)
    assert r2.status_code == 409
