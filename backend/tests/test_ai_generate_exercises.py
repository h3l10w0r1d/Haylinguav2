# backend/tests/test_ai_generate_exercises.py
"""AI-assisted exercise generation: POST /cms/ai/generate-exercises calls
GPT-4o (mocked here — no live API key in CI), validates the returned JSON
against each kind's known config shape, and drops anything malformed
rather than surfacing something the editor/renderer can't handle."""
import json

import httpx
from sqlalchemy import text


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-ai-gen@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


class _FakeResponse:
    def __init__(self, status_code, content):
        self.status_code = status_code
        self._content = content

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


def _mock_openai(monkeypatch, content_obj, status_code=200):
    def fake_post(url, headers=None, json=None, timeout=None, **kwargs):
        assert "chat/completions" in url
        return _FakeResponse(status_code, __import__("json").dumps(content_obj))

    monkeypatch.setattr(httpx, "post", fake_post)


def test_requires_cms_auth(client):
    r = client.post("/cms/ai/generate-exercises", json={"topic": "greetings"})
    assert r.status_code == 401


def test_not_configured_without_api_key(client, db_conn, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "")
    headers = _cms_headers(db_conn)
    r = client.post("/cms/ai/generate-exercises", json={"topic": "greetings"}, headers=headers)
    assert r.status_code == 503


def test_topic_required(client, db_conn, monkeypatch):
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "fake-key")
    headers = _cms_headers(db_conn)
    r = client.post("/cms/ai/generate-exercises", json={"topic": "  "}, headers=headers)
    assert r.status_code == 400


def test_valid_response_returns_validated_exercises(client, db_conn, monkeypatch):
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "fake-key")
    headers = _cms_headers(db_conn)

    _mock_openai(monkeypatch, {
        "exercises": [
            {
                "kind": "translate_mcq",
                "prompt": "Translate this sentence",
                "xp": 10,
                "config": {"sentence": "Hello", "choices": ["Բարև", "Ցտեսություն", "Շնորհակալություն", "Խնդրում եմ"], "answerIndex": 0},
            },
            {
                "kind": "flashcard",
                "prompt": "Learn this word",
                "xp": 5,
                "config": {"front": "Բարև", "back": "Hello"},
            },
        ]
    })

    r = client.post("/cms/ai/generate-exercises", json={"topic": "greetings", "count": 5}, headers=headers)
    assert r.status_code == 200, r.text
    exercises = r.json()["exercises"]
    assert len(exercises) == 2
    kinds = {e["kind"] for e in exercises}
    assert kinds == {"translate_mcq", "flashcard"}
    for e in exercises:
        assert e["expected_answer"] is None
        assert isinstance(e["config"], dict)


def test_malformed_exercises_are_dropped_not_surfaced(client, db_conn, monkeypatch):
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "fake-key")
    headers = _cms_headers(db_conn)

    _mock_openai(monkeypatch, {
        "exercises": [
            # Valid
            {"kind": "true_false", "prompt": "True or false?", "config": {"statement": "Բարև means hello", "correct": True}},
            # Missing required field -> dropped
            {"kind": "true_false", "prompt": "Bad one", "config": {"statement": "no correct field"}},
            # Unknown kind -> dropped
            {"kind": "speak_line", "prompt": "Say it", "config": {}},
            # answerIndex out of range -> dropped
            {"kind": "translate_mcq", "prompt": "x", "config": {"sentence": "Hi", "choices": ["a", "b"], "answerIndex": 5}},
        ]
    })

    r = client.post("/cms/ai/generate-exercises", json={"topic": "test", "count": 10}, headers=headers)
    assert r.status_code == 200, r.text
    exercises = r.json()["exercises"]
    assert len(exercises) == 1
    assert exercises[0]["kind"] == "true_false"


def test_all_exercises_malformed_returns_502(client, db_conn, monkeypatch):
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "fake-key")
    headers = _cms_headers(db_conn)

    _mock_openai(monkeypatch, {"exercises": [{"kind": "unknown_kind", "config": {}}]})

    r = client.post("/cms/ai/generate-exercises", json={"topic": "test"}, headers=headers)
    assert r.status_code == 502


def test_malformed_json_from_model_returns_502(client, db_conn, monkeypatch):
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "fake-key")
    headers = _cms_headers(db_conn)

    def fake_post(url, headers=None, json=None, timeout=None, **kwargs):
        return _FakeResponse(200, "not valid json{{{")

    monkeypatch.setattr(httpx, "post", fake_post)

    r = client.post("/cms/ai/generate-exercises", json={"topic": "test"}, headers=headers)
    assert r.status_code == 502


def test_kinds_filter_restricts_output(client, db_conn, monkeypatch):
    import routes as routes_mod
    monkeypatch.setattr(routes_mod, "_EXPLAIN_OPENAI_KEY", "fake-key")
    headers = _cms_headers(db_conn)

    _mock_openai(monkeypatch, {
        "exercises": [
            {"kind": "flashcard", "prompt": "p", "config": {"front": "Բարև", "back": "Hello"}},
            {"kind": "true_false", "prompt": "p", "config": {"statement": "x", "correct": True}},
        ]
    })

    r = client.post(
        "/cms/ai/generate-exercises",
        json={"topic": "greetings", "kinds": ["flashcard"], "count": 5},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    exercises = r.json()["exercises"]
    assert all(e["kind"] == "flashcard" for e in exercises)
