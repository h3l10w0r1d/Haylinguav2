# backend/db_utils.py

from sqlalchemy import text
from database import engine


def seed_alphabet_lessons() -> None:
    """
    Idempotent seeding of the alphabet lessons.

    Called from main.py on startup:
        Base.metadata.create_all(bind=engine)
        seed_alphabet_lessons()

    This will:
    - Delete existing alphabet lessons (alphabet-1, alphabet-2) and their exercises
    - Recreate them with a fixed, known set of exercises
    - Avoid the old ':config::jsonb' placeholder bug
    """

    with engine.begin() as conn:
        # 1) Wipe existing alphabet lessons + their exercises
        conn.execute(
            text(
                """
                DELETE FROM exercises
                WHERE lesson_id IN (
                    SELECT id FROM lessons
                    WHERE slug IN ('alphabet-1', 'alphabet-2')
                )
                """
            )
        )

        conn.execute(
            text(
                """
                DELETE FROM lessons
                WHERE slug IN ('alphabet-1', 'alphabet-2')
                """
            )
        )

        # 2) Insert alphabet lessons
        #    Make sure these column names match your models in database.py
        lesson1_id = conn.execute(
            text(
                """
                INSERT INTO lessons (slug, title, description, order_index, xp_reward)
                VALUES (:slug, :title, :description, :order_index, :xp_reward)
                RETURNING id
                """
            ),
            {
                "slug": "alphabet-1",
                "title": "Alphabet 1: First Letters",
                "description": "Start learning the Armenian alphabet with your first letters.",
                "order_index": 1,
                "xp_reward": 20,
            },
        ).scalar_one()

        lesson2_id = conn.execute(
            text(
                """
                INSERT INTO lessons (slug, title, description, order_index, xp_reward)
                VALUES (:slug, :title, :description, :order_index, :xp_reward)
                RETURNING id
                """
            ),
            {
                "slug": "alphabet-2",
                "title": "Alphabet 2: More Letters",
                "description": "Continue learning the Armenian alphabet with more letters.",
                "order_index": 2,
                "xp_reward": 25,
            },
        ).scalar_one()

        # 3) Insert exercises for Alphabet 1
        # NOTE: key change vs your broken version:
        # - we do NOT use ':config::jsonb'
        # - we either omit config or set it via a normal value (here '{}'::jsonb literal)
        alphabet1_exercises = [
            {
                "lesson_id": lesson1_id,
                "type": "char_intro",
                "kind": "char_intro",
                "prompt": "Meet your first Armenian letter!",
                "expected_answer": None,
                "sentence_before": None,
                "sentence_after": None,
                "order": 1,
            },
            {
                "lesson_id": lesson1_id,
                "type": "char_mcq",
                "kind": "char_mcq",
                "prompt": "Which of these is the letter Ա (A)?",
                "expected_answer": "Ա",
                "sentence_before": None,
                "sentence_after": None,
                "order": 2,
            },
            {
                "lesson_id": lesson1_id,
                "type": "char_type",
                "kind": "char_type",
                "prompt": "Type the letter you just learned.",
                "expected_answer": "Ա",
                "sentence_before": None,
                "sentence_after": None,
                "order": 3,
            },
        ]

        conn.execute(
            text(
                """
                INSERT INTO exercises
                    (lesson_id, type, kind, prompt, expected_answer,
                     sentence_before, sentence_after, "order", config)
                VALUES
                    (:lesson_id, :type, :kind, :prompt, :expected_answer,
                     :sentence_before, :sentence_after, :order, '{}'::jsonb)
                """
            ),
            alphabet1_exercises,
        )

        # 4) Insert exercises for Alphabet 2
        alphabet2_exercises = [
            {
                "lesson_id": lesson2_id,
                "type": "char_intro",
                "kind": "char_intro",
                "prompt": "Here is your next Armenian letter.",
                "expected_answer": None,
                "sentence_before": None,
                "sentence_after": None,
                "order": 1,
            },
            {
                "lesson_id": lesson2_id,
                "type": "char_mcq",
                "kind": "char_mcq",
                "prompt": "Pick the correct letter you just saw.",
                "expected_answer": "Բ",  # example expected answer
                "sentence_before": None,
                "sentence_after": None,
                "order": 2,
            },
            {
                "lesson_id": lesson2_id,
                "type": "char_type",
                "kind": "char_type",
                "prompt": "Type the new letter.",
                "expected_answer": "Բ",
                "sentence_before": None,
                "sentence_after": None,
                "order": 3,
            },
        ]

        conn.execute(
            text(
                """
                INSERT INTO exercises
                    (lesson_id, type, kind, prompt, expected_answer,
                     sentence_before, sentence_after, "order", config)
                VALUES
                    (:lesson_id, :type, :kind, :prompt, :expected_answer,
                     :sentence_before, :sentence_after, :order, '{}'::jsonb)
                """
            ),
            alphabet2_exercises,
        )

        # That’s it. No :config placeholder anywhere.
