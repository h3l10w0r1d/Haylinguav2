# backend/seed_b1_4.py
"""
B1 roadmap, batch 4 — the finisher: listening, real conversations, and a
checkpoint review that ties the level together.

Listening: type-what-you-hear and tap-what-you-hear over B1 sentences.
Conversations: three full functional scenarios (making plans, at a restaurant
with a polite complaint, asking directions) as order-the-dialogue plus
respond/vocab drills. Checkpoint: a mixed capstone pulling from every B1 theme.

Four chapters / six lessons, cefr="B1" (gated behind the A2 assessment).
Standard Eastern Armenian, hand-checked. Chapters continue at positions 219+.
Idempotent (skips if 'b1-listen-1' exists). Triggered via POST /cms/seed/b1-4.
"""

import json
from sqlalchemy import text

_XP = {"listen_type": 15, "listen_word_bank": 15, "dialogue_order": 15, "dialogue_mcq": 10,
       "multi_select": 10, "word_bank": 15, "match_pairs": 15, "translate_mcq": 10,
       "select_missing_word": 10, "true_false": 10, "sentence_order": 15}
_CEFR = "B1"


def _listen(tts, accepted):
    return {"kind": "listen_type", "prompt": "Type what you hear", "config": {"ttsText": tts, "acceptedAnswers": accepted}}
def _lwb(tts, tiles, sol):
    return {"kind": "listen_word_bank", "prompt": "Tap what you hear", "config": {"ttsText": tts, "tiles": tiles, "solution": sol}}
def _dorder(lines):
    return {"kind": "dialogue_order", "prompt": "Put the conversation in order.", "config": {"lines": lines, "solution": lines}}
def _dm(line, ch, ai):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?", "config": {"lines": [{"from": "them", "text": line}], "choices": ch, "answerIndex": ai}}
def _multi(prompt, ch, idxs):
    return {"kind": "multi_select", "prompt": prompt, "config": {"choices": ch, "correctIndices": idxs}}
def _wb(s, t, sol):
    return {"kind": "word_bank", "prompt": "Build the sentence.", "config": {"sentence": s, "tiles": t, "solution": sol}}
