# backend/seed_wordforms.py
"""
Word Forms — the first lessons built on the new `inflect` exercise (produce the
inflected form of a base word from a grammatical target). This is the drill
Armenian most needs and that a translate/match app can't give: active
PRODUCTION of case, tense, and definiteness, not just recognition.

Three lessons:
- The Definite Article: base noun → «-ը» (or «-ն» after a vowel).
- Verb Forms: base verb → present / past / future of "I".
- To Whom? (Dative): a specific person/recipient → «-ին», plus the object
  pronouns ինձ / քեզ.

Only high-frequency, regular forms are used so every answer key is exact;
irregular declension stems are deliberately avoided (they get their own pass).
Standard Eastern Armenian, hand-checked. Tagged cefr="A2". One chapter
(position 59). Idempotent: skips if 'a2-form-article' exists. Triggered via
POST /cms/seed/wordforms.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"inflect": 15, "true_false": 10}
_CEFR = "A2"


def _inflect(base, base_gloss, target, answer, accepted=None, target_gloss=None, prompt=None):
    cfg = {"base": base, "baseGloss": base_gloss, "target": target, "answer": answer}
    if target_gloss:
        cfg["targetGloss"] = target_gloss
    if accepted:
        cfg["acceptedAnswers"] = list(accepted)
    return {"kind": "inflect",
            "prompt": prompt or "Change the word to the form shown",
            "config": cfg}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?",
            "config": {"correct": correct, "statement": statement}}


_LESSONS = [
    ("Word Forms", 59, "a2-form-article", "The Definite Article", [
        _tf("The definite article «-ը» attaches to the END of a word: "
            "գիրք → գիրքը (the book). After a vowel it becomes «-ն»."),
        _inflect("գիրք", "book", "“the …” (definite)", "գիրքը"),
        _inflect("ջուր", "water", "“the …” (definite)", "ջուրը"),
        _inflect("տուն", "house", "“the …” (definite)", "տունը"),
        _inflect("խնձոր", "apple", "“the …” (definite)", "խնձորը"),
        _inflect("դպրոց", "school", "“the …” (definite)", "դպրոցը"),
        _inflect("կատու", "cat", "“the …” (definite, after a vowel)", "կատուն"),
    ]),
    ("Word Forms", 59, "a2-form-verbs", "Verb Forms: Present, Past, Future", [
        _tf("The present tense = verb stem + «-ում» + «եմ»: "
            "խոսել → խոսում եմ (I speak)."),
        _inflect("խոսել", "to speak", "Present · “I”", "խոսում եմ", target_gloss="I speak"),
        _inflect("գրել", "to write", "Present · “I”", "գրում եմ", target_gloss="I write"),
        _inflect("կարդալ", "to read", "Present · “I”", "կարդում եմ", target_gloss="I read"),
        _inflect("գրել", "to write", "Past · “I”", "գրեցի", target_gloss="I wrote"),
        _inflect("խոսել", "to speak", "Future · “I” (կ-)", "կխոսեմ", target_gloss="I will speak"),
        _inflect("սովորել", "to learn", "Future · “I” (կ-)", "կսովորեմ", target_gloss="I will learn"),
    ]),
    ("Word Forms", 59, "a2-form-dative", "To Whom? (Dative)", [
        _tf("A specific person as the object or recipient takes «-ին»: "
            "Արам → Արամին (to Aram)."),
        _inflect("Արամ", "Aram", "to Aram (dative)", "Արամին"),
        _inflect("Անի", "Ani", "to Ani (dative)", "Անիին"),
        _inflect("Դավիթ", "Davit", "to Davit (dative)", "Դավիթին"),
        _inflect("ես", "I", "“to me / me” (object)", "ինձ"),
        _inflect("դու", "you", "“to you / you” (object)", "քեզ"),
        _tf("«ինձ» is the object form of «ես» — “to me / me.”"),
    ]),
]


def seed_wordforms():
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-form-article'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-form-article already exists"}

        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        created_lessons = 0
        created_exercises = 0
        lesson_config = json.dumps({"cefr": _CEFR})

        for chapter_title, chapter_position, slug, title, exercises in _LESSONS:
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

            for idx, ex in enumerate(exercises, start=1):
                ex["order"] = idx
                ex["xp"] = _XP[ex["kind"]]
            lesson_xp = sum(ex["xp"] for ex in exercises)
            max_level += 1

            lesson_id = conn.execute(
                text("""
                    INSERT INTO lessons (slug, title, level, xp, xp_reward, is_published, chapter_id, lesson_type, config)
                    VALUES (:slug, :title, :level, :xp, :xp, TRUE, :chapter_id, 'standard', CAST(:cfg AS jsonb))
                    RETURNING id
                """),
                {"slug": slug, "title": title, "level": max_level,
                 "xp": lesson_xp, "chapter_id": chapter_ids[chapter_title], "cfg": lesson_config},
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

        return {"ok": True, "cefr": _CEFR, "chapters_created": list(chapter_ids.values()),
                "lessons_created": created_lessons, "exercises_created": created_exercises}
