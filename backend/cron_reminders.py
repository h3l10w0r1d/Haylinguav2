"""Daily streak reminder — send Telegram messages to users who haven't practiced today.

Render setup (dashboard → New → Cron Job):
  - Schedule:   0 19 * * *            # Every day at 19:00 UTC
  - Build:      pip install httpx
  - Command:    python backend/cron_reminders.py
  - Env vars:   DATABASE_URL=<same as backend>
                TELEGRAM_BOT_KEY=<bot token>
                CRON_SECRET=<shared secret>
                BACKEND_URL=https://haylinguav2.onrender.com (optional)

Or trigger via the API endpoint (add to routes.py or call from any scheduler):
  curl -fsS -X POST "$BACKEND_URL/cron/send-reminders" -H "X-Cron-Secret: $CRON_SECRET"
"""
import os
import sys

import httpx

BACKEND_URL = (os.getenv("BACKEND_URL") or "https://haylinguav2.onrender.com").rstrip("/")
TELEGRAM_BOT_KEY = os.getenv("TELEGRAM_BOT_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Messages sent in rotation so it doesn't feel robotic
REMINDER_MESSAGES = [
    "🔥 Hey! Your Armenian streak is waiting. Do a quick lesson today and keep the flame alive!",
    "📚 Don't break your streak! Just 5 minutes of Armenian practice keeps you on track. Let's go!",
    "🇦🇲 Your streak is counting on you! Open Haylingua and do today's lesson.",
    "⏰ One lesson a day keeps the streak alive! Come back to Haylingua today.",
    "✨ Small steps every day. Your Armenian is getting better — don't stop now!",
]


def send_telegram(bot_token: str, chat_id: int, text: str) -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        r = httpx.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        return r.status_code == 200
    except Exception as e:
        print(f"  [telegram] send failed for {chat_id}: {e}")
        return False


def get_at_risk_users(db_url: str) -> list[dict]:
    """Return users with a telegram_id who haven't completed a lesson today (UTC)."""
    try:
        import sqlalchemy as sa

        engine = sa.create_engine(db_url)
        with engine.connect() as conn:
            rows = conn.execute(
                sa.text("""
                    SELECT u.id, u.telegram_id, u.display_name, u.first_name,
                           u.current_streak
                    FROM users u
                    WHERE u.telegram_id IS NOT NULL
                      AND u.current_streak > 0
                      AND NOT EXISTS (
                          SELECT 1 FROM lesson_progress lp
                          WHERE lp.user_id = u.id
                            AND lp.completed_at >= CURRENT_DATE
                      )
                    LIMIT 500
                """)
            ).mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[reminders] DB query failed: {e}")
        return []


def build_message(user: dict, index: int) -> str:
    name = user.get("first_name") or user.get("display_name") or "learner"
    streak = int(user.get("current_streak") or 0)
    base = REMINDER_MESSAGES[index % len(REMINDER_MESSAGES)]
    if streak > 1:
        base += f"\n\n🔢 Your current streak: <b>{streak} days</b> — don't lose it!"
    return base


def main() -> int:
    if not TELEGRAM_BOT_KEY:
        print("[reminders] TELEGRAM_BOT_KEY is not set; aborting.")
        return 1
    if not DATABASE_URL:
        print("[reminders] DATABASE_URL is not set; aborting.")
        return 1

    print("[reminders] Fetching at-risk users…")
    users = get_at_risk_users(DATABASE_URL)
    print(f"[reminders] Found {len(users)} users to remind.")

    sent = 0
    for i, user in enumerate(users):
        chat_id = user.get("telegram_id")
        if not chat_id:
            continue
        msg = build_message(user, i)
        ok = send_telegram(TELEGRAM_BOT_KEY, int(chat_id), msg)
        if ok:
            sent += 1
            print(f"  ✓ user {user['id']} (streak {user.get('current_streak')})")
        else:
            print(f"  ✗ user {user['id']} — send failed")

    print(f"[reminders] Done. Sent {sent}/{len(users)} reminders.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
