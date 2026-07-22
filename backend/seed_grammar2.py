# backend/seed_grammar2.py
"""
Phase 6 — the grammar gaps flagged as most load-bearing for real Armenian
(Eastern Armenian, matching every prior phase in this curriculum):

- The definite article: a suffix, not a separate word (-ը after a
  consonant, -ն after a vowel) — used in nearly every sentence, but never
  taught as its own concept before now (only encountered incidentally,
  e.g. "Անիի գիրքը").
- Possessive suffixes (-ս "my", -դ "your (informal)", -ը/-ն "his/her/its" —
  the same surface form as the definite article) as an alternative to
  "իմ/քո/նրա + noun".
- Ablative (-ից "from") and locative (-ում "in/at") — the two cases not
  covered by Phase 5's genitive-dative and instrumental.
- Full present/past/future paradigms for two common, partly-irregular
  verbs (գնալ "to go", ուտել "to eat" — the latter's past tense uses the
  suppletive stem կեր-, a well-known irregular every course teaches).
- Formal vs. informal “you” (դու/դուք, քեզ/ձեզ) as its own concept,
  previously only touched once inside a greetings drill.

New vocabulary introduced here (երեխա "child", դպրոց "school", Երևան
"Yerevan") is taught within the same lesson (match_pairs) before being
used in any other exercise — never assumed.

Four new chapters (positions 25-28). Idempotent: skips if 'gr-article-1'
exists. Triggered via POST /cms/seed/grammar2.
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


def _wbank(prompt, sentence, tiles, solution):
    return {"kind": "word_bank", "prompt": prompt,
            "config": {"sentence": sentence, "tiles": tiles, "solution": solution}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _conjugation(verb, cells):
    return {"kind": "conjugation", "prompt": f"Conjugate: {verb}",
            "config": {"verb": verb, "cells": [{"label": l, "answer": a} for l, a in cells]}}


_LESSONS = [
    # ---- Grammar IV: Articles & Possession ----
    ("Grammar IV: Articles & Possession", 25, "gr-article-1", "The Definite Article", [
        _match([("հացը", "the bread"), ("ջուրը", "the water"),
                ("տունը", "the house"), ("երեխան", "the child")]),
        _tmcq("the book", ["գիրք", "գիրքը", "գիրքի", "գիրքով"], 1),
        _smw("Ես խմում եմ", "", ["ջուրը", "ջուր", "ջուրով"], 0),
        _sorder("Arrange: “The house is big.”",
                ["մեծ", "Տունը", "է"], ["Տունը", "մեծ", "է"]),
        _wbank("Build: “The child is here.”", "The child is here",
               ["Երեխան", "այստեղ", "է", "երեխա"], ["Երեխան", "այստեղ", "է"]),
        _tf("«-ն» is added after a vowel-ending noun, «-ը» after a consonant-ending noun."),
        _tf("«Երեխա» means “city.”", correct=False),
    ]),
    ("Grammar IV: Articles & Possession", 25, "gr-possessive-1", "Possessive Suffixes", [
        _match([("անունս", "my name"), ("անունդ", "your name"),
                ("տունս", "my house"), ("տունդ", "your house")]),
        _tmcq("my name", ["անունդ", "անունս", "անունը", "անուն"], 1),
        _tmcq("your house", ["տունս", "տունդ", "տունը", "տուն"], 1),
        _smw("Ի՞նչ է", "", ["անունդ", "անունս", "անունը"], 0),
        _sorder("Arrange: “My name is Ani.”",
                ["Անի", "անունս", "է"], ["Անունս", "Անի", "է"]),
        _tf("Adding «-ս» to a noun means “my ___.”"),
        _tf("«Տունդ» means “my house.”", correct=False),
    ]),

    # ---- Grammar V: More Cases ----
    ("Grammar V: More Cases", 26, "gr-case-abl", "From — the Ablative Case", [
        _match([("Երևանից", "from Yerevan"), ("կայարանից", "from the station"),
                ("տնից", "from home"), ("դպրոցից", "from school")]),
        _tmcq("from Yerevan", ["Երևանում", "Երևանից", "Երևանով", "Երևան"], 1),
        _tmcq("from school", ["դպրոցում", "դպրոցից", "դպրոց", "դպրոցով"], 1),
        _smw("Ես", "եմ", ["կայարանից", "կայարան", "կայարանում"], 0),
        _sorder("Arrange: “We are from Yerevan.”",
                ["ենք", "Մենք", "Երևանից"], ["Մենք", "Երևանից", "ենք"]),
        _tf("«-ից» means “from.”"),
        _tf("«Դպրոց» means “bread.”", correct=False),
    ]),
    ("Grammar V: More Cases", 26, "gr-case-loc", "In / At — the Locative Case", [
        _match([("Երևանում", "in Yerevan"), ("դպրոցում", "at school"),
                ("կայարանում", "at the station"), ("տանը", "at home")]),
        _tmcq("at school", ["դպրոցից", "դպրոցում", "դպրոց", "դպրոցով"], 1),
        _tmcq("at home", ["տնից", "տանը", "տուն", "տունը"], 1),
        _smw("Ես", "եմ", ["տանը", "տուն", "տնից"], 0),
        _sorder("Arrange: “We are at school.”",
                ["ենք", "Մենք", "դպրոցում"], ["Մենք", "դպրոցում", "ենք"]),
        _tf("«-ում» means “in / at.”"),
        _tf("«Տանը» means “from home.”", correct=False),
    ]),

    # ---- Grammar VI: Verb Paradigms ----
    ("Grammar VI: Verb Paradigms", 27, "gr-verb-gnal", "To Go — Full Conjugation", [
        _conjugation("գնալ — present (go / going)", [
            ("Ես (I)", "գնում եմ"), ("Դու (you)", "գնում ես"), ("Նա (he/she)", "գնում է"),
            ("Մենք (we)", "գնում ենք"), ("Դուք (you all)", "գնում եք"), ("Նրանք (they)", "գնում են"),
        ]),
        _conjugation("գնալ — past (went)", [
            ("Ես (I)", "գնացի"), ("Դու (you)", "գնացիր"), ("Նա (he/she)", "գնաց"),
            ("Մենք (we)", "գնացինք"), ("Դուք (you all)", "գնացիք"), ("Նրանք (they)", "գնացին"),
        ]),
        _conjugation("գնալ — future (will go)", [
            ("Ես (I)", "կգնամ"), ("Դու (you)", "կգնաս"), ("Նա (he/she)", "կգնա"),
            ("Մենք (we)", "կգնանք"), ("Դուք (you all)", "կգնաք"), ("Նրանք (they)", "կգնան"),
        ]),
        _tmcq("I went", ["գնացի", "կգնամ", "գնում եմ", "գնաց"], 0),
        _smw("Երեկ նա", "դպրոց", ["գնաց", "կգնա", "գնում է"], 0),
        _tf("«Կգնանք» means “we will go.”"),
        _sorder("Arrange: “Tomorrow I will go home.”",
                ["տուն", "Վաղը", "ես", "կգնամ"], ["Վաղը", "ես", "կգնամ", "տուն"]),
    ]),
    ("Grammar VI: Verb Paradigms", 27, "gr-verb-utel", "To Eat — Full Conjugation", [
        _conjugation("ուտել — present (eat / eating)", [
            ("Ես (I)", "ուտում եմ"), ("Դու (you)", "ուտում ես"), ("Նա (he/she)", "ուտում է"),
            ("Մենք (we)", "ուտում ենք"), ("Դուք (you all)", "ուտում եք"), ("Նրանք (they)", "ուտում են"),
        ]),
        _conjugation("ուտել — past (ate)", [
            ("Ես (I)", "կերա"), ("Դու (you)", "կերար"), ("Նա (he/she)", "կերավ"),
            ("Մենք (we)", "կերանք"), ("Դուք (you all)", "կերաք"), ("Նրանք (they)", "կերան"),
        ]),
        _conjugation("ուտել — future (will eat)", [
            ("Ես (I)", "կուտեմ"), ("Դու (you)", "կուտես"), ("Նա (he/she)", "կուտի"),
            ("Մենք (we)", "կուտենք"), ("Դուք (you all)", "կուտեք"), ("Նրանք (they)", "կուտեն"),
        ]),
        _tmcq("I ate", ["կերա", "կուտեմ", "ուտում եմ", "կերավ"], 0),
        _smw("Ես", "հաց", ["ուտում եմ", "կերա", "կուտեմ"], 0),
        _tf("«Ուտել» is irregular in the past — it uses the stem “կեր-”, not “ուտ-”."),
        _tf("«Կուտենք» means “we ate.”", correct=False),
    ]),

    # ---- Grammar VII: Being Polite ----
    ("Grammar VII: Being Polite", 28, "gr-polite-1", "Formal & Informal “You”", [
        _match([("դու", "you (informal)"), ("դուք", "you (formal / plural)"),
                ("քեզ", "you (informal, object)"), ("ձեզ", "you (formal, object)")]),
        _tmcq("you (formal)", ["դու", "դուք", "քեզ", "ձեզ"], 1),
        _tmcq("you (informal)", ["դուք", "դու", "ձեզ", "քեզ"], 1),
        _smw("Բարև", "", ["ձեզ", "քեզ", "դու"], 0),
        _match([("Ինչպե՞ս ես", "How are you? (informal)"), ("Ինչպե՞ս եք", "How are you? (formal)")]),
        _tf("Use «դուք» for someone older or unfamiliar, as a sign of respect."),
        _tf("«Դու» is the formal form.", correct=False),
    ]),
]


def seed_grammar2():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'gr-article-1'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "gr-article-1 already exists"}

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
