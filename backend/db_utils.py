# backend/db_utils.py
import json
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import engine


def _ensure_lesson(
    conn: Connection,
    *,
    slug: str,
    title: str,
    description: str,
    level: int,
    xp: int,
) -> int:
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
    lesson_id = _ensure_lesson(
        conn,
        slug="alphabet-1",
        title="Armenian Alphabet – Part 1",
        description="Meet your first Armenian letter Ա and practice simple combinations.",
        level=1,
        xp=40,
    )

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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    # 2) MCQ
    ex2_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    # 3) Build "Արա"
    ex3_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    # 4) Listen & build
    ex4_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    # 5) Find in grid
    ex5_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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
    ex6_config = {"letter": "Ա"}
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    # same pattern as alphabet-1 but for Բ
    ex1_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    ex2_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    ex3_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    ex4_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    ex5_config = {
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
             :sentence_before, :sentence_after, :order, :config::jsonb)
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

    ex6_config = {"letter": "Բ"}
    conn.execute(
        text(
            """
            INSERT INTO exercises
            (lesson_id, type, kind, prompt, expected_answer,
             sentence_before, sentence_after, "order", config)
            VALUES
            (:lesson_id, :type, :kind, :prompt, :expected_answer,
             :sentence_before, :sentence_after, :order, :config::jsonb)
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


def seed_alphabet_lessons() -> None:
    with engine.begin() as conn:
        _reset_alphabet_1(conn)
        _reset_alphabet_2(conn)
        print("Seeded alphabet-1 and alphabet-2 with exercises.")
