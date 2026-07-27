# backend/seed_life.py
"""
A2 · Daily Life — three more practical A2 chapters: the daily routine (times of
day + everyday verbs), at home (rooms + the locative/postposition "in the
kitchen"), and at the restaurant (ordering, builds on the café vocab).

Established exercise kinds only, so it renders on the deployed engine and can be
authored live via the CMS bulk-import API. Module import has no DB side effects
(`from database import engine` is inside the function). Standard Eastern
Armenian, hand-checked. Tagged cefr="A2", chapter at position 64. Idempotent
(skips if 'a2-life-routine' exists). Triggered via POST /cms/seed/life.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10,
       "select_missing_word": 10, "word_bank": 15, "sentence_order": 15,
       "dialogue_mcq": 10}
_CEFR = "A2"
_CHAPTER = "A2 · Daily Life"
_POSITION = 64


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
    (_CHAPTER, _POSITION, "a2-life-routine", "Daily Routine", [
        _match([("առավոտ", "morning"), ("երեկո", "evening"), ("կեսօր", "noon"), ("գիշեր", "night")]),
        _tmcq("morning", ["առավոտ", "երեկո", "գիշեր", "կեսօր"], 0),
        _tf("«երեկո» means “evening.”"),
        _smw("Գիշերը ես", "", ["քնում եմ", "աշխատում եմ", "խմում եմ"], 0),  # at night I sleep
        _wb("In the morning I drink coffee.", ["Առավոտյան", "ես", "սուրճ", "եմ", "խմում"], ["Առավոտյան", "ես", "սուրճ", "եմ", "խմում"]),
        _tmcq("night", ["գիշեր", "առավոտ", "կեսօր", "երեկո"], 0),
        _sorder("Arrange: “I work every day.”",
                ["Ես", "ամեն", "օր", "աշխատում", "եմ"], ["Ես", "ամեն", "օր", "աշխատում", "եմ"]),
    ]),
    (_CHAPTER, _POSITION, "a2-life-home", "At Home", [
        _match([("սենյակ", "room"), ("խոհանոց", "kitchen"), ("սեղան", "table"), ("աթոռ", "chair")]),
        _tmcq("kitchen", ["խոհանոց", "սենյակ", "տուն", "դուռ"], 0),
        _tf("«աթոռ» means “table.”", correct=False),
        _smw("Ես", "մեջ եմ", ["խոհանոցի", "խոհանոց", "խոհանոցը"], 0),  # I am in the kitchen
        _wb("The table is in the room.", ["Սեղանը", "սենյակում", "է", "աթոռ"], ["Սեղանը", "սենյակում", "է"]),
        _tmcq("chair", ["աթոռ", "սեղան", "դուռ", "պատուհան"], 0),
        _sorder("Arrange: “This is my house.”",
                ["Սա", "իմ", "տունն", "է"], ["Սա", "իմ", "տունն", "է"]),
    ]),
    (_CHAPTER, _POSITION, "a2-life-restaurant", "At the Restaurant", [
        _match([("ռեստորան", "restaurant"), ("մատուցող", "waiter"), ("հաշիվ", "bill"), ("համեղ", "delicious")]),
        _tmcq("restaurant", ["ռեստորան", "խանութ", "դպրոց", "տուն"], 0),
        _tf("«համեղ» means “delicious.”"),
        _smw("Ես ուզում եմ", "", ["պատվիրել", "քնել", "աշխատել"], 0),  # I want to order
        _wb("The bill, please.", ["Հաշիվը", "խնդրում", "եմ", "մենյուն"], ["Հաշիվը", "խնդրում", "եմ"]),
        _dmcq("Ի՞նչ կուզենաք պատվիրել։", ["Մեկ սուրճ, խնդրում եմ", "Ցտեսություն", "Բարև", "Ոչ"], 0),
        _tmcq("bill", ["հաշիվ", "մենյու", "սուրճ", "թեյ"], 0),
    ]),
]


def seed_life():
    from database import engine
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-life-routine'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-life-routine already exists"}

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
