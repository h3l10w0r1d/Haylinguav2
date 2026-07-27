# backend/seed_reading_a2.py
"""
A2 reading — short connected passages, the point where a learner stops
answering single sentences and starts *reading*. Three graded texts that
deliberately walk through the three tenses in the order they were taught, so
each passage is mostly review with only a couple of new, guessable words
(comprehensible input, i+1), and each lesson ends with a small glossary match
to lock those new words in:

- «Իմ օրը» — the present / daily routine (drinks coffee, goes to work,
  studies in the evening).
- «Սրճարանում» — the past, reusing the café words from A2 round 2
  (գնացի, մենյուն, կերա, «Հաշիվը, խնդրում եմ», համեղ էր).
- «Շաբաթ օրը» — the future / weekend plans (կգնամ շուկա, կգնեմ մրգեր,
  ընկերս կգա, ճաշ կպատրաստենք, կդիտենք ֆիլմ).

Uses the self-contained `reading_comprehension` kind (passage bundled with
each question, rendered + graded by ExReadingComprehension), so no fragile
exercise-id wiring. Questions and choices are in English to test comprehension
of the Armenian text, not translation. Passages are standard Eastern Armenian,
hand-checked. Tagged cefr="A2". One new chapter (position 58). Idempotent:
skips if 'a2-read-1' exists. Triggered via POST /cms/seed/reading-a2.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {
    "reading_comprehension": 15,
    "true_false": 10,
    "match_pairs": 15,
}

_CEFR = "A2"


def _reading(passage, question, choices, answer_index=0):
    return {"kind": "reading_comprehension", "prompt": question,
            "config": {"passage": passage, "question": question,
                       "choices": choices, "answerIndex": answer_index}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?",
            "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


# ---- Passage 1: the present / a daily routine ----
_P1 = ("Ամեն օր ես սուրճ եմ խմում։ Առավոտյան ես հաց եմ ուտում, հետո գնում եմ "
       "աշխատանքի։ Երեկոյան ես տանն եմ և հայերեն եմ սովորում։ "
       "Ես շատ եմ սիրում հայերենը։")

# ---- Passage 2: the past / at the café (reuses A2 round-2 café vocab) ----
_P2 = ("Երեկ ես գնացի սրճարան։ Մատուցողը բերեց մենյուն։ Ես խմեցի սուրճ և կերա "
       "թխվածք։ Հետո ես ասացի՝ «Հաշիվը, խնդրում եմ»։ Ամեն ինչ շատ համեղ էր։")

# ---- Passage 3: the future / weekend plans ----
_P3 = ("Վաղը շաբաթ է։ Առավոտյան ես կգնամ շուկա և կգնեմ մրգեր։ Հետո ընկերս կգա "
       "իմ տուն, և մենք միասին ճաշ կպատրաստենք։ Երեկոյան մենք կդիտենք ֆիլմ։")


_LESSONS = [
    ("A2 · Reading", 58, "a2-read-1", "My Day", [
        _reading(_P1, "What does the person drink every day?",
                 ["Coffee", "Tea", "Water", "Milk"], 0),
        _reading(_P1, "What does the person eat in the morning?",
                 ["Bread", "Eggs", "Fruit", "Cheese"], 0),
        _reading(_P1, "Where does the person go after breakfast?",
                 ["To work", "To school", "To a café", "To the market"], 0),
        _reading(_P1, "How does the person feel about Armenian?",
                 ["Loves it", "Hates it", "Not mentioned", "Finds it hard"], 0),
        _tf("The person studies Armenian in the evening."),
        _tf("The person drinks tea every day.", correct=False),
        _match([("առավոտյան", "in the morning"), ("երեկոյան", "in the evening"),
                ("աշխատանք", "work"), ("ամեն օր", "every day")]),
    ]),
    ("A2 · Reading", 58, "a2-read-2", "At the Café", [
        _reading(_P2, "Where did the person go yesterday?",
                 ["To a café", "To school", "To work", "Home"], 0),
        _reading(_P2, "What did the waiter bring?",
                 ["The menu", "The bill", "Water", "Bread"], 0),
        _reading(_P2, "What did the person eat?",
                 ["A pastry", "Bread", "Soup", "Fruit"], 0),
        _reading(_P2, "How was everything?",
                 ["Delicious", "Bad", "Expensive", "Cold"], 0),
        _tf("The person asked for the bill."),
        _tf("The person drank tea.", correct=False),
        _match([("սրճարան", "café"), ("մատուցող", "waiter"),
                ("բերել", "to bring"), ("համեղ", "delicious")]),
    ]),
    ("A2 · Reading", 58, "a2-read-3", "Saturday Plans", [
        _reading(_P3, "What day is tomorrow?",
                 ["Saturday", "Sunday", "Monday", "Friday"], 0),
        _reading(_P3, "What will the person buy at the market?",
                 ["Fruit", "Bread", "Coffee", "Books"], 0),
        _reading(_P3, "Who will come to the person's house?",
                 ["A friend", "A brother", "A teacher", "No one"], 0),
        _reading(_P3, "What will they do in the evening?",
                 ["Watch a film", "Cook lunch", "Rest", "Study"], 0),
        _tf("They will cook lunch together."),
        _tf("The person will go to the market in the evening.", correct=False),
        _match([("շուկա", "market"), ("մրգեր", "fruit"),
                ("միասին", "together"), ("ընկեր", "friend")]),
    ]),
]


def seed_reading_a2():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-read-1'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-read-1 already exists"}

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
