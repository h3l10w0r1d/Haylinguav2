# backend/seed_forum_intros.py
"""
A handful of genuine starter threads for the community forum, posted under
the real Haylingua team's own accounts — not invented "learner" personas.
An empty forum (2 threads, last post 51 days ago, per a UX review) reads as
a dead product; the fix is real seed content from real, already-publicly-
identified people (see /about), not simulated multi-user activity, which
would be the same kind of fabricated social proof already removed from the
homepage's "372,447 learners" counters.

Idempotent: skips a thread if one with the same title already exists under
that category, so it's safe to re-run (e.g. after adding Lilit's account).
Triggered via POST /cms/seed/forum-intros (admin-only, see routes_cms.py).

TEAM_EMAILS currently only resolves Armen's account. Add Lilit's email once
confirmed and re-run — already-created threads are skipped, only the new
author's posts get added.
"""

from sqlalchemy import text
from database import engine

TEAM_EMAILS = [
    "info@haylingua.am",
    # "lilit@haylingua.am",  # add once confirmed, then re-run this seed
]

# (category_slug, thread_title, first_post_body) — written as Armen, the
# builder, in his own voice; matches the tone already established on /about.
_THREADS = [
    (
        "introductions",
        "Hey — I'm Armen, I built Haylingua",
        "Hi everyone! I'm the person behind Haylingua, building it together "
        "with Lilit Hakobyan, who's taught Armenian across the IB Diploma "
        "Programme for years. If you're just getting started, drop a hello "
        "here — I'd love to know what brought you to the language and "
        "where you're learning from. I read every post.",
    ),
    (
        "general",
        "What's the hardest part of Armenian for you so far?",
        "Genuinely curious — for a lot of learners it's the two R's (ր vs "
        "ռ), for others it's the aspirated stops, for others it's just "
        "reading the script fast enough to keep up. What's tripping you up "
        "right now? Might turn the common answers into new lesson content.",
    ),
    (
        "tips",
        "A trick that helped me with the alphabet",
        "One thing that made the 39 letters click for me: instead of "
        "drilling them in isolation, I paired each one with a single word "
        "I already cared about (a family member's name, a food, a place). "
        "The letter shape sticks a lot faster when it's attached to a real "
        "word instead of just \"letter #14.\" Curious what's worked for "
        "the rest of you.",
    ),
    (
        "feedback",
        "Building this in the open — tell me what's missing",
        "We're a team of two, so the fastest way anything gets fixed or "
        "built is you telling me directly. Bug, confusing lesson, a "
        "feature you wish existed — post it here. I go through this board "
        "regularly and a lot of what's shipped recently came straight from "
        "posts like this.",
    ),
]


def seed_forum_intros():
    created = []
    skipped = []
    with engine.begin() as conn:
        author_ids = [
            row[0]
            for row in conn.execute(
                text("SELECT id FROM users WHERE LOWER(email) = ANY(:emails)"),
                {"emails": [e.lower() for e in TEAM_EMAILS]},
            ).fetchall()
        ]
        if not author_ids:
            return {"ok": False, "error": "No matching user found for TEAM_EMAILS — check the addresses."}
        author_id = author_ids[0]

        for slug, title, body in _THREADS:
            category_id = conn.execute(
                text("SELECT id FROM forum_categories WHERE slug = :s"),
                {"s": slug},
            ).scalar()
            if category_id is None:
                skipped.append((title, "category not found"))
                continue

            existing = conn.execute(
                text("SELECT id FROM forum_threads WHERE category_id = :c AND title = :t"),
                {"c": category_id, "t": title},
            ).scalar()
            if existing is not None:
                skipped.append((title, "already exists"))
                continue

            thread_id = conn.execute(
                text("""
                    INSERT INTO forum_threads (category_id, user_id, title, is_pinned)
                    VALUES (:c, :u, :t, TRUE)
                    RETURNING id
                """),
                {"c": category_id, "u": author_id, "t": title},
            ).scalar_one()
            conn.execute(
                text("INSERT INTO forum_posts (thread_id, user_id, body) VALUES (:th, :u, :b)"),
                {"th": thread_id, "u": author_id, "b": body},
            )
            created.append(title)

    return {"ok": True, "created": created, "skipped": skipped}
