# backend/seed_b1_3.py
"""
B1 roadmap, batch 3 — reading, more grammar, and speaking, the skills that
round out an intermediate level.

Reading: three connected B1 passages (a workday, a trip, a plan), each with
four comprehension questions. Grammar: comparatives & superlatives
(ավելի...քան / ամենա-), purpose clauses (որպեսզի / որ + subjunctive), and
frequency/degree adverbs (սովորաբար, հաճախ, չափազանց). Speaking: six spoken
B1 phrases with romanized hints.

Three chapters / seven lessons, cefr="B1" (gated behind the A2 assessment).
Standard Eastern Armenian, hand-checked. Chapters continue at positions 216+.
Idempotent (skips if 'b1-read-work' exists). Triggered via POST /cms/seed/b1-3.
"""

import json
from sqlalchemy import text

_XP = {"reading_comprehension": 15, "true_false": 10, "match_pairs": 15, "translate_mcq": 10,
       "select_missing_word": 10, "word_bank": 15, "sentence_order": 15, "speak": 15}
_CEFR = "B1"


def _reading(passage, question, choices, ai=0):
    return {"kind": "reading_comprehension", "prompt": question,
            "config": {"passage": passage, "question": question, "choices": choices, "answerIndex": ai}}
def _tf(s, c=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": c, "statement": s}}
def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}
def _tmcq(en, ch, ai):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{en}”?", "config": {"choices": ch, "sentence": en, "answerIndex": ai}}
def _smw(b, a, ch, ai=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.", "config": {"before": b, "after": a, "choices": ch, "answerIndex": ai}}
def _wb(s, t, sol):
    return {"kind": "word_bank", "prompt": "Build the sentence.", "config": {"sentence": s, "tiles": t, "solution": sol}}
def _so(p, t, sol):
    return {"kind": "sentence_order", "prompt": p, "config": {"tokens": t, "solution": sol}}
def _speak(target, roman):
    return {"kind": "speak", "prompt": "Say the phrase out loud", "config": {"target": target, "romanization": roman}}


_P1 = ("Արամը աշխատում է որպես ինժեներ մի մեծ ընկերությունում։ Ամեն առավոտ նա "
       "արթնանում է ժամը յոթին, նախաճաշում է և գնում աշխատանքի։ Նա սիրում է իր "
       "գործը, որովհետև ամեն օր նոր բան է սովորում։ Երեկոյան նա տուն է վերադառնում "
       "և ընթրում ընտանիքի հետ։")
_P2 = ("Անցյալ ամառ մենք գնացինք Գյումրի։ Գնացքը ուշացավ, բայց դա կարևոր չէր։ "
       "Քաղաքը շատ գեղեցիկ էր, և մարդիկ շատ բարի էին։ Մենք այցելեցինք հին "
       "եկեղեցիներ և կերանք տեղական ուտեստներ։ Ես հույս ունեմ, որ մի օր նորից կգնանք։")
_P3 = ("Ես ուզում եմ սովորել նոր լեզու։ Կարծում եմ, որ լեզուներ իմանալը շատ "
       "կարևոր է, որովհետև այն օգնում է հասկանալ այլ մշակույթներ։ Հաջորդ տարի ես "
       "կսկսեմ սովորել ֆրանսերեն։ Թեև դժվար կլինի, ես վստահ եմ, որ կհաջողվի։")


_LESSONS = [
    # ---------- B1 · Reading ----------
    ("B1 · Reading", 216, "b1-read-work", "A Working Day", [
        _reading(_P1, "Որտե՞ղ է աշխատում Արամը։", ["Մեծ ընկերությունում", "Դպրոցում", "Հիվանդանոցում", "Խանութում"], 0),
        _reading(_P1, "Ինչու՞ է նա սիրում իր գործը։", ["Ամեն օր նոր բան է սովորում", "Այն հեշտ է", "Այն մոտ է տանը", "Այն թանկ է"], 0),
        _reading(_P1, "Ժամը քանիսի՞ն է նա արթնանում։", ["Յոթին", "Ութին", "Վեցին", "Ինը"], 0),
        _reading(_P1, "Ո՞ւմ հետ է նա ընթրում։", ["Ընտանիքի", "Ընկերների", "Գործընկերների", "Մենակ"], 0),
    ]),
    ("B1 · Reading", 216, "b1-read-trip", "A Trip to Gyumri", [
        _reading(_P2, "Ու՞ր գնացին նրանք։", ["Գյումրի", "Երևան", "Վանաձոր", "Դիլիջան"], 0),
        _reading(_P2, "Ի՞նչ պատահեց գնացքի հետ։", ["Ուշացավ", "Չեկավ", "Արագ եկավ", "Փչացավ"], 0),
        _reading(_P2, "Ինչպիսի՞ն էին մարդիկ։", ["Բարի", "Չար", "Տխուր", "Հոգնած"], 0),
        _reading(_P2, "Ի՞նչ է ուզում անել հեղինակը մի օր։", ["Նորից գնալ", "Տուն վաճառել", "Աշխատել", "Սովորել"], 0),
    ]),
    ("B1 · Reading", 216, "b1-read-plan", "Learning a Language", [
        _reading(_P3, "Ի՞նչ է ուզում անել հեղինակը։", ["Սովորել նոր լեզու", "Գնել տուն", "Ճանապարհորդել", "Աշխատել"], 0),
        _reading(_P3, "Ինչու՞ է կարևոր լեզուներ իմանալը։", ["Օգնում է հասկանալ այլ մշակույթներ", "Հեշտ է", "Թանկ չէ", "Արագ է"], 0),
        _reading(_P3, "Ե՞րբ կսկսի նա ֆրանսերեն սովորել։", ["Հաջորդ տարի", "Այսօր", "Անցյալ տարի", "Երբեք"], 0),
        _reading(_P3, "Ինչպիսի՞ն կլինի դա, ըստ հեղինակի։", ["Դժվար", "Հեշտ", "Ձանձրալի", "Անհնար"], 0),
    ]),
    # ---------- B1 · More Grammar ----------
    ("B1 · More Grammar", 217, "b1-compare", "Comparisons", [
        _tf("A comparison uses «ավելի … քան» (more … than): «ավելի մեծ քան» = bigger than."),
        _smw("Երևանը ավելի մեծ է", "Գյումրին", ["քան", "և", "բայց"], 0),
        _tmcq("bigger", ["ավելի մեծ", "ամենամեծ", "փոքր", "մեծ"], 0),
        _tmcq("the biggest", ["ամենամեծ", "ավելի մեծ", "մեծ", "փոքր"], 0),
        _wb("This book is more interesting.", ["Այս", "գիրքը", "ավելի", "հետաքրքիր", "է"], ["Այս", "գիրքը", "ավելի", "հետաքրքիր", "է"]),
        _tf("«ամենալավ» means “the best.”"),
        _so("Arrange: “He is taller than me.”", ["Նա", "ավելի", "բարձր", "է", "քան", "ես"], ["Նա", "ավելի", "բարձր", "է", "քան", "ես"]),
    ]),
    ("B1 · More Grammar", 217, "b1-purpose", "Saying Why & What For", [
        _tf("«որպեսզի» means “so that / in order to”: «Ես սովորում եմ, որպեսզի իմանամ»."),
        _smw("Ես մարզվում եմ,", "առողջ լինեմ", ["որպեսզի", "որովհետև", "բայց"], 0),
        _tmcq("in order to / so that", ["որպեսզի", "որովհետև", "թեև", "ուստի"], 0),
        _wb("I came to help you.", ["Ես", "եկա", "որ", "օգնեմ", "քեզ"], ["Ես", "եկա", "որ", "օգնեմ", "քեզ"]),
        _tf("«որպեսզի» introduces a purpose."),
        _so("Arrange: “We work in order to live.”", ["Մենք", "աշխատում", "ենք", "որպեսզի", "ապրենք"], ["Մենք", "աշխատում", "ենք", "որպեսզի", "ապրենք"]),
        _tmcq("so that I know", ["որպեսզի իմանամ", "որովհետև գիտեմ", "թեև գիտեմ", "բայց գիտեմ"], 0),
    ]),
    ("B1 · More Grammar", 217, "b1-adverbs", "How Often & How Much", [
        _match([("սովորաբար", "usually"), ("հաճախ", "often"), ("հազվադեպ", "rarely"), ("միշտ", "always")]),
        _smw("Ես", "սուրճ եմ խմում առավոտյան", ["սովորաբար", "երբեք", "ոչ"], 0),
        _tmcq("usually", ["սովորաբար", "հաճախ", "երբեք", "միշտ"], 0),
        _tmcq("too (much)", ["չափազանց", "բավական", "քիչ", "մի"], 0),
        _tf("«հազվադեպ» means “rarely.”"),
        _wb("He often reads books.", ["Նա", "հաճախ", "գիրք", "է", "կարդում"], ["Նա", "հաճախ", "գիրք", "է", "կարդում"]),
        _tmcq("always", ["միշտ", "երբեք", "հաճախ", "հազվադեպ"], 0),
    ]),
    # ---------- B1 · Speaking ----------
    ("B1 · Speaking", 218, "b1-speak-1", "Speaking Your Mind", [
        _speak("Ես կարծում եմ, որ դա լավ գաղափար է", "Yes karcum em, vor da lav gaghapar e"),
        _speak("Ի՞նչ եք կարծում այս մասին", "Inch ek karcum ays masin"),
        _speak("Ես համաձայն եմ ձեզ հետ", "Yes hamadzayn em dzez het"),
        _speak("Կարո՞ղ եք ավելի դանդաղ խոսել", "Karogh ek aveli dandagh khosel"),
        _speak("Ցավոք, ես չեմ կարող գալ", "Tsavok, yes chem karogh gal"),
        _speak("Շնորհակալ եմ օգնության համար", "Shnorhakal em ognutyan hamar"),
    ]),
]


def seed_b1_3():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'b1-read-work'")).first():
            return {"ok": True, "skipped": True, "reason": "b1-read-work already exists"}
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
