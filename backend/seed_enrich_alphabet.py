# backend/seed_enrich_alphabet.py
"""
Makes a new customer's very first exercises (the first 4 alphabet lessons —
hl-alphabet-1 through hl-alphabet-4, 14 letters) less dry: each char_intro
now carries an example word + emoji so "Meet the letter Ա" becomes "Ա is for
Արև (sun) ☀️" instead of a bare glyph, and the frontend (ExerciseRenderer.jsx)
now plays real audio for the letter/word on tap instead of showing silent
text. This script only touches config, via UPDATE — the lessons already
exist (seeded by seed_curriculum.py / seed_alphabet.py), so this is not an
insert-only seed like the others.

Vocabulary is limited to words already safe/common in this curriculum
(Բարև, Գիրք, Դուռ, Երեխա, Հաց, Մայր, Սիրտ are already taught elsewhere) plus
a few new, unambiguous concrete nouns (Արև, Կատու, Զանգ, Ինքնաթիռ, Լուսին,
Նարինջ). Է has no good short native example word (mostly loanwords) so it's
left without one — the frontend treats exampleWord as optional.

Idempotent: only fills exampleWord where it isn't already set. Triggered
via POST /cms/seed/enrich-alphabet.
"""

import json
from sqlalchemy import text
from database import engine

# letter -> (exampleWord, exampleMeaning, exampleEmoji)
_EXAMPLES = {
    "Ա": ("Արև", "sun", "☀️"),
    "Բ": ("Բարև", "hello", "👋"),
    "Գ": ("Գիրք", "book", "📚"),
    "Դ": ("Դուռ", "door", "🚪"),
    "Ե": ("Երեխա", "child", "👶"),
    "Կ": ("Կատու", "cat", "🐱"),
    "Զ": ("Զանգ", "bell", "🔔"),
    # "Է" intentionally omitted — no confident short native example word.
    "Ի": ("Ինքնաթիռ", "airplane", "✈️"),
    "Լ": ("Լուսին", "moon", "🌙"),
    "Հ": ("Հաց", "bread", "🍞"),
    "Մ": ("Մայր", "mother", "👩"),
    "Ն": ("Նարինջ", "orange", "🍊"),
    "Ս": ("Սիրտ", "heart", "❤️"),
}

_LESSON_SLUGS = ["hl-alphabet-1", "hl-alphabet-2", "hl-alphabet-3", "hl-alphabet-4"]


def seed_enrich_alphabet():
    with engine.begin() as conn:
        updated = 0
        skipped = []

        for slug in _LESSON_SLUGS:
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue

            rows = conn.execute(
                text("SELECT id, config FROM exercises WHERE lesson_id = :lid AND kind = 'char_intro'"),
                {"lid": lesson["id"]},
            ).mappings().all()

            for row in rows:
                cfg = row["config"] if isinstance(row["config"], dict) else json.loads(row["config"])
                if cfg.get("exampleWord"):
                    continue  # already enriched
                letter = cfg.get("letter")
                example = _EXAMPLES.get(letter)
                if not example:
                    continue
                word, meaning, emoji = example
                cfg["exampleWord"] = word
                cfg["exampleMeaning"] = meaning
                cfg["exampleEmoji"] = emoji
                conn.execute(
                    text("UPDATE exercises SET config = CAST(:config AS jsonb) WHERE id = :id"),
                    {"config": json.dumps(cfg), "id": row["id"]},
                )
                updated += 1

        return {"ok": True, "exercises_updated": updated, "skipped": skipped}
