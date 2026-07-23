# backend/seed_earlybuild.py
"""
Build-a-sentence, early. One of the most motivating things about Duolingo is
that you assemble real sentences from word tiles almost immediately — so this
drops a couple of word_bank "build the sentence" exercises into the earliest
concrete-noun vocabulary lessons (Family, Food, Colors, Home, Body,
Clothing), using the simplest possible full sentence: «Սա X է» — "This is a
X".

That pattern needs only one already-taught noun plus Սա (this) and է (is),
so a learner builds their first genuine Armenian sentence within their first
few vocabulary lessons instead of waiting for the Sentences chapters. Every
noun used is already taught in that exact lesson; the extra tile is a
distractor drawn from the same lesson.

Idempotent per lesson (skips if it already has a word_bank). Triggered via
POST /cms/seed/earlybuild.
"""

import json
from sqlalchemy import text
from database import engine

_XP_WORD_BANK = 15


def _build(english, subject_word, is_word, noun, distractor):
    """«Սա <noun> է» = "This is a <noun>". Tiles are scrambled (not in
    solution order) and include one distractor to leave unused."""
    solution = [subject_word, noun, is_word]           # Սա X է
    tiles = [noun, distractor, subject_word, is_word]   # scrambled
    return {
        "kind": "word_bank",
        "prompt": f"Build: “{english}”",
        "config": {"sentence": english, "tiles": tiles, "solution": solution},
    }


# slug -> [(english, noun, distractor), …]  (nouns already taught in the lesson)
_SETS = {
    "hl-family": [("This is a child", "երեխա", "տատիկ"), ("This is a grandma", "տատիկ", "երեխա")],
    "hl-food":   [("This is bread", "հաց", "ջուր"), ("This is water", "ջուր", "կաթ")],
    "hl-colors": [("This is red", "կարմիր", "կապույտ"), ("This is blue", "կապույտ", "կանաչ")],
    "hl-home":   [("This is a door", "դուռ", "պատուհան"), ("This is a chair", "աթոռ", "սեղան")],
    "hl-body":   [("This is a hand", "ձեռք", "ոտք"), ("This is an eye", "աչք", "ականջ")],
    "hl-clothing": [("This is a shirt", "շապիկ", "կոշիկ"), ("This is shoes", "կոշիկ", "գուլպա")],
}

_SUBJECT = "Սա"   # this
_IS = "է"         # is


def seed_earlybuild():
    with engine.begin() as conn:
        expanded, skipped, created = [], [], 0

        for slug, items in _SETS.items():
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue
            lid = lesson["id"]

            has = conn.execute(
                text("SELECT 1 FROM exercises WHERE lesson_id = :lid AND kind = 'word_bank' LIMIT 1"),
                {"lid": lid},
            ).first()
            if has:
                skipped.append({"slug": slug, "reason": "already has word_bank"})
                continue

            max_order = conn.execute(
                text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
                {"lid": lid},
            ).scalar()

            for idx, (english, noun, distractor) in enumerate(items, start=1):
                ex = _build(english, _SUBJECT, _IS, noun, distractor)
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lid, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": max_order + idx, "xp": _XP_WORD_BANK, "config": json.dumps(ex["config"])},
                )
                created += 1

            conn.execute(
                text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                          xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                        WHERE id = :lid"""),
                {"lid": lid},
            )
            expanded.append(slug)

        return {"ok": True, "expanded": expanded, "skipped": skipped, "exercises_created": created}
