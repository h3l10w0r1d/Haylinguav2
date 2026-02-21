import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx


BREVO_API_BASE = os.getenv("BREVO_API_BASE", "https://api.brevo.com/v3")


def _enabled() -> bool:
    v = (os.getenv("BREVO_ENABLED") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _api_key() -> Optional[str]:
    k = (os.getenv("BREVO_API_KEY") or "").strip()
    return k or None


def _list_id() -> Optional[int]:
    raw = (os.getenv("BREVO_LIST_ID") or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except Exception:
        return None


def _headers() -> Dict[str, str]:
    # Brevo uses `api-key` header for authentication.
    # https://developers.brevo.com/docs/api-key-authentication
    return {
        "api-key": _api_key() or "",
        "accept": "application/json",
        "content-type": "application/json",
    }


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def upsert_contact(
    *,
    email: str,
    attributes: Dict[str, Any],
    list_id: Optional[int] = None,
    timeout_s: float = 4.0,
    ) -> None:
    """Create or update a Brevo contact.

    Uses `updateEnabled=true` on create to behave like upsert.
    We swallow errors upstream; this must never break the user flow.
    """
    if not _enabled():
        return
    if not _api_key():
        return

    payload: Dict[str, Any] = {
        "email": email,
        "attributes": {k: v for k, v in attributes.items() if v is not None},
        "updateEnabled": True,
    }
    if list_id is None:
        list_id = _list_id()
    if list_id is not None:
        payload["listIds"] = [int(list_id)]

    url = f"{BREVO_API_BASE}/contacts"
    with httpx.Client(timeout=timeout_s) as client:
        # Brevo returns 201 on create, 204/201 depending on upsert behavior.
        # We don't need the body.
        client.post(url, headers=_headers(), json=payload)


def track_event(
    *,
    email: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None,
    event_time: Optional[datetime] = None,
    timeout_s: float = 4.0,
    ) -> None:
    """Send a Brevo Events API event (for automation triggers)."""
    if not _enabled():
        return
    if not _api_key():
        return

    payload: Dict[str, Any] = {
        "email": email,
        "event": event,
    }
    if properties:
        payload["properties"] = {k: v for k, v in properties.items() if v is not None}
    if event_time:
        payload["date"] = _iso(event_time)

    url = f"{BREVO_API_BASE}/events"
    with httpx.Client(timeout=timeout_s) as client:
        client.post(url, headers=_headers(), json=payload)
