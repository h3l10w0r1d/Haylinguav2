"""Status page monitor — runs live health checks and logs a snapshot per
service (API, database, TTS, email, sign-in providers) for the public
/status page's 30-day uptime bars.

Render setup (dashboard → New → Cron Job):
  - Schedule:   */5 * * * *           # Every 5 minutes
  - Build:      pip install httpx
  - Command:    python backend/cron_status_check.py
  - Env vars:   BACKEND_URL=https://haylinguav2.onrender.com (optional)
                CRON_SECRET=<same value set on the backend web service>

Or from any other scheduler:
  curl -fsS -X POST "$BACKEND_URL/cron/status-check" -H "X-Cron-Secret: $CRON_SECRET"
"""
import os
import sys

import httpx

BACKEND_URL = (os.getenv("BACKEND_URL") or "https://haylinguav2.onrender.com").rstrip("/")
CRON_SECRET = os.getenv("CRON_SECRET") or ""


def main() -> int:
    if not CRON_SECRET:
        print("[cron_status_check] CRON_SECRET is not set; aborting.")
        return 1
    url = f"{BACKEND_URL}/cron/status-check"
    try:
        resp = httpx.post(url, headers={"X-Cron-Secret": CRON_SECRET}, timeout=60)
        print(f"[cron_status_check] {resp.status_code} {resp.text[:400]}")
        resp.raise_for_status()
        return 0
    except Exception as e:
        print(f"[cron_status_check] check failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
