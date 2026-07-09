# backend/routes_autofix.py — Sentry → GitHub Actions bridge for AI-assisted
# incident triage.
#
# Flow:
#   1. A Sentry "Issue Alert" rule (condition: "A new issue is created") posts
#      here on genuinely new errors — NOT on every occurrence of a recurring
#      one, so this fires once per distinct bug, not once per request.
#   2. We verify the request really came from Sentry (HMAC signature over the
#      raw body, using the shared secret from the Sentry internal
#      integration), then forward a distilled payload to GitHub's
#      repository_dispatch API.
#   3. That dispatch triggers .github/workflows/sentry-auto-fix.yml, which
#      runs Claude Code in a scratch environment to reproduce, diagnose, and
#      fix — and opens a PR. It NEVER pushes to main directly; a human merges.
#
# This endpoint deliberately does the least possible work itself (no DB
# writes, no retries, no queue) — it's a thin, fast, verifiable bridge.
from __future__ import annotations

import hashlib
import hmac
import os
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter(tags=["autofix"])

GITHUB_API = "https://api.github.com"


def _verify_sentry_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    """Sentry internal-integration webhooks sign the raw request body with
    HMAC-SHA256 over the shared client secret, sent as Sentry-Hook-Signature."""
    secret = (os.getenv("SENTRY_WEBHOOK_SECRET") or "").strip()
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def _distill_issue(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Pull just the fields Claude Code needs out of Sentry's (large) issue
    webhook payload, so the GitHub dispatch client_payload stays small and
    the fix-agent's prompt stays focused."""
    issue = payload.get("data", {}).get("issue") or payload.get("issue") or {}
    metadata = issue.get("metadata") or {}
    return {
        "issue_id": str(issue.get("id") or ""),
        "short_id": issue.get("shortId") or "",
        "title": issue.get("title") or metadata.get("value") or "Unknown error",
        "culprit": issue.get("culprit") or "",
        "level": issue.get("level") or "error",
        "permalink": issue.get("permalink") or "",
        "count": issue.get("count") or "1",
        "first_seen": issue.get("firstSeen") or "",
        "type": metadata.get("type") or "",
        "value": metadata.get("value") or "",
    }


async def _trigger_github_workflow(issue: Dict[str, Any]) -> None:
    token = (os.getenv("GITHUB_DISPATCH_TOKEN") or "").strip()
    repo = (os.getenv("GITHUB_REPO") or "").strip()  # "owner/name"
    if not token or not repo:
        raise HTTPException(status_code=503, detail="Auto-fix dispatch is not configured on this server")

    url = f"{GITHUB_API}/repos/{repo}/dispatches"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={"event_type": "sentry-issue", "client_payload": issue},
        )
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"GitHub dispatch failed: {resp.status_code} {resp.text[:300]}")


@router.post("/internal/sentry-webhook")
async def sentry_webhook(
    request: Request,
    sentry_hook_signature: Optional[str] = Header(default=None, alias="Sentry-Hook-Signature"),
    sentry_hook_resource: Optional[str] = Header(default=None, alias="Sentry-Hook-Resource"),
):
    raw_body = await request.body()

    if not _verify_sentry_signature(raw_body, sentry_hook_signature):
        raise HTTPException(status_code=401, detail="Invalid Sentry signature")

    # Only "issue" resource events represent an actual error/issue (as
    # opposed to comment/installation events on the same integration).
    if sentry_hook_resource and sentry_hook_resource != "issue":
        return {"ok": True, "skipped": f"resource={sentry_hook_resource}"}

    payload = await request.json()
    issue = _distill_issue(payload)
    if not issue["issue_id"]:
        return {"ok": True, "skipped": "no issue id in payload"}

    await _trigger_github_workflow(issue)
    return {"ok": True, "dispatched": issue["short_id"] or issue["issue_id"]}
