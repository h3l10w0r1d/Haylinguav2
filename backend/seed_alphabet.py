# backend/seed_alphabet.py
"""
Phase 1 — Alphabet. Extends the existing "hl-alphabet-1"/"hl-alphabet-2"
lessons (which already cover Ա Բ Գ Դ Ե Կ) with the remaining 33 letters of
the Eastern Armenian alphabet, sequenced so learners always meet a letter
only after they've already drilled its *sound* in Phase 0 (Sounds) — by the
time a letter shows up here, its sound is familiar and the lesson is really
"here's the symbol for a sound you already know."

Each of the 8 new letter lessons (hl-alphabet-3 .. hl-alphabet-10) covers
4-5 letters and follows the same exercise progression as the existing two
lessons: char_intro (symbol + sound) -> audio_choice_tts (hear a real word,
pick the letter it starts with — reinforces sound->symbol) ->
letter_recognition (pick the symbol) -> match_pairs (symbol<->sound) ->
true_false (one fact check). A final capstone lesson (hl-alphabet-11,
"Alphabet Review") uses char_build_word to spell out simple, already-familiar
words now that every letter has been introduced.

Idempotent: skips entirely if "hl-alphabet-3" already exists. Adds two new
chapters ("The Alphabet III", "The Alphabet IV") positioned right after the
existing "The Alphabet II" chapter, shifting every later chapter's position
down by 2 to make room (mirrors seed_sounds.py's shift approach).

Triggered via POST /cms/seed/alphabet (CMS-admin only), same pattern as
POST /cms/seed/sounds.
"""

import json
import random
from sqlalchemy import text
from database import engine

_rng = random.Random(20260101)  # fixed seed: deterministic, reproducible reseeds

_XP = {
    "char_intro": 5,
    "audio_choice_tts": 10,
    "letter_recognition": 10,
    "match_pairs": 15,
    "true_false": 10,
    "char_build_word": 15,
}

# Each entry: (LETTER, lower, transliteration, hint, example_word, example_word_translit)
# example_word is real Armenian, always starting with LETTER (except where the
# sound is rare word-initially, noted per-letter), used for the audio_choice_tts
# "hear a word, pick the letter it starts with" exercise.
_LETTERS = [
    ("Զ", "զ", "z", "Like 'z' in 'zoo'.", "զանգ", "bell"),
    ("Է", "է", "e", "A clear 'e', like 'e' in 'bed'.", "էջ", "page"),
    ("Ի", "ի", "i", "Like 'ee' in 'see'.", "իմ", "my"),
    ("Լ", "լ", "l", "Like 'l' in 'love'.", "լավ", "good"),

    ("Հ", "հ", "h", "Like 'h' in 'house'.", "հայր", "father"),
    ("Մ", "մ", "m", "Like 'm' in 'mom'.", "մայր", "mother"),
    ("Ն", "ն", "n", "Like 'n' in 'no'.", "նոր", "new"),
    ("Ս", "ս", "s", "Like 's' in 'sun'.", "սար", "mountain"),

    ("Վ", "վ", "v", "Like 'v' in 'van'.", "վարդ", "rose"),
    ("Շ", "շ", "sh", "Like 'sh' in 'shoe'.", "շուն", "dog"),
    ("Ժ", "ժ", "zh", "Like the 's' in 'measure'.", "ժամ", "hour/clock"),
    ("Ր", "ր", "r", "A single light tongue-tap, like the 'tt' in American 'butter'.", "արև", "sun"),

    ("Տ", "տ", "t", "A crisp, unaspirated 't' — no puff of air, like 't' in 'stop'.", "տուն", "house"),
    ("Թ", "թ", "t'", "A puffed-out 't', like 't' in 'top' said with a burst of air.", "թիվ", "number"),
    ("Պ", "պ", "p", "A crisp, unaspirated 'p' — no puff of air, like 'p' in 'spin'.", "պապ", "grandpa"),
    ("Փ", "փ", "p'", "A puffed-out 'p', like 'p' in 'pat' with a strong burst of air.", "փիղ", "elephant"),

    ("Ք", "ք", "k'", "A puffed-out 'k', like 'k' in 'kite' with a strong burst of air.", "քիթ", "nose"),
    ("Ծ", "ծ", "ts", "A crisp, unaspirated 'ts' — no puff of air, like 'ts' in 'cats'.", "ծառ", "tree"),
    ("Ց", "ց", "ts'", "A puffed-out 'ts', like the previous sound but with extra breath.", "ցուրտ", "cold"),
    ("Ձ", "ձ", "dz", "Like 'dz' in 'adze'.", "ձի", "horse"),

    ("Ճ", "ճ", "ch", "A crisp, unaspirated 'ch' — tenser than English 'ch', no puff of air.", "ճամփա", "road"),
    ("Չ", "չ", "ch'", "A puffed-out 'ch', like 'ch' in 'chip' with extra breath.", "չար", "angry/evil"),
    ("Ջ", "ջ", "j", "Like 'j' in 'jam'.", "ջուր", "water"),
    ("Ղ", "ղ", "gh", "A soft, gargled 'g', like the French 'r' in 'Paris'.", "աղ", "salt"),

    ("Խ", "խ", "kh", "A rasping sound from the throat, like the 'ch' in Scottish 'loch'.", "խոզ", "pig"),
    ("Ռ", "ռ", "rr", "A strongly rolled/trilled 'r' — the tongue taps rapidly.", "առյուծ", "lion"),
    ("Ը", "ը", "uh", "A quick neutral vowel, like the 'a' in 'sofa'. Rarely starts a word.", "ընկեր", "friend"),
    ("Ո", "ո", "o/vo", "Like 'vo' — a light 'v' glide before 'o' at the start of a word.", "ոսկի", "gold"),

    ("Յ", "յ", "y", "Like 'y' in 'yes'.", "յոթ", "seven"),
    ("ՈՒ", "ու", "u", "Like 'oo' in 'moon'. Written with two letters (Ո+Ւ) but is one sound.", "ուսանող", "student"),
    ("և", "և", "ev", "Means 'and' — a special ligature letter used only in this one word.", "և", "and"),
    ("Օ", "օ", "o", "Like 'o' in 'more'. Starts words; mid-word 'o' is usually written ո.", "օր", "day"),
    ("Ֆ", "ֆ", "f", "Like 'f' in 'fun'.", "ֆիլմ", "film"),
]

