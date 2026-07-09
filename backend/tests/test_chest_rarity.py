# backend/tests/test_chest_rarity.py
"""Chest rarity system: rarity is rolled server-side at open time from the
chest_rarities weights table, gems are rolled within the rolled tier's rows
in chest_rewards, and legendary is a jackpot (gems + XP boost together,
with reward_type kept as "gems" for deploy-skew safety).

Drives the real HTTP endpoint against real Postgres (same conftest bootstrap
as the rest of the suite). Determinism is achieved by editing the
chest_rarities weights (the loader filters weight > 0), not by monkeypatching
randomness — the full production code path runs every time."""
from collections import Counter

from sqlalchemy import text

RARITIES = ("wooden", "silver", "golden", "legendary")


def _grant_chests(db_conn, user_id, n):
    db_conn.execute(
        text("UPDATE users SET chests = :n WHERE id = :u"),
        {"n": n, "u": user_id},
    )


def _force_rarity(db_conn, rarity):
    """Make the loader see only one tier by zeroing the others' weights
    (the loader filters weight > 0). Returns the original rows for restore."""
    original = db_conn.execute(
        text("SELECT rarity, weight FROM chest_rarities")
    ).mappings().all()
    db_conn.execute(
        text("UPDATE chest_rarities SET weight = 0 WHERE rarity != :r"),
        {"r": rarity},
    )
    db_conn.execute(
        text("UPDATE chest_rarities SET weight = 100 WHERE rarity = :r"),
        {"r": rarity},
    )
    return original


def _restore_rarities(db_conn, original):
    for row in original:
        db_conn.execute(
            text("UPDATE chest_rarities SET weight = :w WHERE rarity = :r"),
            {"w": row["weight"], "r": row["rarity"]},
        )


def test_open_chest_response_contract(client, db_conn, make_user):
    user_id, headers = make_user()
    _grant_chests(db_conn, user_id, 5)

    r = client.post("/me/chests/open", headers=headers)
    assert r.status_code == 200, r.text
    d = r.json()

    assert d["ok"] is True
    assert d["rarity"] in RARITIES
    assert d["reward_type"] in ("gems", "xp_boost")
    assert isinstance(d["xp_boost_granted"], bool)
    assert d["chests"] == 4  # decremented

    if d["reward_type"] == "gems":
        assert d["reward_gems"] > 0
        gems_db = db_conn.execute(
            text("SELECT COALESCE(gems, 0) FROM users WHERE id = :u"), {"u": user_id}
        ).scalar()
        assert gems_db == d["reward_gems"] == d["gems"]
    else:
        assert d["reward_gems"] == 0
        boost = db_conn.execute(
            text("SELECT xp_multiplier_active FROM users WHERE id = :u"), {"u": user_id}
        ).scalar()
        assert boost is True


def test_legendary_jackpot(client, db_conn, make_user):
    user_id, headers = make_user()
    _grant_chests(db_conn, user_id, 1)
    original = _force_rarity(db_conn, "legendary")
    try:
        r = client.post("/me/chests/open", headers=headers)
        assert r.status_code == 200, r.text
        d = r.json()

        assert d["rarity"] == "legendary"
        # Jackpot: gems AND boost together; reward_type stays "gems" so an
        # older frontend still renders correctly (deploy-skew contract).
        assert d["reward_type"] == "gems"
        assert d["reward_gems"] >= 100  # legendary tier min is 150 seeded
        assert d["xp_boost_granted"] is True

        boost = db_conn.execute(
            text("SELECT xp_multiplier_active FROM users WHERE id = :u"), {"u": user_id}
        ).scalar()
        assert boost is True
        gems_db = db_conn.execute(
            text("SELECT COALESCE(gems, 0) FROM users WHERE id = :u"), {"u": user_id}
        ).scalar()
        assert gems_db == d["reward_gems"]
    finally:
        _restore_rarities(db_conn, original)


