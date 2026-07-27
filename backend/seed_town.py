# backend/seed_town.py
"""
A2 · Around Town — three more practical A2 chapters of real-world Armenian:
getting around (transport + the instrumental "by bus"), the weather, and
describing people. Established exercise kinds only, so it renders on the
deployed engine and can be authored live via the CMS bulk-import API.

Module import has no DB side effects (`from database import engine` is inside
the function), so a runner can reuse _LESSONS to author it live. Standard
Eastern Armenian, hand-checked. Tagged cefr="A2", chapter at position 63.
Idempotent (skips if 'a2-town-transport' exists). Triggered via
POST /cms/seed/town.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10,
       "select_missing_word": 10, "word_bank": 15, "sentence_order": 15,
       "dialogue_mcq": 10}
_CEFR = "A2"
_CHAPTER = "A2 · Around Town"
_POSITION = 63


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
    (_CHAPTER, _POSITION, "a2-town-transport", "Getting Around", [
        _match([("ավտոբուս", "bus"), ("մեքենա", "car"), ("գնացք", "train"), ("ինքնաթիռ", "airplane")]),
        _tmcq("bus", ["ավտոբուս", "մեքենա", "գնացք", "հեծանիվ"], 0),
        _tmcq("train", ["գնացք", "ինքնաթիռ", "ավտոբուս", "նավ"], 0),
        _tf("«ինքնաթիռ» means “airplane.”"),
        _smw("Ես", "եմ գնում", ["ավտոբուսով", "ավտոբուս", "ավտոբուսը"], 0),  # I go by bus (instrumental)
        _wb("How do I get to the station?", ["Ինչպե՞ս", "հասնեմ", "կայարան", "մեքենա"], ["Ինչպե՞ս", "հասնեմ", "կայարան"]),
        _dmcq("Ինչպե՞ս հասնեմ կենտրոն։", ["Ավտոբուսով", "Շնորհակալություն", "Բարև", "Այո"], 0),
    ]),
    (_CHAPTER, _POSITION, "a2-town-weather", "The Weather", [
        _match([("արև", "sun"), ("անձրև", "rain"), ("ձյուն", "snow"), ("քամի", "wind")]),
        _tmcq("rain", ["անձրև", "ձյուն", "արև", "քամի"], 0),
        _tf("«տաք» means “cold.”", correct=False),
        _smw("Այսօր", "է", ["ցուրտ", "գիրք", "բժիշկ"], 0),  # today it's cold
        _wb("It is raining.", ["Անձրև", "է", "գալիս", "ձյուն"], ["Անձրև", "է", "գալիս"]),
        _tmcq("snow", ["ձյուն", "անձրև", "քամի", "արև"], 0),
        _dmcq("Ինչպիսի՞ն է եղանակը։", ["Արևոտ է", "Շնորհակալ եմ", "Ցտեսություն", "Ո՛չ"], 0),
    ]),
    (_CHAPTER, _POSITION, "a2-town-describe", "Describing People", [
        _match([("երիտասարդ", "young"), ("ծեր", "old"), ("բարի", "kind"), ("խելացի", "smart")]),
        _tmcq("young", ["երիտասարդ", "ծեր", "բարձր", "բարի"], 0),
        _tf("«բարի» means “kind.”"),
        _smw("Նա շատ", "է", ["բարի", "ջուր", "գնացք"], 0),  # he/she is very kind
        _wb("She is young.", ["Նա", "երիտասարդ", "է", "ծեր"], ["Նա", "երիտասարդ", "է"]),
        _tmcq("old", ["ծեր", "երիտասարդ", "նոր", "բարձր"], 0),
        _sorder("Arrange: “He is smart.”", ["Նա", "խելացի", "է"], ["Նա", "խելացի", "է"]),
    ]),
]


def seed_town():
    from database import engine
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-town-transport'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-town-transport already exists"}

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