# Group into lessons of 4 (last lesson gets 5) — this is also the sequencing
# order, chosen to interleave "easy" letters with the Phase-0 triads so a
# triad's three letters (e.g. Պ/Փ/Բ) always land close together.
_LESSON_GROUPS = [
    _LETTERS[0:4],
    _LETTERS[4:8],
    _LETTERS[8:12],
    _LETTERS[12:16],
    _LETTERS[16:20],
    _LETTERS[20:24],
    _LETTERS[24:28],
    _LETTERS[28:33],
]

_REVIEW_WORDS = [
    ("տուն", "house"),
    ("ջուր", "water"),
    ("մայր", "mother"),
    ("լավ", "good"),
    ("հաց", "bread"),
]


def _char_intro(letter, lower, translit, hint):
    return {
        "kind": "char_intro",
        "prompt": f"Meet the letter {letter}",
        "config": {"letter": letter, "lower": lower, "transliteration": translit, "hint": hint},
    }


def _audio_choice(word, correct_letter, translit_word, distractors):
    choices = [correct_letter] + distractors
    order = list(range(len(choices)))
    _rng.shuffle(order)
    shuffled = [choices[i] for i in order]
    return {
        "kind": "audio_choice_tts",
        "prompt": f"Listen — which letter does this word start with? (\"{word}\" = {translit_word})",
        "expected_answer": correct_letter,
        "config": {"ttsText": word, "choices": shuffled, "answerIndex": shuffled.index(correct_letter)},
    }


def _letter_recognition(letter, distractors):
    choices = [letter] + distractors
    _rng.shuffle(choices)
    return {
        "kind": "letter_recognition",
        "prompt": f"Which one is the letter {letter}?",
        "expected_answer": letter,
        "config": {"choices": choices},
    }


def _match_pairs(group):
    return {
        "kind": "match_pairs",
        "prompt": "Match each letter to its sound.",
        "config": {"pairs": [{"left": l, "right": t} for (l, _lo, t, *_rest) in group]},
    }


def _true_false(letter, translit, hint, correct=True):
    if correct:
        statement = f"The letter {letter} makes the sound '{translit}' — {hint}"
    else:
        statement = f"The letter {letter} makes the sound '{translit}'."
    return {
        "kind": "true_false",
        "prompt": "True or False?",
        "config": {"correct": correct, "statement": statement},
    }


def _char_build_word(word, translit):
    # Shuffle tile order so tapping them in the order shown isn't a free win —
    # solutionIndices records which shuffled-tile position spells the word,
    # resolved by original letter position (not by character) so repeated
    # letters in a word don't collide.
    order = list(range(len(word)))
    _rng.shuffle(order)
    tiles = [word[i] for i in order]
    pos_of_tile = {orig_idx: tile_idx for tile_idx, orig_idx in enumerate(order)}
    solution_indices = [pos_of_tile[i] for i in range(len(word))]
    return {
        "kind": "char_build_word",
        "prompt": "Spell the word.",
        "config": {
            "tiles": tiles,
            "solutionIndices": solution_indices,
            "targetWord": word,
        },
        "expected_answer": word,
    }


