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


@router.get("/sitemap.xml")
def sitemap(db: Connection = Depends(get_db)):
    # IMPORTANT: This must be the public website domain (not the backend domain).
    site = (os.getenv("PUBLIC_SITE_URL") or "https://www.haylingua.am").rstrip("/")

    # Static routes you want indexed.
    static_urls: list[tuple[str, str, str]] = [
        (f"{site}/", "weekly", "1.0"),
    ]

    # Published lessons (these are real SEO targets).
    rows = db.execute(
        text(
            """
            SELECT slug
            FROM lessons
            WHERE is_published = true
            ORDER BY level ASC, id ASC
            """
        )
    ).mappings().all()

    urlset = Element("urlset", {"xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"})

    # If you later add lessons.updated_at, swap this out for per-row lastmod.
    today = _iso_date(datetime.now(timezone.utc))

    def add_url(loc: str, changefreq: str | None = None, priority: str | None = None):
        url = SubElement(urlset, "url")
        SubElement(url, "loc").text = loc
        SubElement(url, "lastmod").text = today
        if changefreq:
            SubElement(url, "changefreq").text = changefreq
        if priority:
            SubElement(url, "priority").text = priority

    for loc, cf, pr in static_urls:
        add_url(loc, cf, pr)

    for r in rows:
        slug = (r.get("slug") or "").strip()
        if not slug:
            continue
        # Frontend route: /lessons/:slug
        add_url(f"{site}/lessons/{slug}", "monthly", "0.7")

    xml_bytes = b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(urlset, encoding="utf-8")
    return _xml_response(xml_bytes)
