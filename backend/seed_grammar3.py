# backend/seed_grammar3.py
"""
More verbs and more grammar — the foundation A1 was still thin on:

- Common Verbs II: present-tense conjugations of the most-used regular
  verbs, so a learner can say what they do — խոսել (speak), ապրել (live),
  կարդալ (read), գրել (write), տեսնել (see), անել (do/make), ասել (say).
  Only the present tense (-ում եմ), which is fully regular for all of these,
  so every form is safe.
- More Structure: Armenian postpositions (մեջ "in", վրա "on", տակ "under",
  հետ "with", համար "for") — the spatial words English does with
  prepositions but Armenian puts AFTER the noun — and the modal կարող եմ
  "I can" (+ infinitive: «Ես կարող եմ խոսել»).

Sentences reuse vocabulary/forms already live (հայերեն, Երևանում, գիրք,
ընկերոջ). All hand-checked, standard Eastern Armenian. Two chapters
(positions 43-44). Idempotent: skips if 'gr-verbs-speak' exists. Triggered
via POST /cms/seed/grammar3.
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


def _present(verb_label, stem_present):
    """Regular present tense: <participle> + copula. participle = stem+ում."""
    return _conjugation(verb_label, [
        ("Ես (I)", f"{stem_present} եմ"), ("Դու (you)", f"{stem_present} ես"),
        ("Նա (he/she)", f"{stem_present} է"), ("Մենք (we)", f"{stem_present} ենք"),
        ("Դուք (you all)", f"{stem_present} եք"), ("Նրանք (they)", f"{stem_present} են"),
    ])


_LESSONS = [
    # ---- Common Verbs II ----
    ("Common Verbs II", 43, "gr-verbs-speak", "Speak & Live", [
        _present("խոսել — to speak (present)", "խոսում"),
        _present("ապրել — to live (present)", "ապրում"),
        _match([("խոսում եմ", "I speak"), ("ապրում եմ", "I live"),
                ("խոսում ես", "you speak"), ("ապրում է", "he/she lives")]),
        _smw("Ես հայերեն", "", ["խոսում եմ", "խոսում ես", "ապրում եմ"], 0),
        _sorder("Arrange: “I live in Yerevan.”",
                ["եմ", "Ես", "Երևանում", "ապրում"], ["Ես", "Երևանում", "ապրում", "եմ"]),
        _tf("«Ես հայերեն խոսում եմ» means “I speak Armenian.”"),
        _listen("խոսում", ["խոսում"]),
    ]),
    ("Common Verbs II", 43, "gr-verbs-read", "Read & Write", [
        _present("կարդալ — to read (present)", "կարդում"),
        _present("գրել — to write (present)", "գրում"),
        _match([("կարդում եմ", "I read"), ("գրում եմ", "I write"),
                ("կարդում ես", "you read"), ("գրում է", "he/she writes")]),
        _smw("Ես գիրք", "", ["կարդում եմ", "գրում եմ", "կարդում ես"], 0),
        _tf("«Ես հայերեն գրում եմ» means “I write Armenian.”"),
        _tf("«կարդում եմ» means “I write.”", correct=False),
    ]),
    ("Common Verbs II", 43, "gr-verbs-see", "See, Do & Say", [
        _present("տեսնել — to see (present)", "տեսնում"),
        _present("անել — to do / make (present)", "անում"),
        _present("ասել — to say (present)", "ասում"),
        _match([("տեսնում եմ", "I see"), ("անում եմ", "I do"),
                ("ասում եմ", "I say"), ("տեսնում ես", "you see")]),
        _tmcq("I see", ["տեսնում եմ", "անում եմ", "ասում եմ", "տեսնում ես"], 0),
        _tf("«Ի՞նչ ես անում» means “What are you doing?”"),
        _listen("տեսնում", ["տեսնում"]),
    ]),

    # ---- Grammar XI: More Structure ----
    ("Grammar XI: More Structure", 44, "gr-postpositions", "In, On, Under, With", [
        _match([("մեջ", "in"), ("վրա", "on"), ("տակ", "under"), ("հետ", "with")]),
        _tmcq("on", ["վրա", "մեջ", "տակ", "հետ"], 0),
        _tmcq("with", ["հետ", "համար", "մեջ", "վրա"], 0),
        _tf("In Armenian, «մեջ / վրա / տակ» come AFTER the noun, not before."),
        _match([("համար", "for"), ("մասին", "about"), ("մեջ", "in"), ("տակ", "under")]),
        _sorder("Arrange: “with a friend”",
                ["հետ", "ընկերոջ"], ["ընկերոջ", "հետ"]),
        _tf("«վրա» means “under.”", correct=False),
    ]),
    ("Grammar XI: More Structure", 44, "gr-can", "Can (կարող եմ)", [
        _conjugation("կարողանալ — can / to be able", [
            ("Ես (I)", "կարող եմ"), ("Դու (you)", "կարող ես"), ("Նա (he/she)", "կարող է"),
            ("Մենք (we)", "կարող ենք"), ("Դուք (you all)", "կարող եք"), ("Նրանք (they)", "կարող են"),
        ]),
        _match([("կարող եմ", "I can"), ("կարող ես", "you can"),
                ("կարող է", "he/she can"), ("կարող ենք", "we can")]),
        _smw("Ես", "եմ խոսել", ["կարող", "կարող է", "կարել"], 0),
        _sorder("Arrange: “I can speak Armenian.”",
                ["եմ", "Ես", "կարող", "խոսել", "հայերեն"],
                ["Ես", "կարող", "եմ", "հայերեն", "խոսել"]),
        _tf("«Ես կարող եմ խոսել» means “I can speak.”"),
        _tf("«կարող է» means “we can.”", correct=False),
    ]),
]


def seed_grammar3():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'gr-verbs-speak'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "gr-verbs-speak already exists"}

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
