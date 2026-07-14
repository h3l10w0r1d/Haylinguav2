# backend/tests/test_friend_suggestions.py
"""Smart friend suggestions: weighted, explainable scoring across league
cohort, referral graph, mutual friends, onboarding cohort, shared learning
profile, and progress proximity. See _score_friend_suggestion in routes.py."""
from sqlalchemy import text


def _set_league(db_conn, user_id, week, cohort, tier=0):
    db_conn.execute(
        text("UPDATE users SET league_week = :w, league_cohort = :c, league_tier = :t WHERE id = :u"),
        {"w": week, "c": cohort, "t": tier, "u": user_id},
    )


def _set_onboarding(db_conn, user_id, **fields):
    db_conn.execute(
        text("""
            INSERT INTO user_onboarding (user_id, country, dialect, primary_goal, source_language, updated_at)
            VALUES (:u, :country, :dialect, :primary_goal, :source_language, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                country = EXCLUDED.country, dialect = EXCLUDED.dialect,
                primary_goal = EXCLUDED.primary_goal, source_language = EXCLUDED.source_language
        """),
        {
            "u": user_id,
            "country": fields.get("country"),
            "dialect": fields.get("dialect"),
            "primary_goal": fields.get("primary_goal"),
            "source_language": fields.get("source_language"),
        },
    )


def test_requires_auth(client):
    r = client.get("/friends/suggestions")
    assert r.status_code == 401


def test_excludes_self_existing_friends_and_pending_requests(client, db_conn, make_user):
    me_id, me_headers = make_user()
    friend_id, _ = make_user()
    pending_id, _ = make_user()
    stranger_id, _ = make_user()

    db_conn.execute(text("INSERT INTO friends (user_id, friend_id) VALUES (:a, :b), (:b, :a)"), {"a": me_id, "b": friend_id})
    db_conn.execute(text("INSERT INTO friend_requests (requester_id, addressee_id, status) VALUES (:a, :b, 'pending')"), {"a": me_id, "b": pending_id})

    r = client.get("/friends/suggestions", headers=me_headers)
    assert r.status_code == 200, r.text
    ids = [s["user_id"] for s in r.json()]
    assert friend_id not in ids
    assert pending_id not in ids
    assert me_id not in ids
    assert stranger_id in ids


def test_excludes_hidden_profiles(client, db_conn, make_user):
    me_id, me_headers = make_user()
    hidden_id, _ = make_user()
    db_conn.execute(text("UPDATE users SET is_hidden = TRUE WHERE id = :u"), {"u": hidden_id})

    r = client.get("/friends/suggestions", headers=me_headers)
    assert r.status_code == 200, r.text
    ids = [s["user_id"] for s in r.json()]
    assert hidden_id not in ids


def test_same_league_cohort_scores_highest_with_reason(client, db_conn, make_user):
    me_id, me_headers = make_user()
    same_league_id, _ = make_user()
    other_league_id, _ = make_user()

    _set_league(db_conn, me_id, "2026-W28", 3, tier=1)
    _set_league(db_conn, same_league_id, "2026-W28", 3, tier=1)
    _set_league(db_conn, other_league_id, "2026-W28", 9, tier=1)

    r = client.get("/friends/suggestions", headers=me_headers)
    assert r.status_code == 200, r.text
    by_id = {s["user_id"]: s for s in r.json()}

    assert "In your league this week" in by_id[same_league_id]["reasons"]
    assert "In your league this week" not in by_id[other_league_id]["reasons"]
    assert by_id[same_league_id]["score"] > by_id[other_league_id]["score"]


