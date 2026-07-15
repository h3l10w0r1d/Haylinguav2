# backend/tests/test_email_and_invite_expiry.py
"""Naive-vs-aware datetime bug: email_verification_codes.expires_at/last_sent_at
and cms_invites.expires_at are TIMESTAMPTZ columns (psycopg2 returns them as
timezone-aware datetimes), but routes.py's POST /auth/verify-email + resend
cooldown check, and routes_cms.py's POST /cms/invites/accept, compared them
directly against naive datetime.utcnow() — `aware < naive` raises
`TypeError: can't compare offset-naive and offset-aware datetimes`. Every
other place in the codebase that does this kind of comparison strips tzinfo
first (see password_reset_expires_at at routes.py:3544); these three sites
didn't. Never caught before because no test exercised either endpoint."""
import hashlib
import uuid

from sqlalchemy import text


def _code_hash(code):
    import routes as routes_mod

    return routes_mod._hash_code(code)


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-email-invite-expiry@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def test_verify_email_with_unexpired_code_does_not_crash(client, db_conn, make_user):
    user_id, headers = make_user()
    db_conn.execute(
        text(
            """
            INSERT INTO email_verification_codes (user_id, code_hash, expires_at, last_sent_at)
            VALUES (:u, :h, NOW() + INTERVAL '10 minutes', NOW())
            ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
                expires_at = EXCLUDED.expires_at, last_sent_at = EXCLUDED.last_sent_at, attempts = 0
            """
        ),
        {"u": user_id, "h": _code_hash("000000")},
    )

    r = client.post("/auth/verify-email", json={"code": "111111"}, headers=headers)
    # Wrong code — but the point is it must reach the "wrong code" branch
    # (400 INVALID_CODE) instead of crashing on the expiry comparison (500).
    assert r.status_code == 400, r.text
    assert r.json().get("detail") != "CODE_EXPIRED"


def test_verify_email_with_expired_code_returns_400_not_500(client, db_conn, make_user):
    user_id, headers = make_user()
    db_conn.execute(
        text(
            """
            INSERT INTO email_verification_codes (user_id, code_hash, expires_at, last_sent_at)
            VALUES (:u, :h, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '11 minutes')
            ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
                expires_at = EXCLUDED.expires_at, last_sent_at = EXCLUDED.last_sent_at, attempts = 0
            """
        ),
        {"u": user_id, "h": _code_hash("000000")},
    )

    r = client.post("/auth/verify-email", json={"code": "000000"}, headers=headers)
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "CODE_EXPIRED"


def test_resend_verification_cooldown_does_not_crash(client, db_conn, make_user):
    user_id, headers = make_user()
    db_conn.execute(text("UPDATE users SET email_verified = FALSE WHERE id = :u"), {"u": user_id})
    db_conn.execute(
        text(
            """
            INSERT INTO email_verification_codes (user_id, code_hash, expires_at, last_sent_at)
            VALUES (:u, :h, NOW() + INTERVAL '10 minutes', NOW())
            ON CONFLICT (user_id) DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at
            """
        ),
        {"u": user_id, "h": _code_hash("000000")},
    )

    r = client.post("/auth/resend-verification", headers=headers)
    assert r.status_code == 429, r.text
    assert r.json()["detail"]["code"] == "RESEND_COOLDOWN"


def test_cms_invite_accept_rejects_expired_invite_without_crashing(client, db_conn):
    token = f"pytest-expired-invite-token-{uuid.uuid4().hex[:8]}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    email = f"pytest-invitee-expired-{uuid.uuid4().hex[:8]}@example.test"
    db_conn.execute(
        text(
            """
            INSERT INTO cms_invites (email, role, token_hash, expires_at)
            VALUES (:email, 'admin', :h, NOW() - INTERVAL '1 hour')
            """
        ),
        {"h": token_hash, "email": email},
    )

    r = client.post("/cms/invites/accept", json={"token": token, "password": "SomeStrongPass123"})
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "Invite expired"


def test_cms_invite_accept_accepts_valid_invite(client, db_conn):
    token = f"pytest-valid-invite-token-{uuid.uuid4().hex[:8]}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    email = f"pytest-invitee-valid-{uuid.uuid4().hex[:8]}@example.test"
    db_conn.execute(
        text(
            """
            INSERT INTO cms_invites (email, role, token_hash, expires_at)
            VALUES (:email, 'admin', :h, NOW() + INTERVAL '1 hour')
            """
        ),
        {"h": token_hash, "email": email},
    )

    r = client.post("/cms/invites/accept", json={"token": token, "password": "SomeStrongPass123"})
    assert r.status_code == 200, r.text
