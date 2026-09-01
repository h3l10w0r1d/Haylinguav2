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

# Mirrors src/i18n/index.js's SUPPORTED_LOCALES — kept in sync manually since
# the frontend and backend are separate deploys. English is the implicit
# default and stays unprefixed.
SUPPORTED_LOCALES = ["ru", "fr", "es", "ar", "fa", "ka"]
ALL_LOCALES = ["en", *SUPPORTED_LOCALES]


def _localized_path(path: str, locale: str) -> str:
    if not locale or locale == "en":
        return path
    return f"/{locale}{'' if path == '/' else path}"


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
    ("/learn-armenian-in-los-angeles", "monthly", "0.7"),
    ("/learn-armenian-in-paris", "monthly", "0.7"),
    ("/learn-armenian-in-moscow", "monthly", "0.7"),
    ("/learn-armenian-in-buenos-aires", "monthly", "0.7"),
    ("/learn-armenian-in-beirut", "monthly", "0.7"),
    ("/learn-armenian-in-tehran", "monthly", "0.7"),
    ("/learn-armenian-in-tbilisi", "monthly", "0.7"),
    ("/about", "monthly", "0.5"),
    ("/pricing", "monthly", "0.5"),
    ("/careers", "weekly", "0.4"),
    ("/affiliates", "monthly", "0.4"),
    ("/contact", "yearly", "0.3"),
    ("/community", "weekly", "0.5"),
    ("/soro-blog", "weekly", "0.3"),
    ("/terms", "yearly", "0.2"),
    ("/privacy", "yearly", "0.2"),
    ("/refund-policy", "yearly", "0.2"),
    ("/cookie-policy", "yearly", "0.2"),
]

# Mirrors App.jsx's PUBLIC_ROUTE_DEFS — the subset of STATIC_PAGES that's
# also mounted under /ru, /fr, /es (legal pages, community, deep-link routes
# are deliberately English-only, out of this pass's translation scope).
TRANSLATED_STATIC_PATHS = {
    "/", "/learn-armenian-online", "/armenian-alphabet", "/armenian-pronunciation",
    "/armenian-vocabulary", "/eastern-armenian", "/about", "/pricing",
    "/careers", "/affiliates", "/contact",
    "/learn-armenian-in-los-angeles", "/learn-armenian-in-paris", "/learn-armenian-in-moscow",
    "/learn-armenian-in-buenos-aires", "/learn-armenian-in-beirut", "/learn-armenian-in-tehran",
    "/learn-armenian-in-tbilisi",
}


@router.get("/sitemap.xml")
def sitemap(db: Connection = Depends(get_db)):
    # IMPORTANT: This must be the public website domain (not the backend domain).
    site = (os.getenv("PUBLIC_SITE_URL") or "https://www.haylingua.am").rstrip("/")

    urlset = Element("urlset", {
        "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
        "xmlns:xhtml": "http://www.w3.org/1999/xhtml",
    })
    today = _iso_date(datetime.now(timezone.utc))

    def add_url(loc: str, changefreq: str | None = None, priority: str | None = None,
                lastmod: str | None = None, alternates: list[tuple[str, str]] | None = None):
        # alternates: list of (hreflang, href) pairs, including "x-default".
        url = SubElement(urlset, "url")
        SubElement(url, "loc").text = loc
        SubElement(url, "lastmod").text = lastmod or today
        if changefreq:
            SubElement(url, "changefreq").text = changefreq
        if priority:
            SubElement(url, "priority").text = priority
        for hreflang, href in (alternates or []):
            SubElement(url, "xhtml:link", {"rel": "alternate", "hreflang": hreflang, "href": href})

    for path, cf, pr in STATIC_PAGES:
        if path in TRANSLATED_STATIC_PATHS:
            alternates = [
                (loc if loc != "en" else "en", f"{site}{_localized_path(path, loc)}")
                for loc in ALL_LOCALES
            ]
            alternates.append(("x-default", f"{site}{path}"))
            for loc in ALL_LOCALES:
                add_url(f"{site}{_localized_path(path, loc)}", cf, pr, alternates=alternates)
        else:
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
                SELECT slug, updated_at, locale, translation_group
                FROM blog_posts
                WHERE is_published = true AND published_at <= NOW()
                ORDER BY published_at DESC
                """
            )
        ).mappings().all()
    except Exception:
        blog_rows = []

    # Group by translation_group so sibling-language posts can point their
    # hreflang alternates at each other; a post with no translation_group
    # (not part of any translated set) just gets no alternates.
    by_group: dict[str, list] = {}
    for r in blog_rows:
        group = (r.get("translation_group") or "").strip()
        if group:
            by_group.setdefault(group, []).append(r)

    for r in blog_rows:
        slug = (r.get("slug") or "").strip()
        if not slug:
            continue
        locale = (r.get("locale") or "en").strip() or "en"
        lastmod = _iso_date(r["updated_at"]) if r.get("updated_at") else today
        group = (r.get("translation_group") or "").strip()
        alternates = None
        siblings = by_group.get(group) if group else None
        if siblings and len(siblings) > 1:
            alternates = []
            for s in siblings:
                s_locale = s["locale"] or "en"
                s_path = _localized_path(f"/blog/{s['slug']}", s_locale)
                alternates.append((s_locale, f"{site}{s_path}"))
            en_sibling = next((s for s in siblings if (s["locale"] or "en") == "en"), None)
            if en_sibling:
                alternates.append(("x-default", f"{site}/blog/{en_sibling['slug']}"))
        blog_path = _localized_path(f"/blog/{slug}", locale)
        add_url(f"{site}{blog_path}", "monthly", "0.6", lastmod, alternates=alternates)

    xml_bytes = b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(urlset, encoding="utf-8")
    return _xml_response(xml_bytes)
