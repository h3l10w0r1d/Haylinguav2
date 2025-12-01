# backend/seed_data.py

from database import SessionLocal, engine, Base
from models import Lesson, Exercise, ExerciseOption


def get_or_create_lesson(
    db,
    slug: str,
    title: str,
    description: str,
    level: int,
    xp: int,
) -> Lesson:
    """Get lesson by slug, or create it if it doesn't exist."""
    lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
    if lesson:
        print(f"Lesson '{slug}' already exists (id={lesson.id}).")
        return lesson

    lesson = Lesson(
        slug=slug,
        title=title,
        description=description,
        level=level,
        xp=xp,
    )
    db.add(lesson)
    db.flush()  # lesson.id is now available
    print(f"Created lesson '{slug}' (id={lesson.id}).")
    return lesson


def seed_lesson_1_greetings(db, lesson: Lesson):
    """Greetings – type-answer, fill-blank, multi-select."""
    if lesson.exercises:
        print("Lesson-1 already has exercises, skipping.")
        return

    # Ex 1: type-answer
    ex1 = Exercise(
        lesson_id=lesson.id,
        type="type-answer",
        prompt='Type the Armenian word for "Hello".',
        expected_answer="Բարև",
        order=1,
    )

    # Ex 2: fill-blank
    ex2 = Exercise(
        lesson_id=lesson.id,
        type="fill-blank",
        prompt='Complete the phrase "Բարի _____" (Good morning).',
        sentence_before="Բարի ",
        sentence_after="",
        expected_answer="լույս",
        order=2,
    )

    # Ex 3: multi-select
    ex3 = Exercise(
        lesson_id=lesson.id,
        type="multi-select",
        prompt='Select all ways to say "goodbye".',
        order=3,
    )

    db.add_all([ex1, ex2, ex3])
    db.flush()

    db.add_all(
        [
            ExerciseOption(
                exercise_id=ex3.id,
                text="Ցտեսություն",
                is_correct=True,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="Պայփայի",
                is_correct=True,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="Բարև",
                is_correct=False,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="Շնորհակալություն",
                is_correct=False,
            ),
        ]
    )

    print("Seeded exercises for lesson-1 (Greetings).")


def seed_lesson_2_alphabet(db, lesson: Lesson):
    """Alphabet – type-answer, fill-blank, match-pairs."""
    if lesson.exercises:
        print("Lesson-2 already has exercises, skipping.")
        return

    # Ex 1: type-answer
    ex1 = Exercise(
        lesson_id=lesson.id,
        type="type-answer",
        prompt='Type the Armenian letter "Ա" (just the Armenian character).',
        expected_answer="Ա",
        order=1,
    )

    # Ex 2: fill-blank
    ex2 = Exercise(
        lesson_id=lesson.id,
        type="fill-blank",
        prompt='Complete: "Ա, Բ, __" (first three Armenian letters).',
        sentence_before="Ա, Բ, ",
        sentence_after="",
        expected_answer="Գ",
        order=2,
    )

    # Ex 3: match-pairs – Armenian letter ↔ Latin transcription
    ex3 = Exercise(
        lesson_id=lesson.id,
        type="match-pairs",
        prompt="Match the Armenian letters with their Latin equivalents.",
        order=3,
    )

    db.add_all([ex1, ex2, ex3])
    db.flush()

    pairs = [
        ("Ա", "A", "A"),
        ("Բ", "B", "B"),
        ("Գ", "G", "G"),
        ("Դ", "D", "D"),
    ]

    options = []
    for armenian, latin, key in pairs:
        options.append(
            ExerciseOption(
                exercise_id=ex3.id,
                text=armenian,
                side="left",
                match_key=key,
            )
        )
        options.append(
            ExerciseOption(
                exercise_id=ex3.id,
                text=latin,
                side="right",
                match_key=key,
            )
        )

    db.add_all(options)
    print("Seeded exercises for lesson-2 (Alphabet).")


def seed_lesson_3_numbers(db, lesson: Lesson):
    """Numbers 1–10 – type-answer, match-pairs, multi-select."""
    if lesson.exercises:
        print("Lesson-3 already has exercises, skipping.")
        return

    # Ex 1: type-answer
    ex1 = Exercise(
        lesson_id=lesson.id,
        type="type-answer",
        prompt='Type the Armenian word for "one".',
        expected_answer="մեկ",
        order=1,
    )

    # Ex 2: match-pairs – digit ↔ Armenian word
    ex2 = Exercise(
        lesson_id=lesson.id,
        type="match-pairs",
        prompt="Match the numbers with their Armenian words.",
        order=2,
    )

    # Ex 3: multi-select – select even numbers
    ex3 = Exercise(
        lesson_id=lesson.id,
        type="multi-select",
        prompt="Select all even numbers.",
        order=3,
    )

    db.add_all([ex1, ex2, ex3])
    db.flush()

    number_pairs = [
        ("1", "մեկ", "1"),
        ("2", "երկու", "2"),
        ("3", "երեք", "3"),
        ("4", "չորս", "4"),
    ]

    options = []
    for digit, armenian, key in number_pairs:
        options.append(
            ExerciseOption(
                exercise_id=ex2.id,
                text=digit,
                side="left",
                match_key=key,
            )
        )
        options.append(
            ExerciseOption(
                exercise_id=ex2.id,
                text=armenian,
                side="right",
                match_key=key,
            )
        )

    db.add_all(options)

    # Even numbers multi-select options
    db.add_all(
        [
            ExerciseOption(
                exercise_id=ex3.id,
                text="2 (երկու)",
                is_correct=True,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="3 (երեք)",
                is_correct=False,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="4 (չորս)",
                is_correct=True,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="5 (հինք)",
                is_correct=False,
            ),
        ]
    )

    print("Seeded exercises for lesson-3 (Numbers).")


