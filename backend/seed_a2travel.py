# backend/seed_a2travel.py
"""
A2 · Travel, Communication & Stories — more practical, connected A2 content
across three real-world areas: travelling (airport, hotel, tickets & directions),
communicating (on the phone, asking for help), and telling stories in the past
tense (my weekend, yesterday). A varied mix of exercise kinds, including the
now-server-graded `inflect` and `listen_image`.

Authored live via single-create (accepts any kind). Standard Eastern Armenian,
hand-checked. Tagged cefr="A2", chapters at positions 133+. Idempotent (skips
if 'a2-travel-airport' exists). Triggered via POST /cms/seed/a2travel.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10, "select_missing_word": 10,
       "word_bank": 15, "sentence_order": 15, "dialogue_mcq": 10, "inflect": 15, "listen_image": 10}
_CEFR = "A2"


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
def _limg(tts, ch, ai):
    return {"kind": "listen_image", "prompt": "Which one do you hear?", "config": {"ttsText": tts, "choices": [{"emoji": e, "label": l} for e, l in ch], "answerIndex": ai}}


_LESSONS = [
    # ---------- A2 · Travel ----------
    ("A2 · Travel", 133, "a2-travel-airport", "At the Airport", [
        _match([("օդանավակայան", "airport"), ("անձնագիր", "passport"), ("ուղեբեռ", "luggage"), ("թռիչք", "flight")]),
        _tmcq("passport", ["անձնագիր", "տոմս", "ուղեբեռ", "գիրք"], 0),
        _smw("Որտե՞ղ է իմ", "", ["ուղեբեռը", "գիրք", "ջուր"], 0),
        _tf("«անձնագիր» means “passport.”"),
        _wb("I have a ticket.", ["Ես", "տոմս", "ունեմ", "ուղեբեռ"], ["Ես", "տոմս", "ունեմ"]),
        _dm("Ձեր անձնագիրը, խնդրում եմ։", ["Ահա, խնդրեմ", "Ցտեսություն", "Բարև", "Ոչ"], 0),
        _limg("ինքնաթիռ", [("✈️", "airplane"), ("🚗", "car"), ("🚢", "ship"), ("🚆", "train")], 0),
    ]),
    ("A2 · Travel", 133, "a2-travel-hotel", "At the Hotel", [
        _match([("հյուրանոց", "hotel"), ("սենյակ", "room"), ("բանալի", "key"), ("գիշեր", "night")]),
        _tmcq("hotel", ["հյուրանոց", "ռեստորան", "խանութ", "տուն"], 0),
        _smw("Ես ամրագրել եմ", "", ["սենյակ", "ջուր", "գնացք"], 0),
        _tf("«բանալի» means “door.”", c=False),
        _wb("How much is one night?", ["Որքա՞ն", "է", "մեկ", "գիշերը"], ["Որքա՞ն", "է", "մեկ", "գիշերը"]),
        _dm("Քանի՞ գիշեր։", ["Երկու գիշեր", "Շնորհակալ եմ", "Բարև", "Ոչ"], 0),
        _tmcq("key", ["բանալի", "դուռ", "սենյակ", "տոմս"], 0),
    ]),
    ("A2 · Travel", 133, "a2-travel-tickets", "Tickets & Directions", [
        _match([("տոմս", "ticket"), ("կայարան", "station"), ("քարտեզ", "map"), ("ուղղություն", "direction")]),
        _tmcq("ticket", ["տոմս", "բանալի", "գիրք", "փող"], 0),
        _smw("Ինձ պետք է", "", ["տոմս", "ջուր", "գնացք"], 0),
        _tf("«կայարան» means “station.”"),
        _so("Arrange: “Where is the station?”", ["Որտե՞ղ", "է", "կայարանը"], ["Որտե՞ղ", "է", "կայարանը"]),
        _dm("Ինչպե՞ս հասնեմ կայարան։", ["Գնացեք ուղիղ", "Շնորհակալ եմ", "Բարև", "Ոչ"], 0),
        _tmcq("map", ["քարտեզ", "տոմս", "գիրք", "բանալի"], 0),
    ]),
    # ---------- A2 · Communication ----------
    ("A2 · Communication", 134, "a2-comm-phone", "On the Phone", [
        _match([("հեռախոս", "phone"), ("զանգել", "to call"), ("համար", "number"), ("հաղորդագրություն", "message")]),
        _tmcq("to call", ["զանգել", "գրել", "կարդալ", "խաղալ"], 0),
        _smw("Ես կզանգեմ", "", ["քեզ", "գիրք", "ջուր"], 0),
        _tf("«համար» means “number.”"),
        _wb("What is your number?", ["Ի՞նչ", "է", "քո", "համարը"], ["Ի՞նչ", "է", "քո", "համարը"]),
        _dm("Ալո, ո՞վ է։", ["Բարև, ես Անին եմ", "Ցտեսություն", "Ոչ", "Այո"], 0),
        _tmcq("message", ["հաղորդագրություն", "զանգ", "համար", "գիրք"], 0),
    ]),
    ("A2 · Communication", 134, "a2-comm-help", "Asking for Help", [
        _match([("օգնություն", "help"), ("խնդիր", "problem"), ("հարցնել", "to ask"), ("պատասխանել", "to answer")]),
        _tmcq("help", ["օգնություն", "խնդիր", "գիրք", "ջուր"], 0),
        _smw("Կարո՞ղ եք", "ինձ", ["օգնել", "քնել", "ուտել"], 0),
        _tf("«հարցնել» means “to ask.”"),
        _wb("I have a problem.", ["Ես", "խնդիր", "ունեմ", "օգնություն"], ["Ես", "խնդիր", "ունեմ"]),
        _dm("Կարո՞ղ եմ օգնել։", ["Այո, խնդրում եմ", "Ցտեսություն", "Բարև", "Բժիշկ"], 0),
        _tmcq("to answer", ["պատասխանել", "հարցնել", "գրել", "վազել"], 0),
    ]),
    # ---------- A2 · Telling Stories ----------
    ("A2 · Telling Stories", 135, "a2-story-weekend", "My Weekend", [
        _tf("The past tense of «գնալ» is «գնացի» (I went)."),
        _smw("Շաբաթ օրը ես", "կինո", ["գնացի", "գնում եմ", "կգնամ"], 0),
        _wb("Yesterday I saw a film.", ["Երեկ", "ես", "ֆիլմ", "տեսա"], ["Երեկ", "ես", "ֆիլմ", "տեսա"]),
        _tmcq("I went", ["գնացի", "գնում եմ", "կգնամ", "գնացել եմ"], 0),
        _so("Arrange: “I rested on Sunday.”", ["Կիրակի", "ես", "հանգստացա"], ["Կիրակի", "ես", "հանգստացա"]),
        _inf("տեսնել", "to see", "Past · “I”", "տեսա"),
        _dm("Ի՞նչ արեցիր երեկ։", ["Ես գնացի կինո", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
    ("A2 · Telling Stories", 135, "a2-story-yesterday", "Yesterday", [
        _tmcq("yesterday", ["երեկ", "վաղը", "այսօր", "հիմա"], 0),
        _smw("Երեկ ես", "հայերեն", ["սովորեցի", "սովորում եմ", "կսովորեմ"], 0),
        _wb("I ate bread.", ["Ես", "հաց", "կերա", "խմեցի"], ["Ես", "հաց", "կերա"]),
        _inf("խմել", "to drink", "Past · “I”", "խմեցի"),
        _tf("«կերա» means “I ate.”"),
        _so("Arrange: “I wrote a letter.”", ["Ես", "նամակ", "գրեցի"], ["Ես", "նամակ", "գրեցի"]),
        _tmcq("I did", ["արեցի", "անում եմ", "կանեմ", "արել եմ"], 0),
    ]),
]


def seed_a2travel():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-travel-airport'")).first():
            return {"ok": True, "skipped": True, "reason": "a2-travel-airport already exists"}
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
