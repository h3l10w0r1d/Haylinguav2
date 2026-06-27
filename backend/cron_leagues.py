"""Weekly league rollover trigger — run by a scheduler (e.g. Render Cron Job).

Calls POST /cron/leagues/rollover with the shared CRON_SECRET so promotions /
relegations are applied at the week boundary.

Render setup (dashboard → New → Cron Job):
  - Schedule:   0 0 * * 1            # Mondays 00:00 UTC
  - Build:      pip install httpx
  - Command:    python backend/cron_leagues.py
  - Env vars:   BACKEND_URL=https://haylinguav2.onrender.com
                CRON_SECRET=<same value set on the backend web service>

Or from any other scheduler:
  curl -fsS -X POST "$BACKEND_URL/cron/leagues/rollover" -H "X-Cron-Secret: $CRON_SECRET"
"""
import os
import sys

import httpx

BACKEND_URL = (os.getenv("BACKEND_URL") or "https://haylinguav2.onrender.com").rstrip("/")
CRON_SECRET = os.getenv("CRON_SECRET") or ""


def main() -> int:
    if not CRON_SECRET:
        print("[cron_leagues] CRON_SECRET is not set; aborting.")
        return 1
    url = f"{BACKEND_URL}/cron/leagues/rollover"
    try:
        resp = httpx.post(url, headers={"X-Cron-Secret": CRON_SECRET}, timeout=120)
        print(f"[cron_leagues] {resp.status_code} {resp.text[:300]}")
        resp.raise_for_status()
        return 0
    except Exception as e:
        print(f"[cron_leagues] rollover failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
