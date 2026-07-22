# backend/seed_enrich_sounds.py
"""
snd-vowels-1 ("The Six Vowels") is the TRUE first lesson a new customer
plays — chapter position 1, ahead of "The Alphabet I" — not hl-alphabet-1.
It's pure phonetic discrimination (minimal_pairs) by design (the script
isn't taught yet), which is correct pedagogy, but four of its five
minimal_pairs exercises had the literal identical prompt "Listen and
choose the word you heard." copy-pasted, and the shared frontend bubble
always said "Listen carefully…" for every one of them — genuinely
monotonous, not just a content nit.

This UPDATE-based script (the lesson already exists) does two things:
1. Varies the four duplicate prompts.
2. Adds emoji + meaning to each minimal_pairs exercise's config — a small
   payoff ("You just heard the word for bread! 🍞") revealed after
   grading (ExerciseRenderer.jsx), so the very first lesson still gives a
   taste of real vocabulary even though it deliberately doesn't teach the
   script yet.

Idempotent: skips any exercise whose config already has "emoji" set.
Triggered via POST /cms/seed/enrich-sounds.
"""

import json
from sqlalchemy import text
from database import engine

# exercise_id -> (new_prompt_or_None, emoji, meaning)
_UPDATES = {
    611: (None, "🍞", "bread"),                              # հաց / hats
    612: ("Which one did you hear?", "💧", "water"),          # ջուր / jur
    613: ("Tap the word you heard.", "🍖", "meat"),           # միս / mis
    615: (None, "🐴", "horse"),                               # ձի / dzi
    616: ("Which word matches the sound?", "🥚", "egg"),      # ձու / dzu
    619: (None, "👆", "finger"),                              # մատ / mat
    620: ("One more — what did you hear?", "📍", "nearby"),   # մոտ / mot
}


def seed_enrich_sounds():
    with engine.begin() as conn:
        updated = 0
        skipped = []

        for exercise_id, (new_prompt, emoji, meaning) in _UPDATES.items():
            row = conn.execute(
                text("SELECT id, prompt, config FROM exercises WHERE id = :id"),
                {"id": exercise_id},
            ).mappings().first()
            if not row:
                skipped.append({"id": exercise_id, "reason": "not found"})
                continue

            cfg = row["config"] if isinstance(row["config"], dict) else json.loads(row["config"])
            if cfg.get("emoji"):
                skipped.append({"id": exercise_id, "reason": "already enriched"})
                continue

            cfg["emoji"] = emoji
            cfg["meaning"] = meaning
            prompt = new_prompt if new_prompt is not None else row["prompt"]

            conn.execute(
                text('UPDATE exercises SET config = CAST(:config AS jsonb), prompt = :prompt WHERE id = :id'),
                {"config": json.dumps(cfg), "prompt": prompt, "id": exercise_id},
            )
            updated += 1

        return {"ok": True, "exercises_updated": updated, "skipped": skipped}
