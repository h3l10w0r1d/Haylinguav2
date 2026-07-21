# backend/seed_expand2.py
"""
Volume expansion, round 2 — tops up the 22 lessons that stayed thin after
Phases 2-5 (sentence-pattern lessons, the Sentences/Grammar chapters, and
Fluency II's reading/dialogue), the same way seed_expand.py topped up the
core vocabulary lessons: every new exercise reuses vocabulary or grammar
forms already live in that exact lesson (or, where noted, another
already-verified lesson), never introducing anything new. Adds ~4 exercises
per lesson.

Idempotent per lesson: skips any lesson that already has >= 9 exercises
(the 6-7-exercise lessons targeted here all fall under that; a lesson
that's already been topped up in a prior run is left alone). Triggered via
POST /cms/seed/expand2.
"""

import json
from sqlalchemy import text
from database import engine

_XP = {
    "translate_mcq": 10,
    "select_missing_word": 10,
    "sentence_order": 15,
    "word_bank": 15,
    "true_false": 10,
    "match_pairs": 15,
    "write_translate": 20,
    "reading_comprehension": 15,
    "dialogue_mcq": 15,
    "dialogue_order": 15,
}


def _tmcq(prompt_word, choices, answer_index):
    return {"kind": "translate_mcq", "prompt": f"How do you say “{prompt_word}”?",
            "config": {"choices": choices, "sentence": prompt_word, "answerIndex": answer_index}}


def _smw(before, after, choices, answer_index=0):
    return {"kind": "select_missing_word", "prompt": "Complete the sentence.",
            "config": {"before": before, "after": after, "choices": choices, "answerIndex": answer_index}}


def _sorder(prompt, tokens, solution):
    return {"kind": "sentence_order", "prompt": prompt, "config": {"tokens": tokens, "solution": solution}}


def _tf(statement, correct=True):
    return {"kind": "true_false", "prompt": "True or False?", "config": {"correct": correct, "statement": statement}}


def _match(pairs):
    return {"kind": "match_pairs", "prompt": "Match each word to its meaning.",
            "config": {"pairs": [{"left": l, "right": r} for l, r in pairs]}}


def _wtranslate(source, accepted):
    return {"kind": "write_translate", "prompt": f"Translate: “{source}”",
            "config": {"source": source, "acceptedAnswers": accepted}}


def _reading(passage, question, choices, answer_index):
    return {"kind": "reading_comprehension", "prompt": question,
            "config": {"passage": passage, "question": question, "choices": choices, "answerIndex": answer_index}}


def _dmcq(their_line, choices, answer_index):
    return {"kind": "dialogue_mcq", "prompt": "How do you respond?",
            "config": {"lines": [{"from": "them", "text": their_line}],
                       "choices": choices, "answerIndex": answer_index}}


def _dorder(lines):
    return {"kind": "dialogue_order", "prompt": "Put the conversation in order.",
            "config": {"lines": lines, "solution": lines}}


_FLU_PASSAGE = ("Բարև, իմ անունը Անի է. Ես ուսանող եմ և հայերեն եմ սովորում. "
                "Իմ ընտանիքը մեծ է. Երեկ ես հայերեն սովորեցի, և վաղը ես նորից կսովորեմ.")

