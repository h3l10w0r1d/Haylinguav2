# backend/seed_stories.py
"""
Stories — a "Stories-lite" lesson on the new `story` exercise: a short narrated
dialogue (chat bubbles, tap-to-hear per line via Azure hy-AM TTS, tappable
words, and a translation) followed by a comprehension question. Context +
listening + reading together, graded on understanding — the highest-ROI of the
newer Duolingo formats, and it reuses the existing renderer (no new route).

Five short dialogues built entirely from already-taught vocabulary (greetings,
café, going places, home, introductions). Standard Eastern Armenian,
hand-checked. Tagged cefr="A2", "Stories" chapter at position 63. Idempotent:
skips if 'story-cafe' exists. Triggered via POST /cms/seed/stories.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"story": 20}
_CEFR = "A2"


def _story(slug_title, lines, question, choices, answer_index):
    return {"kind": "story", "prompt": slug_title,
            "config": {"title": slug_title,
                       "lines": [{"speaker": s, "text": t, "translation": tr} for s, t, tr in lines],
                       "question": question, "choices": choices, "answerIndex": answer_index}}


_LESSONS = [
    ("Stories", 63, "story-a2", "Stories", [
        _story("At the Café",
               [("Անի", "Բարև ձեզ։", "Hello."),
                ("Մատուցող", "Բարև ձեզ։ Ի՞նչ եք ուզում։", "Hello. What would you like?"),
                ("Անի", "Մեկ սուրճ, խնդրում եմ։", "One coffee, please."),
                ("Մատուցող", "Լավ։ Շնորհակալություն։", "Okay. Thank you.")],
               "What did Ani order?", ["Coffee", "Tea", "Water", "Bread"], 0),

        _story("Meeting a Friend",
               [("Դավիթ", "Բարև, Անի։ Ինչպե՞ս ես։", "Hi, Ani. How are you?"),
                ("Անի", "Լավ եմ, շնորհակալություն։ Իսկ դու՞։", "I'm good, thanks. And you?"),
                ("Դավիթ", "Ես էլ լավ եմ։ Ո՞ւր ես գնում։", "I'm good too. Where are you going?"),
                ("Անի", "Գնում եմ դպրոց։", "I'm going to school.")],
               "Where is Ani going?", ["To school", "Home", "To work", "To the café"], 0),

        _story("At the Market",
               [("Հաճախորդ", "Բարև։ Խնձոր ունե՞ք։", "Hello. Do you have apples?"),
                ("Վաճառող", "Այո, ունենք։ Քանի՞սն եք ուզում։", "Yes, we do. How many do you want?"),
                ("Հաճախորդ", "Երկու, խնդրում եմ։", "Two, please."),
                ("Վաճառող", "Ահա։ Շնորհակալություն։", "Here you go. Thank you.")],
               "How many apples did the customer want?", ["Two", "One", "Three", "Five"], 0),

        _story("At Home",
               [("Մայրիկ", "Դավիթ, որտե՞ղ ես։", "Davit, where are you?"),
                ("Դավիթ", "Ես տանն եմ, մայրիկ։", "I'm at home, mom."),
                ("Մայրիկ", "Ի՞նչ ես անում։", "What are you doing?"),
                ("Դավիթ", "Հայերեն եմ սովորում։", "I'm studying Armenian.")],
               "What is Davit doing?", ["Studying Armenian", "Sleeping", "Eating", "Reading a book"], 0),

        _story("Introductions",
               [("Անի", "Բարև։ Իմ անունը Անի է։", "Hello. My name is Ani."),
                ("Մարկ", "Շատ հաճելի է։ Ես Մարկն եմ։", "Nice to meet you. I'm Mark."),
                ("Անի", "Որտեղի՞ց ես։", "Where are you from?"),
                ("Մարկ", "Ամերիկայից եմ։", "I'm from America.")],
               "Where is Mark from?", ["America", "Armenia", "France", "Russia"], 0),
    ]),
]


def seed_stories():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'story-a2'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "story-a2 already exists"}

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
