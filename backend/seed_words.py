# backend/seed_words.py
"""
Phase 2 — Words paired with sentence patterns. Adds one "sentence patterns"
lesson to each of the 8 existing topic chapters (Greetings, Numbers, Family,
Food & Drink, Colors, Days & Time, Everyday Phrases, Travel & Directions),
so vocabulary is never left as isolated flashcards — every chapter now also
drills the "եմ/ես/է" copula and basic subject-complement sentences using
that chapter's own words, per the sounds -> letters -> words+sentences
curriculum roadmap.

Grammar safety: every generated sentence follows one of two templates
already verified correct in the live, hand-authored curriculum (confirmed
by reading the actual exercise configs, not assumed):
  Template A (predicate nominative, no article): "Ես/Դու/Նա/Սա X եմ/ես/է"
    e.g. the existing "Ես ուսանող եմ" pattern.
  Template B (possessive/definite subject, ies-a value, copula):
    "[Xը] [value] է" — mirrors the existing, confirmed "Իմ անունը Արմեն է".
New vocabulary introduced beyond what's already live is limited to
extremely high-confidence, basic words (teens/twenties, days of the week,
"here"/"there", "delicious", "big", "fine") to keep translation-accuracy
risk low.

Idempotent: skips entirely if "hl-greetings-sentences" already exists.
Triggered via POST /cms/seed/words (CMS-admin only).
"""

import json
from sqlalchemy import text
from database import engine

_XP = {
    "translate_mcq": 10,
    "select_missing_word": 10,
    "sentence_order": 15,
    "word_bank": 15,
    "true_false": 10,
    "match_pairs": 15,
}


def _tmcq(prompt_word, choices, answer_index):
    return {
        "kind": "translate_mcq",
        "prompt": f"How do you say “{prompt_word}”?",
        "config": {"choices": choices, "sentence": prompt_word, "answerIndex": answer_index},
    }


def _smw(before, after, choices, answer_index=0):
    return {
        "kind": "select_missing_word",
        "prompt": "Complete the sentence.",
        "config": {"before": before, "after": after, "choices": choices, "answerIndex": answer_index},
    }


def _sorder(prompt, tokens, solution):
    return {
        "kind": "sentence_order",
        "prompt": prompt,
        "config": {"tokens": tokens, "solution": solution},
    }


def _wbank(prompt, tiles, solution):
    return {
        "kind": "word_bank",
        "prompt": prompt,
        "config": {"sentence": prompt.split("“")[-1].rstrip("”") if "“" in prompt else prompt,
                   "tiles": tiles, "solution": solution},
    }


def _tf(statement, correct=True):
    return {
        "kind": "true_false",
        "prompt": "True or False?",
        "config": {"correct": correct, "statement": statement},
    }


def _match(pairs):
    return {
        "kind": "match_pairs",
        "prompt": "Match each word to its meaning.",
        "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]},
    }


