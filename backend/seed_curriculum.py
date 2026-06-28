# backend/seed_curriculum.py
"""
Seed a full beginner Armenian curriculum: 10 chapters, each with one lesson of
5 exercises (50 exercises total).

Idempotent: it namespaces its lessons with the "hl-" slug prefix and skips
entirely if that content already exists, so it never duplicates rows and never
clobbers edits made later in the CMS. Runs on startup only when
SEED_ON_STARTUP=true (same gate as seed_alphabet_lessons).

Exercises are deliberately mostly tap-based (MCQ / match / order / word-bank)
so learners don't need an Armenian keyboard.
"""

import json
from sqlalchemy import text
from database import engine

# XP per exercise kind.
_XP = {
    "char_intro": 5,
    "letter_recognition": 10,
    "translate_mcq": 10,
    "true_false": 10,
    "select_missing_word": 10,
    "match_pairs": 15,
    "sentence_order": 15,
    "word_bank": 15,
}


def ci(letter, lower, translit, hint):
    return {"kind": "char_intro", "prompt": f"Meet the letter {letter}", "config": {"letter": letter, "lower": lower, "transliteration": translit, "hint": hint}}

def lr(prompt, choices, answer):
    return {"kind": "letter_recognition", "prompt": prompt, "expected_answer": answer, "config": {"choices": choices}}

def tm(prompt, sentence, choices, answer_index):
    return {"kind": "translate_mcq", "prompt": prompt, "config": {"sentence": sentence, "choices": choices, "answerIndex": answer_index}}

def tf(statement, correct):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"statement": statement, "correct": bool(correct)}}

def smw(prompt, before, after, choices, answer_index):
    return {"kind": "select_missing_word", "prompt": prompt, "config": {"before": before, "after": after, "choices": choices, "answerIndex": answer_index}}

def mp(prompt, pairs):
    return {"kind": "match_pairs", "prompt": prompt, "config": {"pairs": [{"left": l, "right": r} for (l, r) in pairs]}}

def so(prompt, tokens, solution):
    return {"kind": "sentence_order", "prompt": prompt, "config": {"tokens": tokens, "solution": solution}}

def wb(prompt, sentence, tiles, solution):
    return {"kind": "word_bank", "prompt": prompt, "config": {"sentence": sentence, "tiles": tiles, "solution": solution}}


