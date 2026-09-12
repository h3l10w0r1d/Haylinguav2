# backend/email_compliance.py — the unsubscribe mechanism every
# marketing/bulk email must carry (CAN-SPAM/GDPR require a working
# one-click opt-out; transactional email like signup/password-reset is
# exempt and never touches this module). Stateless — no new table.
#
# The token is a keyed HMAC over the user id, reusing auth.py's
# JWT_SECRET_KEY (already guaranteed set in production, or login itself
# is broken) with a domain-separating "unsub:" prefix so a leaked token
# can never be replayed as anything else this secret signs. Worst case
# of a guessed/leaked token is someone force-unsubscribing one other
# known user — low-severity, not a security breach — so a stateless MAC
# is the right amount of machinery here, not a DB-stored token.
from __future__ import annotations
import hashlib
import hmac
import os
from typing import Dict
from urllib.parse import quote

from auth import JWT_SECRET_KEY


def unsubscribe_token(user_id: int) -> str:
    return hmac.new(JWT_SECRET_KEY.encode(), f"unsub:{user_id}".encode(), hashlib.sha256).hexdigest()


def verify_unsubscribe_token(user_id: int, token: str) -> bool:
    if not token:
        return False
    return hmac.compare_digest(unsubscribe_token(user_id), token)


def _api_base() -> str:
    # Same base every other emailed link (click/open tracking) already
    # uses — see automations.py's _tracking_base_url().
    return (os.getenv("PUBLIC_API_BASE_URL") or "https://haylinguav2.onrender.com/api").rstrip("/")


def unsubscribe_url(user_id: int) -> str:
    token = unsubscribe_token(user_id)
    return f"{_api_base()}/email/unsubscribe?u={user_id}&t={token}"


def unsubscribe_footer_text(user_id: int) -> str:
    return f"\n\n---\nDon't want these emails? Unsubscribe: {unsubscribe_url(user_id)}"


def unsubscribe_footer_html(user_id: int) -> str:
    url = unsubscribe_url(user_id)
    return (
        '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;'
        'font-size:12px;color:#94A3B8;font-family:sans-serif;">'
        f'You\'re receiving this from Haylingua. '
        f'<a href="{quote(url, safe=":/?=&")}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe</a>'
        "</div>"
    )


def list_unsubscribe_header(user_id: int) -> Dict[str, str]:
    url = unsubscribe_url(user_id)
    mailto = (os.getenv("EMAIL_FROM") or "no-reply@haylingua.am").strip()
    return {
        "List-Unsubscribe": f"<mailto:{mailto}>, <{url}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
