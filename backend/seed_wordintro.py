# backend/seed_wordintro.py
"""
"Meet the word" intros. Before a vocabulary lesson drills its words, the
learner now sees each new word introduced the way Duolingo does: a big
picture (emoji), the word played out loud automatically (tap to replay),
and its meaning. This is the flashcard kind, which now renders as a rich
intro card (ExFlashcard) whenever it carries `emoji`/`audioText`.

Prepends 4 such intro cards to the start of each image-able vocabulary
lesson (Food, Colors, Family, Home, Body, Clothing, Weather, Emotions) —
words first, drills after — reordering the existing exercises to follow.
Every word is already taught in that exact lesson.

Idempotent per lesson (skips if it already has a flashcard). Triggered via
POST /cms/seed/wordintro.
"""

import json
from sqlalchemy import text
from database import engine

_XP_FLASHCARD = 5

# slug -> first words to introduce: (armenian, emoji, english)
_SETS = {
    "hl-food": [("հաց", "🍞", "bread"), ("ջուր", "💧", "water"),
                ("կաթ", "🥛", "milk"), ("պանիր", "🧀", "cheese")],
    "hl-colors": [("կարմիր", "🔴", "red"), ("կապույտ", "🔵", "blue"),
                  ("կանաչ", "🟢", "green"), ("դեղին", "🟡", "yellow")],
    "hl-family": [("մայր", "👩", "mother"), ("հայր", "👨", "father"),
                  ("քույր", "👧", "sister"), ("եղբայր", "👦", "brother")],
    "hl-home": [("դուռ", "🚪", "door"), ("պատուհան", "🪟", "window"),
                ("աթոռ", "🪑", "chair"), ("մահճակալ", "🛏️", "bed")],
    "hl-body": [("աչք", "👁️", "eye"), ("ականջ", "👂", "ear"),
                ("ձեռք", "✋", "hand"), ("սիրտ", "❤️", "heart")],
    "hl-clothing": [("շապիկ", "👕", "shirt"), ("տաբատ", "👖", "pants"),
                    ("կոշիկ", "👟", "shoes"), ("գլխարկ", "🧢", "hat")],
    "hl-weather": [("անձրև", "🌧️", "rain"), ("ձյուն", "❄️", "snow"),
                   ("արև", "☀️", "sun"), ("ամպ", "☁️", "cloud")],
    "hl-emotions": [("ուրախ", "😀", "happy"), ("տխուր", "😢", "sad"),
                    ("բարկացած", "😡", "angry"), ("հոգնած", "😴", "tired")],
}


def _intro(hy, emoji, en):
    return {
        "kind": "flashcard",
        "prompt": "New word",
        "config": {"front": hy, "back": en, "emoji": emoji, "audioText": hy},
    }


def seed_wordintro():
    with engine.begin() as conn:
        expanded, skipped, created = [], [], 0

        for slug, words in _SETS.items():
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue
            lid = lesson["id"]

            has = conn.execute(
                text("SELECT 1 FROM exercises WHERE lesson_id = :lid AND kind = 'flashcard' LIMIT 1"),
                {"lid": lid},
            ).first()
            if has:
                skipped.append({"slug": slug, "reason": "already has flashcard"})
                continue

            n = len(words)
            # Shift existing exercises down so the intros can take orders 1..n.
            conn.execute(
                text('UPDATE exercises SET "order" = "order" + :n WHERE lesson_id = :lid'),
                {"n": n, "lid": lid},
            )

            for idx, (hy, emoji, en) in enumerate(words, start=1):
                ex = _intro(hy, emoji, en)
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lid, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": idx, "xp": _XP_FLASHCARD, "config": json.dumps(ex["config"])},
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
