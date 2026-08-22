# backend/routes_seo.py
from __future__ import annotations

import os
from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db

router = APIRouter(tags=["seo"])


def _iso_date(dt: datetime) -> str:
    # Sitemap accepts day precision: YYYY-MM-DD
    return dt.astimezone(timezone.utc).date().isoformat()


def _xml_response(xml_bytes: bytes) -> Response:
    return Response(
        content=xml_bytes,
        media_type="application/xml; charset=utf-8",
        headers={
            # Allow crawlers to cache briefly; reduces load while staying fresh.
            "Cache-Control": "public, max-age=300",
        },
    )


# Static marketing/content pages that are always indexable and never change
# URL — kept as one flat list rather than reflecting App.jsx's full route
# table 1:1 (auth-gated app routes, CMS routes, and utility/callback routes
# have no business in a public sitemap).
STATIC_PAGES: list[tuple[str, str, str]] = [
    ("/", "weekly", "1.0"),
    ("/learn-armenian-online", "monthly", "0.9"),
    ("/armenian-alphabet", "monthly", "0.9"),
    ("/armenian-pronunciation", "monthly", "0.8"),
    ("/armenian-vocabulary", "monthly", "0.8"),
    ("/eastern-armenian", "monthly", "0.8"),
    ("/about", "monthly", "0.5"),
    ("/pricing", "monthly", "0.5"),
    ("/careers", "weekly", "0.4"),
    ("/affiliates", "monthly", "0.4"),
    ("/contact", "yearly", "0.3"),
    ("/community", "weekly", "0.5"),
    ("/terms", "yearly", "0.2"),
    ("/privacy", "yearly", "0.2"),
    ("/refund-policy", "yearly", "0.2"),
    ("/cookie-policy", "yearly", "0.2"),
]


@router.get("/sitemap.xml")
def sitemap(db: Connection = Depends(get_db)):
    # IMPORTANT: This must be the public website domain (not the backend domain).
    site = (os.getenv("PUBLIC_SITE_URL") or "https://www.haylingua.am").rstrip("/")

    urlset = Element("urlset", {"xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"})
    today = _iso_date(datetime.now(timezone.utc))

    def add_url(loc: str, changefreq: str | None = None, priority: str | None = None, lastmod: str | None = None):
        url = SubElement(urlset, "url")
        SubElement(url, "loc").text = loc
        SubElement(url, "lastmod").text = lastmod or today
        if changefreq:
            SubElement(url, "changefreq").text = changefreq
        if priority:
            SubElement(url, "priority").text = priority

    for path, cf, pr in STATIC_PAGES:
        add_url(f"{site}{path}", cf, pr)

    # Active community categories.
    try:
        category_rows = db.execute(
            text("SELECT slug FROM forum_categories WHERE is_active = true")
        ).mappings().all()
    except Exception:
        category_rows = []
    for r in category_rows:
        slug = (r.get("slug") or "").strip()
        if slug:
            add_url(f"{site}/community/{slug}", "weekly", "0.4")

    # Published blog posts. Wrapped in try/except: this route must keep
    # working (falling back to just the static pages) during the deploy
    # window before blog_posts exists yet / on any transient query failure —
    # a broken sitemap.xml is worse than a temporarily incomplete one.
    try:
        blog_rows = db.execute(
            text(
                """
                SELECT slug, updated_at
                FROM blog_posts
                WHERE is_published = true
                ORDER BY published_at DESC
                """
            )
        ).mappings().all()
    except Exception:
        blog_rows = []
    for r in blog_rows:
        slug = (r.get("slug") or "").strip()
        if not slug:
            continue
        lastmod = _iso_date(r["updated_at"]) if r.get("updated_at") else today
        add_url(f"{site}/blog/{slug}", "monthly", "0.6", lastmod)

    xml_bytes = b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(urlset, encoding="utf-8")
    return _xml_response(xml_bytes)
