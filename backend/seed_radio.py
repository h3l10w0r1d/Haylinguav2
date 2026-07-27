# backend/seed_radio.py
"""
Radio — a DuoRadio-style long-form listening lesson on the new `radio` exercise:
a short narrated piece split into segments, each played as audio (Azure hy-AM
TTS, no text shown) then checked with a comprehension question; the Armenian
text + translation are revealed only after answering. Audio-first listening.

Five short "shows" (2 segments each) built from already-taught vocabulary
(introductions, weather, café, family, market). Standard Eastern Armenian,
hand-checked. Tagged cefr="A2", "Radio" chapter at position 65. Idempotent:
skips if 'radio-a2' exists. Triggered via POST /cms/seed/radio.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"radio": 20}
_CEFR = "A2"


def _radio(title, segments):
    # segments: list of (text, translation, question, choices, answer_index)
    return {"kind": "radio", "prompt": title,
            "config": {"title": title,
                       "segments": [{"text": t, "translation": tr, "question": q,
                                     "choices": ch, "answerIndex": ai}
                                    for t, tr, q, ch, ai in segments]}}


_LESSONS = [
    ("Radio", 65, "radio-a2", "Radio", [
        _radio("Ani's Day", [
            ("Բարև։ Իմ անունը Անի է։ Ես ուսանող եմ։", "Hello. My name is Ani. I'm a student.",
             "What is Ani?", ["A student", "A teacher", "A doctor", "A waiter"], 0),
            ("Ամեն օր ես հայերեն եմ սովորում։", "Every day I study Armenian.",
             "What does Ani study?", ["Armenian", "English", "Math", "Music"], 0),
        ]),
        _radio("The Weather", [
            ("Այսօր արև է և տաք է։", "Today it's sunny and warm.",
             "How is the weather today?", ["Sunny and warm", "Cold", "Rainy", "Snowy"], 0),
            ("Բայց վաղը անձրև կգա։", "But tomorrow it will rain.",
             "What will happen tomorrow?", ["Rain", "Snow", "Sun", "Wind"], 0),
        ]),
        _radio("At the Café", [
            ("Երեկ ես գնացի սրճարան և սուրճ խմեցի։", "Yesterday I went to a café and drank coffee.",
             "What did the person drink?", ["Coffee", "Tea", "Water", "Juice"], 0),
            ("Սուրճը շատ համեղ էր։", "The coffee was very delicious.",
             "How was the coffee?", ["Delicious", "Bad", "Cold", "Expensive"], 0),
        ]),
        _radio("My Family", [
            ("Իմ ընտանիքը մեծ է։ Ես ունեմ մայր, հայր և քույր։", "My family is big. I have a mother, father, and sister.",
             "Who does the speaker mention?", ["Mother, father, sister", "Only a brother", "Grandparents", "No one"], 0),
            ("Մենք ապրում ենք Երևանում։", "We live in Yerevan.",
             "Where does the family live?", ["Yerevan", "Moscow", "Paris", "London"], 0),
        ]),
        _radio("At the Market", [
            ("Այսօր ես գնացի շուկա և գնեցի խնձոր։", "Today I went to the market and bought apples.",
             "What did the person buy?", ["Apples", "Bread", "Milk", "Eggs"], 0),
            ("Խնձորները շատ համեղ էին։", "The apples were very delicious.",
             "How were the apples?", ["Delicious", "Old", "Small", "Expensive"], 0),
        ]),
    ]),
]


def seed_radio():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'radio-a2'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "radio-a2 already exists"}

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
