# backend/seed_a2types.py
"""
A2 · Exercise Variety — deliberately widens the range of exercise TYPES in A2.
Most A2 content leans on translate/match/cloze; this adds lessons built around
the kinds A2 barely used: conjugation tables, the new `inflect` production
drill, highlight-the-word, categorize, listen-and-tap (listen_word_bank), the
new listen_image, free-typed write_translate, dialogue ordering, and
multi-select.

`inflect` and `listen_image` aren't in the bulk-import allow-list yet, so the
runner authors every exercise here via POST /cms/exercises (single-create),
which accepts any kind. Standard Eastern Armenian, hand-checked. Tagged
cefr="A2", chapters at positions 130+. Idempotent (skips if 'a2t-conj' exists).
Triggered via POST /cms/seed/a2types.
"""

import json
from sqlalchemy import text

_XP = {"conjugation": 20, "inflect": 15, "highlight_grammar": 10, "categorize": 15,
       "listen_word_bank": 15, "listen_image": 10, "write_translate": 15,
       "dialogue_order": 15, "multi_select": 10}
_CEFR = "A2"


def _conj(verb, cells):
    return {"kind": "conjugation", "prompt": f"Conjugate: {verb}",
            "config": {"verb": verb, "cells": [{"label": l, "answer": a} for l, a in cells]}}


def _inflect(base, gloss, target, answer, accepted=None):
    cfg = {"base": base, "baseGloss": gloss, "target": target, "answer": answer}
    if accepted:
        cfg["acceptedAnswers"] = accepted
    return {"kind": "inflect", "prompt": "Change the word to the form shown", "config": cfg}


def _hl(prompt, tokens, idxs):
    return {"kind": "highlight_grammar", "prompt": prompt, "config": {"tokens": tokens, "correctIndices": idxs}}


def _cat(prompt, buckets, items):
    return {"kind": "categorize", "prompt": prompt,
            "config": {"buckets": buckets, "items": [{"text": t, "bucket": b} for t, b in items]}}


def _lwb(tts, tiles, solution):
    return {"kind": "listen_word_bank", "prompt": "Tap what you hear",
            "config": {"ttsText": tts, "tiles": tiles, "solution": solution}}


def _limg(tts, choices, ai):
    return {"kind": "listen_image", "prompt": "Which one do you hear?",
            "config": {"ttsText": tts, "choices": [{"emoji": e, "label": l} for e, l in choices], "answerIndex": ai}}


def _write(source, accepted):
    return {"kind": "write_translate", "prompt": "Write it in Armenian.",
            "config": {"source": source, "acceptedAnswers": accepted}}


def _dorder(lines):
    return {"kind": "dialogue_order", "prompt": "Put the conversation in order.",
            "config": {"lines": lines, "solution": lines}}


def _multi(prompt, choices, idxs):
    return {"kind": "multi_select", "prompt": prompt, "config": {"choices": choices, "correctIndices": idxs}}


_PRES = lambda stem: [("Ես (I)", f"{stem} եմ"), ("Դու (you)", f"{stem} ես"), ("Նա (he/she)", f"{stem} է"),
                      ("Մենք (we)", f"{stem} ենք"), ("Դուք (you all)", f"{stem} եք"), ("Նրանք (they)", f"{stem} են")]

