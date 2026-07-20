# backend/seed_fluency.py
"""
Phase 4 — Functional fluency. Adds past/future tense, reading
comprehension, and dialogue scenarios on top of Phase 3's present-tense
foundation.

Scope, deliberately conservative on grammar: full past + future
conjugation for exactly two verbs — "լինել" (to be, irregular aorist
եղա/եղար/եղավ... and the standard կ- future) and "սովորել" (to learn),
which demonstrates the fully regular -ել -> -եցի (aorist) / կ- + -եմ
(future) pattern shared by the large -ել verb class. Reading-comprehension
and dialogue content is built entirely by recombining vocabulary and
sentence patterns already verified correct earlier in this curriculum, so
no new morphology risk is introduced there.

Deliberately deferred to a later round (not attempted here, to avoid
shipping uncertain grammar): imperative mood, and the remaining cases
(genitive-dative, instrumental) beyond the already-confirmed ablative
(-ից) and one controlled use of the locative (-ում on a proper noun,
Երևանում). AI Conversation (Aram) already exists in the app as the
natural culmination of this phase and needs no code change.

Two new chapters (positions 20-21, right after "Sentences III"):
"Fluency I: Past & Future" and "Fluency II: Reading & Conversation".

Idempotent: skips entirely if "flu-tobe-tenses" already exists.
Triggered via POST /cms/seed/fluency (CMS-admin only).
"""

import json
from sqlalchemy import text
from database import engine

_XP = {
    "conjugation": 20,
    "translate_mcq": 10,
    "select_missing_word": 10,
    "sentence_order": 15,
    "true_false": 10,
    "match_pairs": 15,
    "reading_comprehension": 15,
    "dialogue_mcq": 15,
    "dialogue_order": 15,
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


def _reading(passage, question, choices, answer_index):
    return {"kind": "reading_comprehension", "prompt": question,
            "config": {"passage": passage, "question": question, "choices": choices, "answerIndex": answer_index}}


def _dmcq(their_line, choices, answer_index):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?",
            "config": {"lines": [{"from": "them", "text": their_line}],
                       "choices": choices, "answerIndex": answer_index}}


def _dorder(lines):
    return {"kind": "dialogue_order", "prompt": "Put the conversation in order.",
            "config": {"lines": lines, "solution": lines}}


_PASSAGE = ("Բարև, իմ անունը Անի է. Ես ուսանող եմ և հայերեն եմ սովորում. "
            "Իմ ընտանիքը մեծ է. Երեկ ես հայերեն սովորեցի, և վաղը ես նորից կսովորեմ.")

_LESSONS = [
    ("Fluency I: Past & Future", 20, "flu-tobe-tenses", "Was, Will Be", [
        _conjugation("լինել — past (was)", [
            ("Ես (I)", "եղա"), ("Դու (you)", "եղար"), ("Նա (he/she)", "եղավ"),
            ("Մենք (we)", "եղանք"), ("Դուք (you all)", "եղաք"), ("Նրանք (they)", "եղան"),
        ]),
        _conjugation("լինել — future (will be)", [
            ("Ես (I)", "կլինեմ"), ("Դու (you)", "կլինես"), ("Նա (he/she)", "կլինի"),
            ("Մենք (we)", "կլինենք"), ("Դուք (you all)", "կլինեք"), ("Նրանք (they)", "կլինեն"),
        ]),
        _tmcq("I was", ["եղա", "կլինեմ", "եմ", "էի"], 0),
        _smw("Երեկ ես Երևանում", "", ["եղա", "կլինեմ", "եմ"], 0),
        _sorder("Arrange: “Tomorrow I will be a student.”",
                ["կլինեմ", "Վաղը", "ես", "ուսանող"], ["Վաղը", "ես", "ուսանող", "կլինեմ"]),
        _tf("«Եղա» means “I was.”"),
    ]),
    ("Fluency I: Past & Future", 20, "flu-learn-tenses", "I Learned, I Will Learn", [
        _conjugation("սովորել — past (learned)", [
            ("Ես (I)", "սովորեցի"), ("Դու (you)", "սովորեցիր"), ("Նա (he/she)", "սովորեց"),
            ("Մենք (we)", "սովորեցինք"), ("Դուք (you all)", "սովորեցիք"), ("Նրանք (they)", "սովորեցին"),
        ]),
        _conjugation("սովորել — future (will learn)", [
            ("Ես (I)", "կսովորեմ"), ("Դու (you)", "կսովորես"), ("Նա (he/she)", "կսովորի"),
            ("Մենք (we)", "կսովորենք"), ("Դուք (you all)", "կսովորեք"), ("Նրանք (they)", "կսովորեն"),
        ]),
        _tmcq("I learned", ["սովորեցի", "կսովորեմ", "սովորում եմ", "սովորեց"], 0),
        _smw("Երեկ ես հայերեն", "", ["սովորեցի", "կսովորեմ", "սովորում եմ"], 0),
        _sorder("Arrange: “Tomorrow I will learn Armenian.”",
                ["հայերեն", "կսովորեմ", "Վաղը", "ես"], ["Վաղը", "ես", "հայերեն", "կսովորեմ"]),
        _tf("«Կսովորեմ» means “I will learn.”"),
    ]),
    ("Fluency II: Reading & Conversation", 21, "flu-reading", "A Short Story", [
        _reading(_PASSAGE, "What is Ani learning?",
                 ["Armenian", "English", "French", "Russian"], 0),
        _reading(_PASSAGE, "What did Ani do yesterday?",
                 ["Learned Armenian", "Worked", "Traveled", "Cooked"], 0),
        _reading(_PASSAGE, "Is Ani's family big or small?",
                 ["Big", "Small", "Not mentioned", "Medium"], 0),
        _tf("The passage says Ani will learn Armenian again tomorrow."),
        _match([("երեկ", "yesterday"), ("վաղը", "tomorrow"),
                ("նորից", "again"), ("ընտանիք", "family")]),
    ]),
    ("Fluency II: Reading & Conversation", 21, "flu-dialogue", "A Conversation", [
        _dmcq("Բարև! Ինչպե՞ս ես", ["Ես լավ եմ, շնորհակալություն", "Ցտեսություն", "Ոչ"], 0),
        _dmcq("Որտեղի՞ց ես", ["Ես Հայաստանից եմ", "Ես ուսանող եմ", "Բարև"], 0),
        _dorder(["Բարև!", "Ինչպե՞ս ես", "Ես լավ եմ, շնորհակալություն", "Ցտեսություն"]),
        _tf("«Որտեղի՞ց ես» means “Where are you from?”"),
        _match([("Ինչպես", "how"), ("Որտեղից", "from where"),
                ("Ցտեսություն", "goodbye"), ("նորից", "again")]),
    ]),
]


def seed_fluency_phase():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'flu-tobe-tenses'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "flu-tobe-tenses already exists"}

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
