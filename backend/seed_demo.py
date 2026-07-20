# backend/seed_demo.py
"""
Teacher-facing demo content — NOT part of the learner curriculum. Two
lessons for visual review:
  1. "demo-all-types" — one exercise of every kind ExerciseRenderer.jsx
     renders (29 kinds), so a teacher can see every exercise format in
     one scroll.
  2. "demo-reading" — a short reading-comprehension set.

Both lessons live in a chapter with is_published=FALSE, so they never
appear in a learner's normal chapter list / /me/lessons/progress (which
filters on chapter publish state) — but each lesson is individually
published and GET /lessons/{slug} has no auth or lock gate, so they're
directly reachable at haylingua.am/lesson/demo-all-types and
haylingua.am/lesson/demo-reading for anyone with the link.

Idempotent: skips entirely if "demo-all-types" already exists. Triggered
via POST /cms/seed/demo (CMS-admin only).
"""

import json
from sqlalchemy import text
from database import engine


def _ex(kind, prompt, config, expected_answer=None, xp=10):
    return {"kind": kind, "prompt": prompt, "config": config,
            "expected_answer": expected_answer, "xp": xp}


_ALL_TYPES_EXERCISES = [
    _ex("char_intro", "Meet the letter Ա",
        {"letter": "Ա", "lower": "ա", "transliteration": "a", "hint": "Like 'a' in 'father'."}),
    _ex("char_mcq_sound", "Which sound does this letter make?",
        {"letter": "Ա", "options": ["a", "o", "e", "i"], "correctIndex": 0}),
    _ex("letter_recognition", "Which one is the letter Ա?",
        {"choices": ["Ա", "Բ", "Գ", "Դ"]}, expected_answer="Ա"),
    _ex("char_build_word", "Spell the word.",
        {"tiles": ["ա", "ց", "հ"], "solutionIndices": [2, 0, 1], "targetWord": "հաց"},
        expected_answer="հաց"),
    _ex("letter_typing", "Type the lowercase form of Ա.", {}, expected_answer="ա"),
    _ex("word_spelling", "Spell 'bread' in Armenian.",
        {"hint": "Bread"}, expected_answer="հաց"),
    _ex("fill_blank", "Fill in the blank.",
        {"before": "Ես ուսանող", "after": "", "placeholder": "…"}, expected_answer="եմ"),
    _ex("translate_mcq", "How do you say “Hello”?",
        {"sentence": "Hello", "choices": ["Բարև", "Ցտեսություն", "Այո", "Ոչ"], "answerIndex": 0}),
    _ex("true_false", "True or False?",
        {"statement": "«Բարև» means “Hello.”", "correct": True}),
    _ex("sentence_order", "Arrange: “I am a student.”",
        {"tokens": ["ուսանող", "Ես", "եմ"], "solution": ["Ես", "ուսանող", "եմ"]}),
    _ex("match_pairs", "Match each word to its meaning.",
        {"pairs": [{"left": "Բարև", "right": "Hello"}, {"left": "Ցտեսություն", "right": "Goodbye"}]}),
    _ex("audio_choice_tts", "Listen and choose what you heard.",
        {"ttsText": "հաց", "promptText": "Listen and choose", "choices": ["հաց", "ջուր"], "answerIndex": 0},
        expected_answer="հաց"),
    _ex("multi_select", "Select all colors.",
        {"question": "Select all colors", "choices": ["կարմիր", "մայր", "կապույտ", "սար"], "correctIndices": [0, 2]}),
    _ex("speak", "Say the word for 'bread'.",
        {"acceptedAnswers": [], "language_code": "hye", "transliteration": "hats"},
        expected_answer="հաց", xp=15),
    _ex("listen_type", "Listen and type what you hear.",
        {"ttsText": "հաց", "acceptedAnswers": ["հաց"], "hint": "bread"}, expected_answer="հաց"),
    _ex("word_bank", "Build: “I am a student.”",
        {"sentence": "I am a student", "tiles": ["Ես", "ուսանող", "եմ", "նա"], "solution": ["Ես", "ուսանող", "եմ"]}),
    _ex("select_missing_word", "Complete the sentence.",
        {"before": "Ես ուսանող", "after": "", "choices": ["եմ", "ես", "է"], "answerIndex": 0}),
    _ex("listen_word_bank", "Tap what you hear.",
        {"ttsText": "Ես ուսանող եմ", "tiles": ["Ես", "ուսանող", "եմ", "դու"], "solution": ["Ես", "ուսանող", "եմ"]}),
    _ex("dialogue_mcq", "How do you respond?",
        {"lines": [{"from": "them", "text": "Բարև! Ինչպե՞ս ես"}],
         "choices": ["Ես լավ եմ, շնորհակալություն", "Ցտեսություն", "Ոչ"], "answerIndex": 0}),
    _ex("dialogue_order", "Put the conversation in order.",
        {"lines": ["Բարև!", "Ինչպե՞ս ես", "Ես լավ եմ, շնորհակալություն"],
         "solution": ["Բարև!", "Ինչպե՞ս ես", "Ես լավ եմ, շնորհակալություն"]}),
    _ex("image_select", "Which picture shows 'bread'?",
        {"choices": [{"image": "", "label": "հաց"}, {"image": "", "label": "ջուր"}, {"image": "", "label": "կաթ"}],
         "answerIndex": 0}),
    _ex("reading_comprehension", "What is the person doing?",
        {"passage": "Ես ուսանող եմ և հայերեն եմ սովորում.",
         "question": "What is the person doing?",
         "choices": ["Learning Armenian", "Working", "Sleeping", "Cooking"], "answerIndex": 0}),
    _ex("minimal_pairs", "Listen and choose the word you heard.",
        {"ttsText": "հաց", "choices": ["hats", "jur"], "answerIndex": 0}),
    _ex("flashcard", "Flip the card.",
        {"front": "Շնորհակալություն", "back": "Thank you", "hint": ""}),
    _ex("categorize", "Sort into groups.",
        {"buckets": ["Food", "Color"],
         "items": [{"text": "հաց", "bucket": "Food"}, {"text": "կարմիր", "bucket": "Color"},
                   {"text": "ջուր", "bucket": "Food"}, {"text": "կապույտ", "bucket": "Color"}]}),
    _ex("highlight_grammar", "Tap the verb (‘to be’).",
        {"tokens": ["Ես", "ուսանող", "եմ"], "correctIndices": [2]}),
    _ex("conjugation", "Conjugate: to be",
        {"verb": "լինել (to be)",
         "cells": [{"label": "Ես (I)", "answer": "եմ"}, {"label": "Դու (you)", "answer": "ես"},
                   {"label": "Նա (he/she)", "answer": "է"}]}, xp=20),
    _ex("speak_line", "Say your line.",
        {"lines": [{"from": "them", "text": "Բարև! Ինչպե՞ս ես"}],
         "target": "Ես լավ եմ, շնորհակալություն", "language_code": "hye",
         "transliteration": "Yes lav em, shnorhakalutyun"}, xp=15),
    _ex("write_translate", "Translate: “I am a student”",
        {"source": "I am a student", "acceptedAnswers": ["Ես ուսանող եմ"]}, xp=20),
]

