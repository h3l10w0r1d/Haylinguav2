# backend/seed_b1_2.py
"""
B1 roadmap, batch 2 — grammar depth + topical breadth on top of the opener.
Grammar: conditionals (real + unreal), reported speech, and modals
(should/must/might). Topical: work & career, media & news, health & lifestyle,
and the environment.

Six chapters / nine lessons, cefr="B1" (gated behind the A2 assessment).
Established kinds + inflect. Standard Eastern Armenian, hand-checked.
Chapters continue at positions 205+. Idempotent (skips if 'b1-cond-real'
exists). Triggered via POST /cms/seed/b1-2.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10, "select_missing_word": 10,
       "word_bank": 15, "sentence_order": 15, "dialogue_mcq": 10, "inflect": 15}
_CEFR = "B1"


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}
def _tmcq(w, ch, ai):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{w}”?", "config": {"choices": ch, "sentence": w, "answerIndex": ai}}
def _tf(s, c=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": c, "statement": s}}
def _smw(b, a, ch, ai=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.", "config": {"before": b, "after": a, "choices": ch, "answerIndex": ai}}
def _wb(s, t, sol):
    return {"kind": "word_bank", "prompt": "Build the sentence.", "config": {"sentence": s, "tiles": t, "solution": sol}}
def _so(p, t, sol):
    return {"kind": "sentence_order", "prompt": p, "config": {"tokens": t, "solution": sol}}
def _dm(line, ch, ai):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?", "config": {"lines": [{"from": "them", "text": line}], "choices": ch, "answerIndex": ai}}
def _inf(base, gloss, target, ans):
    return {"kind": "inflect", "prompt": "Change the word to the form shown", "config": {"base": base, "baseGloss": gloss, "target": target, "answer": ans}}


_LESSONS = [
    # ---------- B1 · Conditionals ----------
    ("B1 · Conditionals", 205, "b1-cond-real", "Real Conditions", [
        _tf("A real condition uses «եթե» + the future «կ-»: «Եթե անձրև գա, կմնամ» (if it rains, I'll stay)."),
        _smw("Եթե ժամանակ ունենամ,", "", ["կգամ", "եկա", "գալիս եմ"], 0),
        _tmcq("if", ["եթե", "երբ", "որ", "ով"], 0),
        _wb("If it rains, I will stay home.", ["Եթե", "անձրև", "գա", "ես", "տանը", "կմնամ"], ["Եթե", "անձրև", "գա", "ես", "տանը", "կմնամ"]),
        _tf("«եթե» means “if.”"),
        _so("Arrange: “If you want, we will go.”", ["Եթե", "ուզես", "մենք", "կգնանք"], ["Եթե", "ուզես", "մենք", "կգնանք"]),
        _dm("Կգա՞ս, եթե ես զանգեմ։", ["Այո, կգամ", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
    ("B1 · Conditionals", 205, "b1-cond-unreal", "Unreal Conditions", [
        _tf("An unreal condition uses «կ-» + the imperfect: «Եթե հարուստ լինեի, կճանապարհորդեի» (if I were rich, I would travel)."),
        _smw("Եթե ես ժամանակ ունենայի,", "", ["կգայի", "կգամ", "եկա"], 0),
        _tmcq("I would travel", ["կճանապարհորդեի", "ճանապարհորդեցի", "կճանապարհորդեմ", "ճանապարհորդում եմ"], 0),
        _wb("If I were rich, I would help.", ["Եթե", "հարուստ", "լինեի", "կօգնեի"], ["Եթե", "հարուստ", "լինեի", "կօգնեի"]),
        _tf("«կգայի» means “I would come.”"),
        _so("Arrange: “If I knew, I would tell.”", ["Եթե", "իմանայի", "կասեի"], ["Եթե", "իմանայի", "կասեի"]),
        _tmcq("I would help", ["կօգնեի", "օգնեցի", "կօգնեմ", "օգնում եմ"], 0),
    ]),
    # ---------- B1 · Reported Speech & Modals ----------
    ("B1 · Reported Speech & Modals", 206, "b1-reported", "Reported Speech", [
        _tf("Reported speech uses «որ»: «Նա ասաց, որ գալիս է» (he said that he is coming)."),
        _smw("Նա ասաց,", "հոգնած է", ["որ", "բայց", "թեև"], 0),
        _tmcq("he said", ["ասաց", "ասում է", "կասի", "ասել է"], 0),
        _wb("She said that she is happy.", ["Նա", "ասաց", "որ", "ուրախ", "է"], ["Նա", "ասաց", "որ", "ուրախ", "է"]),
        _tf("«ասաց» means “said.”"),
        _so("Arrange: “He said that he would come.”", ["Նա", "ասաց", "որ", "կգա"], ["Նա", "ասաց", "որ", "կգա"]),
        _dm("Ի՞նչ ասաց Անին։", ["Ասաց, որ ուշանում է", "Ցտեսություն", "Բարև", "Այո"], 0),
    ]),
    ("B1 · Reported Speech & Modals", 206, "b1-modals", "Should & Must", [
        _match([("պետք է", "must / should"), ("կարող", "can / may"), ("հնարավոր է", "it is possible"), ("հարկավոր", "necessary")]),
        _smw("Ես", "գնամ", ["պետք է", "կարող", "հնարավոր"], 0),
        _tmcq("must / should", ["պետք է", "կարող", "ուզում", "գիտեմ"], 0),
        _wb("You should rest.", ["Դու", "պետք", "է", "հանգստանաս"], ["Դու", "պետք", "է", "հանգստանաս"]),
        _tf("«հնարավոր է» means “it is possible.”"),
        _so("Arrange: “He might come.”", ["Նա", "կարող", "է", "գալ"], ["Նա", "կարող", "է", "գալ"]),
        _tmcq("it's possible", ["հնարավոր է", "պետք է", "ուզում եմ", "գիտեմ"], 0),
    ]),
    # ---------- B1 · Work & Career ----------
    ("B1 · Work & Career", 207, "b1-work-office", "At Work", [
        _match([("աշխատանք", "job / work"), ("աշխատավարձ", "salary"), ("ղեկավար", "boss"), ("գործընկեր", "colleague")]),
        _tmcq("salary", ["աշխատավարձ", "աշխատանք", "գործ", "փող"], 0),
        _smw("Ես աշխատում եմ որպես", "", ["ուսուցիչ", "գիրք", "ջուր"], 0),
        _tf("«ղեկավար» means “boss / manager.”"),
        _wb("I like my job.", ["Ես", "սիրում", "եմ", "իմ", "աշխատանքը"], ["Ես", "սիրում", "եմ", "իմ", "աշխատանքը"]),
        _tmcq("colleague", ["գործընկեր", "ղեկավար", "ընկեր", "հարևան"], 0),
        _dm("Որտե՞ղ ես աշխատում։", ["Ես աշխատում եմ գրասենյակում", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
    ("B1 · Work & Career", 207, "b1-work-interview", "The Job Interview", [
        _match([("հարցազրույց", "interview"), ("փորձ", "experience"), ("ընկերություն", "company"), ("պաշտոն", "position")]),
        _tmcq("interview", ["հարցազրույց", "հանդիպում", "դաս", "պատմություն"], 0),
        _smw("Ես ունեմ երեք տարվա", "", ["փորձ", "գիրք", "ջուր"], 0),
        _tf("«ընկերություն» means “company.”"),
        _wb("I want to work here.", ["Ես", "ուզում", "եմ", "այստեղ", "աշխատել"], ["Ես", "ուզում", "եմ", "այստեղ", "աշխատել"]),
        _dm("Ինչու՞ եք ուզում այս պաշտոնը։", ["Որովհետև սիրում եմ այս գործը", "Ցտեսություն", "Բարև", "Ոչ"], 0),
        _tmcq("experience", ["փորձ", "պաշտոն", "հարցազրույց", "աշխատավարձ"], 0),
    ]),
    # ---------- B1 · Media & News ----------
    ("B1 · Media & News", 208, "b1-media", "In the News", [
        _match([("նորություն", "news"), ("թերթ", "newspaper"), ("հոդված", "article"), ("լրագրող", "journalist")]),
        _tmcq("news", ["նորություն", "պատմություն", "գիրք", "կարծիք"], 0),
        _smw("Ես ամեն օր կարդում եմ", "", ["նորությունները", "ջուր", "գնացք"], 0),
        _tf("«լրագրող» means “journalist.”"),
        _wb("I saw it on TV.", ["Ես", "դա", "տեսա", "հեռուստացույցով"], ["Ես", "դա", "տեսա", "հեռուստացույցով"]),
        _tmcq("article", ["հոդված", "թերթ", "գիրք", "նամակ"], 0),
        _dm("Լսե՞լ ես նորությունը։", ["Այո, կարդացի թերթում", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
    # ---------- B1 · Health & Lifestyle ----------
    ("B1 · Health & Lifestyle", 209, "b1-health", "Healthy Living", [
        _match([("առողջություն", "health"), ("սնունդ", "food / nutrition"), ("մարզվել", "to exercise"), ("քուն", "sleep")]),
        _tmcq("health", ["առողջություն", "հիվանդություն", "սնունդ", "քուն"], 0),
        _smw("Ես փորձում եմ առողջ", "", ["ապրել", "գիրք", "ջուր"], 0),
        _tf("«մարզվել» means “to exercise.”"),
        _wb("Sleep is important.", ["Քունը", "կարևոր", "է", "սնունդ"], ["Քունը", "կարևոր", "է"]),
        _tmcq("to exercise", ["մարզվել", "քնել", "ուտել", "աշխատել"], 0),
        _dm("Ինչպե՞ս ես առողջ մնում։", ["Ես ամեն օր մարզվում եմ", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
    # ---------- B1 · The Environment ----------
    ("B1 · The Environment", 210, "b1-env", "Nature & Environment", [
        _match([("բնություն", "nature"), ("միջավայր", "environment"), ("աղտոտվածություն", "pollution"), ("կլիմա", "climate")]),
        _tmcq("nature", ["բնություն", "քաղաք", "տուն", "գիրք"], 0),
        _smw("Մենք պետք է պաշտպանենք", "", ["բնությունը", "գիրք", "ջուր"], 0),
        _tf("«աղտոտվածություն» means “pollution.”"),
        _wb("We must recycle.", ["Մենք", "պետք", "է", "վերամշակենք"], ["Մենք", "պետք", "է", "վերամշակենք"]),
        _tmcq("climate", ["կլիմա", "բնություն", "եղանակ", "միջավայր"], 0),
        _tf("«բնություն» means “nature.”"),
    ]),
]


def seed_b1_2():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'b1-cond-real'")).first():
            return {"ok": True, "skipped": True, "reason": "b1-cond-real already exists"}
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