def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.", "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}
def _tmcq(en, ch, ai):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{en}”?", "config": {"choices": ch, "sentence": en, "answerIndex": ai}}
def _smw(b, a, ch, ai=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.", "config": {"before": b, "after": a, "choices": ch, "answerIndex": ai}}
def _tf(s, c=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": c, "statement": s}}
def _so(p, t, sol):
    return {"kind": "sentence_order", "prompt": p, "config": {"tokens": t, "solution": sol}}


_LESSONS = [
    # ---------- B1 · Listening ----------
    ("B1 · Listening", 219, "b1-listen-1", "Type What You Hear", [
        _listen("Ես կարծում եմ, որ դա ճիշտ է", ["Ես կարծում եմ, որ դա ճիշտ է", "Ես կարծում եմ որ դա ճիշտ է"]),
        _listen("Նա ասաց, որ ուշանում է", ["Նա ասաց, որ ուշանում է", "Նա ասաց որ ուշանում է"]),
        _listen("Ես ուզում եմ դառնալ բժիշկ", ["Ես ուզում եմ դառնալ բժիշկ"]),
        _listen("Հույս ունեմ, որ ամեն ինչ լավ կլինի", ["Հույս ունեմ, որ ամեն ինչ լավ կլինի", "Հույս ունեմ որ ամեն ինչ լավ կլինի"]),
        _listen("Երբ երեխա էի, ես շատ էի խաղում", ["Երբ երեխա էի, ես շատ էի խաղում", "Երբ երեխա էի ես շատ էի խաղում"]),
    ]),
    ("B1 · Listening", 219, "b1-listen-2", "Tap What You Hear", [
        _lwb("Ես ուզում եմ սովորել նոր լեզու", ["Ես", "ուզում", "եմ", "սովորել", "նոր", "լեզու", "գիրք"], ["Ես", "ուզում", "եմ", "սովորել", "նոր", "լեզու"]),
        _lwb("Այս գիրքը շատ հետաքրքիր է", ["Այս", "գիրքը", "շատ", "հետաքրքիր", "է", "վատ"], ["Այս", "գիրքը", "շատ", "հետաքրքիր", "է"]),
        _lwb("Մենք պետք է աշխատենք միասին", ["Մենք", "պետք", "է", "աշխատենք", "միասին", "տանը"], ["Մենք", "պետք", "է", "աշխատենք", "միասին"]),
        _lwb("Ես համաձայն եմ քեզ հետ", ["Ես", "համաձայն", "եմ", "քեզ", "հետ", "ոչ"], ["Ես", "համաձայն", "եմ", "քեզ", "հետ"]),
        _lwb("Վաղը եղանակը լավ կլինի", ["Վաղը", "եղանակը", "լավ", "կլինի", "վատ"], ["Վաղը", "եղանակը", "լավ", "կլինի"]),
    ]),
    # ---------- B1 · Real Conversations ----------
    ("B1 · Real Conversations", 220, "b1-conv-plans", "Making Plans", [
        _dorder(["Բարև, ի՞նչ ես անում այս շաբաթ օրը։", "Դեռ ոչինչ չեմ պլանավորել։ Ինչու՞։",
                 "Ուզո՞ւմ ես գնալ կինո։", "Հիանալի գաղափար է։ Ժամը քանիսի՞ն։", "Եկեք հանդիպենք ժամը յոթին։"]),
        _dm("Ուզո՞ւմ ես գնալ կինո։", ["Հիանալի գաղափար է", "Ցտեսություն", "Ես բժիշկ եմ", "Կարմիր"], 0),
        _dm("Ժամը քանիսի՞ն հանդիպենք։", ["Ժամը յոթին", "Ցտեսություն", "Ես ուսանող եմ", "Կապույտ"], 0),
        _multi("Select all the ways to agree.", ["Հիանալի գաղափար է", "Ցտեսություն", "Համաձայն եմ", "Ոչ"], [0, 2]),
        _wb("Let's meet at seven.", ["Եկեք", "հանդիպենք", "ժամը", "յոթին"], ["Եկեք", "հանդիպենք", "ժամը", "յոթին"]),
    ]),
    ("B1 · Real Conversations", 220, "b1-conv-restaurant", "At the Restaurant", [
        _dorder(["Բարև, կարո՞ղ եմ պատվիրել։", "Այո, իհարկե։ Ի՞նչ կցանկանաք։",
                 "Ես կցանկանայի ապուր և հաց։", "Ներողություն, ապուրը սառն է։", "Ցավում եմ, անմիջապես կփոխեմ։"]),
        _dm("Ի՞նչ կցանկանաք։", ["Ես կցանկանայի ապուր", "Ցտեսություն", "Ես ուսուցիչ եմ", "Կարմիր"], 0),
        _dm("Ներողություն, ապուրը սառն է։", ["Ցավում եմ, անմիջապես կփոխեմ", "Բարև", "Ես ուսանող եմ", "Կապույտ"], 0),
        _multi("Select all the polite phrases.", ["Ներողություն", "Ցավում եմ", "Գնա՛", "Իհարկե"], [0, 1, 3]),
        _wb("I would like soup and bread.", ["Ես", "կցանկանայի", "ապուր", "և", "հաց"], ["Ես", "կցանկանայի", "ապուր", "և", "հաց"]),
    ]),
    ("B1 · Real Conversations", 220, "b1-conv-directions", "Asking Directions", [
        _dorder(["Ներողություն, որտե՞ղ է կայարանը։", "Գնացեք ուղիղ, հետո թեքվեք աջ։",
                 "Հեռու՞ է այստեղից։", "Ոչ, մոտ հինգ րոպե ոտքով։", "Շատ շնորհակալ եմ ձեր օգնության համար։"]),
        _dm("Հեռու՞ է այստեղից։", ["Ոչ, մոտ հինգ րոպե ոտքով", "Ես բժիշկ եմ", "Ցտեսություն", "Կարմիր"], 0),
        _dm("Ներողություն, որտե՞ղ է կայարանը։", ["Գնացեք ուղիղ, հետո թեքվեք աջ", "Ես ուսանող եմ", "Ցտեսություն", "Կապույտ"], 0),
        _multi("Select all the direction words.", ["ուղիղ", "աջ", "ապուր", "ձախ"], [0, 1, 3]),
        _wb("Go straight and turn right.", ["Գնացեք", "ուղիղ", "և", "թեքվեք", "աջ"], ["Գնացեք", "ուղիղ", "և", "թեքվեք", "աջ"]),
    ]),
    # ---------- B1 · Checkpoint ----------
    ("B1 · Checkpoint", 221, "b1-checkpoint", "B1 Review", [
        _match([("կարծիք", "opinion"), ("որովհետև", "because"), ("թեև", "although"), ("հույս", "hope")]),
        _smw("Եթե ժամանակ ունենամ,", "", ["կգամ", "եկա", "գալիս եմ"], 0),
        _tf("«Նա ասաց, որ գալիս է» means “He said that he is coming.”"),
        _tmcq("in order to / so that", ["որպեսզի", "որովհետև", "թեև", "բայց"], 0),
        _wb("This book is more interesting.", ["Այս", "գիրքը", "ավելի", "հետաքրքիր", "է"], ["Այս", "գիրքը", "ավելի", "հետաքրքիր", "է"]),
        _so("Arrange: “If I were rich, I would help.”", ["Եթե", "հարուստ", "լինեի", "կօգնեի"], ["Եթե", "հարուստ", "լինեի", "կօգնեի"]),
        _tmcq("although", ["թեև", "որովհետև", "ուստի", "կամ"], 0),
        _dm("Ի՞նչ ես կարծում այս մասին։", ["Կարծում եմ, որ դա լավ է", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
]


def seed_b1_4():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'b1-listen-1'")).first():
            return {"ok": True, "skipped": True, "reason": "b1-listen-1 already exists"}
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
