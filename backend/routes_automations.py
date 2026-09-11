# backend/routes_automations.py — CMS CRUD for the marketing-automation
# engine (campaigns, segments) plus the cron advancement endpoint. Mirrors
# routes_blog.py's standalone-router style; the actual engine logic lives in
# automations.py, this file is just the HTTP surface + request validation.
from __future__ import annotations

import hmac
import json
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from routes import require_cms_admin
import automations

router = APIRouter(tags=["automations"])


def require_crm_editor(cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)) -> dict:
    """Composes on top of require_cms_admin (doesn't replace or modify it —
    every other /cms/* route keeps today's flat admin-only behavior) to add
    one more check scoped to this file only: a CMS user whose cms_users.
    crm_role is 'viewer' can still pass require_cms_admin (they're a real
    CMS admin) but gets 403'd here on any Automations/Segments *mutation*.
    GET endpoints in this file intentionally keep the plain require_cms_admin
    dependency — viewers can look, just not change anything.

    require_cms_admin returns dict(row) from `SELECT id, email, status,
    totp_enabled FROM cms_users` (routes.py) — keyed by "id", not "sub" (that
    key only exists on the raw, not-yet-looked-up JWT payload one level
    below it). Mismatching this crashed every mutating CRM request in prod
    with a 500 (int(None)) until this fix."""
    role = db.execute(
        text("SELECT crm_role FROM cms_users WHERE id = :id"), {"id": int(cms_user["id"])}
    ).scalar()
    if (role or "editor") == "viewer":
        raise HTTPException(status_code=403, detail="View-only CRM access — ask an editor to make changes")
    return cms_user


class CampaignIn(BaseModel):
    name: str
    status: str = "draft"
    trigger_type: str = "event"
    trigger_config: dict
    steps: list = []
    reenrollment_policy: str = "skip"


class SegmentIn(BaseModel):
    name: str
    description: Optional[str] = None
    # Bare list (legacy, always-AND) or {"op": "and"|"or", "rules": [...]} —
    # see automations.evaluate_when's docstring for why both shapes exist.
    filters: Any = []


def _validate_campaign_payload(payload: CampaignIn) -> None:
    if payload.status not in ("draft", "active", "paused", "archived"):
        raise HTTPException(status_code=400, detail="Invalid status")
    if payload.reenrollment_policy not in ("skip", "allow"):
        raise HTTPException(status_code=400, detail="Invalid reenrollment_policy")
    try:
        automations.validate_campaign(payload.trigger_type, payload.trigger_config, payload.steps)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Campaigns ----------

