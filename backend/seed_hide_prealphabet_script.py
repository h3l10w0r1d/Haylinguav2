# backend/seed_hide_prealphabet_script.py
"""
Every lesson in the 4 "Sounds:" chapters (positions 1-4 — snd-vowels-1,
snd-consonants-1/2, snd-triad-labial/velar/dental/affricate1/affricate2,
snd-unique-1/2) runs entirely BEFORE the alphabet is taught, and their
minimal_pairs exercises say so explicitly ("you haven't learned the
letters yet, and that's the point!"). But their speak exercises still
showed the raw Armenian script as the target to read out loud — a
brand-new learner who genuinely knows zero Armenian would be asked to
"read" glyphs nobody ever taught them, directly contradicting the
lesson's own framing.

This sets cfg.hideScript = true on every speak exercise in those 10
lessons, which ExerciseRenderer.jsx (ExSpeak/ExSpeakLine) now checks to
show the romanized transliteration as the bubble headline instead of the
script, and suppresses the separate hint-toggle (redundant once the
headline already is the hint).

Idempotent: skips exercises whose config already has hideScript set.
Triggered via POST /cms/seed/hide-prealphabet-script.
"""

import json
from sqlalchemy import text
from database import engine

_PRE_ALPHABET_LESSON_SLUGS = [
    "snd-vowels-1",
    "snd-consonants-1", "snd-consonants-2",
    "snd-triad-labial", "snd-triad-velar", "snd-triad-dental",
    "snd-triad-affricate1", "snd-triad-affricate2",
    "snd-unique-1", "snd-unique-2",
]


def seed_hide_prealphabet_script():
    with engine.begin() as conn:
        updated = 0
        skipped = []

        for slug in _PRE_ALPHABET_LESSON_SLUGS:
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue

            rows = conn.execute(
                text("SELECT id, config FROM exercises WHERE lesson_id = :lid AND kind IN ('speak', 'speak_line')"),
                {"lid": lesson["id"]},
            ).mappings().all()

            for row in rows:
                cfg = row["config"] if isinstance(row["config"], dict) else json.loads(row["config"])
                if "hideScript" in cfg:
                    continue
                cfg["hideScript"] = True
                conn.execute(
                    text("UPDATE exercises SET config = CAST(:config AS jsonb) WHERE id = :id"),
                    {"config": json.dumps(cfg), "id": row["id"]},
                )
                updated += 1

        return {"ok": True, "exercises_updated": updated, "skipped": skipped}
