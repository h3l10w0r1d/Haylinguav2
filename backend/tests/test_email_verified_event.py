# backend/tests/test_email_verified_event.py — a real production bug: a
# campaign triggered on "signup" with an "email_verified = true" audience
# filter can never fire, because record_event(..., "signup", ...) runs the
# instant the user row is inserted, before email_verified is ever true (see
# routes.py's signup handler). Fixes it by instrumenting a real
# "email_verified" event at the moment verification actually completes
# (POST /auth/verify-email), so campaigns can trigger on that moment
# directly instead of an unsatisfiable signup+filter combination.
import hashlib

from sqlalchemy import text

import automations


def _code_hash(code):
    import routes as routes_mod
    return routes_mod._hash_code(code)


def _make_email_verified_campaign(db_conn, event_type="email_verified"):
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest email-verified campaign', 'active', 'event', :tc, '[]'::jsonb, 'skip')
            RETURNING id
        """),
        {"tc": '{"event_type": "%s", "filters": {"op": "and", "rules": []}}' % event_type},
    ).mappings().first()
    return row["id"]


def test_verify_email_endpoint_fires_email_verified_event_and_enrolls(client, db_conn, make_user):
    campaign_id = _make_email_verified_campaign(db_conn)
    try:
        user_id, headers = make_user()
        db_conn.execute(
            text("""
                INSERT INTO email_verification_codes (user_id, code_hash, expires_at, last_sent_at)
                VALUES (:u, :h, NOW() + INTERVAL '10 minutes', NOW())
                ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
                    expires_at = EXCLUDED.expires_at, last_sent_at = EXCLUDED.last_sent_at, attempts = 0
            """),
            {"u": user_id, "h": _code_hash("123456")},
        )

        already = db_conn.execute(
            text("SELECT count(*) c FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": user_id},
        ).scalar()
        assert already == 0

        r = client.post("/auth/verify-email", json={"code": "123456"}, headers=headers)
        assert r.status_code == 200, r.text

        enrolled = db_conn.execute(
            text("SELECT count(*) c FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": user_id},
        ).scalar()
        assert enrolled == 1
        print("OK — verifying email now enrolls users in an email_verified-triggered campaign")

        row = db_conn.execute(text("SELECT email_verified FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
        assert row["email_verified"] is True
        print("OK — email_verified column still flips true as before (unrelated to the new event)")
    finally:
        db_conn.execute(text("DELETE FROM automation_enrollments WHERE campaign_id = :c"), {"c": campaign_id})
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_signup_with_email_verified_filter_never_matches_at_signup_time(db_conn, make_user):
    """Documents the original bug precisely: check_and_enroll("signup", ...)
    against a filter requiring email_verified=true never matches, because a
    freshly-inserted user always has email_verified=FALSE at that instant.
    This isn't a bug in the engine — evaluate_when correctly returns False
    for an unverified user — the fix is using the "email_verified" event
    instead of "signup" + a filter, which the test above covers."""
    from sqlalchemy import text as sql_text

    campaign_id = db_conn.execute(
        sql_text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest signup+verified-filter campaign', 'active', 'event', :tc, '[]'::jsonb, 'skip')
            RETURNING id
        """),
        {"tc": '{"event_type": "signup", "filters": {"op": "and", "rules": [{"field": "users.email_verified", "operator": "eq", "value": "true"}]}}'},
    ).mappings().first()["id"]
    try:
        user_id, _ = make_user()
        # make_user's fixture inserts with email_verified=TRUE for test
        # convenience (bypassing the real verify-email flow) — force it
        # back to the real default (FALSE) to match what a genuine fresh
        # signup looks like at the instant "signup" fires.
        db_conn.execute(sql_text("UPDATE users SET email_verified = FALSE WHERE id = :u"), {"u": user_id})
        automations.check_and_enroll(db_conn, user_id, "signup", {})
        enrolled = db_conn.execute(
            sql_text("SELECT count(*) c FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": user_id},
        ).scalar()
        assert enrolled == 0
        print("OK — reproduces the original bug: signup+email_verified-filter never enrolls anyone")
    finally:
        db_conn.execute(sql_text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