@router.get("/cms/automations")
def list_automations(page: int = Query(default=1, ge=1), page_size: int = Query(default=25, ge=1, le=200),
                      q: Optional[str] = Query(default=None), status: Optional[str] = Query(default=None),
                      cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    offset = (page - 1) * page_size
    params = {"limit": page_size, "offset": offset, "q": f"%{q}%" if q else None, "status": status}
    where = []
    if q:
        where.append("lower(c.name) LIKE lower(:q)")
    if status:
        where.append("c.status = :status")
    where_clause = f"WHERE {' AND '.join(where)}" if where else ""
    rows = db.execute(
        text(f"""
            SELECT c.id, c.name, c.status, c.trigger_type, c.trigger_config, c.reenrollment_policy,
                   c.created_at, c.updated_at,
                   (SELECT COUNT(*) FROM automation_enrollments e WHERE e.campaign_id = c.id AND e.status IN ('active', 'waiting')) AS active_enrollments
            FROM automation_campaigns c
            {where_clause}
            ORDER BY c.updated_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).mappings().all()
    total = db.execute(text(f"SELECT COUNT(*) FROM automation_campaigns c {where_clause}"), params).scalar()
    return {"campaigns": [dict(r) for r in rows], "total": int(total or 0), "page": page, "page_size": page_size}


@router.post("/cms/automations")
def create_automation(payload: CampaignIn, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    _validate_campaign_payload(payload)
    row = db.execute(
        text("""
            INSERT INTO automation_campaigns (name, status, trigger_type, trigger_config, steps, reenrollment_policy, created_by)
            VALUES (:name, :status, :trigger_type, :trigger_config, :steps, :policy, :created_by)
            RETURNING id
        """),
        {
            "name": payload.name, "status": payload.status, "trigger_type": payload.trigger_type,
            "trigger_config": json.dumps(payload.trigger_config), "steps": json.dumps(payload.steps),
            "policy": payload.reenrollment_policy, "created_by": cms_user.get("email"),
        },
    ).mappings().first()
    return {"ok": True, "id": row["id"]}


@router.get("/cms/automations/{campaign_id}")
def get_automation(campaign_id: int, cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    row = db.execute(text("SELECT * FROM automation_campaigns WHERE id = :id"), {"id": campaign_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return dict(row)


@router.put("/cms/automations/{campaign_id}")
def update_automation(campaign_id: int, payload: CampaignIn, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    _validate_campaign_payload(payload)
    existing = db.execute(text("SELECT id FROM automation_campaigns WHERE id = :id"), {"id": campaign_id}).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.execute(
        text("""
            UPDATE automation_campaigns
            SET name = :name, status = :status, trigger_type = :trigger_type, trigger_config = :trigger_config,
                steps = :steps, reenrollment_policy = :policy, updated_at = NOW()
            WHERE id = :id
        """),
        {
            "id": campaign_id, "name": payload.name, "status": payload.status, "trigger_type": payload.trigger_type,
            "trigger_config": json.dumps(payload.trigger_config), "steps": json.dumps(payload.steps),
            "policy": payload.reenrollment_policy,
        },
    )
    return {"ok": True}


@router.delete("/cms/automations/{campaign_id}")
def delete_automation(campaign_id: int, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    """Soft-delete only — a hard delete would cascade-wipe automation_sends/
    automation_enrollments history via the FK, which we want to keep as an
    audit trail even for a retired campaign."""
    has_enrollments = db.execute(
        text("SELECT 1 FROM automation_enrollments WHERE campaign_id = :id LIMIT 1"), {"id": campaign_id}
    ).first()
    if has_enrollments:
        db.execute(text("UPDATE automation_campaigns SET status = 'archived', updated_at = NOW() WHERE id = :id"), {"id": campaign_id})
        return {"ok": True, "archived": True}
    result = db.execute(text("DELETE FROM automation_campaigns WHERE id = :id"), {"id": campaign_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"ok": True, "archived": False}


_ENROLLMENT_STATUSES = {"active", "waiting", "completed", "exited", "failed"}
_SEND_STATUSES = {"sent", "skipped", "failed"}


@router.get("/cms/automations/{campaign_id}/enrollments")
def list_enrollments(campaign_id: int, page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200),
                      status: Optional[str] = Query(default=None),
                      cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    if status is not None and status not in _ENROLLMENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status: {status}")
    offset = (page - 1) * page_size
    params = {"c": campaign_id, "limit": page_size, "offset": offset, "status": status}
    status_clause = "AND e.status = :status" if status else ""
    rows = db.execute(
        text(f"""
            SELECT e.id, e.user_id, e.status, e.waiting_step_path, e.resume_at, e.enrolled_at, e.completed_at,
                   COALESCE(u.first_name, u.display_name, u.name) AS user_name, u.email
            FROM automation_enrollments e
            JOIN users u ON u.id = e.user_id
            WHERE e.campaign_id = :c {status_clause}
            ORDER BY e.enrolled_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).mappings().all()
    total = db.execute(
        text(f"SELECT COUNT(*) FROM automation_enrollments e WHERE e.campaign_id = :c {status_clause}"), params
    ).scalar()
    return {"enrollments": [dict(r) for r in rows], "total": int(total or 0), "page": page, "page_size": page_size}


@router.get("/cms/automations/{campaign_id}/sends")
def list_sends(campaign_id: int, page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200),
               status: Optional[str] = Query(default=None),
               cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    if status is not None and status not in _SEND_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status: {status}")
    offset = (page - 1) * page_size
    params = {"c": campaign_id, "limit": page_size, "offset": offset, "status": status}
    status_clause = "AND s.status = :status" if status else ""
    rows = db.execute(
        text(f"""
            SELECT s.id, s.user_id, s.step_index, s.action_type, s.status, s.detail, s.created_at,
                   COALESCE(u.first_name, u.display_name, u.name) AS user_name, u.email
            FROM automation_sends s
            JOIN users u ON u.id = s.user_id
            WHERE s.campaign_id = :c {status_clause}
            ORDER BY s.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).mappings().all()
    total = db.execute(
        text(f"SELECT COUNT(*) FROM automation_sends s WHERE s.campaign_id = :c {status_clause}"), params
    ).scalar()
    return {"sends": [dict(r) for r in rows], "total": int(total or 0), "page": page, "page_size": page_size}


class TestRunIn(BaseModel):
    user_id: int
    force: bool = False


@router.post("/cms/automations/{campaign_id}/test-run")
def test_run_automation(campaign_id: int, payload: TestRunIn, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    campaign = db.execute(text("SELECT id, trigger_config FROM automation_campaigns WHERE id = :id"), {"id": campaign_id}).mappings().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    user = db.execute(text("SELECT id FROM users WHERE id = :u"), {"u": payload.user_id}).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    trigger_config = campaign["trigger_config"] if isinstance(campaign["trigger_config"], dict) else json.loads(campaign["trigger_config"])
    event_type = trigger_config.get("event_type")
    if payload.force:
        # Bypass trigger filters/reenrollment policy — directly enroll & run,
        # for QA'ing the step graph itself regardless of audience targeting.
        enrollment = db.execute(
            text("""
                INSERT INTO automation_enrollments (campaign_id, user_id, status, current_step_index, context)
                VALUES (:c, :u, 'active', 0, '{}')
                RETURNING id, campaign_id, user_id, status, current_step_index, resume_at, context, waiting_step_path
            """),
            {"c": campaign_id, "u": payload.user_id},
        ).mappings().first()
        automations.advance_enrollment(db, dict(enrollment))
    else:
        automations.check_and_enroll(db, payload.user_id, event_type, {})
    return {"ok": True}


# ---------- Segments ----------

@router.get("/cms/segments")
def list_segments(cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    # Deliberately NOT server-paginated: this list doubles as the full
    # picker source for the "in segment" filter operator (FilterRuleBuilder
    # needs every segment name to resolve an id to a label), and segments
    # are a small, slow-growing list — same reasoning the rest of the CMS
    # kit uses to leave lessons/chapters/team/achievements client-paginated
    # rather than server-paginated. CmsSegments.jsx paginates this client-side.
    rows = db.execute(text("SELECT * FROM automation_segments ORDER BY updated_at DESC")).mappings().all()
    return {"segments": [dict(r) for r in rows]}


@router.post("/cms/segments")
def create_segment(payload: SegmentIn, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    try:
        automations.validate_filter_group(payload.filters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    row = db.execute(
        text("""
            INSERT INTO automation_segments (name, description, filters, created_by)
            VALUES (:name, :description, :filters, :created_by)
            RETURNING id
        """),
        {"name": payload.name, "description": payload.description, "filters": json.dumps(payload.filters), "created_by": cms_user.get("email")},
    ).mappings().first()
    return {"ok": True, "id": row["id"]}


@router.get("/cms/segments/{segment_id}")
def get_segment(segment_id: int, cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    row = db.execute(text("SELECT * FROM automation_segments WHERE id = :id"), {"id": segment_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    return dict(row)


@router.put("/cms/segments/{segment_id}")
def update_segment(segment_id: int, payload: SegmentIn, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    try:
        automations.validate_filter_group(payload.filters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    result = db.execute(
        text("""
            UPDATE automation_segments SET name = :name, description = :description, filters = :filters, updated_at = NOW()
            WHERE id = :id
        """),
        {"id": segment_id, "name": payload.name, "description": payload.description, "filters": json.dumps(payload.filters)},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    return {"ok": True}


@router.delete("/cms/segments/{segment_id}")
def delete_segment(segment_id: int, cms_user: dict = Depends(require_crm_editor), db: Connection = Depends(get_db)):
    result = db.execute(text("DELETE FROM automation_segments WHERE id = :id"), {"id": segment_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    return {"ok": True}


@router.get("/cms/segments/{segment_id}/preview-count")
def preview_segment_count(segment_id: int, cms_user: dict = Depends(require_cms_admin), db: Connection = Depends(get_db)):
    row = db.execute(text("SELECT filters FROM automation_segments WHERE id = :id"), {"id": segment_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    filters = row["filters"] if isinstance(row["filters"], list) else json.loads(row["filters"] or "[]")
    # Evaluated in Python per user rather than compiled to SQL — the field
    # whitelist is small and this endpoint is admin-only/low-traffic, so the
    # simplicity of reusing evaluate_when (one evaluator, not two) outweighs
    # the cost of a full users-table scan here.
    user_ids = [r["id"] for r in db.execute(text("SELECT id FROM users")).mappings().all()]
    count = sum(1 for uid in user_ids if automations.evaluate_when(db, uid, {}, filters))
    return {"count": count, "total_users": len(user_ids)}


# ---------- Cron ----------

@router.post("/cron/advance-automations")
def cron_advance_automations(x_cron_secret: Optional[str] = Header(default=None), db: Connection = Depends(get_db)):
    """Resumes enrollments suspended on a wait step, scans for newly broken
    streaks, and scans segment-entry triggers (all folded in here rather
    than their own cron jobs — see automations.detect_streak_breaks and
    automations.check_segment_triggers — so there's only one job to
    schedule externally). Authenticated with the shared CRON_SECRET, same
    shape as /cron/send-push-reminders in routes_cms.py. Schedule every
    15-30 min."""
    secret = (os.getenv("CRON_SECRET") or "").strip()
    if not secret or not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), secret):
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    streak_breaks_fired = automations.detect_streak_breaks(db)
    segment_entries_enrolled = automations.check_segment_triggers(db)

    rows = db.execute(text("""
        SELECT e.id, e.campaign_id, e.user_id, e.status, e.current_step_index, e.resume_at, e.context, e.waiting_step_path
        FROM automation_enrollments e
        JOIN automation_campaigns c ON c.id = e.campaign_id
        WHERE e.status = 'waiting' AND e.resume_at <= NOW() AND c.status = 'active'
        LIMIT 500
    """)).mappings().all()

    for row in rows:
        automations.advance_enrollment(db, dict(row))

    return {
        "ok": True,
        "streak_breaks_fired": streak_breaks_fired,
        "segment_entries_enrolled": segment_entries_enrolled,
        "advanced": len(rows),
    }
