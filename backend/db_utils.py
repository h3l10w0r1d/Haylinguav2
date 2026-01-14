# backend/db_utils.py

from sqlalchemy import text
from database import engine


def seed_alphabet_lessons() -> None:
    """
    Seed (or reseed) the two alphabet lessons and their exercises.

    This version matches your existing DB schema:
      - lessons table has: id, slug, title, description, level, ...
      - `level` is NOT NULL
      - there is NO `order_index` and NO `xp_reward`
    """

    with engine.begin() as conn:
        # 1. Clean existing data for these lessons so seeding is idempotent
        conn.execute(
            text("""
                DELETE FROM exercises
                WHERE lesson_id IN (
                    SELECT id FROM lessons WHERE slug IN ('alphabet-1', 'alphabet-2')
                )
            """)
        )

        conn.execute(
            text("""
                DELETE FROM lessons
                WHERE slug IN ('alphabet-1', 'alphabet-2')
            """)
        )

        # 2. Reinsert lessons using the correct columns, including `level`
        #    Choose whatever level string your app expects; I'm using 'beginner'
        lesson1_id = conn.execute(
            text("""
                INSERT INTO lessons (slug, title, description, level)
                VALUES (:slug, :title, :description, :level)
                RETURNING id
            """),
            {
                "slug": "alphabet-1",
                "title": "Alphabet 1: First Letters",
                "description": "Start learning the Armenian alphabet with your first letters.",
                "level": "beginner",
            },
        ).scalar_one()

        lesson2_id = conn.execute(
            text("""
                INSERT INTO lessons (slug, title, description, level)
                VALUES (:slug, :title, :description, :level)
                RETURNING id
            """),
            {
                "slug": "alphabet-2",
                "title": "Alphabet 2: More Letters",
                "description": "Continue learning the Armenian alphabet with more letters.",
                "level": "beginner",
            },
        ).scalar_one()

        # 3. Re-seed their exercises
        #    Keep your existing implementations of these; just call them here.
        _reset_alphabet_1(conn, lesson1_id)
        _reset_alphabet_2(conn, lesson2_id)
