# backend/seed_imagewords.py
"""
Picture word-learning, Duolingo-style: for image-able vocabulary the learner
sees the Armenian word and taps the matching picture. We don't have an
illustration library, so the "pictures" are large emoji — immediately
shippable, and a genuine word→meaning reinforcement that the curriculum was
missing entirely (every drill was text-only).

Adds 3 image_select exercises to each targeted vocabulary lesson, using only
words already taught in that lesson (no new vocab) and only words with a
clear, unambiguous emoji. Distractors are other emoji from the same lesson.

image_select renders via ExImageSelect (ExerciseRenderer.jsx), which now
shows a big emoji per tile when a choice carries an `emoji` field.

Idempotent per lesson (skips if it already has an image_select exercise).
Triggered via POST /cms/seed/imagewords.
"""

import json
from sqlalchemy import text
from database import engine

_XP_IMAGE_SELECT = 10

# slug -> [(armenian, emoji), …]  (all already taught in that lesson)
_SETS = {
    "hl-food": [("հաց", "🍞"), ("ջուր", "💧"), ("կաթ", "🥛"), ("պանիր", "🧀"),
                ("խնձոր", "🍎"), ("թեյ", "🍵"), ("սուրճ", "☕"), ("միս", "🍖")],
    "hl-colors": [("կարմիր", "🔴"), ("կապույտ", "🔵"), ("կանաչ", "🟢"),
                  ("դեղին", "🟡"), ("սև", "⚫"), ("սպիտակ", "⚪")],
    "hl-family": [("մայր", "👩"), ("հայր", "👨"), ("քույր", "👧"), ("եղբայր", "👦"),
                  ("տատիկ", "👵"), ("պապիկ", "👴"), ("երեխա", "👶")],
    "hl-home": [("դուռ", "🚪"), ("պատուհան", "🪟"), ("աթոռ", "🪑"), ("մահճակալ", "🛏️"),
                ("հայելի", "🪞"), ("բանալի", "🔑"), ("լամպ", "💡")],
    "hl-body": [("աչք", "👁️"), ("ականջ", "👂"), ("քիթ", "👃"), ("բերան", "👄"),
                ("ձեռք", "✋"), ("ոտք", "🦶"), ("սիրտ", "❤️")],
    "hl-clothing": [("շապիկ", "👕"), ("տաբատ", "👖"), ("կոշիկ", "👟"), ("գուլպա", "🧦"),
                    ("գլխարկ", "🧢"), ("բաճկոն", "🧥"), ("զգեստ", "👗")],
    "hl-weather": [("անձրև", "🌧️"), ("ձյուն", "❄️"), ("արև", "☀️"), ("քամի", "💨"), ("ամպ", "☁️")],
    "hl-emotions": [("ուրախ", "😀"), ("տխուր", "😢"), ("բարկացած", "😡"),
                    ("հոգնած", "😴"), ("վախեցած", "😱"), ("զարմացած", "😲")],
}


def _image_select(target_hy, target_emoji, distractor_emojis):
    """A 'tap the picture for «word»' exercise. 4 emoji tiles."""
    choices = [{"emoji": target_emoji, "is_correct": True}]
    for e in distractor_emojis[:3]:
        choices.append({"emoji": e})
    # Deterministic placement so reseeds are stable: correct index rotates by
    # a simple hash of the word length, kept in-range.
    pos = len(target_hy) % len(choices)
    choices.insert(pos, choices.pop(0))
    answer_index = next(i for i, c in enumerate(choices) if c.get("is_correct"))
    return {
        "kind": "image_select",
        "prompt": f"Which one is «{target_hy}»?",
        "config": {"choices": choices, "answerIndex": answer_index},
    }


def _build_for(vocab):
    """3 picture-select exercises: words at index 0,1,2 are the answers,
    distractors drawn from the rest of the set."""
    out = []
    n = len(vocab)
    for i in range(min(3, n)):
        target_hy, target_emoji = vocab[i]
        distractors = [e for j, (_, e) in enumerate(vocab) if j != i]
        # rotate distractor window so the three exercises don't reuse the same trio
        window = distractors[i:] + distractors[:i]
        out.append(_image_select(target_hy, target_emoji, window))
    return out


def seed_imagewords():
    with engine.begin() as conn:
        expanded, skipped, created = [], [], 0

        for slug, vocab in _SETS.items():
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue
            lid = lesson["id"]

            has = conn.execute(
                text("SELECT 1 FROM exercises WHERE lesson_id = :lid AND kind = 'image_select' LIMIT 1"),
                {"lid": lid},
            ).first()
            if has:
                skipped.append({"slug": slug, "reason": "already has image_select"})
                continue

            max_order = conn.execute(
                text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
                {"lid": lid},
            ).scalar()

            for idx, ex in enumerate(_build_for(vocab), start=1):
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lid, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": max_order + idx, "xp": _XP_IMAGE_SELECT, "config": json.dumps(ex["config"])},
                )
                created += 1

            conn.execute(
                text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                          xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                        WHERE id = :lid"""),
                {"lid": lid},
            )
            expanded.append(slug)

        return {"ok": True, "expanded": expanded, "skipped": skipped, "exercises_created": created}
