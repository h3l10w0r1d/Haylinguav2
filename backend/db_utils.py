# backend/db_utils.py
import json
from typing import Dict, Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import engine


def get_db():
    """
    Provide a Connection with an automatic transaction.

    Every request using this dependency runs inside a transaction.
    On success, it's committed; on error, it's rolled back.
    """
    with engine.begin() as conn:
        yield conn


def _ensure_lesson(
    conn: Connection,
    *,
    slug: str,
    title: str,
    description: str,
    level: int,
    xp: int,
) -> int:
    """
    Get or create a lesson by slug, keep metadata up to date,
    and return its id.
    """
    row = conn.execute(
        text(
            """
            SELECT id FROM lessons
            WHERE slug = :slug
            """
        ),
        {"slug": slug},
    ).mappings().first()

    if row is None:
        new_row = conn.execute(
            text(
                """
                INSERT INTO lessons (slug, title, description, level, xp)
                VALUES (:slug, :title, :description, :level, :xp)
                RETURNING id
                """
            ),
            {
                "slug": slug,
                "title": title,
                "description": description,
                "level": level,
                "xp": xp,
            },
        ).mappings().first()
        return new_row["id"]

    # update metadata if it changed
    conn.execute(
        text(
            """
            UPDATE lessons
            SET title = :title,
                description = :description,
                level = :level,
                xp = :xp
            WHERE slug = :slug
            """
        ),
        {
            "slug": slug,
            "title": title,
            "description": description,
            "level": level,
            "xp": xp,
        },
    )
    return row["id"]


def _reset_alphabet_1(conn: Connection) -> None:
    """
    Armenian Alphabet – Part 1 (Ա / ա)
    Several Duolingo-style exercises for the letter Ա.
    """
    lesson_id = _ensure_lesson(
        conn,
        slug="alphabet-1",
        title="Armenian Alphabet – Part 1",
        description="Meet your first Armenian letter Ա and practice simple combinations.",
        level=1,
        xp=40,
    )

    # wipe old exercises for this lesson
    conn.execute(
        text("DELETE FROM exercises WHERE lesson_id = :lesson_id"),
        {"lesson_id": lesson_id},
    )

    # 1) Intro
    ex1_config: Dict[str, Any] = {
        "letter": "Ա",
        "lower": "ա",
        "transliteration": "a",
        "hint": "Like the 'a' in 'father'.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_intro",
            "kind": "char_intro",
            "prompt": "Meet your first Armenian letter!",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 1,
            "config": json.dumps(ex1_config),
        },
    )

    # 2) MCQ: which sound?
    ex2_config: Dict[str, Any] = {
        "letter": "Ա",
        "options": ["a", "o", "e", "u"],
        "correctIndex": 0,
        "showTransliteration": True,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_mcq_sound",
            "kind": "char_mcq_sound",
            "prompt": "Which sound does this letter make?",
            "expected_answer": "a",
            "sentence_before": None,
            "sentence_after": None,
            "order": 2,
            "config": json.dumps(ex2_config),
        },
    )

    # 3) Build word "Արա"
    ex3_config: Dict[str, Any] = {
        "targetWord": "Արա",
        "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
        "solutionIndices": [0, 1, 2],
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_build_word",
            "kind": "char_build_word",
            "prompt": "Tap the letters to spell “Արա” (a common Armenian name).",
            "expected_answer": "Արա",
            "sentence_before": None,
            "sentence_after": None,
            "order": 3,
            "config": json.dumps(ex3_config),
        },
    )

    # 4) Listen & build "Արա"
    ex4_config: Dict[str, Any] = {
        "targetWord": "Արա",
        "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
        "solutionIndices": [0, 1, 2],
        "hint": "Listen to the word, then build it from the letters.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_listen_build",
            "kind": "char_listen_build",
            "prompt": "Listen and build the word you hear.",
            "expected_answer": "Արա",
            "sentence_before": None,
            "sentence_after": None,
            "order": 4,
            "config": json.dumps(ex4_config),
        },
    )

    # 5) Find letter Ա in grid
    ex5_config: Dict[str, Any] = {
        "targetLetter": "Ա",
        "grid": ["Ա", "Բ", "Ա", "Դ", "Ե", "Ա", "Զ", "Թ", "Ա", "Գ", "Ա", "Խ"],
        "columns": 4,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_find_in_grid",
            "kind": "char_find_in_grid",
            "prompt": "Tap every Ա in the grid.",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 5,
            "config": json.dumps(ex5_config),
        },
    )

    # 6) Type transliteration
    ex6_config: Dict[str, Any] = {
        "letter": "Ա",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_type_translit",
            "kind": "char_type_translit",
            "prompt": "Type the Latin sound for this letter.",
            "expected_answer": "a",
            "sentence_before": None,
            "sentence_after": None,
            "order": 6,
            "config": json.dumps(ex6_config),
        },
    )


