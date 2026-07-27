# backend/seed_cefr_tag.py
"""
Tags every lesson with a CEFR level in lessons.config, the basis the level
system groups and gates on:

- A0 (Foundations): lessons in the Sounds and Alphabet chapters.
- A2: already tagged by seed_a2_1 (config.cefr = "A2") — left untouched.
- A1: everything else.

No schema change — the tag lives in the existing lessons.config JSONB. Safe
to re-run: it only fills lessons that don't already have a cefr tag, so the
A2 tags and any future manual overrides are preserved. Triggered via
POST /cms/seed/cefr-tag.
"""

from sqlalchemy import text
from database import engine

# A0 chapters, matched by title prefix.
_A0_TITLE_PREFIXES = ("Sounds", "The Alphabet")


def seed_cefr_tag():
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
                SELECT l.id, l.config, c.title AS chapter_title
                FROM lessons l
                LEFT JOIN chapters c ON c.id = l.chapter_id
            """)
        ).mappings().all()

        a0 = a1 = skipped = 0
        for r in rows:
            cfg = r["config"] if isinstance(r["config"], dict) else {}
            if cfg.get("cefr"):
                skipped += 1
                continue

            title = (r["chapter_title"] or "")
            level = "A0" if any(title.startswith(p) for p in _A0_TITLE_PREFIXES) else "A1"

            # jsonb merge keeps any other config keys intact.
            conn.execute(
                text("""UPDATE lessons
                        SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('cefr', :lvl)
                        WHERE id = :id"""),
                {"lvl": level, "id": r["id"]},
            )
            if level == "A0":
                a0 += 1
            else:
                a1 += 1

        return {"ok": True, "tagged_a0": a0, "tagged_a1": a1, "already_tagged": skipped}
