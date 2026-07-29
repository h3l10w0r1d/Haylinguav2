# backend/seed_chapter_icons.py
"""
Give every chapter an icon. Most chapters (the ones created by content seeds)
have chapters.icon = NULL and render iconless on the roadmap. This assigns a
sensible lucide icon per chapter, matched by title keyword, ONLY to chapters
that don't already have one — so the icons an editor set in the CMS are never
overwritten. Colour is left at its default ('brand'). Idempotent and safe to
re-run. Triggered via POST /cms/seed/chapter-icons.
"""

from sqlalchemy import text
from database import engine

# First matching keyword wins — order specific → general. Values are lucide
# icon names (the same namespace the CMS icon picker uses).
_RULES = [
    ("sound", "volume-2"), ("pronun", "volume-2"),
    ("handwrit", "pen-tool"), ("alphabet", "type"), ("letter", "type"),
    ("number", "hash"), ("11", "hash"),
    ("time", "clock"), ("age", "clock"),
    ("date", "calendar"), ("month", "calendar"), ("season", "calendar"), ("days", "calendar"),
    ("colour", "palette"), ("color", "palette"),
    ("family", "users"),
    ("fruit", "apple"), ("veg", "carrot"), ("cook", "chef-hat"),
    ("drink", "coffee"), ("kitchen", "utensils"), ("food", "utensils"),
    ("greet", "hand"), ("phrase", "message-circle"),
    ("conversation", "messages-square"), ("communicat", "messages-square"),
    ("speak", "mic"), ("listen", "headphones"), ("radio", "radio"),
    ("story", "book-text"), ("stories", "book-text"), ("telling stor", "book-text"),
    ("travel", "plane"), ("direction", "compass"), ("transport", "bus"),
    ("city", "building-2"), ("town", "building"),
    ("nature", "trees"), ("garden", "flower"), ("place", "map-pin"),
    ("home", "home"), ("house", "home"), ("bathroom", "bath"),
    ("office", "briefcase"), ("tool", "wrench"), ("material", "package"), ("object", "package"),
    ("body", "activity"), ("health", "heart-pulse"),
    ("feeling", "smile"), ("emotion", "smile"),
    ("cloth", "shirt"), ("weather", "cloud-sun"),
    ("job", "briefcase"), ("work", "briefcase"),
    ("shop", "shopping-cart"), ("money", "wallet"),
    ("from", "flag"), ("nationalit", "flag"),
    ("sea animal", "fish"), ("bird", "bird"), ("insect", "bug"), ("animal", "paw-print"),
    ("sport", "dumbbell"), ("music", "music"), ("technolog", "smartphone"), ("school", "graduation-cap"),
    ("shape", "shapes"), ("question", "help-circle"),
    ("adjective", "sliders-horizontal"), ("adverb", "gauge"), ("abstract", "brain"),
    ("plural", "copy"), ("possess", "copy"), ("word form", "shapes"),
    ("verb", "zap"), ("action", "zap"),
    ("past", "history"), ("future", "fast-forward"),
    ("if and because", "git-branch"), ("who and what", "help-circle"), ("saying more", "plus-circle"),
    ("about yourself", "user"),
    ("workshop", "dumbbell"), ("build", "blocks"), ("mixed", "shuffle"),
    ("free time", "sun"), ("daily", "sun"), ("situation", "coffee"), ("out & about", "coffee"), ("around", "coffee"),
    ("grammar", "book-open"), ("sentence", "book-open"), ("fluency", "book-open"),
    ("reading", "book-open"), ("read", "book-open"),
    ("vocabulary", "book-a"),
    ("demo", "flask-conical"),
]

_DEFAULT = "book-open"


def _icon_for(title: str) -> str:
    t = (title or "").lower()
    for kw, icon in _RULES:
        if kw in t:
            return icon
    return _DEFAULT


def seed_chapter_icons():
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, title FROM chapters WHERE icon IS NULL OR icon = ''")
        ).mappings().all()
        updated = 0
        for r in rows:
            conn.execute(
                text("UPDATE chapters SET icon = :icon WHERE id = :id AND (icon IS NULL OR icon = '')"),
                {"icon": _icon_for(r["title"]), "id": r["id"]},
            )
            updated += 1
        return {"ok": True, "chapters_updated": updated}
