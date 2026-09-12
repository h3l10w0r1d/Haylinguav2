# backend/tests/test_automations_goal.py — campaign-level goal/exit
# condition, exercised through the real engine entrypoints against the
# live test DB. Covers: exit at enroll time (goal already met), exit at
# cron-resume time (goal met while waiting), and the "empty/absent goal
# must never match" regression guard.
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
import automations

GOAL = {"op": "and", "rules": [{"field": "users.gems", "operator": "gte", "value": "100"}]}


def _make_campaign(db_conn, event_type, goal=None, steps=None):
    steps = steps if steps is not None else [
        {"type": "wait", "duration_hours": 24},
        {"type": "action", "action": "grant_bonus", "params": {"kind": "gems", "amount": 5, "notify_inapp": False, "notify_email": False, "message": ""}},
    ]
    row = db_conn.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy, goal)
            VALUES ('pytest goal campaign', 'active', 'event', :tc, :steps, 'allow', :goal)
            RETURNING id
        """),
        {
            "tc": json.dumps({"event_type": event_type, "filters": []}),
            "steps": json.dumps(steps),
            "goal": json.dumps(goal) if goal else None,
        },
    ).mappings().first()
    return row["id"]


def test_goal_already_met_exits_immediately_without_walking(db_conn, make_user):
    event_type = "pytest_goal_immediate"
    campaign_id = _make_campaign(db_conn, event_type, goal=GOAL)
    try:
        uid, _ = make_user(gems=150)  # already satisfies gems >= 100
        automations.check_and_enroll(db_conn, uid, event_type, {})

        enrollment = db_conn.execute(
            text("SELECT status, context->>'exit_reason' AS reason FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().first()
        assert enrollment["status"] == "exited"
        assert enrollment["reason"] == "goal_met"

        sends = db_conn.execute(text("SELECT 1 FROM automation_sends WHERE campaign_id = :c AND user_id = :u"), {"c": campaign_id, "u": uid}).all()
        assert len(sends) == 0, "walk should never have run — no action should have fired"
        print("OK — goal already met at enroll time: immediate exit, zero sends")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_goal_met_during_wait_exits_on_resume(db_conn, make_user):
    event_type = "pytest_goal_resume"
    campaign_id = _make_campaign(db_conn, event_type, goal=GOAL)
    try:
        uid, _ = make_user(gems=0)  # doesn't satisfy the goal yet
        automations.check_and_enroll(db_conn, uid, event_type, {})

        enrollment = db_conn.execute(
            text("SELECT id, campaign_id, user_id, status, current_step_index, resume_at, context, waiting_step_path FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
            {"c": campaign_id, "u": uid},
        ).mappings().first()
        assert enrollment["status"] == "waiting", "should be parked on the wait step, goal not yet met"

        # user now satisfies the goal (e.g. bought something elsewhere in the app)
        db_conn.execute(text("UPDATE users SET gems = 100 WHERE id = :u"), {"u": uid})

        # simulate the cron resuming this waiting enrollment
        automations.advance_enrollment(db_conn, dict(enrollment))

        after = db_conn.execute(
            text("SELECT status, context->>'exit_reason' AS reason FROM automation_enrollments WHERE id = :id"),
            {"id": enrollment["id"]},
        ).mappings().first()
        assert after["status"] == "exited"
        assert after["reason"] == "goal_met"

        sends = db_conn.execute(text("SELECT 1 FROM automation_sends WHERE campaign_id = :c AND user_id = :u"), {"c": campaign_id, "u": uid}).all()
        assert len(sends) == 0, "resumed walk should have exited before reaching the grant_bonus action"
        print("OK — goal met while waiting: exits on cron resume instead of continuing the walk")
    finally:
        db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})


def test_empty_or_absent_goal_never_matches(db_conn, make_user):
    event_type = "pytest_goal_absent"
    # goal=None (absent) and goal={"op":"and","rules":[]} (empty) must both behave identically to no goal at all
    for goal in (None, {"op": "and", "rules": []}):
        campaign_id = _make_campaign(db_conn, event_type, goal=goal)
        try:
            uid, _ = make_user(gems=99999)  # would satisfy almost any real goal, if one were mistakenly active
            automations.check_and_enroll(db_conn, uid, event_type, {})

            enrollment = db_conn.execute(
                text("SELECT status FROM automation_enrollments WHERE campaign_id = :c AND user_id = :u"),
                {"c": campaign_id, "u": uid},
            ).mappings().first()
            assert enrollment["status"] == "waiting", f"empty/absent goal ({goal!r}) incorrectly exited the enrollment"
        finally:
            db_conn.execute(text("DELETE FROM automation_campaigns WHERE id = :c"), {"c": campaign_id})
    print("OK — empty/absent goal never matches (regression guard)")
