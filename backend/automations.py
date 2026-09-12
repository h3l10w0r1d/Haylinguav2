# backend/automations.py — the marketing-automation engine's core logic.
# Deliberately framework-agnostic (no FastAPI imports) so it's callable from
# both request handlers (routes.py event instrumentation, routes_automations.py
# CMS endpoints) and the cron advancement endpoint, with one implementation of
# "what does a campaign do" rather than two.
#
# Scope so far (M1+M2): wait, condition (if/else-if/else), and the
# send_email action all actually execute — see advance_enrollment/_walk. A
# wait step really suspends the enrollment (status='waiting') and the cron
# entrypoint (routes_automations.py's /cron/advance-automations) resumes it
# later, re-walking the step tree from a recorded path rather than a flat
# index, since a wait nested inside a condition branch needs its full
# position to resume correctly. send_push/send_brevo/grant_bonus are
# implemented below but not yet exposed in the CMS step editor (M3) — the
# streak-break event that the flagship example needs also isn't
# instrumented yet.
from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
from typing import Any, Optional
from urllib.parse import quote

from sqlalchemy import text
from sqlalchemy.engine import Connection

MAX_STEPS_PER_ADVANCE = 200  # guards a malformed campaign that never reaches wait/end

KNOWN_ACTIONS = {"send_email", "send_push", "send_web_push", "send_brevo", "grant_bonus"}
KNOWN_OPERATORS = {"eq", "neq", "gt", "gte", "lt", "lte", "older_than_days", "in_segment"}

