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
    try:
        with httpx.Client(timeout=timeout_s) as client:
            r = client.post(url, headers=_headers(), json=payload)
            # Best-effort: never raise to callers.
            if r.status_code >= 400:
                # Log a short diagnostic to server logs for debugging.
                # (Brevo often returns useful JSON errors, e.g. unknown attribute names.)
                try:
                    print("[brevo] upsert_contact failed", r.status_code, r.text[:1000])
                except Exception:
                    pass
    except Exception as e:
        try:
            print("[brevo] upsert_contact exception", repr(e))
        except Exception:
            pass


def send_transactional_email_result(
    *,
    to_email: str,
    subject: str,
    text: Optional[str] = None,
    html: Optional[str] = None,
    sender_email: Optional[str] = None,
    sender_name: Optional[str] = None,
    timeout_s: float = 8.0,
) -> Dict[str, Any]:
    """Like send_transactional_email but returns a diagnostic dict:
    {ok, reason, status?, error?, sender?} — used by the CMS email tester."""
    api_key = _api_key()
    if not api_key:
        return {"ok": False, "reason": "no_api_key"}

    sender_email = (sender_email or os.getenv("BREVO_SENDER_EMAIL") or os.getenv("EMAIL_FROM") or "").strip()
    sender_name = (sender_name or os.getenv("BREVO_SENDER_NAME") or "Haylingua").strip()
    if not sender_email:
        return {"ok": False, "reason": "no_sender"}

    payload: Dict[str, Any] = {
        "sender": {"email": sender_email, "name": sender_name},
        "to": [{"email": to_email}],
        "subject": subject,
    }
    if html:
        payload["htmlContent"] = html
    if text:
        payload["textContent"] = text
    if not html and not text:
        payload["textContent"] = subject

    url = f"{BREVO_API_BASE}/smtp/email"
    try:
        with httpx.Client(timeout=timeout_s) as client:
            r = client.post(url, headers=_headers(), json=payload)
        if 200 <= r.status_code < 300:
            print(f"[brevo] email sent to {to_email} ({r.status_code})")
            return {"ok": True, "status": r.status_code, "sender": sender_email}
        err = ""
        try:
            err = r.text[:800]
        except Exception:
            pass
        print("[brevo] send failed", r.status_code, err)
        return {"ok": False, "reason": "http_error", "status": r.status_code, "error": err, "sender": sender_email}
    except Exception as e:
        print("[brevo] send exception", repr(e))
        return {"ok": False, "reason": "exception", "error": repr(e), "sender": sender_email}


def send_transactional_email(
    *,
    to_email: str,
    subject: str,
    text: Optional[str] = None,
    html: Optional[str] = None,
    sender_email: Optional[str] = None,
    sender_name: Optional[str] = None,
    timeout_s: float = 8.0,
) -> bool:
    """Send a transactional email via Brevo's HTTP API (POST /v3/smtp/email).

    This works on hosts that block outbound SMTP ports (e.g. Render), because it
    uses plain HTTPS. Requires BREVO_API_KEY and a verified sender (EMAIL_FROM or
    BREVO_SENDER_EMAIL). NOT gated on BREVO_ENABLED so account/security emails
    work even when marketing-contact sync is off. Returns True on success.
    """
    res = send_transactional_email_result(
        to_email=to_email, subject=subject, text=text, html=html,
        sender_email=sender_email, sender_name=sender_name, timeout_s=timeout_s,
    )
    return bool(res.get("ok"))


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

    payload: Dict[str, Any] = {"email": email, "event": event}
    if properties:
        payload["properties"] = {k: v for k, v in properties.items() if v is not None}
    # Brevo expects `event_date` (ISO 8601) per API reference.
    if event_time:
        payload["event_date"] = _iso(event_time)

    url = f"{BREVO_API_BASE}/events"
    try:
        with httpx.Client(timeout=timeout_s) as client:
            r = client.post(url, headers=_headers(), json=payload)
            if r.status_code >= 400:
                try:
                    print("[brevo] track_event failed", r.status_code, r.text[:1000])
                except Exception:
                    pass
    except Exception as e:
        try:
            print("[brevo] track_event exception", repr(e))
        except Exception:
            pass