def _reset_alphabet_2(conn: Connection) -> None:
    """
    Armenian Alphabet – Part 2 (Բ / բ)
    Same exercise types, different letter.
    """
    lesson_id = _ensure_lesson(
        conn,
        slug="alphabet-2",
        title="Armenian Alphabet – Part 2",
        description="Meet the letter Բ and build simple words.",
        level=1,
        xp=40,
    )

    conn.execute(
        text("DELETE FROM exercises WHERE lesson_id = :lesson_id"),
        {"lesson_id": lesson_id},
    )

    # 1) Intro
    ex1_config: Dict[str, Any] = {
        "letter": "Բ",
        "lower": "բ",
        "transliteration": "b",
        "hint": "Like the 'b' in 'book'.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_intro",
            "kind": "char_intro",
            "prompt": "Here is a new letter!",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 1,
            "config": json.dumps(ex1_config),
        },
    )

    # 2) MCQ
    ex2_config: Dict[str, Any] = {
        "letter": "Բ",
        "options": ["p", "b", "v", "m"],
        "correctIndex": 1,
        "showTransliteration": True,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_mcq_sound",
            "kind": "char_mcq_sound",
            "prompt": "Which is the correct sound for Բ?",
            "expected_answer": "b",
            "sentence_before": None,
            "sentence_after": None,
            "order": 2,
            "config": json.dumps(ex2_config),
        },
    )

    # 3) Build word "բար"
    ex3_config: Dict[str, Any] = {
        "targetWord": "բար",
        "tiles": ["ա", "Բ", "բ", "ր", "ն"],
        "solutionIndices": [2, 0, 3],
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_build_word",
            "kind": "char_build_word",
            "prompt": "Tap the letters to spell “բար”.",
            "expected_answer": "բար",
            "sentence_before": None,
            "sentence_after": None,
            "order": 3,
            "config": json.dumps(ex3_config),
        },
    )

    # 4) Listen & build "բար"
    ex4_config: Dict[str, Any] = {
        "targetWord": "բար",
        "tiles": ["ա", "Բ", "բ", "ր", "ն"],
        "solutionIndices": [2, 0, 3],
        "hint": "Listen to the word, then build it from the letters.",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_listen_build",
            "kind": "char_listen_build",
            "prompt": "Listen and build the word you hear.",
            "expected_answer": "բար",
            "sentence_before": None,
            "sentence_after": None,
            "order": 4,
            "config": json.dumps(ex4_config),
        },
    )

    # 5) Find Բ in grid
    ex5_config: Dict[str, Any] = {
        "targetLetter": "Բ",
        "grid": ["Բ", "Ա", "Գ", "Բ", "Դ", "Բ", "Ե", "Զ", "Բ", "Թ", "Բ", "Կ"],
        "columns": 4,
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_find_in_grid",
            "kind": "char_find_in_grid",
            "prompt": "Tap every Բ in the grid.",
            "expected_answer": None,
            "sentence_before": None,
            "sentence_after": None,
            "order": 5,
            "config": json.dumps(ex5_config),
        },
    )

    # 6) Type transliteration
    ex6_config: Dict[str, Any] = {
        "letter": "Բ",
    }
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config)
            """
        ),
        {
            "lesson_id": lesson_id,
            "type": "char_type_translit",
            "kind": "char_type_translit",
            "prompt": "Type the Latin sound for this letter.",
            "expected_answer": "b",
            "sentence_before": None,
            "sentence_after": None,
            "order": 6,
            "config": json.dumps(ex6_config),
        },
    )


def seed_alphabet_lessons():
    """
    Reset ONLY the alphabet lessons (alphabet-1, alphabet-2).
    Older "greetings" lessons can stay in DB, but we don't expose them.
    """
    with engine.begin() as conn:
        _reset_alphabet_1(conn)
        _reset_alphabet_2(conn)
        print("Seeded alphabet-1 and alphabet-2 with exercises.")
