# backend/seed_rework_vowels.py
"""
snd-vowels-1 rework, round 2 — after the copy/emoji pass (seed_enrich_sounds.py)
the user asked for the exercise TYPES themselves to be reworked, not just
varied text. The lesson was minimal_pairs x7 + speak x5 in blocky runs (3
minimal_pairs in a row, then a speak, etc.), and 2 of the 7 sound pairs
(jur/water, mis/meat) had no speak practice at all — an accidental gap, not
a design choice.

This does three things:
1. Adds the 2 missing speak exercises (say "water" / say "meat") so every
   sound pair gets the same listen -> discriminate -> produce treatment.
2. Adds 3 true_false meaning-check exercises as a genuinely different
   interaction (tap True/False vs pick-from-3), using the romanized style
   already established for this lesson (real script only appears once you
   reach a speak exercise, matching the existing pattern) and testing the
   meaning payoff seed_enrich_sounds.py already attached.
3. Reorders every exercise into interleaved pairs — minimal_pairs then its
   matching speak, with a true_false checkpoint every couple of pairs —
   instead of running the same kind 2-3 times back to back.

Idempotent: skips entirely if a speak exercise for "water" already exists
in this lesson. Triggered via POST /cms/seed/rework-vowels.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"speak": 15, "true_false": 10}

_LESSON_SLUG = "snd-vowels-1"

_NEW_SPEAK = [
    # (prompt, expected_answer, transliteration)
    ("Say \"water\".", "ջուր", "jur"),
    ("Say \"meat\".", "միս", "mis"),
]

_NEW_TF = [
    ("«hats» means bread.", True),
    ("«jur» means finger.", False),
    ("«dzu» means egg.", True),
]

# Final interleaved order, referenced by existing exercise id or a
# placeholder key for the newly-inserted ones (resolved after insert).
_ORDER_PLAN = [
    "mp:611", "sp:614", "mp:612", "sp:new:water", "tf:new:0",
    "mp:613", "sp:new:meat", "mp:615", "sp:617", "tf:new:1",
    "mp:616", "sp:618", "mp:619", "sp:621", "tf:new:2",
    "mp:620", "sp:622",
]


def seed_rework_vowels():
    with engine.begin() as conn:
        lesson = conn.execute(
            text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": _LESSON_SLUG}
        ).mappings().first()
        if not lesson:
            return {"ok": False, "reason": "lesson not found"}
        lesson_id = lesson["id"]

        exists = conn.execute(
            text("SELECT 1 FROM exercises WHERE lesson_id = :lid AND kind = 'speak' AND config->>'transliteration' = 'jur'"),
            {"lid": lesson_id},
        ).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "already reworked"}

        max_order = conn.execute(
            text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
            {"lid": lesson_id},
        ).scalar()

        new_speak_ids = {}
        for i, (prompt, answer, translit) in enumerate(_NEW_SPEAK):
            cfg = {"language_code": "hye", "acceptedAnswers": [], "transliteration": translit}
            new_id = conn.execute(
                text("""
                    INSERT INTO exercises (lesson_id, kind, prompt, expected_answer, "order", xp, config)
                    VALUES (:lesson_id, 'speak', :prompt, :answer, :order, :xp, CAST(:config AS jsonb))
                    RETURNING id
                """),
                {"lesson_id": lesson_id, "prompt": prompt, "answer": answer,
                 "order": max_order + 1 + i, "xp": _XP["speak"], "config": json.dumps(cfg)},
            ).scalar()
            key = "water" if translit == "jur" else "meat"
            new_speak_ids[key] = new_id

        new_tf_ids = []
        for i, (statement, correct) in enumerate(_NEW_TF):
            cfg = {"correct": correct, "statement": statement}
            new_id = conn.execute(
                text("""
                    INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                    VALUES (:lesson_id, 'true_false', 'True or False?', :order, :xp, CAST(:config AS jsonb))
                    RETURNING id
                """),
                {"lesson_id": lesson_id, "order": max_order + 1 + len(_NEW_SPEAK) + i, "xp": _XP["true_false"],
                 "config": json.dumps(cfg)},
            ).scalar()
            new_tf_ids.append(new_id)

        def resolve(token):
            # "sp:new:water" / "tf:new:0" are the newly-inserted rows;
            # everything else ("mp:611" / "sp:614") is an existing id.
            if token.startswith("sp:new:"):
                return new_speak_ids[token.split(":")[2]]
            if token.startswith("tf:new:"):
                return new_tf_ids[int(token.split(":")[2])]
            _, rest = token.split(":", 1)
            return int(rest)

        for new_order, token in enumerate(_ORDER_PLAN, start=1):
            ex_id = resolve(token)
            conn.execute(
                text('UPDATE exercises SET "order" = :o WHERE id = :id'),
                {"o": new_order, "id": ex_id},
            )

        conn.execute(
            text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                      xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                    WHERE id = :lid"""),
            {"lid": lesson_id},
        )

        return {
            "ok": True,
            "speak_added": list(new_speak_ids.values()),
            "true_false_added": new_tf_ids,
            "total_exercises": len(_ORDER_PLAN),
        }
