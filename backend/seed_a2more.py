# backend/seed_a2more.py
"""
A2 functional + grammar depth — hand-crafted, connected-sentence practice to
balance the large vocabulary layer. Four chapters:

- About Yourself: introductions, where you live, work & study.
- Plurals & Possessives: -եր / -ներ plurals, իմ/քո/նրա possessives.
- Asking Questions: question words + small talk.
- Daily Actions: the present tense with common verbs.

Established exercise kinds only. Standard Eastern Armenian, hand-checked. Tagged
cefr="A2", chapters at positions 120+. Idempotent (skips if 'a2-self-intro'
exists). Triggered via POST /cms/seed/a2more.
"""

import json
from sqlalchemy import text

_XP = {"match_pairs": 15, "translate_mcq": 10, "true_false": 10,
       "select_missing_word": 10, "word_bank": 15, "sentence_order": 15,
       "dialogue_mcq": 10}
_CEFR = "A2"


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _tmcq(word, choices, ai):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{word}”?",
            "config": {"choices": choices, "sentence": word, "answerIndex": ai}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?",
            "config": {"correct": correct, "statement": statement}}


def _smw(before, after, choices, ai=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.",
            "config": {"before": before, "after": after, "choices": choices, "answerIndex": ai}}


def _wb(sentence, tiles, solution):
    return {"kind": "word_bank", "prompt": "Build the sentence.",
            "config": {"sentence": sentence, "tiles": tiles, "solution": solution}}


def _so(prompt, tokens, solution):
    return {"kind": "sentence_order", "prompt": prompt, "config": {"tokens": tokens, "solution": solution}}


def _dm(their_line, choices, ai):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?",
            "config": {"lines": [{"from": "them", "text": their_line}], "choices": choices, "answerIndex": ai}}