# (chapter_title, chapter_description, lesson_slug, lesson_title, [5 exercises])
CURRICULUM = [
    ("The Alphabet I", "Your very first Armenian letters.", "hl-alphabet-1", "First Letters", [
        ci("Ա", "ա", "a", "Like 'a' in 'father'."),
        ci("Բ", "բ", "b", "Like 'b' in 'boy'."),
        ci("Գ", "գ", "g", "Like 'g' in 'go'."),
        lr("Which one is the letter Ա?", ["Բ", "Ա", "Գ", "Դ"], "Ա"),
        mp("Match each letter to its sound.", [("Ա", "a"), ("Բ", "b"), ("Գ", "g")]),
    ]),
    ("The Alphabet II", "A few more letters and their sounds.", "hl-alphabet-2", "More Letters", [
        ci("Դ", "դ", "d", "Like 'd' in 'dog'."),
        ci("Ե", "ե", "e/ye", "Like 'ye' at the start of a word."),
        ci("Կ", "կ", "k", "Like 'k' in 'kite'."),
        lr("Which one is the letter Կ?", ["Կ", "Ե", "Դ", "Բ"], "Կ"),
        tf("The letter Գ makes the sound 'g' (as in 'go').", True),
    ]),
    ("Greetings", "Say hello, thanks and goodbye.", "hl-greetings", "Hello & Thanks", [
        tm("How do you say “Hello”?", "Hello", ["Բարև", "Շնորհակալություն", "Ցտեսություն", "Այո"], 0),
        tm("How do you say “Thank you”?", "Thank you", ["Խնդրեմ", "Շնորհակալություն", "Ոչ", "Բարև"], 1),
        mp("Match the greeting to its meaning.", [("Բարև", "Hello"), ("Ցտեսություն", "Goodbye"), ("Այո", "Yes"), ("Ոչ", "No")]),
        smw("Complete the polite greeting (“Hello” formal).", "Բարև", "", ["ձեզ", "դու", "ես"], 0),
        tf("«Ոչ» means “yes”.", False),
    ]),
    ("Numbers 1–10", "Count from one to ten.", "hl-numbers", "Counting", [
        mp("Match the number word to the digit.", [("մեկ", "1"), ("երկու", "2"), ("երեք", "3"), ("չորս", "4")]),
        tm("How do you say “three”?", "three", ["երկու", "երեք", "չորս", "հինգ"], 1),
        tm("How do you say “five”?", "five", ["հինգ", "վեց", "յոթ", "ութ"], 0),
        so("Put the numbers in order: one, two, three.", ["երեք", "մեկ", "երկու"], ["մեկ", "երկու", "երեք"]),
        smw("Fill the gap: մեկ, __, երեք.", "մեկ,", ", երեք", ["երկու", "չորս", "հինգ"], 0),
    ]),
    ("Family", "Talk about your family.", "hl-family", "People at Home", [
        mp("Match the family word to its meaning.", [("մայր", "mother"), ("հայր", "father"), ("քույր", "sister"), ("եղբայր", "brother")]),
        tm("How do you say “mother”?", "mother", ["հայր", "մայր", "քույր", "տատիկ"], 1),
        tm("How do you say “grandmother”?", "grandmother", ["պապիկ", "տատիկ", "երեխա", "ընտանիք"], 1),
        tf("«Ընտանիք» means “family”.", True),
        wb("Build: “my family”.", "my family", ["իմ", "ընտանիք", "ընկեր"], ["իմ", "ընտանիք"]),
    ]),
    ("Food & Drink", "Order the basics.", "hl-food", "At the Table", [
        mp("Match the food/drink to its meaning.", [("հաց", "bread"), ("ջուր", "water"), ("կաթ", "milk"), ("պանիր", "cheese")]),
        tm("How do you say “water”?", "water", ["կաթ", "ջուր", "սուրճ", "թեյ"], 1),
        tm("How do you say “apple”?", "apple", ["խնձոր", "հաց", "միս", "պանիր"], 0),
        smw("Pick the drink: “I drink ___ (coffee).”", "Ես խմում եմ", "", ["սուրճ", "հաց", "միս"], 0),
        tf("«Թեյ» means “tea”.", True),
    ]),
    ("Colors", "Name the colors.", "hl-colors", "Colors", [
        mp("Match the color to its meaning.", [("կարմիր", "red"), ("կապույտ", "blue"), ("կանաչ", "green"), ("դեղին", "yellow")]),
        tm("How do you say “red”?", "red", ["կանաչ", "կարմիր", "սև", "սպիտակ"], 1),
        tm("How do you say “black”?", "black", ["սպիտակ", "դեղին", "սև", "կապույտ"], 2),
        tf("«Կանաչ» means “green”.", True),
        smw("Pick the color: “The sky is ___ (blue).”", "Երկինքը", "է", ["կապույտ", "կարմիր", "դեղին"], 0),
    ]),
    ("Days & Time", "Today, tomorrow and more.", "hl-time", "Days & Time", [
        mp("Match the time word to its meaning.", [("այսօր", "today"), ("վաղը", "tomorrow"), ("առավոտ", "morning"), ("գիշեր", "night")]),
        tm("How do you say “today”?", "today", ["վաղը", "այսօր", "շաբաթ", "օր"], 1),
        tm("How do you say “week”?", "week", ["օր", "շաբաթ", "գիշեր", "առավոտ"], 1),
        tf("«Վաղը» means “yesterday”.", False),
        smw("Complete: “Good ___ (morning).”", "Բարի", "", ["առավոտ", "գիշեր", "օր"], 0),
    ]),
    ("Everyday Phrases", "Handy sentences for real conversations.", "hl-phrases", "Useful Phrases", [
        tm("Which means “I don't understand”?", "I don't understand", ["Չեմ հասկանում", "Շնորհակալություն", "Ներողություն", "Այո"], 0),
        tm("Which means “Sorry / Excuse me”?", "Sorry / Excuse me", ["Բարև", "Ներողություն", "Խնդրեմ", "Ոչ"], 1),
        wb("Build: “My name is Armen.”", "My name is Armen", ["Իմ", "անունը", "Արմեն", "է", "քո"], ["Իմ", "անունը", "Արմեն", "է"]),
        so("Arrange: “I am learning Armenian.”", ["սովորում", "Ես", "հայերեն", "եմ"], ["Ես", "հայերեն", "եմ", "սովորում"]),
        tf("«Խնդրեմ» can mean “please” or “you're welcome”.", True),
    ]),
    ("Travel & Directions", "Find your way around.", "hl-travel", "Getting Around", [
        mp("Match the word to its meaning.", [("աջ", "right"), ("ձախ", "left"), ("ուղիղ", "straight"), ("որտեղ", "where")]),
        tm("How do you say “left”?", "left", ["աջ", "ձախ", "ուղիղ", "որտեղ"], 1),
        tm("How do you say “station”?", "station", ["օդանավակայան", "կայարան", "քաղաք", "ճանապարհ"], 1),
        smw("Complete: “Where is the ___? (station)”", "Որտեղ է", "?", ["կայարանը", "ձախ", "աջ"], 0),
        wb("Build: “Turn right.”", "Turn right", ["Թեքվեք", "աջ", "ձախ"], ["Թեքվեք", "աջ"]),
    ]),
]


def seed_curriculum() -> None:
    with engine.begin() as conn:
        # Skip if our namespaced content already exists (idempotent, edit-safe).
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug LIKE 'hl-%' LIMIT 1")).scalar()
        if exists:
            print("[seed_curriculum] Curriculum already present; skipping.")
            return

        print("[seed_curriculum] Seeding 10 chapters / 50 exercises...")
        for pos, (ch_title, ch_desc, slug, l_title, exercises) in enumerate(CURRICULUM, start=1):
            chapter_id = conn.execute(
                text("""
                    INSERT INTO chapters (title, description, position, is_published)
                    VALUES (:t, :d, :p, TRUE) RETURNING id
                """),
                {"t": ch_title, "d": ch_desc, "p": pos},
            ).scalar_one()

            lesson_xp = sum(_XP.get(e["kind"], 10) for e in exercises)
            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config, chapter_id)
                    VALUES (:slug, :title, :desc, :level, :xp, :xp, TRUE, 'standard', '{}'::jsonb, :cid)
                    RETURNING id
                """),
                {"slug": slug, "title": l_title, "desc": ch_desc, "level": pos, "xp": lesson_xp, "cid": chapter_id},
            ).scalar_one()

            for order, ex in enumerate(exercises, start=1):
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, type, kind, prompt, expected_answer, "order", xp, config)
                        VALUES (:lid, :type, :kind, :prompt, :expected, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {
                        "lid": lesson_id,
                        "type": ex["kind"],
                        "kind": ex["kind"],
                        "prompt": ex.get("prompt", ""),
                        "expected": ex.get("expected_answer"),
                        "order": order,
                        "xp": _XP.get(ex["kind"], 10),
                        "config": json.dumps(ex.get("config", {})),
                    },
                )

        print("[seed_curriculum] Done.")
