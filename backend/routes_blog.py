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

_LIST_COLS = "id, slug, title, excerpt, cover_image_url, cover_image_alt, author_name, tags, published_at, locale, translation_group"
_DETAIL_COLS = (
    "id, slug, title, meta_description, excerpt, body_markdown, cover_image_url, cover_image_alt, "
    "author_name, tags, published_at, updated_at, locale, translation_group"
)


@router.get("/blog")
def list_blog_posts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    locale: str = Query(default="en"),
    tag: Optional[str] = Query(default=None),
    db: Connection = Depends(get_db),
):
    offset = (page - 1) * page_size
    # is_published alone isn't enough — a post can be marked published with a
    # future published_at (scheduling: see routes_cms.py's create/update),
    # and must stay invisible here until that date actually arrives. The
    # scheduling model is deliberately "lazy" — no cron/worker needed, a
    # scheduled post just becomes query-visible the moment NOW() passes it.
    #
    # `tag` powers the SEO landing pages' "From the blog" section (see
    # src/lib/RelatedBlogPosts.jsx) — `tags ? :tag` is Postgres jsonb's
    # "does this top-level array contain this string element" operator.
    tag_clause = "AND tags ? :tag" if tag else ""
    params = {"locale": locale}
    if tag:
        params["tag"] = tag
    total = db.execute(
        text(f"SELECT COUNT(*) FROM blog_posts WHERE is_published = true AND published_at <= NOW() AND locale = :locale {tag_clause}"),
        params,
    ).scalar() or 0
    rows = db.execute(
        text(f"""
            SELECT {_LIST_COLS} FROM blog_posts
            WHERE is_published = true AND published_at <= NOW() AND locale = :locale {tag_clause}
            ORDER BY published_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": page_size, "offset": offset},
    ).mappings().all()
    return {
        "posts": [dict(r) for r in rows],
        "page": page,
        "page_size": page_size,
        "total": int(total),
    }


@router.get("/blog/{slug}")
def get_blog_post(slug: str, locale: str = Query(default="en"), db: Connection = Depends(get_db)):
    row = db.execute(
        text(f"SELECT {_DETAIL_COLS} FROM blog_posts WHERE slug = :slug AND locale = :locale AND is_published = true AND published_at <= NOW()"),
        {"slug": slug, "locale": locale},
    ).mappings().first()
    # 404 for missing, draft, OR not-yet-due (scheduled for the future) —
    # don't leak that a post with this slug exists before its scheduled date.
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return dict(row)
