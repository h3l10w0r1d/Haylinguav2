"""backend/webpush.py — Web Push sender (VAPID, standards-based, no
Firebase middleman) — the browser counterpart to apns.py's mobile push.

Needs two things, set as env vars:

  VAPID_PUBLIC_KEY   - base64url-encoded, uncompressed EC P-256 public key
                       (65 raw bytes: 0x04 || X || Y). The frontend fetches
                       this from GET /webpush/vapid-public-key at subscribe
                       time — it's not secret, just identifies this server
                       to the browser's push service as the same sender on
                       every subscribe/send.
  VAPID_PRIVATE_KEY  - base64url-encoded raw 32-byte EC P-256 private key,
                       matching the public key above. Keep this secret.
  VAPID_SUBJECT       - a mailto: or https: URL identifying the site
                       operator, sent with every push per the VAPID spec
                       (some push services use it to contact you if your
                       server is misbehaving). Defaults to
                       mailto:support@haylingua.am if unset.

A fresh keypair can be generated with the `cryptography` package already in
requirements.txt:

  python3 -c "
  import base64
  from cryptography.hazmat.primitives.asymmetric import ec
  pk = ec.generate_private_key(ec.SECP256R1())
  pub = pk.public_key().public_numbers()
  b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
  print('VAPID_PUBLIC_KEY=' + b64(b'\\x04' + pub.x.to_bytes(32,'big') + pub.y.to_bytes(32,'big')))
  print('VAPID_PRIVATE_KEY=' + b64(pk.private_numbers().private_value.to_bytes(32,'big')))
  "

Until VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are set, send_web_push() no-ops and
returns "failed" rather than raising — same degrade-gracefully contract as
apns.send_push, and GET /webpush/vapid-public-key 503s so the frontend never
even attempts to subscribe.
"""
from __future__ import annotations
import json
import os

from pywebpush import webpush, WebPushException


def _configured() -> bool:
    return bool(os.getenv("VAPID_PUBLIC_KEY") and os.getenv("VAPID_PRIVATE_KEY"))


def send_web_push(subscription: dict, title: str, body: str, url: str | None = None) -> str:
    """Send a single push to one browser subscription.

    Returns "sent", "gone" (the push service reports this subscription no
    longer exists — expired/unsubscribed/uninstalled; the caller should
    delete it from web_push_subscriptions), or "failed" (a transient error;
    leave the subscription in place, it may work next time — including
    "not configured yet", which is never treated as a hard failure of the
    subscription itself).
    """
    if not _configured():
        return "failed"

    private_key = os.environ["VAPID_PRIVATE_KEY"].strip()
    subject = (os.getenv("VAPID_SUBJECT") or "mailto:support@haylingua.am").strip()

    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
        )
        return "sent"
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return "gone"
        print(f"[webpush] send failed ({status}): {e}")
        return "failed"
    except Exception as e:
        print(f"[webpush] send failed: {e}")
        return "failed"