_LESSONS = [
    # ---------- A2 · Grammar Workshop ----------
    ("A2 · Grammar Workshop", 130, "a2t-conj", "Conjugation Tables", [
        _conj("խմել — present (drink)", _PRES("խմում")),
        _conj("կարդալ — present (read)", _PRES("կարդում")),
        _conj("գրել — present (write)", _PRES("գրում")),
        _conj("խոսել — present (speak)", _PRES("խոսում")),
        _conj("աշխատել — present (work)", _PRES("աշխատում")),
    ]),
    ("A2 · Grammar Workshop", 130, "a2t-inflect", "Change the Form", [
        _inflect("խմել", "to drink", "Present · “I”", "խմում եմ"),
        _inflect("գնալ", "to go", "Future · “I” (կ-)", "կգնամ"),
        _inflect("գիրք", "book", "“the …” (definite)", "գիրքը"),
        _inflect("գրել", "to write", "Past · “I”", "գրեցի"),
        _inflect("Արամ", "Aram", "to Aram (dative)", "Արամին"),
        _inflect("կատու", "cat", "“the …” (after a vowel)", "կատուն"),
    ]),
    ("A2 · Grammar Workshop", 130, "a2t-highlight", "Spot the Word", [
        _hl("Tap the verb.", ["Ես", "հայերեն", "սովորում", "եմ"], [2]),
        _hl("Tap the noun.", ["Ես", "կարդում", "եմ", "գիրքը"], [3]),
        _hl("Tap the question word.", ["Ի՞նչ", "է", "սա"], [0]),
        _hl("Tap the negative word.", ["Ես", "չեմ", "ուզում"], [1]),
        _hl("Tap the past-tense verb.", ["Երեկ", "ես", "գնացի", "տուն"], [2]),
    ]),
    ("A2 · Grammar Workshop", 130, "a2t-categorize", "Sort It Out", [
        _cat("Sort: present or past?", ["Present", "Past"],
             [("խմում եմ", "Present"), ("խմեցի", "Past"), ("գրում եմ", "Present"), ("գրեցի", "Past"), ("գնում եմ", "Present")]),
        _cat("Sort: present or future?", ["Present", "Future"],
             [("կարդում եմ", "Present"), ("կկարդամ", "Future"), ("խոսում եմ", "Present"), ("կխոսեմ", "Future")]),
        _cat("Sort: noun or verb?", ["Noun", "Verb"],
             [("գիրք", "Noun"), ("կարդալ", "Verb"), ("տուն", "Noun"), ("գնալ", "Verb")]),
        _cat("Sort: singular or plural?", ["Singular", "Plural"],
             [("գիրք", "Singular"), ("գրքեր", "Plural"), ("կատու", "Singular"), ("կատուներ", "Plural")]),
        _cat("Sort: greeting or farewell?", ["Greeting", "Farewell"],
             [("Բարև", "Greeting"), ("Ցտեսություն", "Farewell"), ("Բարի լույս", "Greeting")]),
    ]),
    # ---------- A2 · Listen & Build ----------
    ("A2 · Listen & Build", 131, "a2t-lwb", "Tap What You Hear", [
        _lwb("Ես հայերեն եմ սովորում", ["Ես", "հայերեն", "եմ", "սովորում", "խոսում"], ["Ես", "հայերեն", "եմ", "սովորում"]),
        _lwb("Ինչպես ես", ["Ինչպես", "ես", "լավ", "շնորհակալ"], ["Ինչպես", "ես"]),
        _lwb("Ես սուրճ եմ խմում", ["Ես", "սուրճ", "եմ", "խմում", "թեյ"], ["Ես", "սուրճ", "եմ", "խմում"]),
        _lwb("Ես Երևանում եմ ապրում", ["Ես", "Երևանում", "եմ", "ապրում"], ["Ես", "Երևանում", "եմ", "ապրում"]),
        _lwb("Շնորհակալություն", ["Շնորհակալություն", "Խնդրեմ", "Այո"], ["Շնորհակալություն"]),
    ]),
    ("A2 · Listen & Build", 131, "a2t-limg", "Listen & Choose", [
        _limg("շուն", [("🐶", "dog"), ("🐱", "cat"), ("🐟", "fish"), ("🐦", "bird")], 0),
        _limg("խնձոր", [("🍎", "apple"), ("🍞", "bread"), ("🧀", "cheese"), ("🥛", "milk")], 0),
        _limg("տուն", [("🏠", "house"), ("🏫", "school"), ("🚗", "car"), ("🌳", "tree")], 0),
        _limg("արև", [("☀️", "sun"), ("🌙", "moon"), ("⭐", "star"), ("☁️", "cloud")], 0),
        _limg("գիրք", [("📖", "book"), ("✏️", "pencil"), ("📱", "phone"), ("🎒", "bag")], 0),
    ]),
    ("A2 · Listen & Build", 131, "a2t-write", "Write It Yourself", [
        _write("Hello", ["Բարև", "Բարև ձեզ"]),
        _write("Thank you", ["Շնորհակալություն", "Շնորհակալ եմ"]),
        _write("I am a student", ["Ես ուսանող եմ"]),
        _write("Good morning", ["Բարի լույս"]),
        _write("I speak Armenian", ["Ես հայերեն եմ խոսում", "Ես խոսում եմ հայերեն"]),
    ]),
    # ---------- A2 · Conversations ----------
    ("A2 · Conversations", 132, "a2t-dorder", "Order the Conversation", [
        _dorder(["Բարև", "Բարև, ինչպես ես", "Լավ եմ, շնորհակալ"]),
        _dorder(["Ի՞նչ է քո անունը", "Իմ անունը Անի է", "Ուրախ եմ"]),
        _dorder(["Որտե՞ղ ես ապրում", "Ես ապրում եմ Երևանում", "Շատ լավ"]),
        _dorder(["Ի՞նչ ես ուզում", "Մեկ սուրճ, խնդրում եմ", "Խնդրեմ"]),
        _dorder(["Հաշիվը, խնդրում եմ", "Հազար դրամ", "Շնորհակալություն"]),
    ]),
    ("A2 · Conversations", 132, "a2t-multi", "Pick All That Apply", [
        _multi("Select all the greetings.", ["Բարև", "Շնորհակալություն", "Բարի լույս", "Այո"], [0, 2]),
        _multi("Select all the verbs.", ["գնալ", "գիրք", "խոսել", "կարդալ"], [0, 2, 3]),
        _multi("Select all the colors.", ["կարմիր", "կապույտ", "սեղան", "դեղին"], [0, 1, 3]),
        _multi("Select all the animals.", ["կատու", "հաց", "շուն", "ձուկ"], [0, 2, 3]),
        _multi("Select all the drinks.", ["սուրճ", "հաց", "թեյ", "ջուր"], [0, 2, 3]),
    ]),
]


def seed_a2types():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'a2t-conj'")).first():
            return {"ok": True, "skipped": True, "reason": "a2t-conj already exists"}
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
