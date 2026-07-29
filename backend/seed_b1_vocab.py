# backend/seed_b1_vocab.py
"""
B1 roadmap, vocabulary layer — the high-volume topical vocab that broadens the
level the way the A2 vocab layer did. Eleven intermediate/abstract domains
(emotions, personality, technology, money, education, society, arts, travel,
sports, cooking, communication), each a lesson built by a shared helper:
two match_pairs, three translate_mcq, and two true/false per domain.

Five chapters / eleven lessons, cefr="B1" (gated behind the A2 assessment).
Pure vocabulary — no grammar risk. Standard Eastern Armenian, hand-checked.
Chapters continue at positions 211+. Idempotent (skips if 'b1v-emotions'
exists). Triggered via POST /cms/seed/b1-vocab.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10}
_CEFR = "B1"


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}
def _tmcq(en, choices, ai):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{en}”?", "config": {"choices": choices, "sentence": en, "answerIndex": ai}}
def _tf(s, c=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": c, "statement": s}}


def _vocab_lesson(pairs):
    """pairs: list of 8 (hy, en). Builds a 7-exercise vocab lesson."""
    ex = [_match(pairs[:4]), _match(pairs[4:8])]
    hy_all = [p[0] for p in pairs]
    for idx, wi in enumerate((0, 3, 6)):
        hy, en = pairs[wi]
        distr = [h for h in hy_all if h != hy][:3]
        ai = idx % 3
        choices = distr[:]
        choices.insert(ai, hy)
        ex.append(_tmcq(en, choices, ai))
    ex.append(_tf(f"«{pairs[1][0]}» means “{pairs[1][1]}.”", True))
    ex.append(_tf(f"«{pairs[5][0]}» means “{pairs[2][1]}.”", False))
    return ex


# (chapter, position, slug, title, [8 (hy, en) pairs])
_DOMAINS = [
    ("B1 · Feelings & Character", 211, "b1v-emotions", "Deeper Emotions", [
        ("հպարտ", "proud"), ("նախանձ", "envy"), ("հիասթափված", "disappointed"), ("անհանգիստ", "anxious"),
        ("զարմացած", "surprised"), ("ամաչկոտ", "shy"), ("վստահ", "confident"), ("հանգիստ", "calm")]),
    ("B1 · Feelings & Character", 211, "b1v-personality", "Personality", [
        ("ազնիվ", "honest"), ("առատաձեռն", "generous"), ("համբերատար", "patient"), ("աշխատասեր", "hardworking"),
        ("համեստ", "modest"), ("խիզախ", "brave"), ("ծույլ", "lazy"), ("բարի", "kind")]),
    ("B1 · Modern Life", 212, "b1v-technology", "Technology", [
        ("համակարգիչ", "computer"), ("ինտերնետ", "internet"), ("հավելված", "app"), ("սարք", "device"),
        ("ծրագիր", "program"), ("գաղտնաբառ", "password"), ("էկրան", "screen"), ("ֆայլ", "file")]),
    ("B1 · Modern Life", 212, "b1v-money", "Money & Finance", [
        ("փող", "money"), ("բյուջե", "budget"), ("խնայել", "to save"), ("ծախսել", "to spend"),
        ("վարկ", "loan"), ("գին", "price"), ("հաշիվ", "bill"), ("հարուստ", "rich")]),
    ("B1 · Learning & Society", 213, "b1v-education", "Education", [
        ("կրթություն", "education"), ("համալսարան", "university"), ("գիտություն", "science"), ("ուսանող", "student"),
        ("քննություն", "exam"), ("գիտելիք", "knowledge"), ("դասընթաց", "course"), ("հետազոտություն", "research")]),
    ("B1 · Learning & Society", 213, "b1v-society", "Society", [
        ("հասարակություն", "society"), ("կառավարություն", "government"), ("օրենք", "law"), ("իրավունք", "right"),
        ("խնդիր", "problem"), ("լուծում", "solution"), ("փոփոխություն", "change"), ("զարգացում", "development")]),
    ("B1 · Arts & Leisure", 214, "b1v-arts", "Arts & Culture", [
        ("արվեստ", "art"), ("երաժշտություն", "music"), ("թատրոն", "theater"), ("նկար", "painting"),
        ("մշակույթ", "culture"), ("գրականություն", "literature"), ("ֆիլմ", "film"), ("համերգ", "concert")]),
    ("B1 · Arts & Leisure", 214, "b1v-sports", "Sports", [
        ("թիմ", "team"), ("խաղ", "game"), ("հաղթել", "to win"), ("պարտվել", "to lose"),
        ("մրցում", "competition"), ("մարզիչ", "coach"), ("գնդակ", "ball"), ("մարզադաշտ", "stadium")]),
    ("B1 · Arts & Leisure", 214, "b1v-cooking", "Cooking & Food", [
        ("բաղադրատոմս", "recipe"), ("համեմունք", "spice"), ("եփել", "to cook"), ("թխել", "to bake"),
        ("համ", "flavor"), ("քաղցր", "sweet"), ("աղի", "salty"), ("թարմ", "fresh")]),
    ("B1 · Getting Around", 215, "b1v-travel", "Travel & Tourism", [
        ("ճանապարհորդություն", "journey"), ("զբոսաշրջիկ", "tourist"), ("անձնագիր", "passport"), ("ուղեբեռ", "luggage"),
        ("սահման", "border"), ("արձակուրդ", "vacation"), ("տոմս", "ticket"), ("քարտեզ", "map")]),
    ("B1 · Getting Around", 215, "b1v-communication", "Communication", [
        ("խոսակցություն", "conversation"), ("հաղորդագրություն", "message"), ("նամակ", "letter"), ("զանգ", "call"),
        ("պատասխան", "answer"), ("հարց", "question"), ("լեզու", "language"), ("բառ", "word")]),
]


# Pre-built form: (chapter, position, slug, title, [exercise dicts]).
# Consumed by the single-create runner; the DB seed rebuilds from _DOMAINS.
_LESSONS = [(ct, pos, slug, title, _vocab_lesson(pairs)) for ct, pos, slug, title, pairs in _DOMAINS]


def seed_b1_vocab():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'b1v-emotions'")).first():
            return {"ok": True, "skipped": True, "reason": "b1v-emotions already exists"}
        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        cl = ce = 0
        cfg = json.dumps({"cefr": _CEFR})
        for ct, pos, slug, title, pairs in _DOMAINS:
            exercises = _vocab_lesson(pairs)
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
