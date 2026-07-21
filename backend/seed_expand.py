# backend/seed_expand.py
"""
Volume expansion — tops up the 8 core vocabulary lessons (hl-greetings ..
hl-travel, currently ~5 exercises each) toward Duolingo-length sessions by
mechanically generating extra drills from vocabulary that is ALREADY live
and verified in those same lessons. No new words, no new grammar — just
more repetitions in more directions per word:

  - reverse translate MCQs (Armenian -> English, the live ones are En->Hy)
  - audio recognition (hear the word, pick it) via audio_choice_tts
  - true/false meaning checks (one true, one deliberately wrong pairing)
  - one extra match_pairs over a different slice of the word list

Deterministic (no randomness) so reseeding produces identical content.
Idempotent per lesson: any lesson that already has >= 10 exercises is
skipped, so this can run safely after future manual additions too.
Triggered via POST /cms/seed/expand.
"""

import json
from sqlalchemy import text
from database import engine

# slug -> list of (armenian, english) pairs, copied verbatim from the live,
# already-verified exercises of that same lesson's chapter.
_VOCAB = {
    "hl-greetings": [
        ("Բարև", "hello"), ("Ցտեսություն", "goodbye"), ("Այո", "yes"),
        ("Ոչ", "no"), ("Շնորհակալություն", "thank you"), ("Ներողություն", "sorry / excuse me"),
    ],
    "hl-numbers": [
        ("մեկ", "one"), ("երկու", "two"), ("երեք", "three"),
        ("չորս", "four"), ("հինգ", "five"), ("տասը", "ten"),
    ],
    "hl-family": [
        ("մայր", "mother"), ("հայր", "father"), ("քույր", "sister"),
        ("եղբայր", "brother"), ("տատիկ", "grandmother"), ("ընտանիք", "family"),
    ],
    "hl-food": [
        ("հաց", "bread"), ("ջուր", "water"), ("կաթ", "milk"),
        ("պանիր", "cheese"), ("խնձոր", "apple"), ("թեյ", "tea"),
    ],
    "hl-colors": [
        ("կարմիր", "red"), ("կապույտ", "blue"), ("կանաչ", "green"),
        ("դեղին", "yellow"), ("սև", "black"), ("սպիտակ", "white"),
    ],
    "hl-time": [
        ("այսօր", "today"), ("վաղը", "tomorrow"), ("առավոտ", "morning"),
        ("գիշեր", "night"), ("օր", "day"), ("շաբաթ", "week"),
    ],
    "hl-phrases": [
        ("Չեմ հասկանում", "I don't understand"), ("Ներողություն", "sorry / excuse me"),
        ("Խնդրեմ", "please / you're welcome"), ("Բարև", "hello"),
        ("Շնորհակալություն", "thank you"), ("Ցտեսություն", "goodbye"),
    ],
    "hl-travel": [
        ("աջ", "right"), ("ձախ", "left"), ("ուղիղ", "straight"),
        ("որտեղ", "where"), ("կայարան", "station"), ("այստեղ", "here"),
    ],
}

_XP = {"translate_mcq": 10, "audio_choice_tts": 10, "true_false": 10, "match_pairs": 15}


def _rot(lst, n):
    n = n % len(lst)
    return lst[n:] + lst[:n]


def _build_extras(vocab):
    """6 extra drills from a lesson's word list, deterministic."""
    exercises = []

    # Two reverse MCQs (Armenian -> English) over the first two words,
    # distractors from the same list.
    for i in range(2):
        hy, en = vocab[i]
        distractors = [e for (h, e) in vocab if e != en][:3]
        choices = [en] + distractors
        choices = _rot(choices, i + 1)  # answer not always first
        exercises.append({
            "kind": "translate_mcq",
            "prompt": f"What does “{hy}” mean?",
            "config": {"choices": choices, "sentence": hy, "answerIndex": choices.index(en)},
        })

    # Two listening drills: hear the Armenian word, pick it.
    for i in range(2, 4):
        hy, en = vocab[i]
        distractors = [h for (h, e) in vocab if h != hy][:2]
        choices = _rot([hy] + distractors, i)
        exercises.append({
            "kind": "audio_choice_tts",
            "prompt": "Listen and choose what you heard.",
            "expected_answer": hy,
            "config": {"ttsText": hy, "promptText": "Listen and choose what you heard.",
                       "choices": choices, "answerIndex": choices.index(hy)},
        })

    # One true statement, one deliberately wrong pairing.
    hy_t, en_t = vocab[4]
    exercises.append({
        "kind": "true_false",
        "prompt": "True or False?",
        "config": {"correct": True, "statement": f"«{hy_t}» means “{en_t}.”"},
    })
    hy_f, _ = vocab[5]
    _, en_wrong = vocab[0]
    exercises.append({
        "kind": "true_false",
        "prompt": "True or False?",
        "config": {"correct": False, "statement": f"«{hy_f}» means “{en_wrong}.”"},
    })

    # One extra match over the back half of the list (the live lessons'
    # match_pairs use the front slice).
    back = vocab[2:6]
    exercises.append({
        "kind": "match_pairs",
        "prompt": "Match each word to its meaning.",
        "config": {"pairs": [{"left": h, "right": e} for h, e in back]},
    })

    return exercises


def seed_expand_vocab():
    with engine.begin() as conn:
        expanded = []
        skipped = []
        created_exercises = 0

        for slug, vocab in _VOCAB.items():
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
            if count >= 10:
                skipped.append({"slug": slug, "reason": f"already has {count} exercises"})
                continue

            max_order = conn.execute(
                text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
                {"lid": lesson_id},
            ).scalar()

            extras = _build_extras(vocab)
            for idx, ex in enumerate(extras, start=1):
                xp = _XP[ex["kind"]]
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, expected_answer, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :expected_answer, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lesson_id, "kind": ex["kind"], "prompt": ex["prompt"],
                     "expected_answer": ex.get("expected_answer"),
                     "order": max_order + idx, "xp": xp, "config": json.dumps(ex["config"])},
                )
                created_exercises += 1

            # Keep the lesson's XP totals in sync with its new size.
            conn.execute(
                text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                          xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                        WHERE id = :lid"""),
                {"lid": lesson_id},
            )
            expanded.append(slug)

        return {"ok": True, "expanded": expanded, "skipped": skipped,
                "exercises_created": created_exercises}
