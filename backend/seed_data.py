# backend/seed_data.py
from sqlalchemy.orm import Session

from models import Lesson, Exercise


def _ensure_lesson(
    db: Session,
    *,
    slug: str,
    title: str,
    description: str,
    level: int,
    xp: int,
) -> Lesson:
    """
    ORM-based helper: get or create lesson, keep metadata updated,
    and wipe its exercises for a clean slate.
    """
    lesson = db.query(Lesson).filter(Lesson.slug == slug).first()

    if not lesson:
        lesson = Lesson(
            slug=slug,
            title=title,
            description=description,
            level=level,
            xp=xp,
        )
        db.add(lesson)
        db.flush()
    else:
        lesson.title = title
        lesson.description = description
        lesson.level = level
        lesson.xp = xp
        db.flush()

    db.query(Exercise).filter(Exercise.lesson_id == lesson.id).delete()
    db.flush()
    return lesson


def _seed_alphabet_1(db: Session) -> None:
    # Armenian Alphabet – Part 1 (Ա)
    lesson = _ensure_lesson(
        db,
        slug="alphabet-1",
        title="Armenian Alphabet – Part 1",
        description="Meet your first Armenian letter Ա and practice simple combinations.",
        level=1,
        xp=40,
    )

    ex1 = Exercise(
        lesson_id=lesson.id,
        type="char_intro",
        kind="char_intro",
        prompt="Meet your first Armenian letter!",
        expected_answer=None,
        order=1,
        config={
            "letter": "Ա",
            "lower": "ա",
            "transliteration": "a",
            "hint": "Like the 'a' in 'father'.",
        },
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
        type="char_mcq_sound",
        kind="char_mcq_sound",
        prompt="Which sound does this letter make?",
        expected_answer="a",
        order=2,
        config={
            "letter": "Ա",
            "options": ["a", "o", "e", "u"],
            "correctIndex": 0,
            "showTransliteration": True,
        },
    )

    ex3 = Exercise(
        lesson_id=lesson.id,
        type="char_build_word",
        kind="char_build_word",
        prompt='Tap the letters to spell “Արա” (a common Armenian name).',
        expected_answer="Արա",
        order=3,
        config={
            "targetWord": "Արա",
            "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
            "solutionIndices": [0, 1, 2],
        },
    )

    ex4 = Exercise(
        lesson_id=lesson.id,
        type="char_listen_build",
        kind="char_listen_build",
        prompt="Listen and build the word you hear.",
        expected_answer="Արա",
        order=4,
        config={
            "targetWord": "Արա",
            "tiles": ["Ա", "Ր", "Ա", "Ն", "Կ"],
            "solutionIndices": [0, 1, 2],
            "hint": "Listen to the word, then build it from the letters.",
        },
    )

    ex5 = Exercise(
        lesson_id=lesson.id,
        type="char_find_in_grid",
        kind="char_find_in_grid",
        prompt="Tap every Ա in the grid.",
        expected_answer=None,
        order=5,
        config={
            "targetLetter": "Ա",
            "grid": ["Ա", "Բ", "Ա", "Դ", "Ե", "Ա", "Զ", "Թ", "Ա", "Գ", "Ա", "Խ"],
            "columns": 4,
        },
    )

    ex6 = Exercise(
        lesson_id=lesson.id,
        type="char_type_translit",
        kind="char_type_translit",
        prompt="Type the Latin sound for this letter.",
        expected_answer="a",
        order=6,
        config={"letter": "Ա"},
    )

    db.add_all([ex1, ex2, ex3, ex4, ex5, ex6])


def _seed_alphabet_2(db: Session) -> None:
    # Armenian Alphabet – Part 2 (Բ)
    lesson = _ensure_lesson(
        db,
        slug="alphabet-2",
        title="Armenian Alphabet – Part 2",
        description="Meet the letter Բ and build simple words.",
        level=1,
        xp=40,
    )

    ex1 = Exercise(
        lesson_id=lesson.id,
        type="char_intro",
        kind="char_intro",
        prompt="Here is a new letter!",
        expected_answer=None,
        order=1,
        config={
            "letter": "Բ",
            "lower": "բ",
            "transliteration": "b",
            "hint": "Like the 'b' in 'book'.",
        },
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
        type="char_mcq_sound",
        kind="char_mcq_sound",
        prompt="Which is the correct sound for Բ?",
        expected_answer="b",
        order=2,
        config={
            "letter": "Բ",
            "options": ["p", "b", "v", "m"],
            "correctIndex": 1,
            "showTransliteration": True,
        },
    )

    ex3 = Exercise(
        lesson_id=lesson.id,
        type="char_build_word",
        kind="char_build_word",
        prompt="Tap the letters to spell “բար”.",
        expected_answer="բար",
        order=3,
        config={
            "targetWord": "բար",
            "tiles": ["ա", "Բ", "բ", "ր", "ն"],
            "solutionIndices": [2, 0, 3],
        },
    )

    ex4 = Exercise(
        lesson_id=lesson.id,
        type="char_listen_build",
        kind="char_listen_build",
        prompt="Listen and build the word you hear.",
        expected_answer="բար",
        order=4,
        config={
            "targetWord": "բար",
            "tiles": ["ա", "Բ", "բ", "ր", "ն"],
            "solutionIndices": [2, 0, 3],
            "hint": "Listen to the word, then build it from the letters.",
        },
    )

    ex5 = Exercise(
        lesson_id=lesson.id,
        type="char_find_in_grid",
        kind="char_find_in_grid",
        prompt="Tap every Բ in the grid.",
        expected_answer=None,
        order=5,
        config={
            "targetLetter": "Բ",
            "grid": ["Բ", "Ա", "Գ", "Բ", "Դ", "Բ", "Ե", "Զ", "Բ", "Թ", "Բ", "Կ"],
            "columns": 4,
        },
    )

    ex6 = Exercise(
        lesson_id=lesson.id,
        type="char_type_translit",
        kind="char_type_translit",
        prompt="Type the Latin sound for this letter.",
        expected_answer="b",
        order=6,
        config={"letter": "Բ"},
    )

    db.add_all([ex1, ex2, ex3, ex4, ex5, ex6])


def seed_alphabet_lessons(db: Session) -> None:
    _seed_alphabet_1(db)
    _seed_alphabet_2(db)
