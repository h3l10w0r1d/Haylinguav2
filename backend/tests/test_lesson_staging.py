# backend/tests/test_lesson_staging.py
"""CMS staging workflow: new lessons/chapters default to draft, draft lessons
are invisible to the public GET /lessons/{slug}, and a CMS-minted preview
link is the one way in — scoped to that lesson, short-lived."""
import uuid

from sqlalchemy import text


def _cms_headers(db_conn):
    """Insert an active CMS admin and mint a real CMS JWT via the app's own
    encoder, so the CMS endpoints are exercised exactly as the CMS client."""
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-lesson-staging@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def _create_lesson(client, cms_headers, **overrides):
    suffix = overrides.pop("suffix", "1")
    payload = {
        "slug": overrides.pop("slug", f"staging-test-{suffix}-{uuid.uuid4().hex[:8]}"),
        "title": "Staging test lesson",
        "level": 1,
        "xp": 10,
    }
    payload.update(overrides)
    r = client.post("/cms/lessons", json=payload, headers=cms_headers)
    assert r.status_code == 200, r.text
    return int(r.json()["id"])


def test_new_lesson_defaults_to_draft(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_id = _create_lesson(client, cms_headers, suffix="draft-default")
    row = db_conn.execute(text("SELECT is_published FROM lessons WHERE id = :id"), {"id": lesson_id}).mappings().first()
    assert row["is_published"] is False


def test_new_chapter_defaults_to_draft(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    r = client.post("/cms/chapters", json={"title": "Staging test chapter"}, headers=cms_headers)
    assert r.status_code == 200, r.text
    row = db_conn.execute(text("SELECT is_published FROM chapters WHERE id = :id"), {"id": r.json()["id"]}).mappings().first()
    assert row["is_published"] is False


def test_draft_lesson_is_404_without_preview_token(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_id = _create_lesson(client, cms_headers, suffix="gated")
    slug = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": lesson_id}).mappings().first()["slug"]

    r = client.get(f"/lessons/{slug}")
    assert r.status_code == 404


def test_draft_lesson_reachable_with_valid_preview_token(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_id = _create_lesson(client, cms_headers, suffix="previewable")
    slug = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": lesson_id}).mappings().first()["slug"]

    link_res = client.post(f"/cms/lessons/{lesson_id}/preview-link", headers=cms_headers)
    assert link_res.status_code == 200, link_res.text
    url = link_res.json()["url"]
    assert f"/lesson/{slug}?preview=" in url
    token = url.split("preview=", 1)[1]

    r = client.get(f"/lessons/{slug}", params={"preview": token})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_published"] is False
    assert body["slug"] == slug


def test_preview_token_does_not_work_for_a_different_lesson(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_a = _create_lesson(client, cms_headers, suffix="a-scope")
    lesson_b = _create_lesson(client, cms_headers, suffix="b-scope")
    slug_b = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": lesson_b}).mappings().first()["slug"]

    link_res = client.post(f"/cms/lessons/{lesson_a}/preview-link", headers=cms_headers)
    token_for_a = link_res.json()["url"].split("preview=", 1)[1]

    r = client.get(f"/lessons/{slug_b}", params={"preview": token_for_a})
    assert r.status_code == 404


def test_published_lesson_needs_no_preview_token(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_id = _create_lesson(client, cms_headers, suffix="live", is_published=True)
    slug = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": lesson_id}).mappings().first()["slug"]

    r = client.get(f"/lessons/{slug}")
    assert r.status_code == 200, r.text
    assert r.json()["is_published"] is True


def test_publish_then_unpublish_round_trip(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_id = _create_lesson(client, cms_headers, suffix="roundtrip")
    slug = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": lesson_id}).mappings().first()["slug"]

    pub = client.post(f"/cms/lessons/{lesson_id}/publish", headers=cms_headers)
    assert pub.status_code == 200, pub.text
    assert client.get(f"/lessons/{slug}").status_code == 200

    unpub = client.post(f"/cms/lessons/{lesson_id}/unpublish", headers=cms_headers)
    assert unpub.status_code == 200, unpub.text
    assert client.get(f"/lessons/{slug}").status_code == 404


def test_preview_link_requires_cms_auth(client, db_conn):
    cms_headers = _cms_headers(db_conn)
    lesson_id = _create_lesson(client, cms_headers, suffix="needs-auth")
    r = client.post(f"/cms/lessons/{lesson_id}/preview-link")
    assert r.status_code == 401


def test_draft_lesson_does_not_appear_on_the_roadmap(client, db_conn, make_user):
    """Regression: /me/lessons/progress (the Dashboard roadmap) used to list
    every lesson regardless of is_published, so a draft an admin was still
    building would show up — and fail to open — for real students."""
    cms_headers = _cms_headers(db_conn)
    draft_id = _create_lesson(client, cms_headers, suffix="roadmap-draft")
    draft_slug = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": draft_id}).mappings().first()["slug"]
    live_id = _create_lesson(client, cms_headers, suffix="roadmap-live", is_published=True)
    live_slug = db_conn.execute(text("SELECT slug FROM lessons WHERE id = :id"), {"id": live_id}).mappings().first()["slug"]

    _user_id, headers = make_user()
    r = client.get("/me/lessons/progress", headers=headers)
    assert r.status_code == 200, r.text
    slugs = [row["slug"] for row in r.json()]

    assert draft_slug not in slugs
    assert live_slug in slugs
