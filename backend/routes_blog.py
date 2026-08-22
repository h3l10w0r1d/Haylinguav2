# backend/routes_blog.py
"""Public, unauthenticated reads for the first-party blog (blog_posts table,
see ensure_schema.py). Admin CRUD lives in routes_cms.py under /cms/blog/*;
this file is the public-facing half, mounted without the /cms prefix —
mirrors GET /lessons / GET /lessons/{slug} in routes.py (public, no auth
dependency, published-only)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db

router = APIRouter(tags=["blog"])

_LIST_COLS = "id, slug, title, excerpt, cover_image_url, cover_image_alt, author_name, tags, published_at"
_DETAIL_COLS = (
    "id, slug, title, meta_description, excerpt, body_markdown, cover_image_url, cover_image_alt, "
    "author_name, tags, published_at, updated_at"
)


@router.get("/blog")
def list_blog_posts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: Connection = Depends(get_db),
):
    offset = (page - 1) * page_size
    total = db.execute(
        text("SELECT COUNT(*) FROM blog_posts WHERE is_published = true")
    ).scalar() or 0
    rows = db.execute(
        text(f"""
            SELECT {_LIST_COLS} FROM blog_posts
            WHERE is_published = true
            ORDER BY published_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"limit": page_size, "offset": offset},
    ).mappings().all()
    return {
        "posts": [dict(r) for r in rows],
        "page": page,
        "page_size": page_size,
        "total": int(total),
    }


@router.get("/blog/{slug}")
def get_blog_post(slug: str, db: Connection = Depends(get_db)):
    row = db.execute(
        text(f"SELECT {_DETAIL_COLS} FROM blog_posts WHERE slug = :slug AND is_published = true"),
        {"slug": slug},
    ).mappings().first()
    # 404 for missing OR draft — don't leak that a draft with this slug
    # exists, same behavior unpublished lessons already have.
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return dict(row)