def test_each_rarity_pays_from_its_own_tier(client, db_conn, make_user):
    """Force each tier and check the gem payout falls inside that tier's
    seeded reward range (when the roll lands on gems)."""
    ranges = {"wooden": (10, 60), "silver": (25, 50), "golden": (50, 100), "legendary": (150, 300)}
    for rarity, (lo, hi) in ranges.items():
        user_id, headers = make_user()
        _grant_chests(db_conn, user_id, 10)
        original = _force_rarity(db_conn, rarity)
        try:
            # Open a few — skip xp_boost rolls, assert every gems roll in range.
            saw_gems = False
            for _ in range(10):
                d = client.post("/me/chests/open", headers=headers).json()
                assert d["rarity"] == rarity
                if d["reward_type"] == "gems":
                    saw_gems = True
                    assert lo <= d["reward_gems"] <= hi, (rarity, d["reward_gems"])
            assert saw_gems, f"never rolled gems in 10 opens for {rarity}"
        finally:
            _restore_rarities(db_conn, original)


def test_rarity_distribution_sanity(client, db_conn, make_user):
    """With default weights (55/30/12/3), wooden must be the most common
    outcome over 200 opens and every value must be a known rarity."""
    user_id, headers = make_user()
    _grant_chests(db_conn, user_id, 200)

    counts = Counter()
    for _ in range(200):
        d = client.post("/me/chests/open", headers=headers).json()
        assert d["rarity"] in RARITIES
        counts[d["rarity"]] += 1

    assert counts.most_common(1)[0][0] == "wooden", counts


def test_open_with_zero_chests_is_rejected(client, db_conn, make_user):
    user_id, headers = make_user()
    _grant_chests(db_conn, user_id, 0)
    r = client.post("/me/chests/open", headers=headers)
    assert r.status_code == 400


def _cms_headers(db_conn):
    """Insert an active CMS admin and mint a real CMS JWT via the app's own
    encoder, so the CMS endpoints are exercised exactly as the CMS client."""
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-cms-admin@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def test_cms_chest_roundtrip(client, db_conn):
    headers = _cms_headers(db_conn)

    # Snapshot to restore afterwards (other tests depend on seeded values).
    before = client.get("/cms/shop/chest", headers=headers)
    assert before.status_code == 200, before.text
    snapshot = before.json()
    assert set(r["rarity"] for r in snapshot["rarities"]) == set(RARITIES)

    try:
        payload = {
            "rewards": [
                {"gems": 11, "weight": 5, "rarity": "wooden"},
                {"gems": 33, "weight": 5, "rarity": "silver"},
                {"gems": 77, "weight": 5, "rarity": "golden"},
                {"gems": 222, "weight": 5, "rarity": "legendary"},
                {"gems": 12, "weight": 3},  # no rarity → wooden
            ],
            "rarities": [
                {"rarity": "wooden", "weight": 70, "xp_boost_chance": 30},
                {"rarity": "silver", "weight": 20, "xp_boost_chance": 15},
                {"rarity": "golden", "weight": 8, "xp_boost_chance": 5},
                {"rarity": "legendary", "weight": 2, "xp_boost_chance": 0},
            ],
        }
        r = client.put("/cms/shop/chest", json=payload, headers=headers)
        assert r.status_code == 200, r.text

        back = client.get("/cms/shop/chest", headers=headers).json()
        by_rarity = Counter(row["rarity"] for row in back["rewards"])
        assert by_rarity["wooden"] == 2  # explicit + defaulted
        assert by_rarity["silver"] == by_rarity["golden"] == by_rarity["legendary"] == 1
        weights = {r["rarity"]: r["weight"] for r in back["rarities"]}
        assert weights == {"wooden": 70, "silver": 20, "golden": 8, "legendary": 2}

        # Unknown rarity rejected
        bad = client.put(
            "/cms/shop/chest",
            json={"rewards": [{"gems": 5, "weight": 1, "rarity": "mythic"}]},
            headers=headers,
        )
        assert bad.status_code == 400
    finally:
        restore = {
            "rewards": [
                {"gems": row["gems"], "weight": row["weight"], "rarity": row["rarity"]}
                for row in snapshot["rewards"]
            ],
            "rarities": snapshot["rarities"],
        }
        client.put("/cms/shop/chest", json=restore, headers=headers)
