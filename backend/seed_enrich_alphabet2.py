# backend/seed_enrich_alphabet2.py
"""
Extends seed_enrich_alphabet.py's backfill to the remaining 33 letters
(hl-alphabet-3 through hl-alphabet-10 — the letters seed_alphabet.py added).
Those lessons' char_intro exercises never got exampleWord/exampleMeaning/
exampleEmoji set, even though the (example_word, example_word_translit) pair
already exists per-letter in seed_alphabet.py's _LETTERS tuple (it's used
there for the audio_choice_tts exercise, just never copied onto char_intro).
This script reuses that exact same word/translit pairing rather than
inventing new vocabulary, and adds only the one missing piece: an emoji.

Built for the /armenian-alphabet public SEO page, which renders every
letter's char_intro config in a grid — without this, 33 of the 39 cards
would show a bare glyph with no example while the first 14 show a full
word+meaning+emoji, an inconsistent-looking page.

և (the ligature letter meaning "and") is intentionally left without an
example — its own "example word" would just be itself, which reads as
confusing rather than helpful. Mirrors seed_enrich_alphabet.py leaving Է
unenriched for the same reason.

Idempotent: only fills exampleWord where it isn't already set. Triggered
via POST /cms/seed/enrich-alphabet-2.
"""

import json
from sqlalchemy import text
from database import engine

# letter -> (exampleWord, exampleMeaning, exampleEmoji). Word/meaning taken
# directly from seed_alphabet.py's _LETTERS tuples; emoji is the only new data.
_EXAMPLES = {
    "Զ": ("զանգ", "bell", "🔔"),
    "Ի": ("իմ", "my", "🙋"),
    "Լ": ("լավ", "good", "👍"),
    "Հ": ("հայր", "father", "👨"),
    "Մ": ("մայր", "mother", "👩"),
    "Ն": ("նոր", "new", "✨"),
    "Ս": ("սար", "mountain", "⛰️"),
    "Վ": ("վարդ", "rose", "🌹"),
    "Շ": ("շուն", "dog", "🐶"),
    "Ժ": ("ժամ", "hour/clock", "⏰"),
    "Ր": ("արև", "sun", "☀️"),
    "Տ": ("տուն", "house", "🏠"),
    "Թ": ("թիվ", "number", "🔢"),
    "Պ": ("պապ", "grandpa", "👴"),
    "Փ": ("փիղ", "elephant", "🐘"),
    "Ք": ("քիթ", "nose", "👃"),
    "Ծ": ("ծառ", "tree", "🌳"),
    "Ց": ("ցուրտ", "cold", "❄️"),
    "Ձ": ("ձի", "horse", "🐴"),
    "Ճ": ("ճամփա", "road", "🛣️"),
    "Չ": ("չար", "angry/evil", "😠"),
    "Ջ": ("ջուր", "water", "💧"),
    "Ղ": ("աղ", "salt", "🧂"),
    "Խ": ("խոզ", "pig", "🐷"),
    "Ռ": ("առյուծ", "lion", "🦁"),
    "Ը": ("ընկեր", "friend", "🤝"),
    "Ո": ("ոսկի", "gold", "🥇"),
    "Յ": ("յոթ", "seven", "7️⃣"),
    "ՈՒ": ("ուսանող", "student", "🎓"),
    "Օ": ("օր", "day", "📅"),
    "Ֆ": ("ֆիլմ", "film", "🎬"),
    # "Է" and "և" intentionally omitted — no confident short native example.
}

_LESSON_SLUGS = [f"hl-alphabet-{n}" for n in range(3, 11)]  # 3..10


def seed_enrich_alphabet2():
    with engine.begin() as conn:
        updated = 0
        skipped = []

        for slug in _LESSON_SLUGS:
            lesson = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not lesson:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue

            rows = conn.execute(
                text("SELECT id, config FROM exercises WHERE lesson_id = :lid AND kind = 'char_intro'"),
                {"lid": lesson["id"]},
            ).mappings().all()

            for row in rows:
                cfg = row["config"] if isinstance(row["config"], dict) else json.loads(row["config"])
                if cfg.get("exampleWord"):
                    continue  # already enriched
                letter = cfg.get("letter")
                example = _EXAMPLES.get(letter)
                if not example:
                    continue
                word, meaning, emoji = example
                cfg["exampleWord"] = word
                cfg["exampleMeaning"] = meaning
                cfg["exampleEmoji"] = emoji
                conn.execute(
                    text("UPDATE exercises SET config = CAST(:config AS jsonb) WHERE id = :id"),
                    {"config": json.dumps(cfg), "id": row["id"]},
                )
                updated += 1

        return {"ok": True, "exercises_updated": updated, "skipped": skipped}
