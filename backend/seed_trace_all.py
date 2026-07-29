# backend/seed_trace_all.py
"""
Give every alphabet letter a handwriting step. Appends a `trace_letter`
exercise for each of the 39 letters to the lesson that teaches it (the
hl-alphabet-1..10 lessons), so tracing comes right after the letter is
studied — not as a separate chapter. Idempotent: skips any letter already
traced in its lesson. Triggered via POST /cms/seed/trace-all.
"""
import json
from sqlalchemy import text

# lesson slug -> [(lowercase letter, romanization)] in teaching order
PLAN = {
    "hl-alphabet-1":  [("ա", "a"), ("բ", "b"), ("գ", "g")],
    "hl-alphabet-2":  [("դ", "d"), ("ե", "ye / e"), ("կ", "k")],
    "hl-alphabet-3":  [("զ", "z"), ("է", "e"), ("ի", "i"), ("լ", "l")],
    "hl-alphabet-4":  [("հ", "h"), ("մ", "m"), ("ն", "n"), ("ս", "s")],
    "hl-alphabet-5":  [("վ", "v"), ("շ", "sh"), ("ժ", "zh"), ("ր", "r")],
    "hl-alphabet-6":  [("տ", "t"), ("թ", "t'"), ("պ", "p"), ("փ", "p'")],
    "hl-alphabet-7":  [("ք", "k'"), ("ծ", "ts"), ("ց", "ts'"), ("ձ", "dz")],
    "hl-alphabet-8":  [("ճ", "ch"), ("չ", "ch'"), ("ջ", "j"), ("ղ", "gh")],
    "hl-alphabet-9":  [("խ", "kh"), ("ռ", "rr"), ("ը", "ə"), ("ո", "vo / o")],
    "hl-alphabet-10": [("յ", "y"), ("ու", "u"), ("և", "ev"), ("օ", "o"), ("ֆ", "f")],
}


def seed_trace_all():
    from database import engine
    added = 0
    with engine.begin() as conn:
        for slug, letters in PLAN.items():
            row = conn.execute(text("SELECT id FROM lessons WHERE slug = :s"), {"s": slug}).mappings().first()
            if not row:
                continue
            lid = row["id"]
            have = {r[0] for r in conn.execute(
                text("SELECT config->>'letter' FROM exercises WHERE lesson_id = :l AND kind = 'trace_letter'"), {"l": lid})}
            maxord = conn.execute(text('SELECT COALESCE(MAX("order"),0) FROM exercises WHERE lesson_id = :l'), {"l": lid}).scalar() or 0
            for letter, roman in letters:
                if letter in have:
                    continue
                maxord += 1
                cfg = json.dumps({"letter": letter, "romanization": roman, "audioText": letter})
                conn.execute(text('''INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                                     VALUES (:l, 'trace_letter', :p, :o, 10, CAST(:cfg AS jsonb))'''),
                             {"l": lid, "p": f"Trace: {letter}", "o": maxord, "cfg": cfg})
                added += 1
    return {"ok": True, "trace_exercises_added": added, "letters": sum(len(v) for v in PLAN.values())}
