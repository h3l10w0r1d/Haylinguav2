"""backend/apns.py — raw APNs sender (token-based provider auth, no
Firebase/OneSignal middleman). Needs three things from the Apple Developer
Portal, set as env vars:

  APNS_KEY_ID     - the 10-char Key ID shown after creating an APNs Auth Key
                    (Certificates, Identifiers & Profiles -> Keys -> "+")
  APNS_TEAM_ID    - your 10-char Team ID (top-right of the portal, or
                    Membership details)
  APNS_KEY_P8     - the *contents* of the downloaded AuthKey_XXXX.p8 file,
                    including the "-----BEGIN PRIVATE KEY-----" lines
  APNS_BUNDLE_ID  - the app's bundle id (must match "apns-topic"); defaults
                    to org.reactjs.native.example.HaylinguaMobile
  APNS_USE_SANDBOX - "1" to hit the sandbox host (debug/TestFlight builds
                    signed with a development provisioning profile use
                    the sandbox APNs environment, not production)

Until those are set, send_push() no-ops and returns False rather than
raising, so the reminder cron degrades gracefully instead of crashing.
"""
from __future__ import annotations
import os
import time
import jwt
import httpx

_PROD_HOST = "https://api.push.apple.com"
_SANDBOX_HOST = "https://api.sandbox.push.apple.com"

_cached_token: str | None = None
_cached_token_at: float = 0.0
_TOKEN_TTL_S = 45 * 60  # Apple tokens are valid up to 60min; refresh at 45


def _configured() -> bool:
    return bool(os.getenv("APNS_KEY_ID") and os.getenv("APNS_TEAM_ID") and os.getenv("APNS_KEY_P8"))


def _provider_token() -> str:
    global _cached_token, _cached_token_at
    now = time.time()
    if _cached_token and (now - _cached_token_at) < _TOKEN_TTL_S:
        return _cached_token

    key_id = os.environ["APNS_KEY_ID"].strip()
    team_id = os.environ["APNS_TEAM_ID"].strip()
    private_key = os.environ["APNS_KEY_P8"].replace("\\n", "\n")

    _cached_token = jwt.encode(
        {"iss": team_id, "iat": int(now)},
        private_key,
        algorithm="ES256",
        headers={"kid": key_id},
    )
    _cached_token_at = now
    return _cached_token


def send_push(device_token: str, title: str, body: str, badge: int | None = None, sound: str = "default") -> bool:
    """Send a single alert push. Returns True on Apple's 200, False otherwise
    (including when APNs isn't configured yet — never raises)."""
    if not _configured():
        return False

    bundle_id = os.getenv("APNS_BUNDLE_ID", "org.reactjs.native.example.HaylinguaMobile")
    host = _SANDBOX_HOST if os.getenv("APNS_USE_SANDBOX") == "1" else _PROD_HOST

    aps: dict = {"alert": {"title": title, "body": body}, "sound": sound}
    if badge is not None:
        aps["badge"] = int(badge)

    try:
        with httpx.Client(http2=True, timeout=10) as client:
            resp = client.post(
                f"{host}/3/device/{device_token}",
                json={"aps": aps},
                headers={
                    "authorization": f"bearer {_provider_token()}",
                    "apns-topic": bundle_id,
                    "apns-push-type": "alert",
                    "apns-priority": "10",
                },
            )
        return resp.status_code == 200
    except Exception as e:
        print(f"[apns] send failed for token {device_token[:12]}…: {e}")
        return False
