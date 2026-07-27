# backend/seed_handwriting.py
"""
Handwriting — the first lessons on the new `trace_letter` exercise, where the
learner draws an Armenian letter over a faint guide. Duolingo's #1 tool for
non-Latin scripts and the single biggest week-one barrier for Armenian: the
39-letter alphabet only sticks once you can produce the shapes, not just
recognize them.

The exercise grades by pixel overlap against the glyph rendered in the app
font, so no per-letter stroke data is needed — every letter works from just
the character. Two lessons: the vowels, then the first consonants.

Tagged cefr="A0" (Foundations) and attached to a "Handwriting" chapter placed
at position 8, right after the alphabet chapters, so it sits in the Foundations
band. Idempotent: skips if 'hw-vowels' exists. Triggered via
POST /cms/seed/handwriting.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"trace_letter": 10}
_CEFR = "A0"


def _trace(letter, romanization, audio_text=None):
    return {"kind": "trace_letter", "prompt": f"Trace: {letter}",
            "config": {"letter": letter, "romanization": romanization,
                       "audioText": audio_text or letter}}


_LESSONS = [
    ("Handwriting", 8, "hw-vowels", "Write the Vowels", [
        _trace("ա", "a"),
        _trace("ե", "ye / e"),
        _trace("է", "e"),
        _trace("ը", "ə"),
        _trace("ի", "i"),
        _trace("ո", "vo / o"),
        _trace("օ", "o"),
    ]),
    ("Handwriting", 8, "hw-consonants", "Write: First Consonants", [
        _trace("բ", "b"),
        _trace("գ", "g"),
        _trace("դ", "d"),
        _trace("կ", "k"),
        _trace("մ", "m"),
        _trace("ն", "n"),
    ]),
]


def seed_handwriting():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'hw-vowels'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "hw-vowels already exists"}

        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        created_lessons = 0
        created_exercises = 0
        lesson_config = json.dumps({"cefr": _CEFR})

        for chapter_title, chapter_position, slug, title, exercises in _LESSONS:
            if chapter_title not in chapter_ids:
                existing = conn.execute(
                    text("SELECT id FROM chapters WHERE title = :t"), {"t": chapter_title}
                ).scalar()
                if not existing:
                    existing = conn.execute(
                        text("""INSERT INTO chapters (title, position, is_published)
                                VALUES (:t, :p, TRUE) RETURNING id"""),
                        {"t": chapter_title, "p": chapter_position},
                    ).scalar()
                chapter_ids[chapter_title] = existing

            for idx, ex in enumerate(exercises, start=1):
                ex["order"] = idx
                ex["xp"] = _XP[ex["kind"]]
            lesson_xp = sum(ex["xp"] for ex in exercises)
            max_level += 1

            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type, config)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard', CAST(:cfg AS jsonb))
                    RETURNING id
                """),
                {"slug": slug, "title": title, "level": max_level,
                 "xp": lesson_xp, "chapter_id": chapter_ids[chapter_title], "cfg": lesson_config},
            ).scalar()
            created_lessons += 1

            for ex in exercises:
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lesson_id, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": ex["order"], "xp": ex["xp"], "config": json.dumps(ex["config"])},
                )
                created_exercises += 1

        return {"ok": True, "cefr": _CEFR, "chapters_created": list(chapter_ids.values()),
                "lessons_created": created_lessons, "exercises_created": created_exercises}
