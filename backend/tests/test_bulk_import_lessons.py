# backend/tests/test_bulk_import_lessons.py
"""Bulk import: CSV rows -> lessons. Each row is created inside its own
SAVEPOINT so one bad row (duplicate slug, missing title) doesn't roll back
the rest of the batch."""
import uuid

from sqlalchemy import text


def _cms_headers(db_conn):
    import routes as routes_mod

    row = db_conn.execute(
        text(
            """
            INSERT INTO cms_users (email, role, status, password_hash, totp_enabled)
            VALUES ('pytest-bulk-import@example.test', 'admin', 'active', 'x', TRUE)
            ON CONFLICT (email) DO UPDATE SET status = 'active', totp_enabled = TRUE
            RETURNING id
            """
        )
    ).mappings().first()
    token = routes_mod._cms_jwt_encode(
        {"sub": str(row["id"]), "scope": "cms", "typ": "cms", "role": "admin"}, minutes=30
    )
    return {"Authorization": f"Bearer {token}"}


def _uniq(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_requires_cms_auth(client):
    r = client.post("/cms/lessons/bulk-import", json={"rows": [{"title": "x"}]})
    assert r.status_code == 401


def test_rows_required(client, db_conn):
    headers = _cms_headers(db_conn)
    r = client.post("/cms/lessons/bulk-import", json={"rows": []}, headers=headers)
    assert r.status_code == 400


def test_basic_import_creates_lessons_as_draft(client, db_conn):
    headers = _cms_headers(db_conn)
    slug1, slug2 = _uniq("bulk-a"), _uniq("bulk-b")
    r = client.post(
        "/cms/lessons/bulk-import",
        json={"rows": [
            {"title": "Bulk lesson A", "slug": slug1, "level": 2, "xp": 15, "description": "desc a"},
            {"title": "Bulk lesson B", "slug": slug2},
        ]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 2
    assert body["total"] == 2
    assert all(row["status"] == "created" for row in body["results"])

    rows = db_conn.execute(
        text("SELECT slug, title, level, xp, is_published, chapter_id FROM lessons WHERE slug = ANY(:slugs)"),
        {"slugs": [slug1, slug2]},
    ).mappings().all()
    by_slug = {r["slug"]: r for r in rows}
    assert by_slug[slug1]["title"] == "Bulk lesson A"
    assert by_slug[slug1]["level"] == 2
    assert by_slug[slug1]["xp"] == 15
    assert by_slug[slug1]["is_published"] is False
    assert by_slug[slug2]["level"] == 1  # default
    assert by_slug[slug2]["chapter_id"] is None


def test_missing_title_is_skipped_not_fatal(client, db_conn):
    headers = _cms_headers(db_conn)
    slug = _uniq("bulk-ok")
    r = client.post(
        "/cms/lessons/bulk-import",
        json={"rows": [
            {"title": "", "slug": "no-title-row"},
            {"title": "Has a title", "slug": slug},
        ]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 1
    assert body["total"] == 2
    assert body["results"][0]["status"] == "error"
    assert body["results"][1]["status"] == "created"


def test_duplicate_slug_gets_suffixed_not_rejected(client, db_conn):
    headers = _cms_headers(db_conn)
    slug = _uniq("bulk-dup")
    r = client.post(
        "/cms/lessons/bulk-import",
        json={"rows": [
            {"title": "First", "slug": slug},
            {"title": "Second", "slug": slug},
        ]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 2
    slugs = {row["slug"] for row in body["results"]}
    assert slug in slugs
    assert f"{slug}-2" in slugs


def test_slug_auto_generated_from_title_when_blank(client, db_conn):
    headers = _cms_headers(db_conn)
    title = f"Auto Slug Test {uuid.uuid4().hex[:8]}"
    r = client.post(
        "/cms/lessons/bulk-import",
        json={"rows": [{"title": title}]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    result = r.json()["results"][0]
    assert result["status"] == "created"
    assert result["slug"] == title.lower().replace(" ", "-")


def test_chapter_auto_created_and_reused_across_rows(client, db_conn):
    headers = _cms_headers(db_conn)
    chapter_name = _uniq("Bulk Chapter")
    slug1, slug2 = _uniq("bulk-c1"), _uniq("bulk-c2")
    r = client.post(
        "/cms/lessons/bulk-import",
        json={"rows": [
            {"title": "Lesson 1", "slug": slug1, "chapter": chapter_name},
            {"title": "Lesson 2", "slug": slug2, "chapter": chapter_name},
        ]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 2

    chapters = db_conn.execute(
        text("SELECT id, is_published FROM chapters WHERE LOWER(title) = :t"), {"t": chapter_name.lower()}
    ).mappings().all()
    assert len(chapters) == 1
    assert chapters[0]["is_published"] is False

    lessons = db_conn.execute(
        text("SELECT chapter_id FROM lessons WHERE slug = ANY(:slugs)"), {"slugs": [slug1, slug2]}
    ).mappings().all()
    assert all(row["chapter_id"] == chapters[0]["id"] for row in lessons)


def test_existing_chapter_is_reused_not_duplicated(client, db_conn):
    headers = _cms_headers(db_conn)
    chapter_name = _uniq("Existing Chapter")
    existing_id = db_conn.execute(
        text("INSERT INTO chapters (title, description, position, is_published) VALUES (:t, '', 1, TRUE) RETURNING id"),
        {"t": chapter_name},
    ).scalar()

    slug = _uniq("bulk-existing")
    r = client.post(
        "/cms/lessons/bulk-import",
        json={"rows": [{"title": "Uses existing chapter", "slug": slug, "chapter": chapter_name.upper()}]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 1

    lesson = db_conn.execute(text("SELECT chapter_id FROM lessons WHERE slug = :s"), {"s": slug}).mappings().first()
    assert lesson["chapter_id"] == existing_id

    count = db_conn.execute(
        text("SELECT COUNT(*) FROM chapters WHERE LOWER(title) = :t"), {"t": chapter_name.lower()}
    ).scalar()
    assert count == 1


def test_max_rows_enforced(client, db_conn):
    headers = _cms_headers(db_conn)
    rows = [{"title": f"Row {i}"} for i in range(501)]
    r = client.post("/cms/lessons/bulk-import", json={"rows": rows}, headers=headers)
    assert r.status_code == 400