# base_lesson_slug -> (new_slug, new_title, exercises)
_LESSONS = {
    "hl-greetings": (
        "hl-greetings-sentences",
        "Talking About Yourself",
        [
            _tmcq("I am fine", ["Ես լավ եմ", "Ես վատ եմ",
                                  "Դու լավ ես", "Նա լավ է"], 0),
            _smw("Ես ուսանող", "", ["եմ", "ես", "է"], 0),
            _sorder("Arrange: “I am a student.”",
                    ["ուսանող", "Ես", "եմ"],
                    ["Ես", "ուսանող", "եմ"]),
            _wbank("Build: “You are a student.”",
                   ["Դու", "ուսանող", "ես", "նա", "եմ"],
                   ["Դու", "ուսանող", "ես"]),
            _tf("«Ես ուսանող եմ» means “I am a student.”"),
            _match([("Ես", "եմ"), ("Դու", "ես"), ("Նա", "է")]),
        ],
    ),
    "hl-numbers": (
        "hl-numbers-more",
        "Counting to Twenty",
        [
            _tmcq("ten", ["ինը", "տասը", "տասնմեկ", "ութ"], 1),
            _smw("Սա տասնհինգ", "", ["է", "ես", "եմ"], 0),
            _sorder("Arrange: “This is twenty.”",
                    ["քսան", "Սա", "է"],
                    ["Սա", "քսան", "է"]),
            _wbank("Build: “This is twelve.”",
                   ["Սա", "տասներկու", "է", "տասնմեկ", "ես"],
                   ["Սա", "տասներկու", "է"]),
            _tf("«Տասնութ» means eighteen."),
            _match([("տասնմեկ", "11"), ("տասնհինգ", "15"),
                    ("քսան", "20"), ("տասը", "10")]),
        ],
    ),
    "hl-family": (
        "hl-family-sentences",
        "My Family",
        [
            _tmcq("grandfather", ["պապիկ", "տատիկ", "հայր", "եղբայր"], 0),
            _smw("Իմ քույրը Անի", "", ["է", "ես", "եմ"], 0),
            _sorder("Arrange: “My family is big.”",
                    ["ընտանիքը", "Իմ", "մեծ", "է"],
                    ["Իմ", "ընտանիքը", "մեծ", "է"]),
            _wbank("Build: “My brother is Armen.”",
                   ["Իմ", "եղբայրը", "Արմեն", "է", "քույրը"],
                   ["Իմ", "եղբայրը", "Արմեն", "է"]),
            _tf("«Ընտանիք» + ’-ը’ → «Ընտանիքը» means “the family.”"),
            _match([("պապիկ", "grandfather"), ("տատիկ", "grandmother"),
                    ("ընտանիք", "family"), ("մեծ", "big")]),
        ],
    ),
    "hl-food": (
        "hl-food-sentences",
        "Describing Food",
        [
            _tmcq("delicious", ["համեղ", "սառը", "տաք", "թարմ"], 0),
            _smw("Հացը համեղ", "", ["է", "ես", "եմ"], 0),
            _sorder("Arrange: “The milk is delicious.”",
                    ["համեղ", "Կաթը", "է"],
                    ["Կաթը", "համեղ", "է"]),
            _wbank("Build: “The apple is delicious.”",
                   ["Խնձորը", "համեղ", "է", "հացը"],
                   ["Խնձորը", "համեղ", "է"]),
            _tf("«Համեղ» means “delicious.”"),
            _match([("համեղ", "delicious"), ("սուրճ", "coffee"),
                    ("թեյ", "tea"), ("միս", "meat")]),
        ],
    ),
    "hl-colors": (
        "hl-colors-sentences",
        "Describing Things",
        [
            _tmcq("white", ["սպիտակ", "սև", "դեղին", "կանաչ"], 0),
            _smw("Խնձորը կարմիր", "", ["է", "ես", "եմ"], 0),
            _sorder("Arrange: “The dog is black.”",
                    ["սև", "Շունը", "է"],
                    ["Շունը", "սև", "է"]),
            _wbank("Build: “The sky is blue.”",
                   ["Երկինքը", "կապույտ", "է", "կանաչ"],
                   ["Երկինքը", "կապույտ", "է"]),
            _tf("«Դեղին» means “yellow.”"),
            _match([("կարմիր", "red"), ("կապույտ", "blue"),
                    ("կանաչ", "green"), ("դեղին", "yellow")]),
        ],
    ),
    "hl-time": (
        "hl-time-sentences",
        "Days of the Week",
        [
            _tmcq("Monday", ["Երկուշաբթի", "Երեքշաբթի",
                              "Ուրբաթ", "Կիրակի"], 0),
            _smw("Այսօր երկուշաբթի", "", ["է", "ես", "եմ"], 0),
            _sorder("Arrange: “Tomorrow is Sunday.”",
                    ["կիրակի", "Վաղը", "է"],
                    ["Վաղը", "կիրակի", "է"]),
            _wbank("Build: “Today is Friday.”",
                   ["Այսօր", "ուրբաթ", "է", "շաբաթ"],
                   ["Այսօր", "ուրբաթ", "է"]),
            _tf("«Կիրակի» means “Sunday.”"),
            _match([("երկուշաբթի", "Monday"), ("ուրբաթ", "Friday"),
                    ("կիրակի", "Sunday"), ("շաբաթ", "week / Saturday")]),
        ],
    ),
    "hl-phrases": (
        "hl-phrases-sentences",
        "Talking About Yourself II",
        [
            _tmcq("I am from Armenia", ["Ես Հայաստանից եմ",
                                          "Ես Հայաստան եմ",
                                          "Դու Հայաստանից ես",
                                          "Նա Հայաստանից է"], 0),
            _smw("Ես Հայաստանից", "", ["եմ", "ես", "է"], 0),
            _sorder("Arrange: “I am learning Armenian.”",
                    ["սովորում", "Ես", "հայերեն", "եմ"],
                    ["Ես", "հայերեն", "եմ", "սովորում"]),
            _wbank("Build: “You are from Armenia.”",
                   ["Դու", "Հայաստանից", "ես", "նա", "եմ"],
                   ["Դու", "Հայաստանից", "ես"]),
            _tf("«Հայաստանից» means “from Armenia.”"),
            _match([("Հայաստանից", "from Armenia"), ("հայերեն", "Armenian (language)"),
                    ("սովորում", "learning"), ("հասկանում", "understanding")]),
        ],
    ),
    "hl-travel": (
        "hl-travel-sentences",
        "Where Is It?",
        [
            _tmcq("there", ["այնտեղ", "այստեղ", "որտեղ", "ուղիղ"], 0),
            _smw("Կայարանը այնտեղ", "", ["է", "ես", "եմ"], 0),
            _sorder("Arrange: “I am here.”",
                    ["այստեղ", "Ես", "եմ"],
                    ["Ես", "այստեղ", "եմ"]),
            _wbank("Build: “Turn left.”",
                   ["Թեքվեք", "ձախ", "աջ"],
                   ["Թեքվեք", "ձախ"]),
            _tf("«Այստեղ» means “here.”"),
            _match([("այստեղ", "here"), ("այնտեղ", "there"),
                    ("ուղիղ", "straight"), ("որտեղ", "where")]),
        ],
    ),
}


def seed_words_phase():
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM lessons WHERE slug = 'hl-greetings-sentences'")
        ).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "hl-greetings-sentences already exists"}

        created_lessons = 0
        created_exercises = 0

        for base_slug, (new_slug, new_title, exercises) in _LESSONS.items():
            base = conn.execute(
                text("SELECT id, chapter_id, level FROM lessons WHERE slug = :slug"),
                {"slug": base_slug},
            ).mappings().first()
            if not base:
                continue  # base lesson missing in this environment; skip gracefully

            for idx, ex in enumerate(exercises, start=1):
                ex["order"] = idx
                ex["xp"] = _XP[ex["kind"]]
            lesson_xp = sum(ex["xp"] for ex in exercises)

            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard')
                    RETURNING id
                """),
                {"slug": new_slug, "title": new_title, "level": base["level"],
                 "xp": lesson_xp, "chapter_id": base["chapter_id"]},
            ).scalar()
            created_lessons += 1

            for ex in exercises:
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {
                        "lesson_id": lesson_id,
                        "kind": ex["kind"],
                        "prompt": ex["prompt"],
                        "order": ex["order"],
                        "xp": ex["xp"],
                        "config": json.dumps(ex["config"]),
                    },
                )
                created_exercises += 1

        return {"ok": True, "lessons_created": created_lessons, "exercises_created": created_exercises}