# field -> lambda(db, user_id, context) -> value. Whitelisted, never dynamic
# SQL — the only fields a condition/filter/segment can reference.
def _field_users_col(col):
    def get(db: Connection, user_id: int, context: dict):
        row = db.execute(text(f"SELECT {col} AS v FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
        return row["v"] if row else None
    return get


def _field_event_property(key):
    def get(db: Connection, user_id: int, context: dict):
        return (context or {}).get(key)
    return get


_FIELD_RESOLVERS = {
    "users.current_streak": _field_users_col("current_streak"),
    "users.streak_last_activity_date": _field_users_col("streak_last_activity_date"),
    "users.gems": _field_users_col("gems"),
    "users.bonus_xp": _field_users_col("bonus_xp"),
    "users.is_premium": _field_users_col("is_premium"),
    "users.last_active_at": _field_users_col("last_active_at"),
    # Added for richer CRM segmentation — same generic column-select
    # resolver as above, just more of the `users` table exposed. Each of
    # these is a plain existing column (see ensure_schema.py), never
    # user-supplied SQL — the whitelist key is what makes this safe.
    "users.joined_at": _field_users_col("joined_at"),
    "users.email_verified": _field_users_col("email_verified"),
    "users.country": _field_users_col("country"),
    "users.best_streak": _field_users_col("best_streak"),
    "users.weekly_xp": _field_users_col("weekly_xp"),
    "users.lesson_xp": _field_users_col("lesson_xp"),
    "users.chests": _field_users_col("chests"),
    "users.hearts_current": _field_users_col("hearts_current"),
    "users.league_tier": _field_users_col("league_tier"),
    "users.premium_since": _field_users_col("premium_since"),
    "users.premium_until": _field_users_col("premium_until"),
}


def _resolve_field(db: Connection, user_id: int, context: dict, field: str):
    if field.startswith("event.properties."):
        key = field[len("event.properties."):]
        return _field_event_property(key)(db, user_id, context)
    resolver = _FIELD_RESOLVERS.get(field)
    if resolver is None:
        raise ValueError(f"Unknown condition field: {field}")
    return resolver(db, user_id, context)


def _coerce_bool(value: Any) -> Any:
    """The filter builder's value input is always a string (HTML form
    fields), but boolean columns (is_premium, email_verified) come back
    from the DB as real Python bools — "true" == True is False in Python,
    so eq/neq against a boolean field silently never matched before this.
    Only touches the comparison when `actual` is actually a bool."""
    if isinstance(value, str):
        low = value.strip().lower()
        if low in ("true", "1", "yes"):
            return True
        if low in ("false", "0", "no", ""):
            return False
    return value


def _compare(operator: str, actual: Any, expected: Any) -> bool:
    if isinstance(actual, bool):
        expected = _coerce_bool(expected)
    if operator == "eq":
        return actual == expected
    if operator == "neq":
        return actual != expected
    if operator == "older_than_days":
        if actual is None:
            return False
        import datetime as _dt
        d = actual if isinstance(actual, (_dt.date, _dt.datetime)) else None
        if d is None:
            return False
        today = _dt.date.today()
        if isinstance(d, _dt.datetime):
            d = d.date()
        return (today - d).days >= int(expected)
    # numeric comparisons
    try:
        a, e = float(actual), float(expected)
    except (TypeError, ValueError):
        return False
    if operator == "gt":
        return a > e
    if operator == "gte":
        return a >= e
    if operator == "lt":
        return a < e
    if operator == "lte":
        return a <= e
    return False


def evaluate_when(db: Connection, user_id: int, context: dict, when) -> bool:
    """Evaluates a filter group against the user's current state / the
    trigger-time event context. `in_segment` defers to user_in_segment so
    segment membership uses the same evaluator, not a second implementation.

    `when` accepts two shapes:
      - a bare list of {field, operator, value} conditions (the original
        shape, always AND'd) — kept for backward compatibility with every
        campaign/segment saved before AND/OR grouping was added; treated as
        {"op": "and", "rules": when}.
      - {"op": "and"|"or", "rules": [...]} — one level of grouping, matching
        a Customer.io-style segment. Deliberately not recursive/nested groups
        (a rule is always a leaf condition, never another group) — same
        "cap the complexity" call made for the step editor's branch nesting.
    """
    if isinstance(when, list):
        op, rules = "and", when
    else:
        when = when or {}
        op = when.get("op") or "and"
        rules = when.get("rules") or []
    if op not in ("and", "or"):
        raise ValueError(f"Unknown filter group operator: {op}")

    results = []
    for cond in rules:
        field = cond.get("field")
        operator = cond.get("operator")
        value = cond.get("value")
        if operator not in KNOWN_OPERATORS:
            raise ValueError(f"Unknown condition operator: {operator}")
        if operator == "in_segment":
            results.append(user_in_segment(db, user_id, value))
            continue
        actual = _resolve_field(db, user_id, context, field)
        results.append(_compare(operator, actual, value))

    if not results:
        return True  # an empty group matches everything, same as the old empty-list behavior
    return all(results) if op == "and" else any(results)


def user_in_segment(db: Connection, user_id: int, segment_id: int) -> bool:
    row = db.execute(text("SELECT filters FROM automation_segments WHERE id = :id"), {"id": segment_id}).mappings().first()
    if not row:
        return False
    # A segment's filters are either the legacy bare-list shape or the
    # canonical {op, rules} dict (see evaluate_when's docstring) — both
    # come back from JSONB already parsed as a Python list/dict, never a
    # string, so json.loads should only run on the (shouldn't-happen)
    # string fallback. Previously only checked `isinstance(..., list)`,
    # so any segment saved with the canonical dict shape crashed here with
    # a TypeError the moment anything tried to evaluate it.
    filters = row["filters"] if isinstance(row["filters"], (list, dict)) else json.loads(row["filters"] or "[]")
    return evaluate_when(db, user_id, {}, filters)


def _rules_of(when) -> list[dict]:
    """Same bare-list-or-{op,rules}-group shape evaluate_when accepts —
    pulls out just the leaf rules for validation, regardless of which
    shape was saved."""
    if isinstance(when, list):
        return when
    return (when or {}).get("rules") or []


def validate_filter_group(when) -> None:
    if not isinstance(when, list):
        when = when or {}
        if not isinstance(when, dict):
            raise ValueError("Filter group must be a list or {op, rules} object")
        if when.get("op", "and") not in ("and", "or"):
            raise ValueError(f"Unknown filter group operator: {when.get('op')}")
    for cond in _rules_of(when):
        if cond.get("operator") not in KNOWN_OPERATORS:
            raise ValueError(f"Unknown operator: {cond.get('operator')}")


def _validate_steps(steps: list[dict], depth: int = 0) -> None:
    """Recursive shape check — rejected at campaign save time, not execution
    time, per the plan's verification requirement."""
    if depth > 6:
        raise ValueError("Step nesting too deep")
    for step in steps or []:
        t = step.get("type")
        if t == "wait":
            if not isinstance(step.get("duration_hours"), (int, float)) or step["duration_hours"] <= 0:
                raise ValueError("wait step needs a positive duration_hours")
        elif t == "condition":
            branches = step.get("branches")
            if not isinstance(branches, list) or not branches:
                raise ValueError("condition step needs a non-empty branches list")
            for b in branches:
                if not b.get("else"):
                    validate_filter_group(b.get("when"))
                _validate_steps(b.get("steps") or [], depth + 1)
        elif t == "split":
            branches = step.get("branches")
            if not isinstance(branches, list) or not branches:
                raise ValueError("split step needs a non-empty branches list")
            for b in branches:
                w = b.get("weight")
                if not isinstance(w, (int, float)) or w <= 0:
                    raise ValueError("split branch needs a positive numeric weight")
                _validate_steps(b.get("steps") or [], depth + 1)
        elif t == "action":
            if step.get("action") not in KNOWN_ACTIONS:
                raise ValueError(f"Unknown action: {step.get('action')}")
        else:
            raise ValueError(f"Unknown step type: {t}")


TRIGGER_TYPES = {"event", "segment", "manual"}


def validate_campaign(trigger_type: str, trigger: dict, steps: list[dict], goal: Any = None) -> None:
    if trigger_type not in TRIGGER_TYPES:
        raise ValueError(f"Unknown trigger_type: {trigger_type}")
    if not isinstance(trigger, dict):
        raise ValueError("trigger_config must be an object")
    if trigger_type == "event":
        if not trigger.get("event_type"):
            raise ValueError("trigger.event_type is required")
        validate_filter_group(trigger.get("filters"))
    elif trigger_type in ("segment", "manual"):
        # Both target a segment — "segment" auto-enrolls continuously on
        # membership entry (check_segment_triggers), "manual" is a one-off
        # "Send now" blast (routes_automations.py's send_now endpoint) —
        # same audience-targeting shape, no separate "only if" filter
        # layered on top (the segment's own filters already are that
        # layer). check_and_enroll/check_segment_triggers each filter by
        # an exact trigger_type string, so a 'manual' campaign is inert to
        # both — send_now is the only path that can ever enroll anyone
        # into one.
        if not trigger.get("segment_id"):
            raise ValueError("trigger.segment_id is required")
    if goal is not None:
        validate_filter_group(goal)
    _validate_steps(steps)


def record_event(db: Connection, user_id: int, event_type: str, properties: Optional[dict] = None) -> None:
    """The one function every trigger call site invokes. Inserts the event,
    then immediately checks whether it should enroll the user in any active
    campaign."""
    db.execute(
        text("INSERT INTO automation_events (user_id, event_type, properties) VALUES (:u, :t, :p)"),
        {"u": user_id, "t": event_type, "p": json.dumps(properties or {})},
    )
    check_and_enroll(db, user_id, event_type, properties or {})


def detect_streak_breaks(db: Connection) -> int:
    """Fires a 'streak_broke' event once per actual break — the flagship
    trigger from the original spec, and the one behavior in this file that
    can't be raised inline at the moment it happens (unlike signup or lesson
    completion, nobody calls an endpoint when a streak lapses; it's a
    passive/temporal condition only a scan can notice). Called from the
    cron advancement endpoint rather than its own separate job, so there's
    only one thing to schedule externally.

    This is a simplified heuristic, not a full replay of _compute_streak's
    freeze-bridging logic (routes.py) — it treats "more than a day past the
    grace period with no freeze use" as broken, matching the same
    approximation the existing streak-reminder cron jobs already make
    (`current_streak > 0` + "hasn't practiced yet"), just one step further
    on the same axis (multi-day gap instead of same-day).

    Dedup'd per (user, streak_last_activity_date) via automation_events so
    a user who stays lapsed for a week doesn't refire the trigger daily —
    only a *new* break (a later last-activity date, meaning they resumed
    and lapsed again) fires again.
    """
    rows = db.execute(text("""
        SELECT id, current_streak, streak_last_activity_date
        FROM users
        WHERE current_streak > 0
          AND streak_last_activity_date IS NOT NULL
          AND streak_last_activity_date < CURRENT_DATE - INTERVAL '2 days'
    """)).mappings().all()

    fired = 0
    for u in rows:
        activity_date = str(u["streak_last_activity_date"])
        already = db.execute(
            text("""
                SELECT 1 FROM automation_events
                WHERE user_id = :u AND event_type = 'streak_broke'
                  AND properties ->> 'streak_last_activity_date' = :d
                LIMIT 1
            """),
            {"u": u["id"], "d": activity_date},
        ).first()
        if already:
            continue
        record_event(db, u["id"], "streak_broke", {
            "streak_length": int(u["current_streak"] or 0),
            "streak_last_activity_date": activity_date,
        })
        fired += 1
    return fired


def check_and_enroll(db: Connection, user_id: int, event_type: str, properties: dict) -> None:
    campaigns = db.execute(
        text("""
            SELECT id, trigger_config, reenrollment_policy
            FROM automation_campaigns
            WHERE status = 'active' AND trigger_type = 'event'
              AND trigger_config ->> 'event_type' = :et
        """),
        {"et": event_type},
    ).mappings().all()

    for camp in campaigns:
        trigger_config = camp["trigger_config"] if isinstance(camp["trigger_config"], dict) else json.loads(camp["trigger_config"])
        filters = trigger_config.get("filters") or []
        try:
            if filters and not evaluate_when(db, user_id, properties, filters):
                continue
        except ValueError:
            continue  # malformed filter on an already-saved campaign — skip rather than 500 the caller's request

        if camp["reenrollment_policy"] == "skip":
            existing = db.execute(
                text("""
                    SELECT 1 FROM automation_enrollments
                    WHERE campaign_id = :c AND user_id = :u AND status IN ('active', 'waiting')
                    LIMIT 1
                """),
                {"c": camp["id"], "u": user_id},
            ).first()
            if existing:
                continue

        enrollment = db.execute(
            text("""
                INSERT INTO automation_enrollments (campaign_id, user_id, status, current_step_index, context)
                VALUES (:c, :u, 'active', 0, :ctx)
                RETURNING id, campaign_id, user_id, status, current_step_index, resume_at, context, waiting_step_path
            """),
            {"c": camp["id"], "u": user_id, "ctx": json.dumps(properties)},
        ).mappings().first()
        advance_enrollment(db, dict(enrollment))


def check_segment_triggers(db: Connection) -> int:
    """Segment-entry trigger (trigger_type='segment'). Unlike an event
    trigger — a discrete occurrence that calls check_and_enroll inline the
    moment it happens — segment membership is a continuous state with no
    single moment of change to hook into, so this is cron-scanned (same
    "passive condition, only a scan can notice" shape as
    detect_streak_breaks, called from the same cron endpoint).

    Re-evaluating "is user X in segment Y" on every tick isn't enough by
    itself: a still-matching user would get enrolled again on every single
    tick. automation_segment_membership remembers what this function last
    saw, so only the false->true transition ("entry") enrolls — a user who
    stays in the segment across ticks, or who was already a member before
    the campaign went active, doesn't loop-enroll or trigger on the first
    scan.

    reenrollment_policy still governs concurrent runs (skip = don't enroll
    while already active/waiting) exactly like check_and_enroll — it does
    NOT change how "entry" is detected, so a segment campaign always fires
    once per genuine leave-then-rejoin, regardless of policy.
    """
    campaigns = db.execute(text("""
        SELECT id, trigger_config, reenrollment_policy
        FROM automation_campaigns
        WHERE status = 'active' AND trigger_type = 'segment'
    """)).mappings().all()
    if not campaigns:
        return 0

    user_ids = [r[0] for r in db.execute(text("SELECT id FROM users")).all()]
    enrolled = 0
    for camp in campaigns:
        trigger_config = camp["trigger_config"] if isinstance(camp["trigger_config"], dict) else json.loads(camp["trigger_config"] or "{}")
        segment_id = trigger_config.get("segment_id")
        if not segment_id:
            continue
        for user_id in user_ids:
            try:
                matches = user_in_segment(db, user_id, segment_id)
            except ValueError:
                continue  # malformed segment filter — skip rather than blow up the whole scan

            prev = db.execute(
                text("SELECT is_member FROM automation_segment_membership WHERE campaign_id = :c AND user_id = :u"),
                {"c": camp["id"], "u": user_id},
            ).mappings().first()
            was_member = bool(prev and prev["is_member"])
            if matches == was_member:
                continue

            db.execute(
                text("""
                    INSERT INTO automation_segment_membership (campaign_id, user_id, is_member, updated_at)
                    VALUES (:c, :u, :m, NOW())
                    ON CONFLICT (campaign_id, user_id) DO UPDATE SET is_member = :m, updated_at = NOW()
                """),
                {"c": camp["id"], "u": user_id, "m": matches},
            )
            if not matches:
                continue  # transitioned OUT — nothing to enroll

            if camp["reenrollment_policy"] == "skip":
                existing = db.execute(
                    text("""
                        SELECT 1 FROM automation_enrollments
                        WHERE campaign_id = :c AND user_id = :u AND status IN ('active', 'waiting')
                        LIMIT 1
                    """),
                    {"c": camp["id"], "u": user_id},
                ).first()
                if existing:
                    continue

            enrollment = db.execute(
                text("""
                    INSERT INTO automation_enrollments (campaign_id, user_id, status, current_step_index, context)
                    VALUES (:c, :u, 'active', 0, '{}'::jsonb)
                    RETURNING id, campaign_id, user_id, status, current_step_index, resume_at, context, waiting_step_path
                """),
                {"c": camp["id"], "u": user_id},
            ).mappings().first()
            advance_enrollment(db, dict(enrollment))
            enrolled += 1
    return enrolled


def _step_path_str(path: list[int]) -> str:
    return ".".join(str(p) for p in path)


def _pick_branch(db: Connection, user_id: int, context: dict, condition_step: dict):
    """Evaluated fresh every time this condition is reached — including on
    resume after a wait, per the plan's "still inactive after 1 day gets
    re-checked" requirement. Returns the matched branch's steps list, or
    None if nothing matched (no else branch)."""
    for b in condition_step.get("branches", []):
        if b.get("else"):
            return b.get("steps") or []
        try:
            if evaluate_when(db, user_id, context, b.get("when") or []):
                return b.get("steps") or []
        except ValueError:
            continue
    return None


def _pick_split_branch(branches: list[dict], enrollment_id: int, path_str: str) -> Optional[list[dict]]:
    """A/B split — unlike a condition (re-evaluated fresh every time this
    step is reached, including on resume), the branch a given enrollment
    lands in must be the SAME every time, or a user could flip between
    variant A and B on every cron resume. Derived deterministically from
    (enrollment_id, path_str) via sha256 — not Python's builtin hash(),
    which is salted per-process (PYTHONHASHSEED) and would reshuffle every
    waiting enrollment's branch on the next deploy."""
    if not branches:
        return None
    weights = [max(0.0, float(b.get("weight") or 0)) for b in branches]
    total = sum(weights)
    if total <= 0:
        return branches[0].get("steps") or []
    digest = hashlib.sha256(f"{enrollment_id}:{path_str}".encode()).hexdigest()
    bucket = (int(digest, 16) % 10_000_000) / 10_000_000 * total
    cumulative = 0.0
    for b, w in zip(branches, weights):
        cumulative += w
        if bucket < cumulative:
            return b.get("steps") or []
    return branches[-1].get("steps") or []


def _walk(db, steps, path_prefix, enrollment_id, user_id, context, budget, state):
    """Depth-first walk over a (possibly nested) step list.

    `state` is a shared mutable dict `{"skipping": bool, "target": str|None}`
    used to resume exactly where a previous run suspended on a wait step,
    without needing a single flat index — a wait nested inside a condition
    branch needs its *full* path (e.g. "0.1") to resume correctly, since a
    plain top-level index can't distinguish "step 1 at the top" from "step 1
    inside the branch chosen by step 0".

    While `state["skipping"]` is true, this retraces the same route taken
    before (still evaluating conditions fresh, since which branch matches
    can change step-to-step position but not skip actions) until it reaches
    the exact step previously waited on, then switches to live execution for
    everything after it. If the retraced route never reaches that path
    (e.g. the campaign was edited while an enrollment was waiting on it),
    the walk simply reaches the end and the enrollment is marked completed
    — a safe, if unremarkable, fallback rather than an error.

    Returns None if this (sub)list finished normally (caller continues to
    its own next sibling), or {"type": "wait"|"budget", ...} to propagate a
    suspend/abort up to the top-level caller unchanged.
    """
    for idx, step in enumerate(steps):
        if budget[0] <= 0:
            return {"type": "budget"}
        budget[0] -= 1

        path = path_prefix + [idx]
        path_str = _step_path_str(path)
        t = step.get("type")

        if state["skipping"]:
            if path_str == state["target"]:
                state["skipping"] = False  # this wait step is the resume point — consumed, continue live from the next step
                continue
            if t == "condition":
                branch_steps = _pick_branch(db, user_id, context, step)
                if branch_steps is not None:
                    result = _walk(db, branch_steps, path, enrollment_id, user_id, context, budget, state)
                    if result is not None:
                        return result
            elif t == "split":
                branch_steps = _pick_split_branch(step.get("branches", []), enrollment_id, path_str)
                if branch_steps is not None:
                    result = _walk(db, branch_steps, path, enrollment_id, user_id, context, budget, state)
                    if result is not None:
                        return result
            continue  # wait/action steps already passed through before — skip silently

        # Live execution.
        if t == "wait":
            import datetime as _dt
            hours = step.get("duration_hours", 0)
            resume_at = _dt.datetime.utcnow() + _dt.timedelta(hours=float(hours))
            return {"type": "wait", "resume_at": resume_at, "path": path_str}
        if t == "condition":
            branch_steps = _pick_branch(db, user_id, context, step)
            if branch_steps is not None:
                result = _walk(db, branch_steps, path, enrollment_id, user_id, context, budget, state)
                if result is not None:
                    return result
            continue
        if t == "split":
            branch_steps = _pick_split_branch(step.get("branches", []), enrollment_id, path_str)
            if branch_steps is not None:
                result = _walk(db, branch_steps, path, enrollment_id, user_id, context, budget, state)
                if result is not None:
                    return result
            continue
        if t == "action":
            execute_action(db, enrollment_id, user_id, path_str, step)
            continue
        # unknown step type (shouldn't happen post-validation) — skip rather than crash

    return None


def advance_enrollment(db: Connection, enrollment: dict) -> None:
    campaign = db.execute(
        text("SELECT id, status, steps, goal FROM automation_campaigns WHERE id = :id"),
        {"id": enrollment["campaign_id"]},
    ).mappings().first()
    if not campaign or campaign["status"] != "active":
        return  # paused/archived mid-flight — simply stop advancing, per the plan

    context = enrollment["context"] if isinstance(enrollment["context"], dict) else json.loads(enrollment["context"] or "{}")
    user_id = enrollment["user_id"]
    enrollment_id = enrollment["id"]

    # Goal / exit condition — checked before every walk (both the initial
    # enroll-moment call and every cron-resume call converge here), so a
    # user who's already satisfied the goal is pulled out immediately
    # instead of continuing to receive the rest of the journey. An empty/
    # absent goal must never match — unlike a `when` filter's normal
    # "empty group matches everything" behavior (evaluate_when), which
    # here would instantly exit every single enrollment.
    goal = campaign["goal"] if isinstance(campaign["goal"], (dict, list)) else (json.loads(campaign["goal"]) if campaign["goal"] else None)
    if goal and _rules_of(goal):
        try:
            if evaluate_when(db, user_id, context, goal):
                db.execute(
                    text("""
                        UPDATE automation_enrollments
                        SET status = 'exited', completed_at = NOW(), waiting_step_path = NULL,
                            context = COALESCE(context, '{}'::jsonb) || '{"exit_reason":"goal_met"}'::jsonb
                        WHERE id = :id
                    """),
                    {"id": enrollment_id},
                )
                return
        except ValueError:
            pass  # malformed goal on an already-saved campaign — fall through to a normal walk rather than block advancement

    steps = campaign["steps"] if isinstance(campaign["steps"], list) else json.loads(campaign["steps"])
    resume_target = enrollment.get("waiting_step_path")

    budget = [MAX_STEPS_PER_ADVANCE]
    state = {"skipping": resume_target is not None, "target": resume_target}
    result = _walk(db, steps, [], enrollment_id, user_id, context, budget, state)

    if result is None:
        db.execute(
            text("UPDATE automation_enrollments SET status = 'completed', completed_at = NOW(), waiting_step_path = NULL WHERE id = :id"),
            {"id": enrollment_id},
        )
    elif result["type"] == "wait":
        db.execute(
            text("UPDATE automation_enrollments SET status = 'waiting', resume_at = :r, waiting_step_path = :p WHERE id = :id"),
            {"r": result["resume_at"], "p": result["path"], "id": enrollment_id},
        )
    # else "budget": leave the enrollment exactly as it was (still 'active' or mid-resume as
    # 'waiting' with its prior resume_at/path untouched) for a later cron pass to retry.


class Unsubscribed(Exception):
    """Raised by _action_send_email when the recipient has opted out of
    marketing/reminder email (users.email_reminders_enabled = FALSE).
    Caught separately in execute_action so this shows up as a deliberate
    "skipped" send, not a "failed" one — respecting a preference isn't a
    delivery error."""


def execute_action(db: Connection, enrollment_id: int, user_id: int, step_path: str, step: dict) -> None:
    already = db.execute(
        text("SELECT 1 FROM automation_sends WHERE enrollment_id = :e AND step_index = :i"),
        {"e": enrollment_id, "i": step_path},
    ).first()
    if already:
        return  # dedupe against a cron/event double-fire re-running this exact step

    action = step.get("action")
    params = step.get("params") or {}
    status = "sent"
    detail = dict(params)
    # Generated regardless of whether the email actually ends up trackable
    # (needs an html_body) — cheap, and keeps the token-vs-no-token branch
    # entirely inside _action_send_email rather than duplicated here.
    tracking_token = secrets.token_urlsafe(16) if action == "send_email" else None

    try:
        if action == "send_email":
            result = _action_send_email(db, user_id, params, tracking_token=tracking_token)
            if result:
                detail = {**detail, **result}
        elif action == "send_push":
            _action_send_push(db, user_id, params)
        elif action == "send_web_push":
            _action_send_web_push(db, user_id, params)
        elif action == "send_brevo":
            _action_send_brevo(db, user_id, params)
        elif action == "grant_bonus":
            _action_grant_bonus(db, user_id, params)
        else:
            status = "skipped"
    except Unsubscribed:
        status = "skipped"
        detail = {**detail, "reason": "unsubscribed"}
    except Exception as e:
        status = "failed"
        detail = {**detail, "error": str(e)}

    db.execute(
        text("""
            INSERT INTO automation_sends (campaign_id, enrollment_id, user_id, step_index, action_type, status, detail, tracking_token)
            SELECT campaign_id, :e, :u, :i, :at, :s, :d, :tk FROM automation_enrollments WHERE id = :e
        """),
        {"e": enrollment_id, "u": user_id, "i": step_path, "at": action, "s": status, "d": json.dumps(detail), "tk": tracking_token},
    )


def _render_template(value: Optional[str], variables: dict) -> Optional[str]:
    """Substitutes {{var}} tokens — same minimal scheme the CMS step editor's
    variable picker inserts, no expression language, just literal replace."""
    if not value:
        return value
    out = value
    for key, val in variables.items():
        out = out.replace("{{" + key + "}}", val)
    return out


def _tracking_base_url() -> str:
    return (os.getenv("PUBLIC_API_BASE_URL") or "https://haylinguav2.onrender.com/api").rstrip("/")


def _inject_tracking(html_body: str, tracking_token: str) -> str:
    """Rewrites every http(s) link to route through our own click-tracking
    redirect, and appends an invisible open-tracking pixel. Only ever
    called with the LOCAL variable that's about to be emailed — the
    campaign's saved params["html_body"] is never touched, so re-editing
    the step later still shows the original authored HTML."""
    base = _tracking_base_url()

    def _rewrite(m: "re.Match") -> str:
        url = m.group(1)
        return f'href="{base}/t/c/{tracking_token}?u={quote(url, safe="")}"'

    rewritten = re.sub(r'href="(https?://[^"]+)"', _rewrite, html_body)
    pixel = f'<img src="{base}/t/o/{tracking_token}.png" width="1" height="1" style="display:none" alt="" />'
    return rewritten + pixel


def _template_variables(db: Connection, user_id: int) -> dict:
    """The {{var}} substitution context shared by every channel a step can
    send through (email/push/web push) — one query, one dict, so adding a
    new personalization field (streak, gems, ...) only ever needs to
    happen here. All values are pre-stringified since _render_template does
    a plain string .replace()."""
    from routes import LEAGUE_TIERS  # lazy import, same reason as the _send_email import below

    row = db.execute(
        text("""
            SELECT email, username, first_name, display_name, name,
                   gems, current_streak, best_streak, weekly_xp, league_tier
            FROM users WHERE id = :u
        """),
        {"u": user_id},
    ).mappings().first()
    if not row:
        raise ValueError("user not found")
    display_name = row["first_name"] or row["display_name"] or row["name"] or "there"
    tier = row["league_tier"] or 0
    league_name = LEAGUE_TIERS[min(tier, len(LEAGUE_TIERS) - 1)]
    return {
        "name": display_name,
        "first_name": row["first_name"] or display_name,
        "username": row["username"] or display_name,
        "email": row["email"] or "",
        "streak": str(row["current_streak"] or 0),
        "best_streak": str(row["best_streak"] or 0),
        "gems": str(row["gems"] or 0),
        "weekly_xp": str(row["weekly_xp"] or 0),
        "league": league_name,
    }


def _action_send_email(db: Connection, user_id: int, params: dict, tracking_token: Optional[str] = None) -> Optional[dict]:
    from routes import _send_email  # lazy import — mirrors the existing brevo lazy-import style in routes.py, avoids a circular import since routes.py imports this module

    # Kept as its own query rather than folded into _template_variables,
    # which push/web-push/brevo actions also call — this check must only
    # ever gate the email path.
    row = db.execute(text("SELECT email_reminders_enabled FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    if row and row["email_reminders_enabled"] is False:
        raise Unsubscribed()

    variables = _template_variables(db, user_id)
    if not variables["email"]:
        raise ValueError("user has no email on file")
    subject = _render_template(params.get("subject") or "Haylingua", variables)
    body = _render_template(params.get("body") or "", variables)
    html_body = _render_template(params.get("html_body"), variables)
    if html_body and tracking_token:
        html_body = _inject_tracking(html_body, tracking_token)
    # return_diagnostic=True captures the REAL provider response — which
    # channel (brevo/smtp/none), Brevo's message_id on success, or the
    # exact reason/error on failure (no_api_key, no_sender, an http_error
    # with Brevo's own response body, or an SMTP exception). Previously
    # only a bare bool was checked (and even that was discarded entirely
    # at one point), so the CMS Send log's `detail` column said "sent"
    # for emails that silently never left the server. execute_action
    # merges this dict into `detail` either way (success or failure) —
    # visible in the Send log / automation_sends table.
    diag = _send_email(to_email=variables["email"], subject=subject, body=body, html_body=html_body, unsubscribe_user_id=user_id, return_diagnostic=True)
    if not diag.get("ok"):
        raise RuntimeError(f"email not actually sent — {diag}")
    return {"provider": diag}


def _action_send_push(db: Connection, user_id: int, params: dict) -> None:
    from apns import send_push

    tokens = db.execute(text("SELECT token FROM device_push_tokens WHERE user_id = :u"), {"u": user_id}).mappings().all()
    if not tokens:
        raise ValueError("user has no registered device tokens")
    variables = _template_variables(db, user_id)
    title = _render_template(params.get("title") or "Haylingua", variables)
    body = _render_template(params.get("body") or "", variables)
    for t in tokens:
        send_push(t["token"], title, body)


def _action_send_web_push(db: Connection, user_id: int, params: dict) -> None:
    from webpush import send_web_push

    subs = db.execute(
        text("SELECT id, endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = :u"),
        {"u": user_id},
    ).mappings().all()
    if not subs:
        raise ValueError("user has no web push subscription")
    variables = _template_variables(db, user_id)
    title = _render_template(params.get("title") or "Haylingua", variables)
    body = _render_template(params.get("body") or "", variables)
    url = params.get("url") or None
    for s in subs:
        subscription = {"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}}
        result = send_web_push(subscription, title, body, url)
        if result == "gone":
            # The push service says this subscription no longer exists
            # (expired, unsubscribed, browser data cleared) — clean it up so
            # it stops being tried on every future send_web_push step.
            db.execute(text("DELETE FROM web_push_subscriptions WHERE id = :id"), {"id": s["id"]})


def _action_send_brevo(db: Connection, user_id: int, params: dict) -> None:
    from integrations.brevo import track_event

    row = db.execute(text("SELECT email FROM users WHERE id = :u"), {"u": user_id}).mappings().first()
    if not row or not row["email"]:
        raise ValueError("user has no email on file")
    track_event(email=row["email"], event=params.get("event_name") or "automation_step", properties=params.get("properties"))


def _action_grant_bonus(db: Connection, user_id: int, params: dict) -> None:
    from routes_cms import grant_bonus_core

    grant_bonus_core(
        db, user_id,
        kind=params.get("kind"),
        amount=int(params.get("amount") or 0),
        notify_email=bool(params.get("notify_email")),
        notify_inapp=bool(params.get("notify_inapp")),
        message=params.get("message"),
    )
