# backend/seed_vocab3.py
"""
Vocabulary Phase 3 — three more everyday domains: Jobs, Emotions, Shopping
& Money, and Dates/Months/Seasons. Same two-stage lesson shape as
seed_vocab2.py (5-exercise base + the seed_expand.py-style 7-exercise
mechanical extras), same high-confidence-vocabulary-only rule.

Three new chapters (positions 33-35). Idempotent: skips if 'hl-jobs'
exists. Triggered via POST /cms/seed/vocab3.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {
    "translate_mcq": 10,
    "select_missing_word": 10,
    "true_false": 10,
    "match_pairs": 15,
    "audio_choice_tts": 10,
}


def _rot(lst, n):
    n = n % len(lst)
    return lst[n:] + lst[:n]


def _mp(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _tm(vocab, i, rot_n):
    hy, en = vocab[i]
    distractors = [h for h, e in vocab if h != hy][:3]
    choices = _rot([hy] + distractors, rot_n)
    return {"kind": "translate_mcq", "prompt": f"How do you say “{en}”?",
            "config": {"choices": choices, "sentence": en, "answerIndex": choices.index(hy)}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _smw_this_is(vocab, i):
    hy, en = vocab[i]
    distractors = [h for h, e in vocab if h != hy][:2]
    choices = _rot([hy] + distractors, i)
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.",
            "config": {"before": "Սա", "after": "է", "choices": choices, "answerIndex": choices.index(hy)}}


def _base5(vocab):
    return [
        _mp(vocab[:4]),
        _tm(vocab, 0, 1),
        _tm(vocab, 1, 2),
        _tf(f"«{vocab[2][0]}» means “{vocab[2][1]}.”", True),
        _smw_this_is(vocab, 3),
    ]


def _extras7(vocab):
    exercises = []
    for i in range(2):
        hy, en = vocab[i]
        distractors = [e for h, e in vocab if e != en][:3]
        choices = _rot([en] + distractors, i + 1)
        exercises.append({"kind": "translate_mcq", "prompt": f"What does “{hy}” mean?",
                           "config": {"choices": choices, "sentence": hy, "answerIndex": choices.index(en)}})
    for i in range(2, 4):
        hy, en = vocab[i]
        distractors = [h for h, e in vocab if h != hy][:2]
        choices = _rot([hy] + distractors, i)
        exercises.append({"kind": "audio_choice_tts", "prompt": "Listen and choose what you heard.",
                           "config": {"ttsText": hy, "promptText": "Listen and choose what you heard.",
                                      "choices": choices, "answerIndex": choices.index(hy)}})
    hy_t, en_t = vocab[4]
    exercises.append(_tf(f"«{hy_t}» means “{en_t}.”", True))
    hy_f, _ = vocab[5]
    _, en_wrong = vocab[0]
    exercises.append(_tf(f"«{hy_f}» means “{en_wrong}.”", False))
    back = vocab[2:6]
    exercises.append(_mp(back))
    return exercises


_VOCAB = {
    "hl-jobs": [
        ("ուսուցիչ", "teacher"), ("բժիշկ", "doctor"), ("ինժեներ", "engineer"), ("խոհարար", "cook"),
        ("վարորդ", "driver"), ("ոստիկան", "police officer"), ("գրող", "writer"), ("նկարիչ", "painter"),
    ],
    "hl-emotions": [
        ("ուրախ", "happy"), ("տխուր", "sad"), ("բարկացած", "angry"), ("հոգնած", "tired"),
        ("վախեցած", "scared"), ("զարմացած", "surprised"), ("հանգիստ", "calm"), ("սոված", "hungry"),
    ],
    "hl-shopping": [
        ("փող", "money"), ("գին", "price"), ("խանութ", "shop"), ("դրամապանակ", "wallet"),
        ("քարտ", "card"), ("կանխիկ", "cash"), ("թանկ", "expensive"), ("էժան", "cheap"),
    ],
    "hl-months": [
        ("ամառ", "summer"), ("ձմեռ", "winter"), ("գարուն", "spring"), ("աշուն", "fall"),
        ("հունվար", "January"), ("հուլիս", "July"), ("ամիս", "month"), ("տարի", "year"),
    ],
}

_CHAPTERS = {
    "hl-jobs": ("Jobs & Emotions", 33, "What Do You Do?"),
    "hl-emotions": ("Jobs & Emotions", 33, "How Do You Feel?"),
    "hl-shopping": ("Shopping & Money", 34, "At the Shop"),
    "hl-months": ("Dates, Months & Seasons", 35, "The Calendar"),
}


def seed_vocab3():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'hl-jobs'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "hl-jobs already exists"}

        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        created_lessons = 0
        created_exercises = 0
        chapter_ids = {}

        for slug, vocab in _VOCAB.items():
            chapter_title, chapter_position, lesson_title = _CHAPTERS[slug]

            if chapter_title not in chapter_ids:
                existing = conn.execute(
                    text("SELECT id FROM chapters WHERE title = :t"), {"t": chapter_title}
                ).scalar()
                if not existing:
                    existing = conn.execute(
                        text("""INSERT INTO chapters (title, position, is_published)
                                VALUES (:t, :p, TRUE) RETURNING id"""),
                        {"t": chapter_title, "p": chapter_position},
                    ).scalar()
                chapter_ids[chapter_title] = existing

            exercises = _base5(vocab) + _extras7(vocab)
            for idx, ex in enumerate(exercises, start=1):
                ex["order"] = idx
                ex["xp"] = _XP[ex["kind"]]
            lesson_xp = sum(ex["xp"] for ex in exercises)
            max_level += 1

            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard')
                    RETURNING id
                """),
                {"slug": slug, "title": lesson_title, "level": max_level,
                 "xp": lesson_xp, "chapter_id": chapter_ids[chapter_title]},
            ).scalar()
            created_lessons += 1

            for ex in exercises:
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lesson_id, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": ex["order"], "xp": ex["xp"], "config": json.dumps(ex["config"])},
                )
                created_exercises += 1

        return {"ok": True, "chapters_created": list(chapter_ids.values()),
                "lessons_created": created_lessons, "exercises_created": created_exercises}
