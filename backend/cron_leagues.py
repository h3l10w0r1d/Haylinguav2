"""Weekly league rollover trigger — run by a scheduler.

Calls POST /cron/leagues/rollover with the shared CRON_SECRET so promotions /
relegations are applied at the week boundary.

Actually scheduled via .github/workflows/league-rollover.yml (Mondays 00:05
UTC) — that needs a CRON_SECRET repo secret set to the same value as the
backend service's CRON_SECRET env var. This script is kept for local/manual
use (e.g. testing, or triggering an out-of-band rollover) and isn't itself
invoked by anything in CI.

Manual use:
  BACKEND_URL=https://haylinguav2.onrender.com CRON_SECRET=... python backend/cron_leagues.py

Or directly:
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
