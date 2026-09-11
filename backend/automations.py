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

import json
from typing import Any, Optional

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
    filters = row["filters"] if isinstance(row["filters"], list) else json.loads(row["filters"] or "[]")
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
        elif t == "action":
            if step.get("action") not in KNOWN_ACTIONS:
                raise ValueError(f"Unknown action: {step.get('action')}")
        else:
            raise ValueError(f"Unknown step type: {t}")


def validate_campaign(trigger: dict, steps: list[dict]) -> None:
    if not isinstance(trigger, dict) or not trigger.get("event_type"):
        raise ValueError("trigger.event_type is required")
    validate_filter_group(trigger.get("filters"))
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
        if t == "action":
            execute_action(db, enrollment_id, user_id, path_str, step)
            continue
        # unknown step type (shouldn't happen post-validation) — skip rather than crash

    return None


def advance_enrollment(db: Connection, enrollment: dict) -> None:
    campaign = db.execute(
        text("SELECT id, status, steps FROM automation_campaigns WHERE id = :id"),
        {"id": enrollment["campaign_id"]},
    ).mappings().first()
    if not campaign or campaign["status"] != "active":
        return  # paused/archived mid-flight — simply stop advancing, per the plan

    steps = campaign["steps"] if isinstance(campaign["steps"], list) else json.loads(campaign["steps"])
    context = enrollment["context"] if isinstance(enrollment["context"], dict) else json.loads(enrollment["context"] or "{}")
    user_id = enrollment["user_id"]
    enrollment_id = enrollment["id"]
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

    try:
        if action == "send_email":
            _action_send_email(db, user_id, params)
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
    except Exception as e:
        status = "failed"
        detail = {**detail, "error": str(e)}

    db.execute(
        text("""
            INSERT INTO automation_sends (campaign_id, enrollment_id, user_id, step_index, action_type, status, detail)
            SELECT campaign_id, :e, :u, :i, :at, :s, :d FROM automation_enrollments WHERE id = :e
        """),
        {"e": enrollment_id, "u": user_id, "i": step_path, "at": action, "s": status, "d": json.dumps(detail)},
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


def _action_send_email(db: Connection, user_id: int, params: dict) -> None:
    from routes import _send_email  # lazy import — mirrors the existing brevo lazy-import style in routes.py, avoids a circular import since routes.py imports this module

    row = db.execute(
        text("SELECT email, username, first_name, display_name, name FROM users WHERE id = :u"),
        {"u": user_id},
    ).mappings().first()
    if not row or not row["email"]:
        raise ValueError("user has no email on file")
    display_name = row["first_name"] or row["display_name"] or row["name"] or "there"
    variables = {
        "name": display_name,
        "first_name": row["first_name"] or display_name,
        "username": row["username"] or display_name,
        "email": row["email"],
    }
    subject = _render_template(params.get("subject") or "Haylingua", variables)
    body = _render_template(params.get("body") or "", variables)
    html_body = _render_template(params.get("html_body"), variables)
    _send_email(to_email=row["email"], subject=subject, body=body, html_body=html_body)


def _action_send_push(db: Connection, user_id: int, params: dict) -> None:
    from apns import send_push

    tokens = db.execute(text("SELECT token FROM device_push_tokens WHERE user_id = :u"), {"u": user_id}).mappings().all()
    if not tokens:
        raise ValueError("user has no registered device tokens")
    title = params.get("title") or "Haylingua"
    body = params.get("body") or ""
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
    title = params.get("title") or "Haylingua"
    body = params.get("body") or ""
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
