# backend/tests/test_automations_manual_trigger.py — one-off broadcast
# ("manual" trigger_type), exercised end-to-end against the real FastAPI
# app and live test DB. The most important test here is the "invisible to
# every existing auto-enrollment path" regression guard — the entire
# safety argument for adding a third trigger_type rests on it.
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
import automations


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text("""
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-manual-trigger@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
        """)
    ).mappings().first()
    token = routes_mod._cms_jwt_encode({"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30)
    return {"Authorization": f"Bearer {token}"}


def _make_segment(db_conn, min_gems):
    row = db_conn.execute(
        text("""
            INSERT INTO automation_segments (name, filters)
            VALUES ('pytest manual-trigger segment', :f)
            RETURNING id
        """),
        {"f": json.dumps({"op": "and", "rules": [{"field": "users.gems", "operator": "gte", "value": str(min_gems)}]})},
    ).mappings().first()
    return row["id"]


def _make_manual_campaign(db_conn, segment_id, status="active"):
    steps = [{"type": "action", "action": "grant_bonus", "params": {"kind": "gems", "amount": 1, "notify_inapp": False, "notify_email": False, "message": ""}}]
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest manual-trigger campaign', :status, 'manual', :tc, :steps, 'skip')
            RETURNING id
        """),
        {"status": status, "tc": json.dumps({"segment_id": segment_id}), "steps": json.dumps(steps)},
    ).mappings().first()
    return row["id"]


def test_validate_campaign_accepts_manual_trigger_type():
    automations.validate_campaign("manual", {"segment_id": 1}, [])
    try:
        automations.validate_campaign("manual", {}, [])
        raise AssertionError("should have required segment_id")
    except ValueError as e:
        assert "segment_id" in str(e)
    print("OK — manual trigger_type validates like segment (requires segment_id)")


def test_send_now_enrolls_only_matching_users_once_and_archives(client, db_conn, make_user):
    headers = _cms_headers(db_conn)
    segment_id = _make_segment(db_conn, min_gems=100)
    campaign_id = _make_manual_campaign(db_conn, segment_id)
    try:
        matching = [make_user(gems=150)[0] for _ in range(3)]
        non_matching = [make_user(gems=0)[0] for _ in range(2)]

        r = client.post(f"/cms/automations/{campaign_id}/send-now", headers=headers)
        assert r.status_code == 200
        assert r.json()["sent"] == 3

        for uid in matching:
            row = db_conn.execute(text("SELECT status FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"), {"c": campaign_id, "u": uid}).mappings().first()
            assert row is not None, f"user {uid} should have been enrolled"
        for uid in non_matching:
            row = db_conn.execute(text("SELECT 1 FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"), {"c": campaign_id, "u": uid}).first()
            assert row is None, f"user {uid} should NOT have been enrolled (doesn't match segment)"

        campaign = db_conn.execute(text("SELECT status FROM automation_campaigns WHERE id = :id"), {"id": campaign_id}).mappings().first()
        assert campaign["status"] == "archived"
        print("OK — send-now enrolls only segment-matching users, archives the campaign afterward")

        # a second click must not double-send / must be rejected since the campaign is no longer active
        r2 = client.post(f"/cms/automations/{campaign_id}/send-now", headers=headers)
        assert r2.status_code == 400
        print("OK — sending an already-archived campaign again is rejected")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
        db_conn.execute(text("DELETE FROM automation_segments WHERE id = :s"), {"s": segment_id})


def test_manual_campaign_is_invisible_to_event_and_segment_auto_enrollment(db_conn, make_user):
    """The load-bearing regression test: an active 'manual' campaign must
    NEVER be picked up by check_and_enroll or check_segment_triggers,
    even though it targets a segment exactly like a real 'segment'
    campaign would. If this ever breaks, a "Send now" campaign would
    silently start auto-enrolling people via the cron-driven segment scan,
    defeating the entire point of it being a one-off."""
    segment_id = _make_segment(db_conn, min_gems=0)  # matches everyone
    campaign_id = _make_manual_campaign(db_conn, segment_id, status="active")
    try:
        uid, _ = make_user(gems=999)

        # a real event firing must not enroll anyone into the manual campaign
        automations.check_and_enroll(db_conn, uid, "signup", {})
        row = db_conn.execute(text("SELECT 1 FROM automation_enrollments WHERE campaign_id = :c"), {"c": campaign_id}).first()
        assert row is None, "check_and_enroll must never touch a manual-trigger campaign"

        # the segment-entry cron scan must not enroll anyone into the manual campaign either
        automations.check_segment_triggers(db_conn)
        row2 = db_conn.execute(text("SELECT 1 FROM automation_enrollments WHERE campaign_id = :c"), {"c": campaign_id}).first()
        assert row2 is None, "check_segment_triggers must never touch a manual-trigger campaign"

        print("OK — manual campaign is completely inert to check_and_enroll and check_segment_triggers")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
        db_conn.execute(text("DELETE FROM automation_segment_membership WHERE campaign_id = :c"), {"c": campaign_id})
        db_conn.execute(text("DELETE FROM automation_segments WHERE id = :s"), {"s": segment_id})
