# backend/seed_essentials.py
"""
Essential building blocks a beginner can't form real sentences without, and
which were missing from the curriculum entirely:

- ունել "to have" — its own (irregular) verb in Armenian, not a "have"
  helper: ունեմ / ունես / ունի / ունենք / ունեք / ունեն. Needed for
  "I have a brother", "Do you have water?".
- ուզել "to want" — the -ում present participle + copula (ուզում եմ …),
  as high-frequency as they come.
- Noun plurals — the -եր / -ներ rule (one syllable → -եր, more than one →
  -ներ). Learners had only ever seen singular nouns.

All vocabulary reused is already live elsewhere (գիրք, ջուր, եղբայր, տուն,
ընկեր, օր, աթոռ, ուսանող …). Plural forms are hand-checked; only clean,
textbook-standard forms are used (գիրք→գրքեր, տուն→տներ, ուսանող→ուսանողներ).

Two new chapters (positions 37-38). Idempotent: skips if 'gr-have' exists.
Triggered via POST /cms/seed/essentials.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {
    "conjugation": 20,
    "translate_mcq": 10,
    "select_missing_word": 10,
    "sentence_order": 15,
    "word_bank": 15,
    "true_false": 10,
    "match_pairs": 15,
}


def _tmcq(prompt_word, choices, answer_index):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{prompt_word}”?",
            "config": {"choices": choices, "sentence": prompt_word, "answerIndex": answer_index}}


def _smw(before, after, choices, answer_index=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.",
            "config": {"before": before, "after": after, "choices": choices, "answerIndex": answer_index}}


def _sorder(prompt, tokens, solution):
    return {"kind": "sentence_order", "prompt": prompt, "config": {"tokens": tokens, "solution": solution}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _conjugation(verb, cells):
    return {"kind": "conjugation", "prompt": f"Conjugate: {verb}",
            "config": {"verb": verb, "cells": [{"label": l, "answer": a} for l, a in cells]}}


_LESSONS = [
    # ---- Grammar VIII: Having & Wanting ----
    ("Grammar VIII: Having & Wanting", 37, "gr-have", "To Have", [
        _conjugation("ունել — to have", [
            ("Ես (I)", "ունեմ"), ("Դու (you)", "ունես"), ("Նա (he/she)", "ունի"),
            ("Մենք (we)", "ունենք"), ("Դուք (you all)", "ունեք"), ("Նրանք (they)", "ունեն"),
        ]),
        _match([("ունեմ", "I have"), ("ունես", "you have"),
                ("ունի", "he/she has"), ("ունենք", "we have")]),
        _tmcq("I have", ["ունեմ", "ունես", "ունի", "ունեն"], 0),
        _smw("Ես եղբայր", "", ["ունեմ", "ունես", "ունի"], 0),
        _sorder("Arrange: “I have a book.”",
                ["ունեմ", "Ես", "գիրք"], ["Ես", "գիրք", "ունեմ"]),
        _tf("«ունի» means “he/she has.”"),
        _tf("«ունեմ» means “you have.”", correct=False),
    ]),
    ("Grammar VIII: Having & Wanting", 37, "gr-want", "To Want", [
        _conjugation("ուզել — to want", [
            ("Ես (I)", "ուզում եմ"), ("Դու (you)", "ուզում ես"), ("Նա (he/she)", "ուզում է"),
            ("Մենք (we)", "ուզում ենք"), ("Դուք (you all)", "ուզում եք"), ("Նրանք (they)", "ուզում են"),
        ]),
        _match([("ուզում եմ", "I want"), ("ուզում ես", "you want"),
                ("ուզում է", "he/she wants"), ("ուզում ենք", "we want")]),
        _tmcq("I want", ["ուզում եմ", "ուզում ես", "ուզում է", "ունեմ"], 0),
        _smw("Ես", "ջուր", ["ուզում եմ", "ուզում ես", "ուզում է"], 0),
        _tf("«ուզում է» means “he/she wants.”"),
        _sorder("Arrange: “I want water.”",
                ["եմ", "Ես", "ուզում", "ջուր"], ["Ես", "ուզում", "եմ", "ջուր"]),
    ]),

    # ---- Grammar IX: One and Many (Plurals) ----
    ("Grammar IX: One & Many", 38, "gr-plurals", "Plurals", [
        _match([("գրքեր", "books"), ("տներ", "houses"),
                ("օրեր", "days"), ("ընկերներ", "friends")]),
        _tmcq("books", ["գրքեր", "գիրք", "տներ", "օրեր"], 0),
        _tmcq("friends", ["ընկերներ", "ընկեր", "ուսանողներ", "աթոռներ"], 0),
        _smw("Ես ունեմ երկու", "", ["գրքեր", "գիրք", "գրքի"], 0),
        _tf("One-syllable nouns add «-եր»; longer nouns add «-ներ»."),
        _tf("«տներ» means “houses.”"),
        _tf("The plural of «ուսանող» is «ուսանողեր».", correct=False),
        _match([("ձեռքեր", "hands"), ("աթոռներ", "chairs"),
                ("մատիտներ", "pencils"), ("սարեր", "mountains")]),
    ]),
]


def seed_essentials():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'gr-have'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "gr-have already exists"}

        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        created_lessons = 0
        created_exercises = 0

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
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard')
                    RETURNING id
                """),
                {"slug": slug, "title": title, "level": max_level,
                 "xp": lesson_xp, "chapter_id": chapter_ids[chapter_title]},
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

        return {"ok": True, "chapters_created": list(chapter_ids.values()),
                "lessons_created": created_lessons, "exercises_created": created_exercises}