_READING_PASSAGE = ("Բարև, իմ անունը Անի է. Ես ուսանող եմ և հայերեն եմ սովորում. "
                     "Իմ ընտանիքը մեծ է. Ես Հայաստանից եմ.")

_READING_EXERCISES = [
    _ex("reading_comprehension", "What is Ani's name?",
        {"passage": _READING_PASSAGE, "question": "What is Ani's name?",
         "choices": ["Ani", "Armen", "Sona", "Ara"], "answerIndex": 0}),
    _ex("reading_comprehension", "What is Ani learning?",
        {"passage": _READING_PASSAGE, "question": "What is Ani learning?",
         "choices": ["Armenian", "English", "French", "Russian"], "answerIndex": 0}),
    _ex("reading_comprehension", "Where is Ani from?",
        {"passage": _READING_PASSAGE, "question": "Where is Ani from?",
         "choices": ["Armenia", "Russia", "France", "Georgia"], "answerIndex": 0}),
    _ex("reading_comprehension", "Is Ani's family big or small?",
        {"passage": _READING_PASSAGE, "question": "Is Ani's family big or small?",
         "choices": ["Big", "Small", "Not mentioned", "Medium"], "answerIndex": 0}),
    _ex("true_false", "True or False?",
        {"statement": "The passage says Ani is a student.", "correct": True}),
]

_LESSONS = [
    ("demo-all-types", "Demo: Every Exercise Type", _ALL_TYPES_EXERCISES),
    ("demo-reading", "Demo: Reading Comprehension", _READING_EXERCISES),
]


def seed_demo_lessons():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'demo-all-types'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "demo-all-types already exists"}

        chapter_title = "Demo (hidden — teacher review only)"
        chapter_id = conn.execute(
            text("SELECT id FROM chapters WHERE title = :t"), {"t": chapter_title}
        ).scalar()
        if not chapter_id:
            chapter_id = conn.execute(
                text("""INSERT INTO chapters (title, position, is_published)
                        VALUES (:t, 999, FALSE) RETURNING id"""),
                {"t": chapter_title},
            ).scalar()

        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        created_lessons = 0
        created_exercises = 0

        for slug, title, exercises in _LESSONS:
            max_level += 1
            lesson_xp = sum(ex["xp"] for ex in exercises)
            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard')
                    RETURNING id
                """),
                {"slug": slug, "title": title, "level": max_level, "xp": lesson_xp, "chapter_id": chapter_id},
            ).scalar()
            created_lessons += 1

            for idx, ex in enumerate(exercises, start=1):
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, expected_answer, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :expected_answer, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lesson_id, "kind": ex["kind"], "prompt": ex["prompt"],
                     "expected_answer": ex["expected_answer"], "order": idx, "xp": ex["xp"],
                     "config": json.dumps(ex["config"])},
                )
                created_exercises += 1

        return {"ok": True, "chapter_id": chapter_id,
                "lessons_created": created_lessons, "exercises_created": created_exercises}
