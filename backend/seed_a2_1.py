# backend/seed_a2_1.py
"""
A2 roadmap, round 1 — the first "Elementary" content, where a learner moves
from fixed phrases into the past and into comparing things:

- Irregular past tense (aorist) of the everyday verbs whose past is NOT
  regular: տեսնել→տեսա (saw), գալ→եկա (came), անել→արեցի (did),
  ասել→ասացի (said). Conjugation tables, so every form is exact.
- The perfect ("I have …"): the -ել participle + copula — «Ես գրել եմ»
  (I have written), «Ես հայերեն խոսել եմ».
- Comparatives & superlatives: ավելի … (more), -ից (than), ամենա- (most)
  — «Սա ավելի մեծ է», «ամենամեծը».

Every lesson is tagged cefr="A2" in its config, so the coming level system
can group and gate it. Verbs/adjectives reuse ones already taught (տեսնել,
գալ, անել, ասել, գրել, խոսել, մեծ, լավ). Standard Eastern Armenian,
hand-checked. Two new chapters (positions 52-53). Idempotent: skips if
'a2-past-1' exists. Triggered via POST /cms/seed/a2-1.

The accusative case and conditionals are deliberately deferred to A2 round 2
(they carry the most declension risk and deserve their own careful pass).
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

_CEFR = "A2"


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
    # ---- A2 · The Past ----
    ("A2 · The Past", 52, "a2-past-1", "Past: See & Come", [
        _conjugation("տեսնել — past (saw)", [
            ("Ես (I)", "տեսա"), ("Դու (you)", "տեսար"), ("Նա (he/she)", "տեսավ"),
            ("Մենք (we)", "տեսանք"), ("Դուք (you all)", "տեսաք"), ("Նրանք (they)", "տեսան"),
        ]),
        _conjugation("գալ — past (came)", [
            ("Ես (I)", "եկա"), ("Դու (you)", "եկար"), ("Նա (he/she)", "եկավ"),
            ("Մենք (we)", "եկանք"), ("Դուք (you all)", "եկաք"), ("Նրանք (they)", "եկան"),
        ]),
        _match([("տեսա", "I saw"), ("եկա", "I came"),
                ("տեսավ", "he/she saw"), ("եկան", "they came")]),
        _tmcq("I saw", ["տեսա", "տեսավ", "եկա", "տեսնում եմ"], 0),
        _smw("Երեկ ես", "", ["եկա", "եկավ", "գալիս եմ"], 0),
        _tf("«տեսնել» has an irregular past — «տեսա», not «տեսեցի»."),
        _listen("տեսա", ["տեսա"]),
    ]),
    ("A2 · The Past", 52, "a2-past-2", "Past: Do & Say", [
        _conjugation("անել — past (did / made)", [
            ("Ես (I)", "արեցի"), ("Դու (you)", "արեցիր"), ("Նա (he/she)", "արեց"),
            ("Մենք (we)", "արեցինք"), ("Դուք (you all)", "արեցիք"), ("Նրանք (they)", "արեցին"),
        ]),
        _conjugation("ասել — past (said)", [
            ("Ես (I)", "ասացի"), ("Դու (you)", "ասացիր"), ("Նա (he/she)", "ասաց"),
            ("Մենք (we)", "ասացինք"), ("Դուք (you all)", "ասացիք"), ("Նրանք (they)", "ասացին"),
        ]),
        _match([("արեցի", "I did"), ("ասացի", "I said"),
                ("արեց", "he/she did"), ("ասաց", "he/she said")]),
        _tmcq("I said", ["ասացի", "ասաց", "արեցի", "ասում եմ"], 0),
        _tf("«անել» → past «արեցի» (the stem changes to «ար-»)."),
        _tf("«ասաց» means “they said.”", correct=False),
    ]),

    # ---- A2 · Saying More ----
    ("A2 · Saying More", 53, "a2-perfect", "Have Done (the Perfect)", [
        _match([("գրել եմ", "I have written"), ("խոսել եմ", "I have spoken"),
                ("տեսել եմ", "I have seen"), ("եկել եմ", "I have come")]),
        _tf("The perfect = the «-ել» participle + «եմ»: գրել + եմ → «գրել եմ» (I have written)."),
        _tmcq("I have spoken", ["խոսել եմ", "խոսում եմ", "խոսեցի", "խոսել ես"], 0),
        _smw("Ես հայերեն", "", ["խոսել եմ", "խոսում եմ", "խոսել ես"], 0),
        _sorder("Arrange: “I have written a book.”",
                ["եմ", "Ես", "գիրք", "գրել"], ["Ես", "գիրք", "գրել", "եմ"]),
        _tf("«գրել եմ» means “I am writing.”", correct=False),
    ]),
    ("A2 · Saying More", 53, "a2-compare", "More & Most", [
        _match([("ավելի", "more"), ("ամենա-", "most"), ("մեծ", "big"), ("լավ", "good")]),
        _tf("«ավելի մեծ» means “bigger” (more big)."),
        _tmcq("bigger", ["ավելի մեծ", "ամենամեծ", "մեծ", "ավելի լավ"], 0),
        _smw("Սա", "մեծ է", ["ավելի", "ամենա", "շատ"], 0),
        _tf("«ամենամեծը» means “the biggest.”"),
        _tf("To say “than”, Armenian adds «-ից» to the thing compared."),
        _sorder("Arrange: “This is better.”",
                ["է", "Սա", "ավելի", "լավ"], ["Սա", "ավելի", "լավ", "է"]),
    ]),
]


def seed_a2_1():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-past-1'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-past-1 already exists"}

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
