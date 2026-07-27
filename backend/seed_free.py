# backend/seed_free.py
"""
A2 · Free Time — three practical A2 chapters: hobbies (sports, music, "I like
to …"), feelings (happy/sad/tired/hungry), and invitations ("let's go", "do
you want to …"). Established exercise kinds only, so it renders on the deployed
engine and can be authored live via the CMS bulk-import API. Module import has
no DB side effects (`from database import engine` is inside the function).
Standard Eastern Armenian, hand-checked. Tagged cefr="A2", chapter at position
65. Idempotent (skips if 'a2-free-hobbies' exists). Triggered via
POST /cms/seed/free.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10,
       "select_missing_word": 10, "word_bank": 15, "sentence_order": 15,
       "dialogue_mcq": 10}
_CEFR = "A2"
_CHAPTER = "A2 · Free Time"
_POSITION = 65


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
    (_CHAPTER, _POSITION, "a2-free-hobbies", "Hobbies", [
        _match([("սպորտ", "sport"), ("երաժշտություն", "music"), ("պարել", "to dance"), ("երգել", "to sing")]),
        _tmcq("music", ["երաժշտություն", "սպորտ", "գիրք", "ֆիլմ"], 0),
        _tf("«երգել» means “to sing.”"),
        _smw("Ես սիրում եմ", "", ["պարել", "հիվանդ", "սեղան"], 0),  # I like to dance
        _wb("I like to read books.", ["Ես", "սիրում", "եմ", "կարդալ", "գրքեր"], ["Ես", "սիրում", "եմ", "կարդալ", "գրքեր"]),
        _tmcq("to dance", ["պարել", "երգել", "կարդալ", "խաղալ"], 0),
        _sorder("Arrange: “I play football.”",
                ["Ես", "ֆուտբոլ", "խաղում", "եմ"], ["Ես", "ֆուտբոլ", "խաղում", "եմ"]),
    ]),
    (_CHAPTER, _POSITION, "a2-free-feelings", "Feelings", [
        _match([("ուրախ", "happy"), ("տխուր", "sad"), ("հոգնած", "tired"), ("քաղցած", "hungry")]),
        _tmcq("happy", ["ուրախ", "տխուր", "հոգնած", "ծարավ"], 0),
        _tf("«տխուր» means “happy.”", correct=False),
        _smw("Ես շատ", "եմ", ["հոգնած", "սեղան", "գնացք"], 0),  # I am very tired
        _wb("I am hungry.", ["Ես", "քաղցած", "եմ", "ծարավ"], ["Ես", "քաղցած", "եմ"]),
        _tmcq("sad", ["տխուր", "ուրախ", "ծարավ", "բարի"], 0),
        _dmcq("Ինչպե՞ս ես։", ["Լավ եմ, շնորհակալ եմ", "Ցտեսություն", "Խնդրեմ", "Ոչ"], 0),
    ]),
    (_CHAPTER, _POSITION, "a2-free-invite", "Invitations", [
        _match([("գնանք", "let's go"), ("միասին", "together"), ("կինո", "cinema"), ("զբոսնել", "to stroll")]),
        _tmcq("cinema", ["կինո", "ռեստորան", "խանութ", "դպրոց"], 0),
        _smw("", "գնանք կինո", ["Արի", "Գիրք", "Ջուր"], 0),  # come, let's go to the cinema
        _tf("«միասին» means “together.”"),
        _wb("Do you want to go?", ["Ուզու՞մ", "ես", "գնալ", "միասին"], ["Ուզու՞մ", "ես", "գնալ"]),
        _dmcq("Ուզու՞մ ես կինո գնալ։", ["Այո, գնանք", "Շնորհակալություն", "Ցտեսություն", "Բժիշկ"], 0),
        _sorder("Arrange: “Let's go together.”",
                ["Արի", "միասին", "գնանք"], ["Արի", "միասին", "գնանք"]),
    ]),
]


def seed_free():
    from database import engine
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-free-hobbies'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-free-hobbies already exists"}

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
