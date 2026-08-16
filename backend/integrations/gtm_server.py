import os
from typing import Any, Dict, Optional

import httpx


def _enabled() -> bool:
    v = (os.getenv("GTM_SERVER_ENABLED") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _url() -> Optional[str]:
    u = (os.getenv("GTM_SERVER_URL") or "").strip()
    return u.rstrip("/") or None


def send_event(
    *,
    event_name: str,
    event_id: Optional[str],
    user_data: Dict[str, Any],
    custom_data: Optional[Dict[str, Any]] = None,
    timeout_s: float = 4.0,
) -> None:
    """Forward a server-side event to our GTM server-side container, which
    holds the actual Meta Conversions API tag + access token (never stored
    in our own env — see the marketing integration plan). The same
    `event_id` a browser-side Pixel fire used for this same real-world
    event must be passed here so Meta deduplicates instead of
    double-counting.

    Best-effort: never raises to callers, mirrors integrations/brevo.py's
    contract exactly (we swallow errors upstream; this must never break the
    request it's attached to).
    """
    if not _enabled():
        return
    url = _url()
    if not url:
        return

    payload: Dict[str, Any] = {
        "event_name": event_name,
        "event_id": event_id,
        "user_data": {k: v for k, v in user_data.items() if v is not None},
        "custom_data": {k: v for k, v in (custom_data or {}).items() if v is not None},
    }
    try:
        with httpx.Client(timeout=timeout_s) as client:
            r = client.post(f"{url}/gtm/collect", json=payload)
            if r.status_code >= 400:
                try:
                    print("[gtm_server] send_event failed", r.status_code, r.text[:500])
                except Exception:
                    pass
    except Exception as e:
        try:
            print("[gtm_server] send_event exception", repr(e))
        except Exception:
            pass
