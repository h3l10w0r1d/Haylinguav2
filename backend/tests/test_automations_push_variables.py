# backend/tests/test_automations_push_variables.py — {{variable}} substitution
# for push/web-push automation steps (previously email-only), including the
# new streak/gems/weekly_xp/league personalization fields shared via
# automations._template_variables.
import sys
import os
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# backend/webpush.py does `from pywebpush import webpush, WebPushException` at
# import time; pywebpush (a real push-service HTTP client) isn't always
# installed in a local dev env even though it's in requirements.txt for
# deploy. Stub it out here so this test file doesn't require it — the real
# send_web_push is monkeypatched per-test anyway, so pywebpush's actual
# behavior is never exercised.
if "pywebpush" not in sys.modules:
    stub = types.ModuleType("pywebpush")
    stub.webpush = lambda *a, **k: None
    class WebPushException(Exception):
        pass
    stub.WebPushException = WebPushException
    sys.modules["pywebpush"] = stub

from sqlalchemy import text

import automations


def _set_stats(db_conn, user_id, *, gems=0, current_streak=0, best_streak=0, weekly_xp=0, league_tier=0):
    db_conn.execute(
        text("""
            UPDATE users SET gems = :gems, current_streak = :cs, best_streak = :bs,
                              weekly_xp = :wx, league_tier = :lt
            WHERE id = :id
        """),
        {"gems": gems, "cs": current_streak, "bs": best_streak, "wx": weekly_xp, "lt": league_tier, "id": user_id},
    )


def test_template_variables_includes_streak_gems_league(db_conn, make_user):
    user_id, _ = make_user(gems=250)
    _set_stats(db_conn, user_id, gems=250, current_streak=7, best_streak=30, weekly_xp=420, league_tier=2)

    variables = automations._template_variables(db_conn, user_id)
    assert variables["gems"] == "250"
    assert variables["streak"] == "7"
    assert variables["best_streak"] == "30"
    assert variables["weekly_xp"] == "420"
    assert variables["league"] == "Gold"  # LEAGUE_TIERS[2] == Bronze, Silver, Gold
    print("OK — _template_variables surfaces gems/streak/best_streak/weekly_xp/league")


def test_send_push_renders_variables(db_conn, make_user, monkeypatch):
    user_id, _ = make_user()
    _set_stats(db_conn, user_id, gems=99, current_streak=5, league_tier=0)
    db_conn.execute(
        text("INSERT INTO device_push_tokens (user_id, token, platform) VALUES (:u, 'tok-1', 'ios')"),
        {"u": user_id},
    )

    captured = []

    def fake_send_push(token, title, body):
        captured.append((token, title, body))

    import apns
    monkeypatch.setattr(apns, "send_push", fake_send_push)

    automations._action_send_push(db_conn, user_id, {
        "title": "Hi {{first_name}}!",
        "body": "You have {{gems}} gems and a {{streak}}-day streak in {{league}}!",
    })

    assert len(captured) == 1
    token, title, body = captured[0]
    assert token == "tok-1"
    assert "{{" not in title and "{{" not in body
    assert "99 gems" in body
    assert "5-day streak" in body
    assert "Bronze" in body
    print("OK — send_push renders {{gems}}/{{streak}}/{{league}} tokens")


def test_send_web_push_renders_variables(db_conn, make_user, monkeypatch):
    user_id, _ = make_user()
    _set_stats(db_conn, user_id, weekly_xp=1200, league_tier=4)
    db_conn.execute(
        text("""
            INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (:u, 'https://example.test/push/abc', 'p256dh-key', 'auth-key')
        """),
        {"u": user_id},
    )

    captured = []

    def fake_send_web_push(subscription, title, body, url):
        captured.append((subscription, title, body, url))
        return "ok"

    import webpush
    monkeypatch.setattr(webpush, "send_web_push", fake_send_web_push)

    automations._action_send_web_push(db_conn, user_id, {
        "title": "{{weekly_xp}} XP this week!",
        "body": "You're in {{league}} league, {{username}}.",
        "url": "https://haylingua.am/dashboard",
    })

    assert len(captured) == 1
    _, title, body, url = captured[0]
    assert title == "1200 XP this week!"
    assert "Ruby" in body  # LEAGUE_TIERS[4] == ... Sapphire, Ruby
    assert url == "https://haylingua.am/dashboard"
    print("OK — send_web_push renders {{weekly_xp}}/{{league}}/{{username}} tokens")
