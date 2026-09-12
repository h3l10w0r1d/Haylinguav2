# backend/tests/test_automations_split.py — A/B split branch step, exercised
# through the real engine entrypoints (automations.check_and_enroll /
# advance_enrollment) against the real test DB, not a mock. Determinism of
# the underlying bucket function itself is covered separately (pure-Python,
# no DB needed) — this file checks the split actually reaches the DB
# correctly end-to-end: every enrollee lands in exactly one branch's
# automation_sends row, the split is roughly balanced, and re-advancing the
# same enrollment doesn't re-fire or flip branches.
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
import automations


def _make_split_campaign(db_conn, event_type):
    steps = [
        {
            "type": "split",
            "branches": [
                {"weight": 50, "steps": [{"type": "action", "action": "grant_bonus", "params": {"kind": "gems", "amount": 111, "notify_inapp": False, "notify_email": False, "message": ""}}]},
                {"weight": 50, "steps": [{"type": "action", "action": "grant_bonus", "params": {"kind": "gems", "amount": 222, "notify_inapp": False, "notify_email": False, "message": ""}}]},
            ],
        }
    ]
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy)
            VALUES ('pytest split campaign', 'active', 'event', :tc, :steps, 'allow')
            RETURNING id
        """),
        {"tc": json.dumps({"event_type": event_type, "filters": []}), "steps": json.dumps(steps)},
    ).mappings().first()
    return row["id"]


def test_split_branch_enrolls_each_user_into_exactly_one_branch(db_conn, make_user):
    event_type = "pytest_split_trigger"
    campaign_id = _make_split_campaign(db_conn, event_type)
    try:
        user_ids = [make_user()[0] for _ in range(40)]
        for uid in user_ids:
            automations.check_and_enroll(db_conn, uid, event_type, {})

        rows = db_conn.execute(
            text("SELECT user_id, detail->>'amount' AS amount FROM automation_sends WHERE campaign_id = :c"),
            {"c": campaign_id},
        ).mappings().all()

        seen = {}
        for r in rows:
            seen.setdefault(r["user_id"], []).append(r["amount"])

        # every enrolled user got exactly one grant_bonus send (one branch, not both/neither)
        assert set(seen.keys()) == set(user_ids), f"missing or extra users: {set(user_ids) - set(seen.keys())}"
        for uid, amounts in seen.items():
            assert len(amounts) == 1, f"user {uid} got {len(amounts)} sends, expected exactly 1: {amounts}"

        counts = {"111": 0, "222": 0}
        for amounts in seen.values():
            counts[amounts[0]] += 1
        print("branch distribution:", counts)
        assert counts["111"] >= 12 and counts["222"] >= 12, f"split too skewed for 40 users: {counts}"
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_split_branch_resume_does_not_flip_or_refire(db_conn, make_user):
    event_type = "pytest_split_resume_trigger"
    campaign_id = _make_split_campaign(db_conn, event_type)
    try:
        uid, _ = make_user()
        automations.check_and_enroll(db_conn, uid, event_type, {})

        enrollment = db_conn.execute(
            text("SELECT id, campaign_id, user_id, status, current_step_index, resume_at, context, waiting_step_path FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().first()
        assert enrollment["status"] == "completed"

        first_send = db_conn.execute(
            text("SELECT detail->>'amount' AS amount FROM automation_sends WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().first()

        # simulate a second cron pass re-advancing the same (already-completed) enrollment
        automations.advance_enrollment(db_conn, dict(enrollment))

        sends_after = db_conn.execute(
            text("SELECT detail->>'amount' AS amount FROM automation_sends WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().all()

        assert len(sends_after) == 1, f"re-advancing re-fired the action: {sends_after}"
        assert sends_after[0]["amount"] == first_send["amount"], "branch flipped on resume"
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