_LESSONS = [
    # ---------- A2 · About Yourself ----------
    ("A2 · About Yourself", 120, "a2-self-intro", "Introducing Yourself", [
        _match([("անուն", "name"), ("տարիք", "age"), ("ազգություն", "nationality"), ("զբաղմունք", "occupation")]),
        _smw("Իմ անունը", "է", ["Արամ", "գիրք", "ջուր"], 0),          # My name is Aram
        _wb("I am from Armenia.", ["Ես", "Հայաստանից", "եմ", "քաղաքից"], ["Ես", "Հայաստանից", "եմ"]),
        _tf("«տարիք» means “age.”"),
        _so("Arrange: “I am twenty years old.”", ["Ես", "քսան", "տարեկան", "եմ"], ["Ես", "քսան", "տարեկան", "եմ"]),
        _dm("Ի՞նչ է քո անունը։", ["Իմ անունը Անի է", "Շնորհակալություն", "Ցտեսություն", "Այո"], 0),
        _tmcq("name", ["անուն", "տարիք", "տուն", "գիրք"], 0),
    ]),
    ("A2 · About Yourself", 120, "a2-self-live", "Where You Live", [
        _tmcq("to live", ["ապրել", "աշխատել", "սովորել", "խաղալ"], 0),
        _smw("Ես ապրում եմ", "", ["Երևանում", "գիրք", "ջուր"], 0),    # I live in Yerevan
        _wb("I live in the city.", ["Ես", "ապրում", "եմ", "քաղաքում"], ["Ես", "ապրում", "եմ", "քաղաքում"]),
        _tf("«ապրել» means “to work.”", correct=False),
        _dm("Որտե՞ղ ես ապրում։", ["Երևանում", "Շնորհակալ եմ", "Բարև", "Ոչ"], 0),
        _so("Arrange: “I live in Armenia.”", ["Ես", "Հայաստանում", "ապրում", "եմ"], ["Ես", "Հայաստանում", "ապրում", "եմ"]),
        _smw("Իմ քաղաքը", "է", ["գեղեցիկ", "ջուր", "գնացք"], 0),      # My city is beautiful
    ]),
    ("A2 · About Yourself", 120, "a2-self-work", "Work & Study", [
        _tmcq("student", ["ուսանող", "ուսուցիչ", "բժիշկ", "վարորդ"], 0),
        _smw("Ես", "եմ", ["ուսանող", "ջուր", "տուն"], 0),            # I am a student
        _wb("I study Armenian.", ["Ես", "հայերեն", "եմ", "սովորում"], ["Ես", "հայերեն", "եմ", "սովորում"]),
        _tf("«աշխատել» means “to study.”", correct=False),
        _dm("Ի՞նչ ես անում։", ["Ես ուսանող եմ", "Ցտեսություն", "Խնդրեմ", "Ոչ"], 0),
        _so("Arrange: “I work at a school.”", ["Ես", "դպրոցում", "աշխատում", "եմ"], ["Ես", "դպրոցում", "աշխատում", "եմ"]),
        _tmcq("to work", ["աշխատել", "ապրել", "խաղալ", "քնել"], 0),
    ]),
    # ---------- A2 · Plurals & Possessives ----------
    ("A2 · Plurals & Possessives", 121, "a2-gram-plural", "Making Plurals", [
        _tf("One-syllable words take «-եր»: գիրք → գրքեր (books)."),
        _match([("գրքեր", "books"), ("կատուներ", "cats"), ("տներ", "houses"), ("աշակերտներ", "pupils")]),
        _tmcq("books", ["գրքեր", "գիրք", "գրքով", "գրքի"], 0),
        _smw("Դրանք", "են", ["գրքեր", "գիրք", "գրքով"], 0),          # Those are books
        _so("Arrange: “These are cats.”", ["Սրանք", "կատուներ", "են"], ["Սրանք", "կատուներ", "են"]),
        _tf("Words of more than one syllable take «-ներ» (կատու → կատուներ)."),
        _tmcq("houses", ["տներ", "տուն", "տանը", "տնով"], 0),
    ]),
    ("A2 · Plurals & Possessives", 121, "a2-gram-poss", "My, Your, Their", [
        _match([("իմ", "my"), ("քո", "your"), ("նրա", "his/her"), ("մեր", "our")]),
        _tmcq("my", ["իմ", "քո", "նրա", "մեր"], 0),
        _smw("", "անունը Անի է", ["Իմ", "Գիրք", "Ջուր"], 0),         # My name is Ani
        _wb("This is my house.", ["Սա", "իմ", "տունն", "է"], ["Սա", "իմ", "տունն", "է"]),
        _tf("«մեր» means “our.”"),
        _tmcq("your", ["քո", "իմ", "նրա", "ձեր"], 0),
        _so("Arrange: “Her name is Ani.”", ["Նրա", "անունը", "Անի", "է"], ["Նրա", "անունը", "Անի", "է"]),
    ]),
    # ---------- A2 · Asking Questions ----------
    ("A2 · Asking Questions", 122, "a2-q-basics", "Question Words", [
        _match([("ո՞վ", "who"), ("ի՞նչ", "what"), ("որտե՞ղ", "where"), ("ե՞րբ", "when")]),
        _tmcq("who", ["ո՞վ", "ի՞նչ", "ինչու՞", "ինչպե՞ս"], 0),
        _smw("", "ես դու", ["Ո՞վ", "Գիրք", "Ջուր"], 0),              # Who are you
        _tf("«ինչու՞» means “why.”"),
        _tmcq("where", ["որտե՞ղ", "ե՞րբ", "ո՞վ", "որքա՞ն"], 0),
        _so("Arrange: “When do you come?”", ["Ե՞րբ", "ես", "գալիս"], ["Ե՞րբ", "ես", "գալիս"]),
        _dm("Որքա՞ն արժե սա։", ["Հազար դրամ", "Բարև", "Այո", "Ցտեսություն"], 0),
    ]),
    ("A2 · Asking Questions", 122, "a2-q-smalltalk", "Small Talk", [
        _dm("Ինչպե՞ս ես։", ["Լավ եմ, շնորհակալ եմ", "Ցտեսություն", "Բժիշկ", "Ոչ"], 0),
        _dm("Որտեղացի՞ ես։", ["Ես Հայաստանից եմ", "Շնորհակալ եմ", "Բարև", "Այո"], 0),
        _smw("Շատ", "եմ քեզ հանդիպելու համար", ["ուրախ", "ջուր", "գիրք"], 0),  # Very glad to meet you
        _tf("«Ինչպե՞ս ես» means “How are you?”"),
        _wb("Nice to meet you.", ["Ուրախ", "եմ", "ծանոթանալու", "համար"], ["Ուրախ", "եմ", "ծանոթանալու", "համար"]),
        _dm("Ի՞նչ ես անում այսօր։", ["Ես աշխատում եմ", "Ցտեսություն", "Ոչ", "Խնդրեմ"], 0),
        _tmcq("thank you", ["շնորհակալություն", "բարև", "ցտեսություն", "այո"], 0),
    ]),
    # ---------- A2 · Daily Actions ----------
    ("A2 · Daily Actions", 123, "a2-act-present", "What I Do", [
        _tf("The present tense = stem + «-ում» + «եմ»: խմել → խմում եմ (I drink)."),
        _smw("Ես ամեն օր սուրճ", "", ["խմում եմ", "խմեցի", "կխմեմ"], 0),   # I drink coffee every day
        _wb("I read a book.", ["Ես", "գիրք", "եմ", "կարդում"], ["Ես", "գիրք", "եմ", "կարդում"]),
        _tmcq("I write", ["գրում եմ", "գրեցի", "կգրեմ", "գրել եմ"], 0),
        _so("Arrange: “I speak Armenian.”", ["Ես", "հայերեն", "եմ", "խոսում"], ["Ես", "հայերեն", "եմ", "խոսում"]),
        _tf("«խմում եմ» means “I drank.”", correct=False),
        _dm("Ի՞նչ ես խմում։", ["Ես թեյ եմ խմում", "Ցտեսություն", "Բարև", "Ոչ"], 0),
    ]),
    ("A2 · Daily Actions", 123, "a2-act-verbs", "Common Actions", [
        _match([("ուտել", "to eat"), ("խմել", "to drink"), ("կարդալ", "to read"), ("գրել", "to write")]),
        _tmcq("I eat", ["ուտում եմ", "կերա", "կուտեմ", "կերել եմ"], 0),
        _smw("Նա գիրք", "", ["կարդում է", "կարդաց", "կկարդա"], 0),         # He reads a book
        _wb("We speak Armenian.", ["Մենք", "հայերեն", "ենք", "խոսում"], ["Մենք", "հայերեն", "ենք", "խոսում"]),
        _tf("«ուտում եմ» means “I eat.”"),
        _so("Arrange: “They play football.”", ["Նրանք", "ֆուտբոլ", "են", "խաղում"], ["Նրանք", "ֆուտբոլ", "են", "խաղում"]),
        _tmcq("to read", ["կարդալ", "գրել", "խմել", "վազել"], 0),
    ]),
]


def seed_a2more():
    from database import engine
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2-self-intro'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "a2-self-intro already exists"}
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
