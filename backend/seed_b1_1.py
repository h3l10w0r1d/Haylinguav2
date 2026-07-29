# backend/seed_b1_1.py
"""
B1 roadmap, opener — the first Intermediate content, taking the learner from
A2's simple sentences into the core B1 skills: expressing opinions, giving
reasons and contrast, relative clauses (որ/ով/որտեղ/երբ), talking about hopes
and plans, and the past in detail (imperfect + past perfect).

Five chapters / ten lessons, tagged cefr="B1" so the level system groups them
and the A2→B1 assessment gate opens once A2 is passed. Established kinds plus
inflect. Standard Eastern Armenian, hand-checked. Chapters at positions 200+.
Idempotent (skips if 'b1-opinion-express' exists). Triggered via
POST /cms/seed/b1-1.
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
    # ---------- B1 · Opinions & Ideas ----------
    ("B1 · Opinions & Ideas", 200, "b1-opinion-express", "Expressing Opinions", [
        _match([("կարծիք", "opinion"), ("մտածել", "to think"), ("ճիշտ", "right"), ("սխալ", "wrong")]),
        _tmcq("opinion", ["կարծիք", "գաղափար", "խնդիր", "պատմություն"], 0),
        _smw("Իմ կարծիքով,", "", ["սա լավ է", "գիրք", "ջուր"], 0),
        _wb("I think that this is true.", ["Ես", "կարծում", "եմ", "որ", "սա", "ճիշտ", "է"], ["Ես", "կարծում", "եմ", "որ", "սա", "ճիշտ", "է"]),
        _tf("«Ես կարծում եմ» means “I think.”"),
        _dm("Ի՞նչ ես կարծում։", ["Կարծում եմ, որ դա լավ է", "Ցտեսություն", "Բարև", "Ոչ"], 0),
        _so("Arrange: “In my opinion, it is good.”", ["Իմ", "կարծիքով", "դա", "լավ", "է"], ["Իմ", "կարծիքով", "դա", "լավ", "է"]),
    ]),
    ("B1 · Opinions & Ideas", 200, "b1-opinion-agree", "Agreeing & Disagreeing", [
        _match([("համաձայն", "in agreement"), ("դեմ", "against"), ("ճիշտ", "right"), ("սխալ", "wrong")]),
        _tmcq("I agree", ["համաձայն եմ", "դեմ եմ", "կարծում եմ", "ուզում եմ"], 0),
        _smw("Ես", "չեմ", ["համաձայն", "գիրք", "ջուր"], 0),
        _tf("«դեմ եմ» means “I am against.”"),
        _wb("I completely agree.", ["Ես", "լիովին", "համաձայն", "եմ"], ["Ես", "լիովին", "համաձայն", "եմ"]),
        _dm("Համաձա՞յն ես ինձ հետ։", ["Այո, համաձայն եմ", "Ցտեսություն", "Բարև", "Բժիշկ"], 0),
        _tmcq("wrong", ["սխալ", "ճիշտ", "լավ", "վատ"], 0),
    ]),
    # ---------- B1 · Reasons & Contrast ----------
    ("B1 · Reasons & Contrast", 201, "b1-reason-cause", "Because & So", [
        _match([("որովհետև", "because"), ("ուստի", "therefore"), ("պատճառ", "reason"), ("հետևանք", "result")]),
        _smw("Ես չեկա,", "հիվանդ էի", ["որովհետև", "բայց", "կամ"], 0),
        _tmcq("because", ["որովհետև", "բայց", "կամ", "թեև"], 0),
        _wb("It was raining, so I stayed home.", ["Անձրև", "էր", "ուստի", "ես", "տանը", "մնացի"], ["Անձրև", "էր", "ուստի", "ես", "տանը", "մնացի"]),
        _tf("«ուստի» means “therefore.”"),
        _so("Arrange: “I'm tired because I worked.”", ["Ես", "հոգնած", "եմ", "որովհետև", "աշխատեցի"], ["Ես", "հոգնած", "եմ", "որովհետև", "աշխատեցի"]),
        _tmcq("reason", ["պատճառ", "հետևանք", "կարծիք", "գիրք"], 0),
    ]),
    ("B1 · Reasons & Contrast", 201, "b1-reason-contrast", "Although & But", [
        _match([("թեև", "although"), ("բայց", "but"), ("չնայած", "despite"), ("սակայն", "however")]),
        _smw("", "անձրև էր, ես գնացի", ["Թեև", "Որովհետև", "Ուստի"], 0),
        _tmcq("although", ["թեև", "որովհետև", "ուստի", "կամ"], 0),
        _tf("«բայց» means “but.”"),
        _wb("I want to come but I can't.", ["Ես", "ուզում", "եմ", "գալ", "բայց", "չեմ", "կարող"], ["Ես", "ուզում", "եմ", "գալ", "բայց", "չեմ", "կարող"]),
        _dm("Կգա՞ս վաղը։", ["Ուզում եմ, բայց չեմ կարող", "Ցտեսություն", "Բարև", "Այո"], 0),
        _tmcq("however", ["սակայն", "որովհետև", "ուստի", "թեև"], 0),
    ]),
    # ---------- B1 · Relative Clauses ----------
    ("B1 · Relative Clauses", 202, "b1-rel-who", "Who & That (որ / ով)", [
        _tf("Use «ով» for people and «որ» for things: «մարդը, ով…» / «գիրքը, որ…»."),
        _smw("Գիրքը,", "ես կարդում եմ, հետաքրքիր է", ["որ", "ով", "որտեղ"], 0),
        _tmcq("who", ["ով", "որ", "որտեղ", "երբ"], 0),
        _wb("The man who is speaking is my father.", ["Մարդը", "ով", "խոսում", "է", "իմ", "հայրն", "է"], ["Մարդը", "ով", "խոսում", "է", "իմ", "հայրն", "է"]),
        _tf("«որ» is used for things."),
        _so("Arrange: “The book that I read.”", ["Գիրքը", "որ", "ես", "կարդացի"], ["Գիրքը", "որ", "ես", "կարդացի"]),
        _smw("Մարդը,", "այնտեղ է, իմ ընկերն է", ["ով", "որ", "երբ"], 0),
    ]),
    ("B1 · Relative Clauses", 202, "b1-rel-where", "Where & When", [
        _match([("որտեղ", "where"), ("երբ", "when"), ("ով", "who"), ("որ", "that")]),
        _smw("Այն տունը,", "ես ապրում եմ, մեծ է", ["որտեղ", "ով", "որ"], 0),
        _tmcq("where", ["որտեղ", "երբ", "ով", "ինչ"], 0),
        _wb("The day when we met.", ["Այն", "օրը", "երբ", "մենք", "հանդիպեցինք"], ["Այն", "օրը", "երբ", "մենք", "հանդիպեցինք"]),
        _tf("«երբ» can introduce a time clause."),
        _so("Arrange: “The city where I was born.”", ["Այն", "քաղաքը", "որտեղ", "ես", "ծնվեցի"], ["Այն", "քաղաքը", "որտեղ", "ես", "ծնվեցի"]),
        _tmcq("when", ["երբ", "որտեղ", "ով", "ինչու"], 0),
    ]),
    # ---------- B1 · Hopes & Plans ----------
    ("B1 · Hopes & Plans", 203, "b1-hope-ambition", "Ambitions", [
        _match([("երազանք", "dream"), ("ապագա", "future"), ("դառնալ", "to become"), ("նպատակ", "goal")]),
        _tmcq("to become", ["դառնալ", "ուզել", "գնալ", "ապրել"], 0),
        _smw("Ես ուզում եմ դառնալ", "", ["բժիշկ", "գիրք", "ջուր"], 0),
        _wb("My dream is to travel.", ["Իմ", "երազանքն", "է", "ճանապարհորդել"], ["Իմ", "երազանքն", "է", "ճանապարհորդել"]),
        _tf("«ապագա» means “future.”"),
        _dm("Ի՞նչ ես ուզում դառնալ։", ["Ուզում եմ դառնալ ուսուցիչ", "Ցտեսություն", "Բարև", "Ոչ"], 0),
        _tmcq("goal", ["նպատակ", "երազանք", "պատճառ", "կարծիք"], 0),
    ]),
    ("B1 · Hopes & Plans", 203, "b1-hope-wish", "Hopes & Wishes", [
        _match([("հույս", "hope"), ("ցանկություն", "wish"), ("հուսալ", "to hope"), ("ուզել", "to want")]),
        _smw("Հույս ունեմ,", "ամեն ինչ լավ կլինի", ["որ", "բայց", "թեև"], 0),
        _tmcq("hope", ["հույս", "երազանք", "կարծիք", "նպատակ"], 0),
        _wb("I hope to see you.", ["Հույս", "ունեմ", "քեզ", "տեսնել"], ["Հույս", "ունեմ", "քեզ", "տեսնել"]),
        _tf("«հուսալ» means “to hope.”"),
        _so("Arrange: “I hope that you are well.”", ["Հույս", "ունեմ", "որ", "լավ", "ես"], ["Հույս", "ունեմ", "որ", "լավ", "ես"]),
        _tmcq("wish", ["ցանկություն", "հույս", "նպատակ", "պատճառ"], 0),
    ]),
    # ---------- B1 · The Past in Detail ----------
    ("B1 · The Past in Detail", 204, "b1-past-imperfect", "When I Was Young", [
        _tf("The imperfect describes the habitual past: «խաղում էի» = I used to play / was playing."),
        _smw("Երբ երեխա էի, ես շատ", "", ["խաղում էի", "խաղացի", "կխաղամ"], 0),
        _tmcq("I used to play", ["խաղում էի", "խաղացի", "կխաղամ", "խաղում եմ"], 0),
        _wb("I used to live in Yerevan.", ["Ես", "ապրում", "էի", "Երևանում"], ["Ես", "ապրում", "էի", "Երևանում"]),
        _tf("«էի» is the past of «եմ» (I was)."),
        _inf("ապրել", "to live", "Imperfect · “I” (used to)", "ապրում էի"),
        _so("Arrange: “I was reading a book.”", ["Ես", "գիրք", "էի", "կարդում"], ["Ես", "գիրք", "էի", "կարդում"]),
    ]),
    ("B1 · The Past in Detail", 204, "b1-past-perfect", "It Had Happened", [
        _tf("The past perfect = the «-ել» participle + «էի»: «կերել էի» = I had eaten."),
        _smw("Երբ նա եկավ, ես արդեն", "", ["կերել էի", "ուտում եմ", "կուտեմ"], 0),
        _tmcq("I had written", ["գրել էի", "գրեցի", "գրում էի", "կգրեմ"], 0),
        _wb("I had already left.", ["Ես", "արդեն", "գնացել", "էի"], ["Ես", "արդեն", "գնացել", "էի"]),
        _tf("«կերել էի» means “I had eaten.”"),
        _inf("գրել", "to write", "Past perfect · “I” (had written)", "գրել էի"),
        _so("Arrange: “She had seen the film.”", ["Նա", "ֆիլմը", "տեսել", "էր"], ["Նա", "ֆիլմը", "տեսել", "էր"]),
    ]),
]


def seed_b1_1():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'b1-opinion-express'")).first():
            return {"ok": True, "skipped": True, "reason": "b1-opinion-express already exists"}
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