def _build_lessons():
    lessons = []
    taught_pool = ["Ա", "Բ", "Գ", "Դ", "Ե", "Կ"]  # already live in hl-alphabet-1/2

    for i, group in enumerate(_LESSON_GROUPS, start=3):
        exercises = []
        for letter, lower, translit, hint, word, word_en in group:
            exercises.append(_char_intro(letter, lower, translit, hint))

        # audio_choice_tts for the first two letters in the group
        for letter, lower, translit, hint, word, word_en in group[:2]:
            others = [l for l in taught_pool if l != letter]
            distractors = (others + [g[0] for g in group if g[0] != letter])[:3]
            exercises.append(_audio_choice(word, letter, word_en, distractors))

        taught_pool = taught_pool + [g[0] for g in group]

        # letter_recognition for the last two letters in the group
        for letter, lower, translit, hint, word, word_en in group[-2:]:
            others = [l for l in taught_pool if l != letter]
            distractors = others[-3:] if len(others) >= 3 else others
            exercises.append(_letter_recognition(letter, distractors))

        exercises.append(_match_pairs(group))
        first = group[0]
        exercises.append(_true_false(first[0], first[2], first[3], correct=True))

        for idx, ex in enumerate(exercises, start=1):
            ex["order"] = idx
            ex["xp"] = _XP[ex["kind"]]

        lessons.append({
            "slug": f"hl-alphabet-{i}",
            "title": f"Letters: {' '.join(g[0] for g in group)}",
            "exercises": exercises,
        })

    # Capstone review lesson
    review_exercises = [_char_build_word(w, en) for w, en in _REVIEW_WORDS]
    for idx, ex in enumerate(review_exercises, start=1):
        ex["order"] = idx
        ex["xp"] = _XP[ex["kind"]]
    lessons.append({
        "slug": "hl-alphabet-11",
        "title": "Alphabet Review",
        "exercises": review_exercises,
    })

    return lessons


def seed_alphabet_phase():
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM lessons WHERE slug = 'hl-alphabet-3'")
        ).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "hl-alphabet-3 already exists"}

        # Make room: shift every chapter at position >= 7 down by 2.
        conn.execute(text("UPDATE chapters SET position = position + 1000 WHERE position >= 7"))
        conn.execute(text("UPDATE chapters SET position = position - 998 WHERE position >= 1007"))

        chapter3_id = conn.execute(
            text("SELECT id FROM chapters WHERE title = 'The Alphabet III'")
        ).scalar()
        if not chapter3_id:
            chapter3_id = conn.execute(
                text("""INSERT INTO chapters (title, position, is_published)
                        VALUES ('The Alphabet III', 7, TRUE) RETURNING id""")
            ).scalar()

        chapter4_id = conn.execute(
            text("SELECT id FROM chapters WHERE title = 'The Alphabet IV'")
        ).scalar()
        if not chapter4_id:
            chapter4_id = conn.execute(
                text("""INSERT INTO chapters (title, position, is_published)
                        VALUES ('The Alphabet IV', 8, TRUE) RETURNING id""")
            ).scalar()

        lessons = _build_lessons()
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()

        created_lessons = 0
        created_exercises = 0

        for li, lesson in enumerate(lessons):
            chapter_id = chapter3_id if li < 4 else chapter4_id
            lesson_xp = sum(ex["xp"] for ex in lesson["exercises"])
            max_level += 1
            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard')
                    RETURNING id
                """),
                {"slug": lesson["slug"], "title": lesson["title"], "level": max_level,
                 "xp": lesson_xp, "chapter_id": chapter_id},
            ).scalar()
            created_lessons += 1

            for ex in lesson["exercises"]:
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, expected_answer, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :expected_answer, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {
                        "lesson_id": lesson_id,
                        "kind": ex["kind"],
                        "prompt": ex["prompt"],
                        "expected_answer": ex.get("expected_answer"),
                        "order": ex["order"],
                        "xp": ex["xp"],
                        "config": json.dumps(ex["config"]),
                    },
                )
                created_exercises += 1

        return {
            "ok": True,
            "chapters_created": [chapter3_id, chapter4_id],
            "lessons_created": created_lessons,
            "exercises_created": created_exercises,
        }
