# backend/db_utils.py

from sqlalchemy import text
from database import engine


def seed_alphabet_lessons() -> None:
    """
    Seed (or reseed) the two alphabet lessons and their exercises.

    IMPORTANT: This version assumes your `lessons` table has ONLY:
        id, slug, title, description, ...
    and does NOT have `order_index` or `xp_reward`.
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

        # 2. Reinsert lessons using ONLY existing columns: slug, title, description
        lesson1_id = conn.execute(
            text("""
                INSERT INTO lessons (slug, title, description)
                VALUES (:slug, :title, :description)
                RETURNING id
            """),
            {
                "slug": "alphabet-1",
                "title": "Alphabet 1: First Letters",
                "description": "Start learning the Armenian alphabet with your first letters.",
            },
        ).scalar_one()

        lesson2_id = conn.execute(
            text("""
                INSERT INTO lessons (slug, title, description)
                VALUES (:slug, :title, :description)
                RETURNING id
            """),
            {
                "slug": "alphabet-2",
                "title": "Alphabet 2: More Letters",
                "description": "Continue learning the Armenian alphabet with more letters.",
            },
        ).scalar_one()

        # 3. Re-seed their exercises (your existing functions)
        _reset_alphabet_1(conn, lesson1_id)
        _reset_alphabet_2(conn, lesson2_id)
