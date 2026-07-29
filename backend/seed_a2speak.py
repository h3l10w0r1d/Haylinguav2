# backend/seed_a2speak.py
"""
A2 · Speaking — spoken production practice, the thin spot in A2. Each exercise
shows an Armenian phrase (with a romanized hint) and the learner says it aloud;
STT grades it. Three lessons: greetings, about yourself, everyday phrases.

Uses the `speak` kind. Config: {target, romanization}. Authored live via
single-create. Standard Eastern Armenian, hand-checked romanization. Tagged
cefr="A2", one chapter at position 136. Idempotent (skips if 'a2-speak-greet'
exists). Triggered via POST /cms/seed/a2speak.
"""

import json
from sqlalchemy import text

_XP = {"speak": 15}
_CEFR = "A2"
_CHAPTER = "A2 · Speaking"
_POS = 136


def _speak(target, roman):
    return {"kind": "speak", "prompt": "Say the phrase out loud",
            "config": {"target": target, "romanization": roman}}


_LESSONS = [
    (_CHAPTER, _POS, "a2-speak-greet", "Say It: Greetings", [
        _speak("Բարև ձեզ", "barev dzez"),
        _speak("Շնորհակալություն", "shnorhakalutyun"),
        _speak("Ինչպե՞ս եք", "inchpes ek"),
        _speak("Ցտեսություն", "tstesutyun"),
        _speak("Բարի լույս", "bari luys"),
    ]),
    (_CHAPTER, _POS, "a2-speak-self", "Say It: About Yourself", [
        _speak("Իմ անունը Անի է", "im anun@ Ani e"),
        _speak("Ես ուսանող եմ", "yes usanogh em"),
        _speak("Ես Հայաստանից եմ", "yes Hayastanits em"),
        _speak("Ես հայերեն եմ սովորում", "yes hayeren em sovorum"),
        _speak("Ես քսան տարեկան եմ", "yes ksan tarekan em"),
    ]),
    (_CHAPTER, _POS, "a2-speak-everyday", "Say It: Everyday", [
        _speak("Ես սուրճ եմ խմում", "yes surch em khmum"),
        _speak("Ինձ պետք է օգնություն", "indz petk e ognutyun"),
        _speak("Որքա՞ն արժե սա", "vorkan arzhe sa"),
        _speak("Ես սիրում եմ Հայաստանը", "yes sirum em Hayastan@"),
        _speak("Համեղ էր", "hamegh er"),
    ]),
]


def seed_a2speak():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-speak-greet'")).first():
            return {"ok": True, "skipped": True, "reason": "a2-speak-greet already exists"}
        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        cl = ce = 0
        cfg = json.dumps({"cefr": _CEFR})
        for ct, pos, slug, title, exercises in _LESSONS:
            if ct not in chapter_ids:
                cid = conn.execute(text("SELECT id FROM chapters WHERE title = :t"), {"t": ct}).scalar()
                if not cid:
                    cid = conn.execute(text("""INSERT INTO chapters (title, position, is_published) VALUES (:t,:p,TRUE) RETURNING id"""),
                                       {"t": ct, "p": pos}).scalar()
                chapter_ids[ct] = cid
            for i, e in enumerate(exercises, start=1):
                e["order"] = i; e["xp"] = _XP[e["kind"]]
            max_level += 1
            lid = conn.execute(text("""INSERT INTO lessons (slug,title,level,xp,xp_reward,is_published,chapter_id,lesson_type,config)
                        VALUES (:s,:t,:l,:xp,:xp,TRUE,:c,'standard',CAST(:cfg AS jsonb)) RETURNING id"""),
                {"s": slug, "t": title, "l": max_level, "xp": sum(e["xp"] for e in exercises), "c": chapter_ids[ct], "cfg": cfg}).scalar()
            cl += 1
            for e in exercises:
                conn.execute(text("""INSERT INTO exercises (lesson_id,kind,prompt,"order",xp,config)
                        VALUES (:l,:k,:p,:o,:xp,CAST(:cfg AS jsonb))"""),
                    {"l": lid, "k": e["kind"], "p": e["prompt"], "o": e["order"], "xp": e["xp"], "cfg": json.dumps(e["config"])})
                ce += 1
        return {"ok": True, "cefr": _CEFR, "chapters": len(chapter_ids), "lessons": cl, "exercises": ce}
