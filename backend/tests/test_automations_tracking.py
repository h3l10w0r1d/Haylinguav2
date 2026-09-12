# backend/tests/test_automations_tracking.py — open/click tracking + the
# step-stats/analytics endpoints, exercised end-to-end against the real
# FastAPI app and live test DB.
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
            VALUES ('pytest-automation-tracking@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
        """)
    ).mappings().first()
    token = routes_mod._cms_jwt_encode({"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30)
    return {"Authorization": f"Bearer {token}"}


def _make_email_campaign(db_conn, event_type):
    steps = [{
        "type": "action",
        "action": "send_email",
        "params": {
            "subject": "Hi",
            "body": "plain",
            "html_body": '<div><a href="https://haylingua.am/lessons/1">Go</a></div>',
        },
    }]
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest tracking campaign', 'active', 'event', :tc, :steps, 'allow')
            RETURNING id
        """),
        {"tc": json.dumps({"event_type": event_type, "filters": []}), "steps": json.dumps(steps)},
    ).mappings().first()
    return row["id"]


def test_send_email_generates_tracking_token(db_conn, make_user):
    event_type = "pytest_tracking_token"
    campaign_id = _make_email_campaign(db_conn, event_type)
    try:
        uid, _ = make_user()
        automations.check_and_enroll(db_conn, uid, event_type, {})
        send = db_conn.execute(
            text("SELECT tracking_token FROM automation_sends WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().first()
        assert send is not None
        assert send["tracking_token"], "send_email should always generate a tracking_token"
        print("OK — send_email generates a tracking_token")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_open_and_click_tracking_endpoints(client, db_conn, make_user):
    event_type = "pytest_tracking_pixel"
    campaign_id = _make_email_campaign(db_conn, event_type)
    try:
        uid, _ = make_user()
        automations.check_and_enroll(db_conn, uid, event_type, {})
        send = db_conn.execute(
            text("SELECT id, tracking_token FROM automation_sends WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().first()
        token = send["tracking_token"]

        # open pixel
        r = client.get(f"/t/o/{token}.png")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        row = db_conn.execute(text("SELECT opened_at, open_count FROM automation_sends WHERE id = :id"), {"id": send["id"]}).mappings().first()
        assert row["opened_at"] is not None
        assert row["open_count"] == 1

        # hit it again — open_count increments, opened_at stays the first timestamp
        client.get(f"/t/o/{token}.png")
        row2 = db_conn.execute(text("SELECT opened_at, open_count FROM automation_sends WHERE id = :id"), {"id": send["id"]}).mappings().first()
        assert row2["open_count"] == 2
        assert row2["opened_at"] == row["opened_at"]
        print("OK — open pixel updates opened_at/open_count, opened_at doesn't move on repeat")

        # click redirect
        dest = "https://haylingua.am/lessons/1"
        r2 = client.get(f"/t/c/{token}", params={"u": dest}, follow_redirects=False)
        assert r2.status_code == 302
        assert r2.headers["location"] == dest
        row3 = db_conn.execute(text("SELECT clicked_at, click_count FROM automation_sends WHERE id = :id"), {"id": send["id"]}).mappings().first()
        assert row3["clicked_at"] is not None
        assert row3["click_count"] == 1
        print("OK — click redirect 302s to the real URL and updates clicked_at/click_count")

        # open-redirect guard
        r3 = client.get(f"/t/c/{token}", params={"u": "javascript:alert(1)"}, follow_redirects=False)
        assert r3.status_code == 400
        print("OK — non-http(s) redirect target rejected with 400")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_step_stats_and_analytics_endpoints(client, db_conn, make_user):
    event_type = "pytest_tracking_stats"
    campaign_id = _make_email_campaign(db_conn, event_type)
    try:
        headers = _cms_headers(db_conn)
        u1, _ = make_user()
        u2, _ = make_user()
        automations.check_and_enroll(db_conn, u1, event_type, {})
        automations.check_and_enroll(db_conn, u2, event_type, {})

        send = db_conn.execute(
            text("SELECT tracking_token FROM automation_sends WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": u1},
        ).mappings().first()
        client.get(f"/t/o/{send['tracking_token']}.png")

        stats = client.get(f"/cms/automations/{campaign_id}/step-stats", headers=headers)
        assert stats.status_code == 200
        body = stats.json()
        assert body["0"]["reached"] == 2
        assert body["0"]["opened"] == 1
        assert body["0"]["clicked"] == 0
        print("OK — step-stats reports reached/opened/clicked keyed by backend dotted path")

        analytics = client.get(f"/cms/automations/{campaign_id}/analytics", headers=headers)
        assert analytics.status_code == 200
        abody = analytics.json()
        assert abody["enrollments"]["total"] == 2
        assert abody["enrollments"]["completed"] == 2
        assert abody["email"]["sent"] == 2
        assert abody["email"]["opened"] == 1
        print("OK — analytics endpoint reports correct enrollment/email aggregates")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