def seed_lesson_4_basic_phrases(db, lesson: Lesson):
    """Basic phrases – type-answer, fill-blank, multi-select."""
    if lesson.exercises:
        print("Lesson-4 already has exercises, skipping.")
        return

    ex1 = Exercise(
        lesson_id=lesson.id,
        type="type-answer",
        prompt='Type the Armenian for "Thank you".',
        expected_answer="Շնորհակալություն",
        order=1,
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
        type="fill-blank",
        prompt='Complete: "Ինչպե՞ս _____?" (How are you?).',
        sentence_before="Ինչպե՞ս ",
        sentence_after="?",
        expected_answer="ես",
        order=2,
    )

    ex3 = Exercise(
        lesson_id=lesson.id,
        type="multi-select",
        prompt="Select all polite Armenian expressions.",
        order=3,
    )

    db.add_all([ex1, ex2, ex3])
    db.flush()

    db.add_all(
        [
            ExerciseOption(
                exercise_id=ex3.id,
                text="Խնդրում եմ",
                is_correct=True,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="Շնորհակալություն",
                is_correct=True,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="Հանգիստ թող ինձ",
                is_correct=False,
            ),
            ExerciseOption(
                exercise_id=ex3.id,
                text="Բարև",
                is_correct=True,
            ),
        ]
    )

    print("Seeded exercises for lesson-4 (Basic Phrases).")


def seed_lesson_5_family(db, lesson: Lesson):
    """Family – type-answer, match-pairs, fill-blank."""
    if lesson.exercises:
        print("Lesson-5 already has exercises, skipping.")
        return

    ex1 = Exercise(
        lesson_id=lesson.id,
        type="type-answer",
        prompt='Type the Armenian for "mother".',
        expected_answer="մայր",
        order=1,
    )

    ex2 = Exercise(
        lesson_id=lesson.id,
        type="match-pairs",
        prompt="Match the family members with their Armenian words.",
        order=2,
    )

    ex3 = Exercise(
        lesson_id=lesson.id,
        type="fill-blank",
        prompt='Complete: "Նա իմ _____ է" (She is my sister).',
        sentence_before="Նա իմ ",
        sentence_after=" է",
        expected_answer="քույրը",
        order=3,
    )

    db.add_all([ex1, ex2, ex3])
    db.flush()

    pairs = [
        ("father", "հայր", "father"),
        ("mother", "մայր", "mother"),
        ("brother", "եղբայր", "brother"),
        ("sister", "քույր", "sister"),
    ]

    options = []
    for en, hy, key in pairs:
        options.append(
            ExerciseOption(
                exercise_id=ex2.id,
                text=en,
                side="left",
                match_key=key,
            )
        )
        options.append(
            ExerciseOption(
                exercise_id=ex2.id,
                text=hy,
                side="right",
                match_key=key,
            )
        )

    db.add_all(options)

    print("Seeded exercises for lesson-5 (Family).")


def seed_all():
    """Entry point for seeding all demo lessons + exercises."""
    db = SessionLocal()
    try:
        # Make sure tables exist
        Base.metadata.create_all(bind=engine)

        # ---- define lessons that match your roadmap-ish ----
        l1 = get_or_create_lesson(
            db,
            slug="lesson-1",
            title="Greetings",
            description="Learn basic Armenian greetings.",
            level=1,
            xp=50,
        )
        seed_lesson_1_greetings(db, l1)

        l2 = get_or_create_lesson(
            db,
            slug="lesson-2",
            title="The Alphabet",
            description="Master the Armenian alphabet basics.",
            level=1,
            xp=75,
        )
        seed_lesson_2_alphabet(db, l2)

        l3 = get_or_create_lesson(
            db,
            slug="lesson-3",
            title="Numbers 1–10",
            description="Count from one to ten in Armenian.",
            level=1,
            xp=60,
        )
        seed_lesson_3_numbers(db, l3)

        l4 = get_or_create_lesson(
            db,
            slug="lesson-4",
            title="Basic Phrases",
            description="Common everyday expressions.",
            level=2,
            xp=80,
        )
        seed_lesson_4_basic_phrases(db, l4)

        l5 = get_or_create_lesson(
            db,
            slug="lesson-5",
            title="Family Members",
            description="Words for family relationships.",
            level=2,
            xp=70,
        )
        seed_lesson_5_family(db, l5)

        db.commit()
        print("✅ Seeding completed.")
    except Exception as e:
        db.rollback()
        print("❌ Error during seeding:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
