# backend/tests/test_email_unsubscribe.py — the compliance fix: every
# marketing/bulk email needs a working unsubscribe, and opted-out users
# must actually be skipped by the automation engine, not just linked out.
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

import email_compliance
import automations


def test_token_round_trip():
    token = email_compliance.unsubscribe_token(123)
    assert email_compliance.verify_unsubscribe_token(123, token) is True
    print("OK — valid token verifies")

    assert email_compliance.verify_unsubscribe_token(123, "not-the-token") is False
    assert email_compliance.verify_unsubscribe_token(456, token) is False  # different user, same token
    assert email_compliance.verify_unsubscribe_token(123, "") is False
    print("OK — tampered/mismatched/empty tokens are rejected")


def test_unsubscribe_endpoint_flips_the_flag(client, db_conn, make_user):
    user_id, _ = make_user()
    row = db_conn.execute(text("SELECT email_reminders_enabled FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row["email_reminders_enabled"] is True

    token = email_compliance.unsubscribe_token(user_id)
    r = client.get(f"/email/unsubscribe?u={user_id}&t={token}")
    assert r.status_code == 200
    assert "unsubscribed" in r.text.lower()

    row2 = db_conn.execute(text("SELECT email_reminders_enabled FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row2["email_reminders_enabled"] is False
    print("OK — valid unsubscribe link flips email_reminders_enabled to false")


def test_unsubscribe_endpoint_rejects_bad_token(client, db_conn, make_user):
    user_id, _ = make_user()
    r = client.get(f"/email/unsubscribe?u={user_id}&t=garbage")
    assert r.status_code == 400

    row = db_conn.execute(text("SELECT email_reminders_enabled FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    assert row["email_reminders_enabled"] is True  # untouched
    print("OK — a bad token 400s and leaves the flag untouched")


def test_action_send_email_skips_unsubscribed_user(db_conn, make_user, monkeypatch):
    user_id, _ = make_user()
    db_conn.execute(text("UPDATE users SET email_reminders_enabled = FALSE WHERE id = :u"), {"u": user_id})

    import routes
    called = []
    monkeypatch.setattr(routes, "_send_email", lambda **kw: called.append(kw) or True)

    try:
        automations._action_send_email(db_conn, user_id, {"subject": "hi", "body": "test"})
        assert False, "expected Unsubscribed to be raised"
    except automations.Unsubscribed:
        pass

    assert called == []
    print("OK — _action_send_email raises Unsubscribed and never calls _send_email")


def test_execute_action_records_skipped_not_failed_for_unsubscribed_user(db_conn, make_user):
    user_id, _ = make_user()
    db_conn.execute(text("UPDATE users SET email_reminders_enabled = FALSE WHERE id = :u"), {"u": user_id})

    campaign_id = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest unsub campaign', 'active', 'manual', :tc, :steps, 'skip')
            RETURNING id
        """),
        {"tc": json.dumps({"segment_id": None}), "steps": json.dumps([])},
    ).scalar()
    enrollment_id = db_conn.execute(
        text("""
            INSERT INTO automation_enrollments (campaign_id, user_id, status, current_step_index, context)
            VALUES (:c, :u, 'active', 0, '{}'::jsonb) RETURNING id
        """),
        {"c": campaign_id, "u": user_id},
    ).scalar()

    step = {"type": "action", "action": "send_email", "params": {"subject": "hi", "body": "test"}}
    automations.execute_action(db_conn, enrollment_id, user_id, "0", step)

    row = db_conn.execute(
        text("SELECT status, detail FROM automation_sends WHERE enrollment_id = :e"),
        {"e": enrollment_id},
    ).mappings().first()
    assert row["status"] == "skipped"
    assert row["detail"].get("reason") == "unsubscribed"
    print("OK — execute_action records status=skipped, reason=unsubscribed (not failed)")


def test_brevo_payload_includes_headers(monkeypatch):
    from integrations import brevo

    monkeypatch.setattr(brevo, "_api_key", lambda: "fake-key")
    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

    class FakeClient:
        def __init__(self, timeout=None):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
        def post(self, url, headers=None, json=None):
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(brevo.httpx, "Client", FakeClient)

    res = brevo.send_transactional_email_result(
        to_email="x@example.test", subject="hi", text="body",
        sender_email="from@haylingua.am",
        headers={"List-Unsubscribe": "<https://example.test/unsub>"},
    )
    assert res["ok"] is True
    assert captured["payload"]["headers"] == {"List-Unsubscribe": "<https://example.test/unsub>"}
    print("OK — send_transactional_email_result forwards headers into the Brevo payload")


def test_action_send_email_records_failed_when_nothing_actually_sends(db_conn, make_user, monkeypatch):
    """_send_email returns False when no Brevo/SMTP is configured — it just
    logs to the server console. That return value used to be discarded, so
    automations.execute_action's default status="sent" stood even though
    nothing was ever delivered (the real bug behind "the log says sent but
    I never got the email"). Confirms it's now correctly raised/recorded
    as failed instead."""
    import routes
    monkeypatch.setattr(routes, "_send_email", lambda **kw: False)

    user_id, _ = make_user()
    try:
        automations._action_send_email(db_conn, user_id, {"subject": "hi", "body": "test"})
        assert False, "expected a RuntimeError when _send_email returns False"
    except RuntimeError as e:
        assert "not actually sent" in str(e)
    print("OK — _action_send_email raises when _send_email reports it didn't actually send")