def test_direct_referral_outranks_shared_referrer(client, db_conn, make_user):
    me_id, me_headers = make_user()
    referrer_id, _ = make_user()
    i_invited_id, _ = make_user()
    same_referrer_id, _ = make_user()
    unrelated_id, _ = make_user()

    db_conn.execute(text("UPDATE users SET referred_by = :r WHERE id = :u"), {"r": referrer_id, "u": me_id})
    db_conn.execute(text("UPDATE users SET referred_by = :r WHERE id = :u"), {"r": referrer_id, "u": same_referrer_id})
    db_conn.execute(text("UPDATE users SET referred_by = :r WHERE id = :u"), {"r": me_id, "u": i_invited_id})

    r = client.get("/friends/suggestions", headers=me_headers)
    assert r.status_code == 200, r.text
    by_id = {s["user_id"]: s for s in r.json()}

    assert "You invited them" in by_id[i_invited_id]["reasons"]
    assert "Invited by the same person" in by_id[same_referrer_id]["reasons"]
    assert by_id[i_invited_id]["score"] > by_id[same_referrer_id]["score"]
    assert by_id[unrelated_id]["score"] < by_id[same_referrer_id]["score"]


def test_mutual_friends_counted_and_capped(client, db_conn, make_user):
    me_id, me_headers = make_user()
    mutual_a, _ = make_user()
    mutual_b, _ = make_user()
    candidate_id, _ = make_user()
    no_mutual_id, _ = make_user()

    # me <-> mutual_a, me <-> mutual_b
    for f in (mutual_a, mutual_b):
        db_conn.execute(text("INSERT INTO friends (user_id, friend_id) VALUES (:a, :b), (:b, :a)"), {"a": me_id, "b": f})
    # candidate <-> mutual_a, candidate <-> mutual_b (both are mutual friends of candidate too)
    for f in (mutual_a, mutual_b):
        db_conn.execute(text("INSERT INTO friends (user_id, friend_id) VALUES (:a, :b), (:b, :a)"), {"a": candidate_id, "b": f})

    r = client.get("/friends/suggestions", headers=me_headers)
    assert r.status_code == 200, r.text
    by_id = {s["user_id"]: s for s in r.json()}

    assert "2 mutual friends" in by_id[candidate_id]["reasons"]
    assert by_id[candidate_id]["score"] > by_id[no_mutual_id]["score"]


def test_shared_learning_profile_scored(client, db_conn, make_user):
    me_id, me_headers = make_user()
    same_country_id, _ = make_user()
    different_id, _ = make_user()

    _set_onboarding(db_conn, me_id, country="Armenia", dialect="Eastern", primary_goal="heritage", source_language="en")
    _set_onboarding(db_conn, same_country_id, country="Armenia", dialect="Western", primary_goal="travel", source_language="fr")
    _set_onboarding(db_conn, different_id, country="France", dialect="Western", primary_goal="travel", source_language="fr")

    r = client.get("/friends/suggestions", headers=me_headers)
    assert r.status_code == 200, r.text
    by_id = {s["user_id"]: s for s in r.json()}

    assert "Also learning from Armenia" in by_id[same_country_id]["reasons"]
    assert by_id[same_country_id]["score"] > by_id[different_id]["score"]


def test_ranked_highest_score_first(client, db_conn, make_user):
    me_id, me_headers = make_user()
    strong_id, _ = make_user()
    weak_id, _ = make_user()

    _set_league(db_conn, me_id, "2026-W30", 1, tier=0)
    _set_league(db_conn, strong_id, "2026-W30", 1, tier=0)
    db_conn.execute(text("UPDATE users SET referred_by = :r WHERE id = :u"), {"r": me_id, "u": strong_id})

    r = client.get("/friends/suggestions", headers=me_headers, params={"limit": 50})
    assert r.status_code == 200, r.text
    scores = [s["score"] for s in r.json()]
    assert scores == sorted(scores, reverse=True)
    ids = [s["user_id"] for s in r.json()]
    assert ids.index(strong_id) < ids.index(weak_id)


def test_limit_is_clamped(client, make_user):
    _, headers = make_user()
    r = client.get("/friends/suggestions", headers=headers, params={"limit": 9999})
    assert r.status_code == 200, r.text
    assert len(r.json()) <= 50
