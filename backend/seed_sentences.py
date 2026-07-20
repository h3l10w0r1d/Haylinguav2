# backend/seed_sentences.py
"""
Phase 3 — Sentences. Extends the copula/SVO groundwork from Phase 2 into
full present-tense conjugation across all six persons, negation, question
formation, and basic connectors (և / բայց / որովհետև), per the curriculum
roadmap.

Grammar safety: every sentence either (a) directly extends the confirmed
"եմ/ես/է" copula paradigm to its (equally standard, high-confidence)
plural forms ենք/եք/են, (b) reuses full clauses already verified correct
elsewhere in this same live curriculum (e.g. "Ես հայերեն եմ սովորում",
"Հայաստանից", "Որտեղ է կայարանը") joined with a connector, or (c) applies
the standard, highly regular -ել -> -ում present-continuous pattern
(already confirmed via "սովորել" -> "սովորում") to a couple of extremely
common, unambiguous verbs (աշխատել "to work", խաղալ "to play"). No case
morphology beyond the already-confirmed ablative "-ից" is introduced, to
keep translation risk low for a single content round.

Three new chapters (positions 17-19, right after "Travel & Directions" at
16): "Sentences I: The Full Present Tense", "Sentences II: Questions &
Negation", "Sentences III: Connecting Ideas" — 6 lessons, ~36 exercises.

Idempotent: skips entirely if "sent-tobe-full" already exists. Triggered
via POST /cms/seed/sentences (CMS-admin only).
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
    "write_translate": 20,
}


def _tmcq(prompt_word, choices, answer_index):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{prompt_word}”?",
            "config": {"choices": choices, "sentence": prompt_word, "answerIndex": answer_index}}


def _smw(before, after, choices, answer_index=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.",
            "config": {"before": before, "after": after, "choices": choices, "answerIndex": answer_index}}


def _sorder(prompt, tokens, solution):
    return {"kind": "sentence_order", "prompt": prompt, "config": {"tokens": tokens, "solution": solution}}


def _wbank(prompt, tiles, solution):
    sentence = prompt.split("“")[-1].rstrip("”") if "“" in prompt else prompt
    return {"kind": "word_bank", "prompt": prompt,
            "config": {"sentence": sentence, "tiles": tiles, "solution": solution}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _wtranslate(source, accepted):
    return {"kind": "write_translate", "prompt": f"Translate: “{source}”",
            "config": {"source": source, "acceptedAnswers": accepted}}


def _conjugation(verb, cells):
    return {"kind": "conjugation", "prompt": f"Conjugate: {verb}",
            "config": {"verb": verb, "cells": [{"label": l, "answer": a} for l, a in cells]}}


_LESSONS = [
    # (chapter_title, chapter_position, lesson_slug, lesson_title, exercises)
    ("Sentences I: The Full Present Tense", 17, "sent-tobe-full", "The Full “To Be”", [
        _conjugation("լինել (to be)", [
            ("Ես (I)", "եմ"), ("Դու (you)", "ես"), ("Նա (he/she)", "է"),
            ("Մենք (we)", "ենք"), ("Դուք (you all)", "եք"), ("Նրանք (they)", "են"),
        ]),
        _tmcq("we are", ["ենք", "եք", "են", "եմ"], 0),
        _smw("Մենք ուսանող", "", ["ենք", "եք", "են"], 0),
        _sorder("Arrange: “You (all) are students.”",
                ["ուսանող", "Դուք", "եք"], ["Դուք", "ուսանող", "եք"]),
        _wbank("Build: “They are students.”",
               ["Նրանք", "ուսանող", "են", "մենք"], ["Նրանք", "ուսանող", "են"]),
        _tf("«Նրանք» means “they.”"),
    ]),
    ("Sentences I: The Full Present Tense", 17, "sent-present-verbs", "Everyday Actions", [
        _tmcq("I am working", ["Ես աշխատում եմ", "Ես աշխատում ես",
                                 "Դու աշխատում եմ", "Նա աշխատում ենք"], 0),
        _smw("Մենք հայերեն ենք", "", ["սովորում", "աշխատում", "խաղում"], 0),
        _sorder("Arrange: “You (all) are working.”",
                ["աշխատում", "Դուք", "եք"], ["Դուք", "աշխատում", "եք"]),
        _wbank("Build: “They are playing.”",
               ["Նրանք", "խաղում", "են", "մենք"], ["Նրանք", "խաղում", "են"]),
        _tf("«Աշխատել» means “to work.”"),
        _match([("աշխատում", "working"), ("խաղում", "playing"),
                ("ապրում", "living"), ("սովորում", "learning")]),
    ]),
    ("Sentences II: Questions & Negation", 18, "sent-negation", "Saying No", [
        _tmcq("I am not a student", ["Ես ուսանող չեմ", "Ես ուսանող եմ",
                                       "Դու ուսանող չես", "Նա ուսանող չէ"], 0),
        _smw("Նա ուսանող", "", ["չէ", "է", "չեմ"], 0),
        _sorder("Arrange: “We are not students.”",
                ["չենք", "Մենք", "ուսանող"], ["Մենք", "ուսանող", "չենք"]),
        _wbank("Build: “You are not from Armenia.”",
               ["Դու", "Հայաստանից", "չես", "ես"], ["Դու", "Հայաստանից", "չես"]),
        _tf("«Չեմ» means “I am not” / “I don’t.”"),
        _match([("չեմ", "I am not"), ("չես", "you are not"),
                ("չէ", "he/she is not"), ("չենք", "we are not")]),
    ]),
    ("Sentences II: Questions & Negation", 18, "sent-questions", "Asking Questions", [
        _tmcq("what", ["ի՞նչ", "ո՞վ", "ինչու՞", "որտեղ"], 0),
        _smw("", "է սա?", ["Ի՞նչ", "Ո՞վ", "Ինչու՞"], 0),
        _sorder("Arrange: “Who is he/she?”",
                ["է", "Ո՞վ", "նա"], ["Ո՞վ", "է", "նա"]),
        _wbank("Build: “Where is the station?”",
               ["Որտեղ", "է", "կայարանը", "ինչու"], ["Որտեղ", "է", "կայարանը"]),
        _tf("«Ինչու՞» means “why.”"),
        _match([("ի՞նչ", "what"), ("ո՞վ", "who"),
                ("ինչու՞", "why"), ("որտեղ", "where")]),
    ]),
    ("Sentences III: Connecting Ideas", 19, "sent-connectors", "And, But, Because", [
        _tmcq("but", ["բայց", "և", "որովհետև", "որտեղ"], 0),
        _smw("Հացը համեղ է,", "թանկ է", ["բայց", "և", "որովհետև"], 0),
        _sorder("Arrange: “I am a student and I am learning Armenian.”",
                ["ուսանող", "և", "Ես", "եմ", "հայերեն", "եմ", "սովորում"],
                ["Ես", "ուսանող", "եմ", "և", "հայերեն", "եմ", "սովորում"]),
        _wbank("Build: “I am a student because I am learning Armenian.”",
               ["Ես", "ուսանող", "եմ", "որովհետև", "հայերեն", "եմ", "սովորում", "բայց"],
               ["Ես", "ուսանող", "եմ", "որովհետև", "հայերեն", "եմ", "սովորում"]),
        _tf("«Որովհետև» means “because.”"),
        _match([("և", "and"), ("բայց", "but"),
                ("որովհետև", "because"), ("թանկ", "expensive")]),
    ]),
    ("Sentences III: Connecting Ideas", 19, "sent-review", "Put It Together", [
        _wtranslate("I am a student and I am learning Armenian",
                    ["Ես ուսանող եմ և հայերեն եմ սովորում"]),
        _wtranslate("He is not a student", ["Նա ուսանող չէ"]),
        _wtranslate("What is this?", ["Ի՞նչ է սա", "Ի՞նչ է սա?"]),
        _wtranslate("We are working", ["Մենք աշխատում ենք"]),
        _tf("«Աշխատում ենք» means “we are working.”"),
        _match([("եմ", "am"), ("ենք", "are (we)"),
                ("չեմ", "am not"), ("որովհետև", "because")]),
    ]),
]


def seed_sentences_phase():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'sent-tobe-full'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "sent-tobe-full already exists"}

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
