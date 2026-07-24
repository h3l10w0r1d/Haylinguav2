# backend/seed_vowelintro.py
"""
"Meet the word" intros for snd-vowels-1 — the very first lesson. It's a
pre-alphabet listening lesson (the learner hasn't seen the script yet), so
each intro card shows the PICTURE + the ROMANIZED word (hats, jur, …) + the
word played out loud (real Armenian audio) + its meaning. No Armenian script
is shown, matching the rest of the Sounds chapters.

This gives a brand-new learner a picture-and-sound anchor for every word
before they're asked to tell the words apart by ear — a warm, image-and-
audio-forward opening to the whole course.

Prepends the intros to the start of the lesson, reordering the existing
listen/speak drills to follow. Idempotent (skips if a flashcard exists).
Triggered via POST /cms/seed/vowelintro.

flashcard config here: front = romanized (shown), audioText = Armenian
(spoken only, never displayed).
"""

import json
from sqlalchemy import text
from database import engine

_XP_FLASHCARD = 5
_LESSON_SLUG = "snd-vowels-1"

# (armenian [audio only], romanized [shown], english, emoji) — all already the
# words drilled in this lesson.
_WORDS = [
    ("հաց", "hats", "bread", "🍞"),
    ("ջուր", "jur", "water", "💧"),
    ("միս", "mis", "meat", "🍖"),
    ("ձի", "dzi", "horse", "🐴"),
    ("ձու", "dzu", "egg", "🥚"),
    ("մատ", "mat", "finger", "👆"),
    ("մոտ", "mot", "nearby", "📍"),
]


def seed_vowelintro():
    with engine.begin() as conn:
        lesson = conn.execute(
            text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": _LESSON_SLUG}
        ).mappings().first()
        if not lesson:
            return {"ok": False, "reason": "lesson not found"}
        lid = lesson["id"]

        has = conn.execute(
            text("SELECT 1 FROM exercises WHERE lesson_id = :lid AND kind = 'flashcard' LIMIT 1"),
            {"lid": lid},
        ).first()
        if has:
            return {"ok": True, "skipped": True, "reason": "already has flashcard"}

        n = len(_WORDS)
        conn.execute(
            text('UPDATE exercises SET "order" = "order" + :n WHERE lesson_id = :lid'),
            {"n": n, "lid": lid},
        )

        created = 0
        for idx, (hy, rom, en, emoji) in enumerate(_WORDS, start=1):
            cfg = {"front": rom, "back": en, "emoji": emoji, "audioText": hy}
            conn.execute(
                text("""
                    INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                    VALUES (:lesson_id, 'flashcard', 'New word', :order, :xp, CAST(:config AS jsonb))
                """),
                {"lesson_id": lid, "order": idx, "xp": _XP_FLASHCARD, "config": json.dumps(cfg)},
            )
            created += 1

        conn.execute(
            text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                      xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                    WHERE id = :lid"""),
            {"lid": lid},
        )

        return {"ok": True, "exercises_created": created, "lesson": _LESSON_SLUG}
