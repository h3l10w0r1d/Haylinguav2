# backend/tests/test_automations_by_user.py — the "Automations" tab on the
# CMS Support page's per-learner history, exercised end-to-end against the
# real FastAPI app and live test DB.
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
            VALUES ('pytest-by-user@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
        """)
    ).mappings().first()
    token = routes_mod._cms_jwt_encode({"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30)
    return {"Authorization": f"Bearer {token}"}


def _make_campaign(db_conn, name="pytest by-user campaign"):
    steps = [{"type": "action", "action": "grant_bonus", "params": {"kind": "gems", "amount": 1, "notify_inapp": False, "notify_email": False, "message": ""}}]
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES (:n, 'active', 'event', :tc, :steps, 'allow')
            RETURNING id
        """),
        {"n": name, "tc": json.dumps({"event_type": "pytest_by_user_evt", "filters": []}), "steps": json.dumps(steps)},
    ).mappings().first()
    return row["id"]


def test_enroll_then_by_user_then_exit(client, db_conn, make_user):
    headers = _cms_headers(db_conn)
    campaign_id = _make_campaign(db_conn)
    try:
        uid, _ = make_user()

        r = client.post(f"/cms/automations/{campaign_id}/test-run", json={"user_id": uid, "force": True}, headers=headers)
        assert r.status_code == 200

        r2 = client.get(f"/cms/automations/enrollments/by-user/{uid}", headers=headers)
        assert r2.status_code == 200
        rows = r2.json()["enrollments"]
        assert len(rows) == 1
        row = rows[0]
        assert row["campaign_id"] == campaign_id
        assert row["campaign_name"] == "pytest by-user campaign"
        assert row["send_count"] == 1  # the grant_bonus action fired
        assert row["status"] == "completed"  # single-action campaign finishes immediately

        # completed enrollments can't be "exited" via the manual-remove endpoint
        r3 = client.post(f"/cms/automations/enrollments/{row['enrollment_id']}/exit", headers=headers)
        assert r3.status_code == 404
        print("OK — enroll via test-run shows up in by-user history; can't exit an already-completed enrollment")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_exit_an_active_enrollment(client, db_conn, make_user):
    headers = _cms_headers(db_conn)
    # a wait step keeps the enrollment 'waiting' so we have something removable
    steps = [{"type": "wait", "duration_hours": 24}]
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest exit campaign', 'active', 'event', :tc, :steps, 'allow')
            RETURNING id
        """),
        {"tc": json.dumps({"event_type": "pytest_exit_evt", "filters": []}), "steps": json.dumps(steps)},
    ).mappings().first()
    campaign_id = row["id"]
    try:
        uid, _ = make_user()
        client.post(f"/cms/automations/{campaign_id}/test-run", json={"user_id": uid, "force": True}, headers=headers)

        before = client.get(f"/cms/automations/enrollments/by-user/{uid}", headers=headers).json()["enrollments"][0]
        assert before["status"] == "waiting"
        assert before["exit_reason"] is None

        r = client.post(f"/cms/automations/enrollments/{before['enrollment_id']}/exit", headers=headers)
        assert r.status_code == 200

        after = client.get(f"/cms/automations/enrollments/by-user/{uid}", headers=headers).json()["enrollments"][0]
        assert after["status"] == "exited"
        assert after["exit_reason"] == "manual_removed"
        assert after["waiting_step_path"] is None
        print("OK — manually removing a waiting enrollment sets status/exit_reason correctly")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
