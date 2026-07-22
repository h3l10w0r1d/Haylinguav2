# backend/seed_functional.py
"""
Functional Conversations — the register/pragmatics gap beyond the
դու/դուք lesson: three short real-world dialogue scenarios (café,
shopping, making plans by phone) built entirely from vocabulary/grammar
already live elsewhere in the curriculum:

  - fs-cafe: հաց/ջուր/թեյ/սուրճ (hl-food), «Ի՞նչ եք» + present-tense
    «եք» conjugation (established by analogy across every -ում եք/ես/եմ
    paradigm in the grammar chapters), «Շնորհակալություն»/«Խնդրեմ»
    (hl-phrases / flu-dialogue).
  - fs-shop: «թանկ»/«էժան»/«փող»/«գին»/«խանութ»/«քարտ» (hl-shopping,
    Vocabulary Phase 3), «բայց» (sent-connectors).
  - fs-phone: «Ինչպե՞ս ես» (gr-polite-1), «վաղը», «դպրոց» (gr-case-abl/
    gr-case-loc), and the full future paradigm of «գնալ» (gr-verb-gnal) —
    «կգնաս» / «կգնամ» reused directly, not reintroduced.

One new chapter (position 36). Idempotent: skips if 'fs-cafe' exists.
Triggered via POST /cms/seed/functional.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"dialogue_mcq": 15, "dialogue_order": 15, "true_false": 10, "match_pairs": 15}


def _dmcq(their_line, choices, answer_index):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?",
            "config": {"lines": [{"from": "them", "text": their_line}],
                       "choices": choices, "answerIndex": answer_index}}


def _dorder(lines):
    return {"kind": "dialogue_order", "prompt": "Put the conversation in order.",
            "config": {"lines": lines, "solution": lines}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


_LESSONS = [
    ("Functional Conversations", 36, "fs-cafe", "At the Café", [
        _dmcq("Բարև, ինչպե՞ս եք", ["Լավ եմ, շնորհակալություն", "Ես ուսանող եմ", "Ցտեսություն"], 0),
        _dmcq("Ի՞նչ եք խմում", ["Ես խմում եմ թեյ", "Ես ուսանող եմ", "Բարև"], 0),
        _dorder(["Շնորհակալություն", "Խնդրեմ"]),
        _tf("«Ի՞նչ եք խմում» means “What are you drinking?”"),
        _match([("թեյ", "tea"), ("սուրճ", "coffee"), ("ջուր", "water"), ("հաց", "bread")]),
    ]),
    ("Functional Conversations", 36, "fs-shop", "At the Shop", [
        _dmcq("Սա թանկ է", ["Այո, բայց լավ է", "Ես ուսանող եմ", "Բարև"], 0),
        _dmcq("Սա էժան է", ["Լավ", "Ես ուսանող եմ", "Ցտեսություն"], 0),
        _dorder(["Շնորհակալություն", "Խնդրեմ"]),
        _tf("«Էժան» means “expensive.”", correct=False),
        _match([("փող", "money"), ("գին", "price"), ("խանութ", "shop"), ("քարտ", "card")]),
    ]),
    ("Functional Conversations", 36, "fs-phone", "Making Plans", [
        _dmcq("Բարև, ինչպե՞ս ես", ["Լավ եմ, շնորհակալություն", "Ես ուսանող եմ", "Ցտեսություն"], 0),
        _dmcq("Վաղը կգնա՞ս դպրոց", ["Այո, վաղը կգնամ դպրոց", "Ոչ", "Բարև"], 0),
        _dorder(["Բարև", "Ցտեսություն"]),
        _tf("«Կգնաս» means “you will go.”"),
        _match([("դու", "you (informal)"), ("վաղը", "tomorrow"), ("դպրոց", "school"), ("կգնամ", "I will go")]),
    ]),
]


def seed_functional():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'fs-cafe'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "fs-cafe already exists"}

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
