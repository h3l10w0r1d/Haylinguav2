# backend/seed_a2_2.py
"""
A2 roadmap, round 2 — the pieces round 1 deliberately left for a careful pass,
plus the future and the first real "out in the world" communication:

- The future tense (ապառնի): «կ-» + subjunctive — «կգնամ» (I will go),
  «կգամ» (I will come). Taught right after the past so a learner can finally
  talk about both directions in time, and tied to real plans with time words
  (վաղը tomorrow, հաջորդ շաբաթ next week).
- The definite direct object — the core A2 case rule. A specific *person*
  object is marked with «-ին» (Արամ → «Արամին»); a *thing* object takes the
  definite article «-ը / -ն» (գիրք → «գիրքը»). Taught with proper names and
  simple nouns so no irregular declension stems are involved.
- Conditionals & connectors: «եթե … կ-» (if … then), and «որովհետև» (because),
  «բայց» (but), «երբ» (when) to start joining sentences into speech.
- Getting around: ordering at a café (մենյուն, հաշիվը, «խնդրում եմ») and asking
  the way (ձախ/աջ/ուղիղ, «որտե՞ղ է …»).

Everything reuses verbs/nouns already taught where possible and is tagged
cefr="A2". Standard Eastern Armenian, hand-checked. Four new chapters
(positions 54-57). Idempotent: skips if 'a2-future-1' exists. Triggered via
POST /cms/seed/a2-2.
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
    # ---------- A2 · The Future ----------
    ("A2 · The Future", 54, "a2-future-1", "Will Do (the Future)", [
        _conjugation("գնալ — future (will go)", [
            ("Ես (I)", "կգնամ"), ("Դու (you)", "կգնաս"), ("Նա (he/she)", "կգնա"),
            ("Մենք (we)", "կգնանք"), ("Դուք (you all)", "կգնաք"), ("Նրանք (they)", "կգնան"),
        ]),
        _conjugation("գալ — future (will come)", [
            ("Ես (I)", "կգամ"), ("Դու (you)", "կգաս"), ("Նա (he/she)", "կգա"),
            ("Մենք (we)", "կգանք"), ("Դուք (you all)", "կգաք"), ("Նրանք (they)", "կգան"),
        ]),
        _tf("The future adds «կ-» to the verb: գնամ → «կգնամ» (I will go)."),
        _match([("կգնամ", "I will go"), ("կգամ", "I will come"),
                ("կուտեմ", "I will eat"), ("կխմեմ", "I will drink")]),
        _tmcq("I will come", ["կգամ", "եկա", "գալիս եմ", "կգնամ"], 0),
        _tf("«կգնամ» means “I went.”", correct=False),
        _listen("կգամ", ["կգամ"]),
    ]),
    ("A2 · The Future", 54, "a2-future-2", "Making Plans", [
        _match([("վաղը", "tomorrow"), ("հաջորդ շաբաթ", "next week"),
                ("հետո", "later / after"), ("այսօր", "today")]),
        _smw("Վաղը ես", "դպրոց", ["կգնամ", "գնացի", "գնում եմ"], 0),
        _smw("Հաջորդ շաբաթ մենք", "", ["կգանք", "եկանք", "գալիս ենք"], 0),
        _tmcq("tomorrow", ["վաղը", "երեկ", "այսօր", "հիմա"], 0),
        _sorder("Arrange: “Tomorrow I will go home.”",
                ["Վաղը", "տուն", "ես", "կգնամ"], ["Վաղը", "ես", "տուն", "կգնամ"]),
        _tf("«վաղը» means “tomorrow.”"),
        _tf("«երեկ» means “tomorrow.”", correct=False),
    ]),

    # ---------- A2 · Who and What ----------
    ("A2 · Who and What", 55, "a2-object-person", "The Person You Mean", [
        _tf("When the object is a specific person, Armenian marks it with «-ին»: "
            "Արամ → «Արամին»."),
        _match([("Արամին", "Aram (as object)"), ("Անիին", "Ani (as object)"),
                ("Դավիթին", "Davit (as object)"), ("ընկերոջը", "the friend (as object)")]),
        _smw("Ես տեսնում եմ", "", ["Արամին", "Արամ", "Արամով"], 0),
        _tmcq("I see Aram", ["Ես տեսնում եմ Արամին", "Ես տեսնում եմ Արամ",
                             "Ես Արամ եմ", "Արամը տեսնում է"], 0),
        _sorder("Arrange: “I love Ani.”",
                ["Ես", "Անիին", "սիրում", "եմ"], ["Ես", "Անիին", "սիրում", "եմ"]),
        _tf("For a specific person as the object, you would say «Արամ», not «Արամին».",
            correct=False),
    ]),
    ("A2 · Who and What", 55, "a2-object-thing", "The Thing You Mean", [
        _tf("A *thing* as a definite object takes the article «-ը»: գիրք → «գիրքը» "
            "(the book)."),
        _match([("գիրքը", "the book"), ("ջուրը", "the water"),
                ("խնձորը", "the apple"), ("հացը", "the bread")]),
        _smw("Ես կարդում եմ", "", ["գիրքը", "գիրքին", "գրքով"], 0),
        _tmcq("I am eating the apple", ["Ես ուտում եմ խնձորը", "Ես ուտում եմ խնձորին",
                                        "Ես խնձոր եմ", "Խնձորը ուտում է"], 0),
        _tf("A person object takes «-ին», but a thing object takes «-ը» (the article)."),
        _tf("«ջուրը» means “the water.”"),
        _sorder("Arrange: “I am reading the book.”",
                ["Ես", "գիրքը", "կարդում", "եմ"], ["Ես", "գիրքը", "կարդում", "եմ"]),
    ]),

    # ---------- A2 · If and Because ----------
    ("A2 · If and Because", 56, "a2-conditional", "If … Then", [
        _tf("A condition uses «եթե» (if) with the result in the future «կ-»: "
            "«Եթե ժամանակ ունենամ, կգամ» (If I have time, I’ll come)."),
        _match([("եթե", "if"), ("ունենամ", "I have (subjunctive)"),
                ("կգամ", "I will come"), ("կմնամ", "I will stay")]),
        _smw("Եթե անձրև գա, ես տանը", "", ["կմնամ", "մնացի", "մնում եմ"], 0),
        _tmcq("if", ["եթե", "երբ", "որովհետև", "բայց"], 0),
        _sorder("Arrange: “If I have time, I’ll come.”",
                ["Եթե", "ունենամ", "ժամանակ", "կգամ"],
                ["Եթե", "ժամանակ", "ունենամ", "կգամ"]),
        _tf("«եթե» means “because.”", correct=False),
    ]),
    ("A2 · If and Because", 56, "a2-connectors", "Because, But, When", [
        _match([("որովհետև", "because"), ("բայց", "but"),
                ("երբ", "when"), ("կամ", "or")]),
        _smw("Ես տանն եմ,", "անձրև է", ["որովհետև", "բայց", "կամ"], 0),
        _smw("Ուզում եմ գալ,", "չեմ կարող", ["բայց", "որովհետև", "երբ"], 0),
        _tmcq("because", ["որովհետև", "բայց", "երբ", "եթե"], 0),
        _tmcq("but", ["բայց", "կամ", "և", "որ"], 0),
        _tf("«երբ» means “when.”"),
        _sorder("Arrange: “I want to come, but I can’t.”",
                ["Ուզում", "գալ,", "եմ", "չեմ", "բայց", "կարող"],
                ["Ուզում", "եմ", "գալ,", "բայց", "չեմ", "կարող"]),
    ]),

    # ---------- A2 · Out & About ----------
    ("A2 · Out & About", 57, "a2-cafe", "At the Café", [
        _match([("մենյուն", "the menu"), ("հաշիվը", "the bill"),
                ("սուրճ", "coffee"), ("թեյ", "tea")]),
        _tmcq("coffee", ["սուրճ", "թեյ", "ջուր", "հաց"], 0),
        _smw("Մեկ սուրճ,", "", ["խնդրում եմ", "շնորհակալ եմ", "ցտեսություն"], 0),
        _tmcq("The bill, please", ["Հաշիվը, խնդրում եմ", "Մենյուն, խնդրում եմ",
                                   "Շնորհակալ եմ", "Բարև ձեզ"], 0),
        _tf("«խնդրում եմ» means “please.”"),
        _sorder("Arrange: “I would like tea.”",
                ["Ես", "թեյ", "կուզեմ"], ["Ես", "թեյ", "կուզեմ"]),
        _listen("հաշիվը", ["հաշիվը"]),
    ]),
    ("A2 · Out & About", 57, "a2-directions", "Finding Your Way", [
        _match([("ձախ", "left"), ("աջ", "right"),
                ("ուղիղ", "straight"), ("այնտեղ", "there")]),
        _tmcq("left", ["ձախ", "աջ", "ուղիղ", "մոտ"], 0),
        _tmcq("right", ["աջ", "ձախ", "հեռու", "այստեղ"], 0),
        _smw("Որտե՞ղ է", "", ["կայարանը", "կայարան", "կայարանով"], 0),
        _smw("Գնա", ", հետո թեքվիր ձախ", ["ուղիղ", "աջ", "մոտ"], 0),
        _tf("«ուղիղ» means “straight.”"),
        _tf("«աջ» means “left.”", correct=False),
    ]),
]


def seed_a2_2():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-future-1'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-future-1 already exists"}

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
