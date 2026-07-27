# backend/seed_dictation.py
"""
Adds a listening-dictation exercise (listen_type — hear the word, type it)
to each core vocabulary lesson. Dictation existed only in the hidden demo,
so the audio-production channel in the real curriculum was thin — this puts
it into live lessons using a short word already taught there.

Idempotent per lesson (skips if it already has a listen_type). Triggered via
POST /cms/seed/dictation.
"""

import json
from sqlalchemy import text
from database import engine

_XP_LISTEN = 15

# slug -> a short, already-taught word to dictate
_WORDS = {
    "hl-food": "հաց",
    "hl-family": "մայր",
    "hl-colors": "սև",
    "hl-home": "դուռ",
    "hl-body": "ձեռք",
    "hl-clothing": "կոշիկ",
    "hl-weather": "արև",
    "hl-emotions": "ուրախ",
}


def seed_dictation():
    with engine.begin() as conn:
        expanded, skipped, created = [], [], 0

        for slug, word in _WORDS.items():
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue
            lid = lesson["id"]

            has = conn.execute(
                text("SELECT 1 FROM exercises WHERE lesson_id = :lid AND kind = 'listen_type' LIMIT 1"),
                {"lid": lid},
            ).first()
            if has:
                skipped.append({"slug": slug, "reason": "already has listen_type"})
                continue

            max_order = conn.execute(
                text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
                {"lid": lid},
            ).scalar()

            cfg = {"ttsText": word, "acceptedAnswers": [word]}
            conn.execute(
                text("""
                    INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                    VALUES (:lesson_id, 'listen_type', 'Type what you hear', :order, :xp, CAST(:config AS jsonb))
                """),
                {"lesson_id": lid, "order": max_order + 1, "xp": _XP_LISTEN, "config": json.dumps(cfg)},
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
