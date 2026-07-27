# backend/seed_situations.py
"""
A2 · Everyday Situations — practical, real-world Armenian for three high-
frequency scenarios: at the doctor, at the shop, and making plans. Built from
already-taught grammar plus the scenario vocabulary, using only established
exercise kinds (match, translate, true/false, cloze, word-bank, sentence-order,
dialogue) so it renders on the deployed engine.

The content data (_LESSONS) is module-level and importing this file has no side
effects — `from database import engine` lives inside seed_situations() — so a
CMS-API runner can reuse the exact same data to author the chapter live while a
deploy is blocked. Standard Eastern Armenian, hand-checked. Tagged cefr="A2",
"A2 · Everyday Situations" chapter at position 62. Idempotent (skips if
'a2-situ-doctor' exists). Triggered via POST /cms/seed/situations.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10,
       "select_missing_word": 10, "word_bank": 15, "sentence_order": 15,
       "dialogue_mcq": 10}
_CEFR = "A2"
_CHAPTER = "A2 · Everyday Situations"
_POSITION = 62


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _tmcq(word, choices, answer_index):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{word}”?",
            "config": {"choices": choices, "sentence": word, "answerIndex": answer_index}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?",
            "config": {"correct": correct, "statement": statement}}


def _smw(before, after, choices, answer_index=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.",
            "config": {"before": before, "after": after, "choices": choices, "answerIndex": answer_index}}


def _wb(sentence, tiles, solution):
    return {"kind": "word_bank", "prompt": "Build the sentence.",
            "config": {"sentence": sentence, "tiles": tiles, "solution": solution}}


def _sorder(prompt, tokens, solution):
    return {"kind": "sentence_order", "prompt": prompt, "config": {"tokens": tokens, "solution": solution}}


def _dmcq(their_line, choices, answer_index):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?",
            "config": {"lines": [{"from": "them", "text": their_line}],
                       "choices": choices, "answerIndex": answer_index}}


_LESSONS = [
    (_CHAPTER, _POSITION, "a2-situ-doctor", "At the Doctor", [
        _match([("բժիշկ", "doctor"), ("հիվանդ", "sick"), ("դեղ", "medicine"), ("ցավ", "pain")]),
        _tmcq("doctor", ["բժիշկ", "ուսուցիչ", "ընկեր", "հարևան"], 0),
        _tf("«հիվանդ» means “healthy.”", correct=False),
        _smw("Ես", "եմ", ["հիվանդ", "գիրք", "ջուր"], 0),
        _wb("My head hurts.", ["Գլուխս", "ցավում", "է", "փորս"], ["Գլուխս", "ցավում", "է"]),
        _tmcq("medicine", ["դեղ", "հաց", "թեյ", "փող"], 0),
        _sorder("Arrange: “I need a doctor.”",
                ["Ինձ", "պետք", "է", "բժիշկ"], ["Ինձ", "պետք", "է", "բժիշկ"]),
    ]),
    (_CHAPTER, _POSITION, "a2-situ-shop", "At the Shop", [
        _match([("խանութ", "shop"), ("թանկ", "expensive"), ("էժան", "cheap"), ("փող", "money")]),
        _tmcq("how much?", ["Որքա՞ն", "Ե՞րբ", "Ինչու՞", "Որտե՞ղ"], 0),
        _smw("Սա", "է", ["թանկ", "բժիշկ", "հիվանդ"], 0),
        _tf("«էժան» means “cheap.”"),
        _wb("How much does this cost?", ["Որքա՞ն", "արժե", "սա", "թանկ"], ["Որքա՞ն", "արժե", "սա"]),
        _tmcq("money", ["փող", "հաց", "գիրք", "դուռ"], 0),
        _dmcq("Որքա՞ն արժե սա։", ["Հազար դրամ", "Բարև ձեզ", "Ցտեսություն", "Այո"], 0),
    ]),
    (_CHAPTER, _POSITION, "a2-situ-plans", "Making Plans", [
        _match([("ե՞րբ", "when"), ("վաղը", "tomorrow"), ("ժամ", "hour / time"), ("հանդիպել", "to meet")]),
        _tmcq("when?", ["Ե՞րբ", "Որքա՞ն", "Ինչու՞", "Ո՞վ"], 0),
        _smw("", "հանդիպենք", ["Վաղը", "Գիրք", "Ջուր"], 0),
        _wb("Let's meet tomorrow.", ["Վաղը", "հանդիպենք", "այսօր"], ["Վաղը", "հանդիպենք"]),
        _tf("«վաղը» means “yesterday.”", correct=False),
        _dmcq("Ե՞րբ հանդիպենք։", ["Վաղը", "Շնորհակալություն", "Բարև", "Ոչ"], 0),
        _sorder("Arrange: “What time is it?”",
                ["Ժամը", "քանի՞սն", "է"], ["Ժամը", "քանի՞սն", "է"]),
    ]),
]


def seed_situations():
    from database import engine
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-situ-doctor'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-situ-doctor already exists"}

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
