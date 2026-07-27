# backend/seed_activate.py
"""
Mixed Practice — activates exercise formats the engine already renders but that
no lesson used, so the learner actually meets them. Five dormant kinds, one
lesson each, all on vocabulary/grammar already taught:

- multi_select      — "select all that apply"
- categorize        — sort words into groups
- highlight_grammar — tap the target word in a sentence
- fill_blank        — type the missing word (cloze)
- listen_word_bank  — "tap what you hear": rebuild a sentence from audio (TTS)

Config shapes match each renderer exactly (verified against ExerciseRenderer /
Phase2Exercise). Standard Eastern Armenian, hand-checked. Tagged cefr="A1",
"Mixed Practice" chapter at position 45 (end of A1). Idempotent: skips if
'mix-select' exists. Triggered via POST /cms/seed/activate.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"multi_select": 10, "categorize": 15, "highlight_grammar": 10,
       "fill_blank": 10, "listen_word_bank": 15}
_CEFR = "A1"


def _multi(prompt, choices, correct_indices):
    return {"kind": "multi_select", "prompt": prompt,
            "config": {"choices": choices, "correctIndices": correct_indices}}


def _cat(prompt, buckets, items):
    return {"kind": "categorize", "prompt": prompt,
            "config": {"buckets": buckets,
                       "items": [{"text": t, "bucket": b} for t, b in items]}}


def _hl(prompt, tokens, correct_indices):
    return {"kind": "highlight_grammar", "prompt": prompt,
            "config": {"tokens": tokens, "correctIndices": correct_indices}}


def _blank(prompt, before, after, answers):
    return {"kind": "fill_blank", "prompt": prompt,
            "config": {"before": before, "after": after, "answers": list(answers)}}


def _lwb(tts_text, tiles, solution):
    return {"kind": "listen_word_bank", "prompt": "Tap what you hear",
            "config": {"ttsText": tts_text, "tiles": tiles, "solution": solution}}


_LESSONS = [
    ("Mixed Practice", 45, "mix-select", "Choose All That Apply", [
        _multi("Select all the greetings.", ["Բարև", "Շնորհակալություն", "Բարի լույս", "Այո"], [0, 2]),
        _multi("Select all the numbers.", ["մեկ", "կատու", "երկու", "հաց"], [0, 2]),
        _multi("Select all the family words.", ["մայր", "ջուր", "հայր", "քույր"], [0, 2, 3]),
        _multi("Select all the colors.", ["կարմիր", "կապույտ", "սեղան", "դեղին"], [0, 1, 3]),
        _multi("Select all the verbs.", ["գնալ", "գիրք", "խոսել", "կարդալ"], [0, 2, 3]),
        _multi("Select all the drinks.", ["սուրճ", "հաց", "թեյ", "ջուր"], [0, 2, 3]),
    ]),
    ("Mixed Practice", 45, "mix-sort", "Sort Into Groups", [
        _cat("Sort: food or drink?", ["Food", "Drink"],
             [("հաց", "Food"), ("սուրճ", "Drink"), ("խնձոր", "Food"), ("թեյ", "Drink"), ("ջուր", "Drink")]),
        _cat("Sort: family or color?", ["Family", "Color"],
             [("մայր", "Family"), ("կարմիր", "Color"), ("հայր", "Family"), ("կապույտ", "Color")]),
        _cat("Sort: number or verb?", ["Number", "Verb"],
             [("մեկ", "Number"), ("գնալ", "Verb"), ("երկու", "Number"), ("խոսել", "Verb")]),
        _cat("Sort: present or past?", ["Present", "Past"],
             [("գրում եմ", "Present"), ("գրեցի", "Past"), ("խոսում եմ", "Present"), ("խոսեցի", "Past")]),
        _cat("Sort: greeting or farewell?", ["Greeting", "Farewell"],
             [("Բարև", "Greeting"), ("Ցտեսություն", "Farewell"), ("Բարի լույս", "Greeting")]),
    ]),
    ("Mixed Practice", 45, "mix-highlight", "Tap the Word", [
        _hl("Tap the question word.", ["Ի՞նչ", "է", "սա"], [0]),
        _hl("Tap the noun.", ["Ես", "կարդում", "եմ", "գիրքը"], [3]),
        _hl("Tap the negative word.", ["Ես", "չեմ", "ուզում"], [1]),
        _hl("Tap the definite noun (with «-ը/-ն»).", ["Ես", "տեսնում", "եմ", "կատուն"], [3]),
        _hl("Tap the past-tense verb.", ["Երեկ", "ես", "գնացի", "դպրոց"], [2]),
        _hl("Tap the number.", ["Ես", "երկու", "գիրք", "ունեմ"], [1]),
    ]),
    ("Mixed Practice", 45, "mix-blank", "Fill in the Blank", [
        _blank("I am a student.", "Ես", "եմ", ["ուսանող"]),
        _blank("He is a teacher.", "Նա", "է", ["ուսուցիչ"]),
        _blank("We speak Armenian.", "Մենք հայերեն", "", ["խոսում ենք"]),
        _blank("I drink water.", "Ես ջուր", "", ["խմում եմ"]),
        _blank("This book is good.", "Այս գիրքը", "է", ["լավ"]),
        _blank("Tomorrow I will go.", "Վաղը ես", "", ["կգնամ"]),
    ]),
    ("Mixed Practice", 45, "mix-listen", "Tap What You Hear", [
        _lwb("Բարև ձեզ", ["Բարև", "ձեզ", "շնորհակալ", "եմ"], ["Բարև", "ձեզ"]),
        _lwb("Ես ուսանող եմ", ["Ես", "ուսանող", "եմ", "ուսուցիչ"], ["Ես", "ուսանող", "եմ"]),
        _lwb("Ես հայերեն եմ սովորում", ["Ես", "հայերեն", "եմ", "սովորում", "խոսում"], ["Ես", "հայերեն", "եմ", "սովորում"]),
        _lwb("Ջուր, խնդրում եմ", ["Ջուր", "խնդրում", "եմ", "սուրճ"], ["Ջուր", "խնդրում", "եմ"]),
        _lwb("Շնորհակալություն", ["Շնորհակալություն", "Խնդրեմ", "Այո"], ["Շնորհակալություն"]),
    ]),
]


def seed_activate():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'mix-select'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "mix-select already exists"}

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
