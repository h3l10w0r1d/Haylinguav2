# backend/seed_listen_image.py
"""
Listen & Choose — the new `listen_image` exercise (Tier 2, "deepen listening"):
hear an Armenian word spoken (Azure hy-AM TTS) and tap the matching picture.
Pure sound→meaning, no text shown — the listening counterpart to image_select.

Adds one lesson to the existing "Mixed Practice" chapter (found by title).
Emoji tiles, so no image assets are needed. Config per item:
{ ttsText, choices:[{emoji,label}], answerIndex }. Tagged cefr="A1".
Idempotent: skips if 'mix-listen-image' exists. Triggered via
POST /cms/seed/listen-image.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"listen_image": 10}
_CEFR = "A1"


def _li(tts_text, choices, answer_index):
    return {"kind": "listen_image", "prompt": "Which one do you hear?",
            "config": {"ttsText": tts_text,
                       "choices": [{"emoji": e, "label": l} for e, l in choices],
                       "answerIndex": answer_index}}


_LESSONS = [
    ("Mixed Practice", 45, "mix-listen-image", "Listen & Choose", [
        _li("կատու", [("🐱", "cat"), ("🐶", "dog"), ("🐟", "fish"), ("🐦", "bird")], 0),
        _li("շուն", [("🐱", "cat"), ("🐶", "dog"), ("🐴", "horse"), ("🐰", "rabbit")], 1),
        _li("խնձոր", [("🍎", "apple"), ("🍞", "bread"), ("🧀", "cheese"), ("🥛", "milk")], 0),
        _li("ջուր", [("☕", "coffee"), ("🍵", "tea"), ("💧", "water"), ("🍷", "wine")], 2),
        _li("տուն", [("🏠", "house"), ("🏫", "school"), ("🚗", "car"), ("🌳", "tree")], 0),
        _li("արև", [("🌙", "moon"), ("☀️", "sun"), ("⭐", "star"), ("☁️", "cloud")], 1),
        _li("գիրք", [("📖", "book"), ("✏️", "pencil"), ("📱", "phone"), ("🎒", "bag")], 0),
    ]),
]


def seed_listen_image():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'mix-listen-image'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "mix-listen-image already exists"}

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