# slug -> extra exercises
_EXTRAS = {
    # ---- Phase 2: sentence-pattern lessons ----
    "hl-greetings-sentences": [
        _smw("Դու ուսանող", "", ["ես", "եմ", "է"], 0),
        _sorder("Arrange: “She is fine.”", ["լավ", "Նա", "է"], ["Նա", "լավ", "է"]),
        _tf("«Վատ» means “bad.”"),
        _match([("լավ", "good / fine"), ("վատ", "bad"),
                ("ուսանող", "student"), ("Շնորհակալություն", "thank you")]),
    ],
    "hl-numbers-more": [
        _tmcq("nine", ["ինը", "ութ", "տասը", "տասնմեկ"], 0),
        _smw("Սա տասնութ", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “This is eleven.”", ["տասնմեկ", "Սա", "է"], ["Սա", "տասնմեկ", "է"]),
        _tf("«Ինը» means “nine.”"),
    ],
    "hl-family-sentences": [
        _tmcq("mother", ["մայր", "հայր", "քույր", "եղբայր"], 0),
        _smw("Իմ հայրը Արմեն", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “My mother is Ani.”",
                ["մայրը", "Իմ", "Անի", "է"], ["Իմ", "մայրը", "Անի", "է"]),
        _tf("«Պապիկ» means “grandfather.”"),
    ],
    "hl-food-sentences": [
        _tmcq("tea", ["թեյ", "սուրճ", "կաթ", "միս"], 0),
        _smw("Սուրճը համեղ", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “Tea is delicious.”", ["համեղ", "Թեյը", "է"], ["Թեյը", "համեղ", "է"]),
        _tf("«Միս» means “meat.”"),
    ],
    "hl-colors-sentences": [
        _tmcq("black", ["սև", "սպիտակ", "դեղին", "կանաչ"], 0),
        _smw("Շունը սև", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “The apple is red.”", ["կարմիր", "Խնձորը", "է"], ["Խնձորը", "կարմիր", "է"]),
        _tf("«Սպիտակ» means “white.”"),
    ],
    "hl-time-sentences": [
        _tmcq("Sunday", ["կիրակի", "ուրբաթ", "երկուշաբթի", "շաբաթ"], 0),
        _smw("Այսօր ուրբաթ", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “Tomorrow is Monday.”",
                ["երկուշաբթի", "Վաղը", "է"], ["Վաղը", "երկուշաբթի", "է"]),
        _tf("«Երեքշաբթի» means “Tuesday.”"),
    ],
    "hl-phrases-sentences": [
        _tmcq("understanding", ["հասկանում", "սովորում", "հայերեն", "Հայաստանից"], 0),
        _smw("Նա Հայաստանից", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “She is learning Armenian.”",
                ["հայերեն", "Նա", "սովորում", "է"], ["Նա", "հայերեն", "է", "սովորում"]),
        _tf("«Հասկանում» means “understanding.”"),
    ],
    "hl-travel-sentences": [
        _tmcq("straight", ["ուղիղ", "աջ", "ձախ", "որտեղ"], 0),
        _smw("Կայարանը այստեղ", "", ["է", "ես", "եմ"], 0),
        _sorder("Arrange: “I am going straight.”",
                ["ուղիղ", "Ես", "գնում", "եմ"], ["Ես", "ուղիղ", "եմ", "գնում"]),
        _tf("«Ուղիղ» means “straight.”"),
    ],

    # ---- Phase 3: Sentences chapters ----
    "sent-tobe-full": [
        _tmcq("you all are", ["եք", "ենք", "են", "եմ"], 0),
        _smw("Նրանք ուսանող", "", ["են", "ենք", "եք"], 0),
        _tf("«Եք» means “you all are.”"),
        _match([("եմ", "I am"), ("ես", "you are"), ("ենք", "we are"), ("են", "they are")]),
    ],
    "sent-present-verbs": [
        _tmcq("she is playing", ["Նա խաղում է", "Նա խաղում եմ",
                                   "Ես խաղում է", "Դու խաղում եմ"], 0),
        _smw("Ես աշխատում", "", ["եմ", "ես", "է"], 0),
        _sorder("Arrange: “She is working.”", ["աշխատում", "Նա", "է"], ["Նա", "աշխատում", "է"]),
        _tf("«Ապրել» means “to live.”"),
    ],
    "sent-negation": [
        _tmcq("they are not", ["չեն", "չենք", "չեք", "չէ"], 0),
        _smw("Նրանք ուսանող", "", ["չեն", "չենք", "չեք"], 0),
        _tf("«Չես» means “you are not.”"),
        _match([("չեմ", "I am not"), ("չենք", "we are not"),
                ("չեն", "they are not"), ("չեք", "you all are not")]),
    ],
    "sent-questions": [
        _tmcq("where", ["որտեղ", "ի՞նչ", "ո՞վ", "ինչու՞"], 0),
        _smw("", "է կայարանը?", ["Որտեղ", "Ի՞նչ", "Ո՞վ"], 0),
        _tf("«Ո՞վ» means “who.”"),
        _sorder("Arrange: “What is this?”", ["է", "Ի՞նչ", "սա"], ["Ի՞նչ", "է", "սա"]),
    ],
    "sent-connectors": [
        _tmcq("and", ["և", "բայց", "որովհետև", "որտեղ"], 0),
        _smw("Հացը թանկ է,", "համեղ է", ["բայց", "և", "որովհետև"], 0),
        _tf("«Թանկ» means “expensive.”"),
        _match([("և", "and"), ("բայց", "but"),
                ("որովհետև", "because"), ("ուսանող", "student")]),
    ],
    "sent-review": [
        _wtranslate("We are not students", ["Մենք ուսանող չենք"]),
        _wtranslate("Where is the station?", ["Որտեղ է կայարանը", "Որտեղ է կայարանը?"]),
        _tf("«Չենք» means “we are not.”"),
        _match([("չենք", "we are not"), ("որովհետև", "because"),
                ("ուսանող", "student"), ("կայարան", "station")]),
    ],

    # ---- Phase 5: Grammar chapters ----
    "gr-imperative-1": [
        _tmcq("Sit!", ["Նստի՛ր", "Արի՛", "Գնա՛", "Կարդա՛"], 0),
        _smw("", " հայերեն", ["Կարդա՛", "Կարդալ", "Կարդում"], 0),
        _tf("«Գրի՛ր» means “Write!”"),
        _match([("Արի՛", "Come!"), ("Նստի՛ր", "Sit!"),
                ("Կարդա՛", "Read!"), ("Գրի՛ր", "Write!")]),
    ],
    "gr-imperative-2": [
        _tmcq("Sit! (polite)", ["Նստե՛ք", "Նստի՛ր", "Եկե՛ք", "Գնացե՛ք"], 0),
        _smw("", ", խնդրում եմ", ["Գրե՛ք", "Գրի՛ր", "Գրել"], 0),
        _tf("«Գնացե՛ք» is the polite/plural form of “Go!”"),
        _match([("Եկե՛ք", "Come! (pl.)"), ("Գնացե՛ք", "Go! (pl.)"),
                ("Գրե՛ք", "Write! (pl.)"), ("Կարդացե՛ք", "Read! (pl.)")]),
    ],
    "gr-cases-gen": [
        _tmcq("friend's", ["ընկերոջ", "հոր", "մոր", "Անիի"], 0),
        _smw("Իմ", "անունը Արմեն է", ["հոր", "հայր", "հայրը"], 0),
        _tf("«Ընկերոջ» means “friend's.”"),
        _match([("մոր", "mother's"), ("հոր", "father's"),
                ("ընկերոջ", "friend's"), ("Անիի", "Ani's")]),
    ],
    "gr-cases-inst": [
        _tmcq("on foot", ["ոտքով", "ավտոբուսով", "գնացքով", "մեքենայով"], 0),
        _smw("Ես գնում եմ", "", ["ոտքով", "ոտք", "ոտքի"], 0),
        _tf("«Մեքենայով» means “by car.”"),
        _match([("ավտոբուսով", "by bus"), ("գնացքով", "by train"),
                ("մեքենայով", "by car"), ("ոտքով", "on foot")]),
    ],
    "gr-pastfut-1": [
        _tmcq("we worked", ["աշխատեցինք", "աշխատեցի", "խաղացինք", "աշխատում ենք"], 0),
        _smw("Երեկ նա", "", ["խաղաց", "կխաղա", "խաղում է"], 0),
        _tf("«Աշխատեց» means “he/she worked.”"),
        _match([("աշխատեցի", "I worked"), ("խաղացի", "I played"),
                ("աշխատեցինք", "we worked"), ("խաղացինք", "we played")]),
    ],
    "gr-pastfut-2": [
        _tmcq("we will work", ["կաշխատենք", "կաշխատեմ", "կխաղանք", "աշխատում ենք"], 0),
        _smw("Վաղը նա", "", ["կխաղա", "խաղաց", "խաղում է"], 0),
        _tf("«Կխաղամ» means “I will play.”"),
        _match([("կաշխատեմ", "I will work"), ("կխաղամ", "I will play"),
                ("կաշխատենք", "we will work"), ("կխաղանք", "we will play")]),
    ],

    # ---- Phase 4: Fluency II ----
    "flu-reading": [
        _reading(_FLU_PASSAGE, "What did Ani say at the start?",
                 ["Hello", "Goodbye", "Thank you", "Sorry"], 0),
        _reading(_FLU_PASSAGE, "Is Ani a student?",
                 ["Yes", "No", "Not mentioned", "Maybe"], 0),
        _reading(_FLU_PASSAGE, "What will Ani do tomorrow?",
                 ["Learn Armenian again", "Work", "Travel", "Sleep"], 0),
        _tf("The passage says Ani's family is big."),
    ],
    "flu-dialogue": [
        _dmcq("Շնորհակալություն", ["Խնդրեմ", "Ցտեսություն", "Բարև"], 0),
        _dmcq("Ի՞նչ է սա", ["Սա հաց է", "Ես ուսանող եմ", "Բարև"], 0),
        _dorder(["Շնորհակալություն", "Խնդրեմ"]),
        _tf("«Խնդրեմ» can mean “you're welcome.”"),
    ],
}


def seed_expand2():
    with engine.begin() as conn:
        expanded, skipped, created_exercises = [], [], 0

        for slug, extras in _EXTRAS.items():
            row = conn.execute(
                text("SELECT id FROM lessons WHERE slug = :slug"), {"slug": slug}
            ).mappings().first()
            if not row:
                skipped.append({"slug": slug, "reason": "lesson not found"})
                continue
            lesson_id = row["id"]

            count = conn.execute(
                text("SELECT COUNT(*) FROM exercises WHERE lesson_id = :lid"), {"lid": lesson_id}
            ).scalar()
            if count >= 9:
                skipped.append({"slug": slug, "reason": f"already has {count} exercises"})
                continue

            max_order = conn.execute(
                text('SELECT COALESCE(MAX("order"), 0) FROM exercises WHERE lesson_id = :lid'),
                {"lid": lesson_id},
            ).scalar()

            for idx, ex in enumerate(extras, start=1):
                xp = _XP[ex["kind"]]
                conn.execute(
                    text("""
                        INSERT INTO exercises (lesson_id, kind, prompt, "order", xp, config)
                        VALUES (:lesson_id, :kind, :prompt, :order, :xp, CAST(:config AS jsonb))
                    """),
                    {"lesson_id": lesson_id, "kind": ex["kind"], "prompt": ex["prompt"],
                     "order": max_order + idx, "xp": xp, "config": json.dumps(ex["config"])},
                )
                created_exercises += 1

            conn.execute(
                text("""UPDATE lessons SET xp = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid),
                                          xp_reward = (SELECT COALESCE(SUM(xp),0) FROM exercises WHERE lesson_id = :lid)
                        WHERE id = :lid"""),
                {"lid": lesson_id},
            )
            expanded.append(slug)

        return {"ok": True, "expanded": expanded, "skipped": skipped,
                "exercises_created": created_exercises}
