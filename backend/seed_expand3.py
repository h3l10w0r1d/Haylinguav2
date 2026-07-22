# backend/seed_expand3.py
"""
Volume expansion, round 3 — reading exercises. flu-reading had exactly one
passage (about "Ani") reused across all 8 of its reading_comprehension
questions; this adds two brand-new passages so learners see different
reading material, not the same paragraph nine times.

Every sentence in both new passages is a taught form or exact sentence
already used elsewhere in the curriculum — not new vocabulary:
  - "Իմ անունը ... է" / "Ես հայերեն եմ սովորում" — hl-phrases (write_translate
    solution, sentence_order solution)
  - "Իմ ընտանիքը մեծ է" — the existing flu-reading passage
  - "Երկինքը ... է" (sky is ___) — hl-colors select_missing_word template
  - "Ես խմում եմ ___" — hl-food select_missing_word template
  - "Բարի առավոտ" — hl-time select_missing_word answer
  - "կաշխատեմ" (I will work) — gr-pastfut-2
  - "Որտեղ է կայարանը" / "Թեքվեք աջ" — hl-travel select_missing_word /
    word_bank solutions
  - number words, "ոչ", colors/food vocab — hl-numbers, hl-greetings, hl-food

Idempotent: skips flu-reading once it already has >= 18 exercises (it had
9 before this run). Triggered via POST /cms/seed/expand3.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"reading_comprehension": 15, "true_false": 10, "match_pairs": 15}


def _reading(passage, question, choices, answer_index):
    return {"kind": "reading_comprehension", "prompt": question,
            "config": {"passage": passage, "question": question, "choices": choices, "answerIndex": answer_index}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


_PASSAGE_B = (
    "Բարի առավոտ! Իմ անունը Լիլիթ է. Երկինքը կապույտ է այսօր. "
    "Ես խմում եմ թեյ. Իմ ընտանիքը մեծ է. Վաղը ես կաշխատեմ."
)

_PASSAGE_C = "Որտեղ է կայարանը: Թեքվեք աջ, ոչ ձախ: Մեկ, երկու, երեք:"

_EXTRAS = {
    "flu-reading": [
        _reading(_PASSAGE_B, "What color is the sky in the passage?",
                 ["Red", "Blue", "Green", "Yellow"], 1),
        _reading(_PASSAGE_B, "What does Lilit drink?",
                 ["Water", "Milk", "Tea", "Coffee"], 2),
        _reading(_PASSAGE_B, "Is Lilit's family big or small?",
                 ["Big", "Small", "Not mentioned", "Medium"], 0),
        _reading(_PASSAGE_B, "What will Lilit do tomorrow?",
                 ["Work", "Travel", "Sleep", "Cook"], 0),
        _tf("The passage says Lilit drinks water.", correct=False),
        _match([("կապույտ", "blue"), ("առավոտ", "morning"),
                ("ընտանիք", "family"), ("կաշխատեմ", "I will work")]),
        _reading(_PASSAGE_C, "Where is being asked about?",
                 ["The station", "The airport", "The city", "The road"], 0),
        _reading(_PASSAGE_C, "Which direction should you turn?",
                 ["Left", "Right", "Straight", "Back"], 1),
        _reading(_PASSAGE_C, "Which number comes right after “երկու”?",
                 ["մեկ", "երեք", "չորս", "հինգ"], 1),
        _tf("The passage says to turn left.", correct=False),
        _match([("կայարան", "station"), ("աջ", "right"),
                ("ձախ", "left"), ("երեք", "three")]),
    ],
}


def seed_expand3():
    with engine.begin() as conn:
        expanded, skipped, created_exercises = [], [], 0

        for slug, extras in _EXTRAS.items():
            row = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not row:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue
            lesson_id = row["id"]

            count = conn.execute(
                text("SELECT COUNT(*) FROM exercises WHERE lesson_id = :lid"), {"lid": lesson_id}
            ).scalar()
            if count >= 18:
                skipped.append({"slug": slug, "reason": f"already has {count} exercises"})
                continue

            max_order = conn.execute(
                text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
                {"lid": lesson_id},
            ).scalar()

            for idx, ex in enumerate(extras, start=1):
                xp = _XP[ex["kind"]]
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lesson_id, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": max_order + idx, "xp": xp, "config": json.dumps(ex["config"])},
                )
                created_exercises += 1

            conn.execute(
                text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                          xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                        WHERE id = :lid"""),
                {"lid": lesson_id},
            )
            expanded.append(slug)

        return {"ok": True, "expanded": expanded, "skipped": skipped,
                "exercises_created": created_exercises}
