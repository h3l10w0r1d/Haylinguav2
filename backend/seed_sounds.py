# backend/seed_sounds.py
"""
Phase 0 — Sounds. Seeds pure audio-in/audio-out content (minimal_pairs +
speak only, zero letters shown) that must be completed before the alphabet
chapters, per the sounds-first curriculum redesign.

Why this exists: Eastern Armenian has a three-way stop/affricate contrast —
voiced (բ/գ/դ/ձ/ջ), voiceless aspirated (փ/ք/թ/ց/չ), and voiceless
unaspirated/"tense" (պ/կ/տ/ծ/ճ) — that English only distinguishes by voicing
(aspiration is unconscious/allophonic in English). Learners who see the
letters before drilling this contrast by ear systematically confuse
պ/փ/բ (and the other four triads) for as long as they study — a documented
failure mode in Armenian-as-a-foreign-language pedagogy. Section 0c below
(the five triads) is the pedagogical core of this file and uses strict
minimal-pair discipline; 0a/0b/0d use real, clear common words without
requiring every exercise to be a surgical minimal pair, since those sub-phases
are explicitly the "easy" on-ramp, not the hard part.

Idempotent: namespaces lessons with the "snd-" slug prefix and skips
entirely if that content already exists — same pattern as seed_curriculum.py.
Triggered via POST /cms/seed/sounds (CMS-admin, mirrors the existing
"Add starter curriculum" -> POST /cms/seed/curriculum button) rather than
running automatically on boot, so a human consciously applies it once and can
review/hide it via the normal chapter publish toggle if anything looks wrong.

Also performs the one-time chapter cleanup this redesign requires: hides
(is_published=false, never deletes) the ad-hoc duplicate chapter track that
was created by hand through the CMS at some point and collides on position
with seed_curriculum.py's canonical "hl-" track (chapters.position has no
uniqueness constraint — see ensure_schema.py), and shifts the "hl-" track's
positions to make room for these new sound chapters at the front.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {"minimal_pairs": 10, "speak": 15}


def mpq(prompt, tts_text, choices, answer_index):
    """minimal_pairs: play `tts_text`, learner picks which of `choices` they heard."""
    return {
        "kind": "minimal_pairs",
        "prompt": prompt,
        "config": {"ttsText": tts_text, "choices": choices, "answerIndex": answer_index},
    }


def sp(prompt, target, accepted=None):
    """speak: learner records themselves saying `target`; graded by transcript similarity."""
    return {
        "kind": "speak",
        "prompt": prompt,
        "expected_answer": target,
        "config": {"acceptedAnswers": accepted or [], "language_code": "hye"},
    }


_LISTEN = "Listen and choose the word you heard."

# Ad-hoc chapters (created by hand through the CMS, not by any seed script)
# that collide in position with the canonical "hl-" track. Identified by the
# lesson slugs they contain, since chapter titles alone aren't a reliable key.
_ADHOC_LESSON_SLUGS = ["alphabet-basics", "alphabet-sounds", "basic-words", "greetings"]

# ---------------------------------------------------------------------------
# 0a — Vowels (ա ե ը ի ո ու). Quick, low-difficulty pass.
# ---------------------------------------------------------------------------
_VOWELS_LESSON = ("snd-vowels-1", "The Six Vowels", "Warm up your ear before anything else.", [
    mpq("Listen carefully. Later you'll learn to read these words — for now, just listen and choose what you hear.",
        "հաց", ["հաց", "միս", "ջուր"], 0),
    mpq(_LISTEN, "ջուր", ["հաց", "ջուր", "կաթ"], 1),
    mpq(_LISTEN, "միս", ["միս", "պանիր", "հաց"], 0),
    sp("Now you try — say \"bread\".", "հաց"),
    mpq("These two differ in just one vowel sound — ի vs ու.", "ձի", ["ձի", "ձու", "գառ"], 0),
    mpq(_LISTEN, "ձու", ["ձի", "ձու", "հաց"], 1),
    sp("Say \"horse\".", "ձի"),
    sp("Say \"egg\".", "ձու"),
    mpq("Another close pair — ա vs ո.", "մատ", ["մատ", "մոտ", "միս"], 0),
    mpq(_LISTEN, "մոտ", ["մատ", "մոտ", "ջուր"], 1),
    sp("Say \"finger\".", "մատ"),
    sp("Say \"near\".", "մոտ"),
])

# ---------------------------------------------------------------------------
# 0b — Consonants that map closely to sounds you already know.
# ---------------------------------------------------------------------------
_CONSONANTS_LESSON_1 = ("snd-consonants-1", "Sibilants", "Sounds like s, z, sh, and zh.", [
    mpq(_LISTEN, "սար", ["սար", "զանգ", "շուն"], 0),
    mpq(_LISTEN, "զանգ", ["սար", "զանգ", "ժամ"], 1),
    mpq(_LISTEN, "շուն", ["շուն", "ժամ", "սար"], 0),
    mpq(_LISTEN, "ժամ", ["շուն", "ժամ", "զանգ"], 1),
    sp("Say \"mountain\".", "սար"),
    sp("Say \"bell\".", "զանգ"),
    sp("Say \"dog\".", "շուն"),
    sp("Say \"clock\".", "ժամ"),
    mpq("Mixed review — all four.", "զանգ", ["սար", "զանգ", "շուն", "ժամ"], 1),
])
_CONSONANTS_LESSON_2 = ("snd-consonants-2", "Nasals & Glides", "Sounds like m, n, l, v, h, y, f.", [
    mpq("A very useful pair to start with.", "մայր", ["մայր", "հայր"], 0),
    mpq(_LISTEN, "հայր", ["մայր", "հայր"], 1),
    sp("Say \"mother\".", "մայր"),
    sp("Say \"father\".", "հայր"),
    mpq(_LISTEN, "լույս", ["լույս", "նույն"], 0),
    mpq(_LISTEN, "նույն", ["լույս", "նույն", "վարդ"], 1),
    sp("Say \"light\".", "լույս"),
    mpq(_LISTEN, "վարդ", ["վարդ", "յոթ"], 0),
    mpq(_LISTEN, "յոթ", ["վարդ", "յոթ", "ֆիլմ"], 1),
    sp("Say \"rose\".", "վարդ"),
    sp("Say \"seven\".", "յոթ"),
    sp("Say \"film\".", "ֆիլմ"),
])

# ---------------------------------------------------------------------------
# 0c — THE three-way contrast. The pedagogical core of Phase 0.
# Each lesson: 3-way intro -> 3x speak -> 3x pairwise drill -> mixed review.
# Strict minimal-pair / clear-triplet discipline throughout.
# ---------------------------------------------------------------------------
def _triad_lesson(slug, title, desc, intro, w_plain, w_aspirated, w_voiced,
                   gloss_plain, gloss_aspirated, gloss_voiced):
    return (slug, title, desc, [
        mpq(intro, w_plain, [w_plain, w_aspirated, w_voiced], 0),
        mpq(_LISTEN, w_aspirated, [w_plain, w_aspirated, w_voiced], 1),
        mpq(_LISTEN, w_voiced, [w_plain, w_aspirated, w_voiced], 2),
        sp(f"Say \"{gloss_plain}\".", w_plain),
        sp(f"Say \"{gloss_aspirated}\".", w_aspirated),
        sp(f"Say \"{gloss_voiced}\".", w_voiced),
        mpq("Just these two now.", w_plain, [w_plain, w_aspirated], 0),
        mpq(_LISTEN, w_aspirated, [w_plain, w_aspirated], 1),
        mpq("And this pair.", w_voiced, [w_plain, w_voiced], 1),
        mpq("Mixed review — all three.", w_voiced, [w_plain, w_aspirated, w_voiced], 2),
    ])


_TRIAD_LABIAL = _triad_lesson(
    "snd-triad-labial", "Պ / Փ / Բ", "The labial three-way split.",
    "This is the hardest part of Armenian sounds — but also the most important! "
    "Three sounds, three ways of saying (roughly) \"p/b\": պ (crisp, no puff of air), "
    "փ (with a strong puff of air), բ (voiced, like English b). Listen closely.",
    "պապ", "փիղ", "բադ", "grandpa", "elephant", "duck",
)
_TRIAD_VELAR = _triad_lesson(
    "snd-triad-velar", "Կ / Ք / Գ", "The velar three-way split.",
    "Same idea, new set of sounds: կ (crisp k), ք (k with a strong puff of air), գ (voiced, like English g).",
    "կով", "քիթ", "գառ", "cow", "nose", "lamb",
)
_TRIAD_DENTAL = _triad_lesson(
    "snd-triad-dental", "Տ / Թ / Դ", "The dental three-way split.",
    "Third set: տ (crisp t), թ (t with a strong puff of air), դ (voiced, like English d).",
    "տուն", "թիվ", "դուռ", "house", "number", "door",
)
_TRIAD_AFFRICATE_1 = _triad_lesson(
    "snd-triad-affricate1", "Ծ / Ց / Ձ", "The first affricate three-way split.",
    "These \"ts\" sounds don't exist in English at all — ծ (crisp ts), ց (ts with a strong puff "
    "of air), ձ (voiced, like \"ds\" in \"kids\"). Listen closely.",
    "ծառ", "ցուրտ", "ձեռք", "tree", "cold", "hand",
)
_TRIAD_AFFRICATE_2 = _triad_lesson(
    "snd-triad-affricate2", "Ճ / Չ / Ջ", "The second affricate three-way split.",
    "Last set of hard sounds: ճ (crisp ch), չ (ch with a strong puff of air), ջ (voiced, like English j).",
    "ճամփա", "չար", "ջերմ", "road", "naughty", "warm",
)

# ---------------------------------------------------------------------------
# 0d — Sounds with no close English equivalent.
# ---------------------------------------------------------------------------
_UNIQUE_LESSON_1 = ("snd-unique-1", "Ղ vs Խ", "Two throaty sounds English doesn't have.", [
    mpq("Two sounds with no English equivalent: ղ is a soft, gargled sound (a bit like a French r); "
        "խ is a rougher, throat-clearing sound (like German \"Bach\" or Scottish \"loch\").",
        "աղ", ["աղ", "խնձոր"], 0),
    mpq(_LISTEN, "խնձոր", ["աղ", "խնձոր"], 1),
    sp("Say \"salt\".", "աղ"),
    sp("Say \"apple\".", "խնձոր"),
    mpq(_LISTEN, "ողջույն", ["ողջույն", "խոզ"], 0),
    mpq(_LISTEN, "խոզ", ["ողջույն", "խոզ"], 1),
    sp("Say \"greetings\".", "ողջույն"),
    sp("Say \"pig\".", "խոզ"),
    mpq("Mixed review.", "աղ", ["աղ", "խոզ"], 0),
    mpq("Mixed review.", "խնձոր", ["ողջույն", "խնձոր"], 1),
])
_UNIQUE_LESSON_2 = ("snd-unique-2", "Ր vs Ռ", "A quick tap vs. a rolled r.", [
    mpq("Armenian has TWO different r-sounds: ր is a quick tap (like Spanish \"pero\"); "
        "ռ is a rolled/trilled r (like Spanish \"perro\" or Russian r). This is subtle — listen carefully!",
        "սար", ["սար", "դուռ"], 0),
    mpq(_LISTEN, "դուռ", ["սար", "դուռ"], 1),
    sp("Say \"mountain\".", "սար"),
    sp("Say \"door\".", "դուռ"),
    mpq(_LISTEN, "առյուծ", ["առյուծ", "սար"], 0),
    sp("Say \"lion\".", "առյուծ"),
    mpq(_LISTEN, "թռչուն", ["թռչուն", "դուռ"], 0),
    sp("Say \"bird\".", "թռչուն"),
    mpq("Mixed review.", "դուռ", ["առյուծ", "դուռ", "թռչուն"], 1),
    mpq("Mixed review.", "սար", ["սար", "առյուծ", "թռչուն"], 0),
])

# (chapter_title, chapter_description, [ (lesson_slug, lesson_title, lesson_desc, [exercises]) , ... ])
SOUNDS_CURRICULUM = [
    ("Sounds: Vowels", "Warm up your ear — six vowel sounds, no letters yet.", [_VOWELS_LESSON]),
    ("Sounds: Easy Consonants", "Sounds that map closely to ones you already know.",
     [_CONSONANTS_LESSON_1, _CONSONANTS_LESSON_2]),
    ("Sounds: The Three-Way Contrast", "The hardest — and most important — sounds in Armenian.",
     [_TRIAD_LABIAL, _TRIAD_VELAR, _TRIAD_DENTAL, _TRIAD_AFFRICATE_1, _TRIAD_AFFRICATE_2]),
    ("Sounds: Unique to Armenian", "Two sounds with no real English equivalent.",
     [_UNIQUE_LESSON_1, _UNIQUE_LESSON_2]),
]


def seed_sounds_phase() -> dict:
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug LIKE 'snd-%' LIMIT 1")).scalar()
        if exists:
            print("[seed_sounds] Sounds phase already present; skipping.")
            return {"created": False}

        # Hide the ad-hoc duplicate chapter track (never delete — lessons and
        # their exercise content stay intact and reachable via direct edit).
        hidden_chapter_ids = conn.execute(
            text(
                """
                SELECT DISTINCT l.chapter_id
                FROM lessons l
                WHERE l.slug = ANY(:slugs) AND l.chapter_id IS NOT NULL
                """
            ),
            {"slugs": _ADHOC_LESSON_SLUGS},
        ).scalars().all()
        if hidden_chapter_ids:
            conn.execute(
                text("UPDATE chapters SET is_published = FALSE WHERE id = ANY(:ids)"),
                {"ids": list(hidden_chapter_ids)},
            )
            print(f"[seed_sounds] Hid {len(hidden_chapter_ids)} ad-hoc duplicate chapter(s).")

        # Shift every existing chapter's position back to make room for the
        # new sound chapters at the front. Two-step (add a large offset, then
        # settle) avoids transient collisions with the new positions 1..N
        # while the UPDATE is running against a table with no unique index.
        n_new = len(SOUNDS_CURRICULUM)
        conn.execute(text("UPDATE chapters SET position = position + 1000"))
        conn.execute(text("UPDATE chapters SET position = position - 1000 + :n WHERE position >= 1000"), {"n": n_new})

        print(f"[seed_sounds] Seeding {n_new} sound chapters...")
        total_exercises = 0
        for pos, (ch_title, ch_desc, lessons) in enumerate(SOUNDS_CURRICULUM, start=1):
            chapter_id = conn.execute(
                text(
                    "INSERT INTO chapters (title, description, position, is_published) "
                    "VALUES (:t, :d, :p, TRUE) RETURNING id"
                ),
                {"t": ch_title, "d": ch_desc, "p": pos},
            ).scalar_one()

            for level, (slug, l_title, l_desc, exercises) in enumerate(lessons, start=1):
                lesson_xp = sum(_XP.get(e["kind"], 10) for e in exercises)
                lesson_id = conn.execute(
                    text(
                        "INSERT INTO lessons (slug, title, description, level, xp, xp_reward, is_published, lesson_type, config, chapter_id) "
                        "VALUES (:slug, :title, :desc, :level, :xp, :xp, TRUE, 'standard', '{}'::jsonb, :cid) "
                        "RETURNING id"
                    ),
                    {"slug": slug, "title": l_title, "desc": l_desc, "level": level, "xp": lesson_xp, "cid": chapter_id},
                ).scalar_one()

                for order, ex in enumerate(exercises, start=1):
                    conn.execute(
                        text(
                            'INSERT INTO exercises (lesson_id, type, kind, prompt, expected_answer, "order", xp, config) '
                            "VALUES (:lid, :type, :kind, :prompt, :expected, :order, :xp, CAST(:config AS jsonb))"
                        ),
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
                    total_exercises += 1

        print(f"[seed_sounds] Done: {n_new} chapters, {total_exercises} exercises.")
        return {"created": True, "chapters": n_new, "exercises": total_exercises, "hidden_chapters": len(hidden_chapter_ids)}
