# backend/seed_grammar.py
"""
Phase 5 — Advanced grammar: the pieces deliberately deferred from Phase 4
because they carried translation risk. This round covers only forms that are
fully regular or so common they are beyond doubt in Eastern Armenian:

- Imperative mood: the everyday command set (Արի՛/Եկե՛ք, Գնա՛/Գնացե՛ք,
  Լսի՛ր/Լսե՛ք, Խոսի՛ր/Խոսե՛ք, Գրի՛ր/Գրե՛ք, Կարդա՛/Կարդացե՛ք,
  Նստի՛ր/Նստե՛ք) — all textbook-standard singular/plural pairs.
- Genitive-dative (possession): proper names take -ի (Անիի, Արմենի), plus
  the three high-frequency irregulars every course teaches first
  (մայր→մոր, հայր→հոր, ընկեր→ընկերոջ).
- Instrumental (-ով): transport/means set (ավտոբուսով, գնացքով,
  մեքենայով, ոտքով) — fully regular.
- Past + future for two more fully regular verbs, one per conjugation
  class: աշխատել (-ել → -եցի / կ- -եմ) and խաղալ (-ալ → -ացի / կ- -ամ),
  both with their present forms already live in Phase 3.

Typed answers involving the emphasis mark (՛) accept unmarked variants too,
since learners can't type it on a normal keyboard.

Three new chapters (positions 22-24). Idempotent: skips if
'gr-imperative-1' exists. Triggered via POST /cms/seed/grammar.
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


def _wbank(prompt, sentence, tiles, solution):
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
    ("Grammar I: Commands", 22, "gr-imperative-1", "Commands", [
        _match([("Արի՛", "Come!"), ("Գնա՛", "Go!"), ("Լսի՛ր", "Listen!"), ("Նստի՛ր", "Sit!")]),
        _tmcq("Come!", ["Արի՛", "Գնա՛", "Խոսի՛ր", "Գրի՛ր"], 0),
        _tmcq("Speak!", ["Խոսի՛ր", "Լսի՛ր", "Կարդա՛", "Արի՛"], 0),
        _smw("Խնդրում եմ,", "այստեղ", ["արի՛", "գալ", "գալիս"], 0),
        _sorder("Arrange: “Please, speak Armenian.”",
                ["խոսե՛ք", "Խնդրում", "հայերեն", "եմ"],
                ["Խնդրում", "եմ", "խոսե՛ք", "հայերեն"]),
        _tf("«Գնա՛» means “Go!”"),
        _tf("«Կարդա՛» means “Sit!”", correct=False),
    ]),
    ("Grammar I: Commands", 22, "gr-imperative-2", "Polite Commands", [
        _match([("Եկե՛ք", "Come! (polite)"), ("Գնացե՛ք", "Go! (polite)"),
                ("Լսե՛ք", "Listen! (polite)"), ("Կարդացե՛ք", "Read! (polite)")]),
        _tmcq("Listen! (to a group)", ["Լսե՛ք", "Լսի՛ր", "Խոսե՛ք", "Նստե՛ք"], 0),
        _tmcq("Write! (to a group)", ["Գրե՛ք", "Գրի՛ր", "Կարդացե՛ք", "Գնացե՛ք"], 0),
        _smw("", ", խնդրում եմ", ["Նստե՛ք", "Նստել", "Նստում"], 0),
        _tf("«Եկե՛ք» is the polite/plural form of «Արի՛»."),
        _wtranslate("Come!", ["Արի՛", "Արի", "Եկե՛ք", "Եկեք"]),
        _wtranslate("Listen!", ["Լսի՛ր", "Լսիր", "Լսե՛ք", "Լսեք"]),
    ]),
    ("Grammar II: Cases", 23, "gr-cases-gen", "Whose? — Possession", [
        _tmcq("Ani's book", ["Անիի գիրքը", "Անին գիրքը", "Գիրքը Անի", "Անի գիրք"], 0),
        _match([("մոր", "mother's"), ("հոր", "father's"), ("Արմենի", "Armen's"), ("ընկերոջ", "friend's")]),
        _smw("Իմ", "անունը Անի է", ["մոր", "մայր", "մայրը"], 0),
        _sorder("Arrange: “My father's name is Armen.”",
                ["հոր", "Իմ", "անունը", "Արմեն", "է"],
                ["Իմ", "հոր", "անունը", "Արմեն", "է"]),
        _wbank("Build: “Armen's house”", "Armen's house",
               ["Արմենի", "տունը", "տուն", "Արմեն"], ["Արմենի", "տունը"]),
        _tf("«Մոր» means “mother's.”"),
        _tf("To say a person's name owns something, add «-ի»: Անի → Անիի."),
    ]),
    ("Grammar II: Cases", 23, "gr-cases-inst", "How? — By Bus, On Foot", [
        _match([("ավտոբուսով", "by bus"), ("գնացքով", "by train"),
                ("մեքենայով", "by car"), ("ոտքով", "on foot")]),
        _tmcq("by bus", ["ավտոբուսով", "ավտոբուս", "ավտոբուսի", "գնացքով"], 0),
        _tmcq("by car", ["մեքենայով", "մեքենա", "գնացքով", "ոտքով"], 0),
        _smw("Ես գնում եմ տուն", "", ["ավտոբուսով", "ավտոբուս", "ավտոբուսի"], 0),
        _sorder("Arrange: “We are going to Yerevan by train.”",
                ["գնում", "Մենք", "ենք", "Երևան", "գնացքով"],
                ["Մենք", "գնում", "ենք", "Երևան", "գնացքով"]),
        _tf("«Ոտքով» means “on foot.”"),
        _tf("«-ով» is the ending for “by / with”: ավտոբուս → ավտոբուսով."),
    ]),
    ("Grammar III: Past & Future II", 24, "gr-pastfut-1", "More Past", [
        _conjugation("աշխատել — past (worked)", [
            ("Ես (I)", "աշխատեցի"), ("Դու (you)", "աշխատեցիր"), ("Նա (he/she)", "աշխատեց"),
            ("Մենք (we)", "աշխատեցինք"), ("Դուք (you all)", "աշխատեցիք"), ("Նրանք (they)", "աշխատեցին"),
        ]),
        _conjugation("խաղալ — past (played)", [
            ("Ես (I)", "խաղացի"), ("Դու (you)", "խաղացիր"), ("Նա (he/she)", "խաղաց"),
            ("Մենք (we)", "խաղացինք"), ("Դուք (you all)", "խաղացիք"), ("Նրանք (they)", "խաղացին"),
        ]),
        _tmcq("I worked", ["աշխատեցի", "կաշխատեմ", "աշխատում եմ", "աշխատեց"], 0),
        _smw("Երեկ ես", "", ["աշխատեցի", "կաշխատեմ", "աշխատում եմ"], 0),
        _tf("«Խաղացինք» means “we played.”"),
        _sorder("Arrange: “Yesterday we played.”",
                ["խաղացինք", "Երեկ", "մենք"], ["Երեկ", "մենք", "խաղացինք"]),
    ]),
    ("Grammar III: Past & Future II", 24, "gr-pastfut-2", "More Future", [
        _conjugation("աշխատել — future (will work)", [
            ("Ես (I)", "կաշխատեմ"), ("Դու (you)", "կաշխատես"), ("Նա (he/she)", "կաշխատի"),
            ("Մենք (we)", "կաշխատենք"), ("Դուք (you all)", "կաշխատեք"), ("Նրանք (they)", "կաշխատեն"),
        ]),
        _conjugation("խաղալ — future (will play)", [
            ("Ես (I)", "կխաղամ"), ("Դու (you)", "կխաղաս"), ("Նա (he/she)", "կխաղա"),
            ("Մենք (we)", "կխաղանք"), ("Դուք (you all)", "կխաղաք"), ("Նրանք (they)", "կխաղան"),
        ]),
        _tmcq("I will play", ["կխաղամ", "խաղացի", "խաղում եմ", "կխաղա"], 0),
        _smw("Վաղը ես", "", ["կաշխատեմ", "աշխատեցի", "աշխատում եմ"], 0),
        _tf("«Կխաղան» means “they will play.”"),
        _sorder("Arrange: “Tomorrow we will play.”",
                ["կխաղանք", "Վաղը", "մենք"], ["Վաղը", "մենք", "կխաղանք"]),
    ]),
]


def seed_grammar_phase():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'gr-imperative-1'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "gr-imperative-1 already exists"}

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
