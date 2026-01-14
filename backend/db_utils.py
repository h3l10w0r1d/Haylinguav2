# backend/db_utils.py

import json
from typing import Optional, Dict, Any

from sqlalchemy import text
from database import engine


def seed_alphabet_lessons() -> None:
    """
    Seed (or reseed) the two Alphabet lessons plus their exercises.

    This is called from main.on_startup() so the data is present in
    every environment (local, Render, etc.).
    """
    with engine.begin() as conn:
        # --- 0) Ensure schema matches what our code expects -------------------
        # Add xp_reward column if it doesn't exist yet (Render DB currently
        # doesn't have it, which caused the UndefinedColumn error).
        conn.execute(
            text(
                """
                ALTER TABLE lessons
                ADD COLUMN IF NOT EXISTS xp_reward INTEGER NOT NULL DEFAULT 40
                """
            )
        )

        # --- 1) Clean out any previous version of these lessons + exercises ---
        conn.execute(
            text(
                """
                DELETE FROM lesson_progress
                WHERE lesson_id IN (
                    SELECT id FROM lessons
                    WHERE slug IN (:slug1, :slug2)
                )
                """
            ),
            {"slug1": "alphabet-1", "slug2": "alphabet-2"},
        )

        conn.execute(
            text(
                """
                DELETE FROM exercises
                WHERE lesson_id IN (
                    SELECT id FROM lessons
                    WHERE slug IN (:slug1, :slug2)
                )
                """
            ),
            {"slug1": "alphabet-1", "slug2": "alphabet-2"},
        )

        conn.execute(
            text(
                """
                DELETE FROM lessons
                WHERE slug IN (:slug1, :slug2)
                """
            ),
            {"slug1": "alphabet-1", "slug2": "alphabet-2"},
        )

        # --- 2) Insert fresh lessons -----------------------------------------
        # NOTE: level is an INTEGER column -> we pass numbers, not strings.
        lesson1_id = conn.execute(
            text(
                """
                INSERT INTO lessons (slug, title, description, level, xp_reward)
                VALUES (:slug, :title, :description, :level, :xp_reward)
                RETURNING id
                """
            ),
            {
                "slug": "alphabet-1",
                "title": "Alphabet 1: First Letters",
                "description": "Start learning the Armenian alphabet with your first letters.",
                "level": 1,
                "xp_reward": 40,
            },
        ).scalar_one()

        lesson2_id = conn.execute(
            text(
                """
                INSERT INTO lessons (slug, title, description, level, xp_reward)
                VALUES (:slug, :title, :description, :level, :xp_reward)
                RETURNING id
                """
            ),
            {
                "slug": "alphabet-2",
                "title": "Alphabet 2: More Letters",
                "description": "Continue with more letters and simple words.",
                "level": 1,  # or 2 if you want a higher level
                "xp_reward": 40,
            },
        ).scalar_one()

        # --- 3) Create exercises for each lesson -----------------------------
        _create_alphabet_1_exercises(conn, lesson1_id)
        _create_alphabet_2_exercises(conn, lesson2_id)


def _insert_exercise(
    conn,
    *,
    lesson_id: int,
    order: int,
    type_: str,
    kind: str,
    prompt: str,
    expected_answer: Optional[str] = None,
    sentence_before: Optional[str] = None,
    sentence_after: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Helper to insert a single exercise row.

    The `config` dict is stored as JSONB.
    """
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order,
             CAST(:config AS jsonb))
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": type_,
            "kind": kind,
            "prompt": prompt,
            "expected_answer": expected_answer,
            "sentence_before": sentence_before,
            "sentence_after": sentence_after,
            "order": order,
            "config": json.dumps(config or {}),
        },
    )


def _create_alphabet_1_exercises(conn, lesson_id: int) -> None:
    """
    Seed a minimal but working set of exercises for Alphabet 1.
    Adjust/expand these as your frontend grows.
    """

    # 1. Intro to letter Լ
    _insert_exercise(
        conn,
        lesson_id=lesson_id,
        order=1,
        type_="char_intro",
        kind="char_intro",
        prompt="Meet your first Armenian letter Լ!",
        config={
            "letter": "Լ",
            "transliteration": "L",
            "examples": [
                {"hy": "Լուսին", "en": "Moon"},
                {"hy": "Լեռն", "en": "Mountain"},
            ],
        },
    )

    # 2. Simple multiple-choice recognition
    _insert_exercise(
        conn,
        lesson_id=lesson_id,
        order=2,
        type_="multiple_choice",
        kind="letter_recognition",
        prompt="Which of these is the letter Լ?",
        expected_answer="Լ",
        config={
            "choices": ["Ա", "Լ", "Կ", "Մ"],
        },
    )

    # 3. Type the letter
    _insert_exercise(
        conn,
        lesson_id=lesson_id,
        order=3,
        type_="type_answer",
        kind="letter_typing",
        prompt="Type the Armenian letter for the sound 'L'.",
        expected_answer="Լ",
        config={
            "keyboard_hint": "It looks like a tall hook.",
        },
    )


def _create_alphabet_2_exercises(conn, lesson_id: int) -> None:
    """
    Seed a minimal set of exercises for Alphabet 2.
    """

    # 1. Intro to letter Ֆ
    _insert_exercise(
        conn,
        lesson_id=lesson_id,
        order=1,
        type_="char_intro",
        kind="char_intro",
        prompt="Meet the Armenian letter Ֆ!",
        config={
            "letter": "Ֆ",
            "transliteration": "F",
            "examples": [
                {"hy": "Ֆիլմ", "en": "Film"},
                {"hy": "Ֆուտբոլ", "en": "Football"},
            ],
        },
    )

    # 2. Multiple choice
    _insert_exercise(
        conn,
        lesson_id=lesson_id,
        order=2,
        type_="multiple_choice",
        kind="letter_recognition",
        prompt="Select the letter Ֆ.",
        expected_answer="Ֆ",
        config={
            "choices": ["Պ", "Ֆ", "Թ", "Կ"],
        },
    )

    # 3. Simple word with Ֆ
    _insert_exercise(
        conn,
        lesson_id=lesson_id,
        order=3,
        type_="fill_in",
        kind="word_spelling",
        prompt="Complete the word for 'film' in Armenian: Ֆি__",
        expected_answer="Ֆիլմ",
        sentence_before=None,
        sentence_after=None,
        config={
            "hint": "Think of the English word 'film'.",
        },
    )
