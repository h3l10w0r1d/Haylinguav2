# backend/seed_a1.py
"""
The pieces needed to complete a genuine A1 level of Armenian, all of which
were missing:

- Numbers 20-100 (tens + how compound numbers are built) — unlocks age,
  prices and telling time.
- Time & Age — «Ես քսան տարեկան եմ» (I'm 20), «Ժամը երեքն է» (it's 3
  o'clock), «Քանի՞ տարեկան ես» (how old are you?).
- Two of the most common A1 verbs: գիտենալ "to know" (irregular:
  գիտեմ/գիտես/գիտի…) and սիրել "to like/love" (սիրում եմ …).
- Nationalities & countries — «Ես հայ եմ» (I'm Armenian), «Ես Հայաստանից
  եմ» (I'm from Armenia).

Also introduces real listening dictation (listen_type — hear the word,
type it) into live lessons, which previously only existed in the hidden
demo.

All forms are hand-checked, standard Eastern Armenian. Four new chapters
(positions 39-42). Idempotent: skips if 'num-tens' exists. Triggered via
POST /cms/seed/a1.
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
    "listen_type": 15,
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


def _listen(tts_text, accepted):
    return {"kind": "listen_type", "prompt": "Type what you hear",
            "config": {"ttsText": tts_text, "acceptedAnswers": accepted}}


_LESSONS = [
    # ---- Bigger Numbers ----
    ("Bigger Numbers", 39, "num-tens", "Tens to 100", [
        _match([("քսան", "20"), ("երեսուն", "30"), ("քառասուն", "40"), ("հիսուն", "50")]),
        _tmcq("thirty", ["երեսուն", "քսան", "քառասուն", "հիսուն"], 0),
        _tmcq("one hundred", ["հարյուր", "իննսուն", "ութսուն", "հիսուն"], 0),
        _match([("վաթսուն", "60"), ("յոթանասուն", "70"), ("ութսուն", "80"), ("իննսուն", "90")]),
        _tf("«հարյուր» means 100."),
        _tf("«հիսուն» means 40.", correct=False),
        _listen("երեսուն", ["երեսուն"]),
        _listen("հարյուր", ["հարյուր"]),
    ]),
    ("Bigger Numbers", 39, "num-compound", "Counting Higher", [
        _tf("21 is «քսանմեկ» — twenty + one, written as one word."),
        _match([("քսանմեկ", "21"), ("երեսուներկու", "32"), ("քառասունյոթ", "47"), ("իննսունինը", "99")]),
        _tmcq("twenty-one", ["քսանմեկ", "քսան", "երեսուն", "տասնմեկ"], 0),
        _tmcq("thirty-two", ["երեսուներկու", "երեսուն", "քսաներկու", "երեք"], 0),
        _tf("«իննսունինը» means 99."),
        _tf("«քսանհինգ» means 52.", correct=False),
    ]),

    # ---- Time & Age ----
    ("Time & Age", 40, "a1-age", "How Old Are You?", [
        _match([("տարեկան", "years old"), ("Քանի՞", "How many?"),
                ("տարի", "year"), ("Ես", "I")]),
        _tmcq("years old", ["տարեկան", "տարի", "քսան", "տատիկ"], 0),
        _smw("Ես քսան", "եմ", ["տարեկան", "տարի", "տարեկան է"], 0),
        _sorder("Arrange: “I am 30 years old.”",
                ["եմ", "Ես", "երեսուն", "տարեկան"], ["Ես", "երեսուն", "տարեկան", "եմ"]),
        _match([("Քանի՞ տարեկան ես", "How old are you?"), ("Ես քսան տարեկան եմ", "I am 20 years old")]),
        _tf("«Ես երեսուն տարեկան եմ» means “I am 30 years old.”"),
        _listen("տարեկան", ["տարեկան"]),
    ]),
    ("Time & Age", 40, "a1-time", "What Time Is It?", [
        _match([("Ժամը մեկն է", "It's 1 o'clock"), ("Ժամը երեքն է", "It's 3 o'clock"),
                ("Ժամը յոթն է", "It's 7 o'clock"), ("Ժամը տասն է", "It's 10 o'clock")]),
        _smw("Ժամը", "է", ["երեքն", "երեք", "երեքը"], 0),
        _sorder("Arrange: “It's five o'clock.”",
                ["է", "Ժամը", "հինգն"], ["Ժամը", "հինգն", "է"]),
        _tf("«Ժամը տասն է» means “It's ten o'clock.”"),
        _tf("«Ո՞ր ժամն է» means “What is your name?”", correct=False),
        _tf("«Ո՞ր ժամն է» means “What time is it?”"),
    ]),

    # ---- Grammar X: Knowing & Liking ----
    ("Grammar X: Knowing & Liking", 41, "gr-know", "To Know", [
        _conjugation("գիտենալ — to know", [
            ("Ես (I)", "գիտեմ"), ("Դու (you)", "գիտես"), ("Նա (he/she)", "գիտի"),
            ("Մենք (we)", "գիտենք"), ("Դուք (you all)", "գիտեք"), ("Նրանք (they)", "գիտեն"),
        ]),
        _match([("գիտեմ", "I know"), ("գիտես", "you know"),
                ("գիտի", "he/she knows"), ("չգիտեմ", "I don't know")]),
        _tmcq("I know", ["գիտեմ", "գիտես", "գիտի", "գիտեն"], 0),
        _smw("Ես հայերեն", "", ["գիտեմ", "գիտես", "գիտի"], 0),
        _tf("«չգիտեմ» means “I don't know.”"),
        _tf("«գիտի» means “they know.”", correct=False),
        _listen("գիտեմ", ["գիտեմ"]),
    ]),
    ("Grammar X: Knowing & Liking", 41, "gr-like", "To Like", [
        _conjugation("սիրել — to like / love", [
            ("Ես (I)", "սիրում եմ"), ("Դու (you)", "սիրում ես"), ("Նա (he/she)", "սիրում է"),
            ("Մենք (we)", "սիրում ենք"), ("Դուք (you all)", "սիրում եք"), ("Նրանք (they)", "սիրում են"),
        ]),
        _match([("սիրում եմ", "I like"), ("սիրում ես", "you like"),
                ("սիրում է", "he/she likes"), ("սիրում ենք", "we like")]),
        _tmcq("I like", ["սիրում եմ", "սիրում ես", "սիրում է", "սիրում են"], 0),
        _smw("Ես", "եմ սուրճ", ["սիրում", "սիրում է", "սիրել"], 0),
        _tf("«Ես սիրում եմ հայերեն» means “I love Armenian.”"),
        _sorder("Arrange: “I like water.”",
                ["եմ", "Ես", "սիրում", "ջուր"], ["Ես", "սիրում", "եմ", "ջուր"]),
    ]),

    # ---- Where Are You From? ----
    ("Where Are You From?", 42, "a1-nationalities", "Nationalities", [
        _match([("հայ", "Armenian"), ("ամերիկացի", "American"),
                ("ռուս", "Russian"), ("ֆրանսիացի", "French")]),
        _tmcq("Armenian (person)", ["հայ", "ռուս", "ամերիկացի", "ֆրանսիացի"], 0),
        _match([("Հայաստան", "Armenia"), ("Ամերիկա", "America"),
                ("Ռուսաստան", "Russia"), ("Ֆրանսիա", "France")]),
        _smw("Ես", "եմ", ["հայ", "Հայաստան", "հայերեն"], 0),
        _sorder("Arrange: “I am from Armenia.”",
                ["եմ", "Ես", "Հայաստանից"], ["Ես", "Հայաստանից", "եմ"]),
        _tf("«Ես հայ եմ» means “I am Armenian.”"),
        _tf("«ամերիկացի» means “French.”", correct=False),
        _listen("հայ", ["հայ"]),
    ]),
]


def seed_a1():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'num-tens'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "num-tens already exists"}

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
