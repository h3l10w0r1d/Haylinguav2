# backend/content_engine.py
"""
Content engine — the scalable path toward Duolingo-size volume.

A curated bilingual sentence corpus is fanned out by generators into many
exercise instances (~7 per sentence: translate both ways, word-bank, listen &
type, tap-what-you-hear, fill-blank, speak) plus a vocab layer from the focus
lexemes. A lesson assembler packs the generated exercises into ~15-item lessons
grouped by topic.

Risk policy (strategy: "reviewer flags, publish live, fix on signal"): every
sentence is scored low / medium / high by grammatical complexity, and that
score is written onto each generated exercise's config as `reviewRisk`. Content
is PUBLISHED immediately (so learners get volume), but medium/high items surface
in the CMS review queue (GET /cms/review-queue) for a human spot-check, and the
existing repetitive-mistakes auto-hide catches anything that slips through.

Generated lessons use `gen-*` slugs so they are trivially identifiable and
reversible. This module both seeds the DB (seed_content_batch1) and exposes a
pre-built `_LESSONS` for the single-create runner.
"""

import re
import json
from sqlalchemy import text

_XP = {"translate_mcq": 10, "word_bank": 15, "listen_type": 15, "listen_word_bank": 15,
       "select_missing_word": 10, "speak": 15, "match_pairs": 15}
_CEFR = "A2"
_LESSON_SIZE = 15  # exercises per generated lesson

# --- Curated corpus. Each entry: hy, en, romanization, topic, (focus_surface, focus_gloss).
#     focus_surface MUST appear verbatim as a token in hy (used for fill-blank + vocab).
#     tokens are derived from hy (punctuation stripped) so word-bank is always consistent.
_CORPUS = [
    # ---- Daily Life ----
    ("Ամեն օր ես սուրճ եմ խմում", "Every day I drink coffee", "Amen or yes surch em khmum", "Daily Life", ("սուրճ", "coffee")),
    ("Առավոտյան ես լվանում եմ երեսս", "In the morning I wash my face", "Aravotyan yes lvanum em yeress", "Daily Life", ("լվանում", "wash")),
    ("Երեկոյան ես կարդում եմ գիրք", "In the evening I read a book", "Yerekoyan yes kardum em girq", "Daily Life", ("գիրք", "book")),
    ("Ես ապրում եմ Երևանում", "I live in Yerevan", "Yes aprum em Yerevanum", "Daily Life", ("ապրում", "live")),
    ("Շաբաթ օրը ես հանգստանում եմ", "On Saturday I rest", "Shabat ory yes hangstanum em", "Daily Life", ("հանգստանում", "rest")),
    ("Ես սովորաբար ընթրում եմ ուշ", "I usually have dinner late", "Yes sovorabar ynt'rum em ush", "Daily Life", ("ընթրում", "dine")),
    # ---- Food & Drink ----
    ("Այս ռեստորանում ուտելիքը համեղ է", "The food in this restaurant is delicious", "Ays restoranum uteliqy hamegh e", "Food & Drink", ("համեղ", "delicious")),
    ("Ես նախաճաշին ուտում եմ պանիր", "For breakfast I eat cheese", "Yes nakhachashin utum em panir", "Food & Drink", ("պանիր", "cheese")),
    ("Ես սիրում եմ քաղցր մրգեր", "I like sweet fruits", "Yes sirum em qaghts'r mrger", "Food & Drink", ("մրգեր", "fruits")),
    ("Սուրճը շատ տաք է", "The coffee is very hot", "Surchy shat taq e", "Food & Drink", ("տաք", "hot")),
    ("Ջուրը սառն է և մաքուր", "The water is cold and clean", "Jury sar'n e yev maqur", "Food & Drink", ("մաքուր", "clean")),
    ("Մայրս համեղ ապուր է եփում", "My mother cooks delicious soup", "Mayrs hamegh apur e yep'um", "Food & Drink", ("ապուր", "soup")),
    # ---- Travel & Places ----
    ("Կայարանը գտնվում է քաղաքի կենտրոնում", "The station is in the city center", "Kayarany gtnvum e qaghaqi kentronum", "Travel & Places", ("կայարան", "station")),
    ("Ես երեկ գնեցի նոր հեռախոս", "I bought a new phone yesterday", "Yes yerek gnetsi nor herakhos", "Travel & Places", ("հեռախոս", "phone")),
    ("Ինքնաթիռը թռչում է ժամը տասին", "The plane leaves at ten o'clock", "Inqnatiry t'rrchum e zhamy tasin", "Travel & Places", ("ինքնաթիռ", "plane")),
    ("Հյուրանոցը մոտ է ծովին", "The hotel is near the sea", "Hyuranots'y mot e tsovin", "Travel & Places", ("հյուրանոց", "hotel")),
    ("Մենք վաղը կգնանք լեռներ", "We will go to the mountains tomorrow", "Menq vaghy kgnanq ler'ner", "Travel & Places", ("լեռներ", "mountains")),
    ("Այս ավտոբուսը տանում է դեպի կենտրոն", "This bus goes to the center", "Ays avtobusy tanum e depi kentron", "Travel & Places", ("ավտոբուսը", "bus")),
    # ---- Family & People ----
    ("Եղբայրս սովորում է համալսարանում", "My brother studies at the university", "Yeghbayrs sovorum e hamalsaranum", "Family & People", ("համալսարանում", "university")),
    ("Իմ քույրը բժիշկ է", "My sister is a doctor", "Im quyry bzhishk e", "Family & People", ("քույրը", "sister")),
    ("Հայրս աշխատում է գործարանում", "My father works at a factory", "Hayrs ashkhatum e gortsaranum", "Family & People", ("գործարանում", "factory")),
    ("Տատիկս ապրում է գյուղում", "My grandmother lives in a village", "Tatiks aprum e gyughum", "Family & People", ("գյուղում", "village")),
    ("Ընկերս շատ բարի մարդ է", "My friend is a very kind person", "Ynkers shat bari mard e", "Family & People", ("բարի", "kind")),
    ("Մենք մեծ ընտանիք ունենք", "We have a big family", "Menq mets yntaniq unenq", "Family & People", ("ընտանիք", "family")),
    # ---- Weather & Seasons ----
    ("Այսօր դրսում ցուրտ է", "Today it is cold outside", "Aysor drsum ts'urt e", "Weather & Seasons", ("ցուրտ", "cold")),
    ("Ձմռանը շատ ձյուն է գալիս", "In winter a lot of snow falls", "Dzmrany shat dzyun e galis", "Weather & Seasons", ("ձյուն", "snow")),
    ("Ամռանը մենք լողում ենք ծովում", "In summer we swim in the sea", "Amrany menq loghum enq tsovum", "Weather & Seasons", ("լողում", "swim")),
    ("Այսօր արևոտ եղանակ է", "Today is sunny weather", "Aysor arevot yeghanak e", "Weather & Seasons", ("արևոտ", "sunny")),
    ("Աշնանը տերևները դեղնում են", "In autumn the leaves turn yellow", "Ashnany terevnery deghnum en", "Weather & Seasons", ("տերևները", "leaves")),
    ("Գիշերը քամի է փչում", "At night the wind blows", "Gishery qami e p'chum", "Weather & Seasons", ("քամի", "wind")),
    # ---- Leisure & Hobbies ----
    ("Ես սիրում եմ լսել երաժշտություն", "I like listening to music", "Yes sirum em lsel yerazhshtutyun", "Leisure & Hobbies", ("երաժշտություն", "music")),
    ("Երեխաները խաղում են բակում", "The children are playing in the yard", "Yerekhanery khaghum en bakum", "Leisure & Hobbies", ("բակում", "yard")),
    ("Նա ամեն առավոտ վազում է այգում", "He runs in the park every morning", "Na amen aravot vazum e aygum", "Leisure & Hobbies", ("վազում", "runs")),
    ("Ես ուզում եմ սովորել նոր լեզու", "I want to learn a new language", "Yes uzum em sovorel nor lezu", "Leisure & Hobbies", ("լեզու", "language")),
    ("Շաբաթ օրերին մենք գնում ենք կինո", "On Saturdays we go to the cinema", "Shabat orerin menq gnum enq kino", "Leisure & Hobbies", ("կինո", "cinema")),
    ("Ազատ ժամանակ ես նկարում եմ", "In my free time I draw", "Azat zhamanak yes nkarum em", "Leisure & Hobbies", ("նկարում", "draw")),
]

_TOPIC_ORDER = ["Daily Life", "Food & Drink", "Travel & Places", "Family & People", "Weather & Seasons", "Leisure & Hobbies"]

# Risk markers: presence bumps a sentence's review risk. Kept conservative and
# specific — a broad "any word starting with կ" rule over-flags every noun like
# «կենտրոն», so future tense is inferred from time cues instead.
_HIGH = [r"Եթե", r"որպեսզի", r"ասաց,?\s+որ", r"\w+ել\s+էի", r"կ\w+եի\b"]          # conditional / purpose / reported / past-perfect / would-form
_MED = [r"\w+ում\s+է[իր]", r"\w+եցի\b", r"\w+ացի\b", r"\w+եց\b", r"\bվաղը\b", r"\bերեկ\b"]  # imperfect / simple past / future time-cue


def _risk(hy):
    for p in _HIGH:
        if re.search(p, hy):
            return "high"
    for p in _MED:
        if re.search(p, hy):
            return "medium"
    return "low"


def _toks(hy):
    return [t for t in re.sub(r"[,։՞՜.]", "", hy).split() if t]


def _rot(pool, correct, n, seed):
    opts = [x for x in pool if x != correct]
    if not opts:
        return []
    s = seed % len(opts)
    return (opts[s:] + opts[:s])[:n]


_ALL_HY = [c[0] for c in _CORPUS]
_ALL_EN = [c[1] for c in _CORPUS]
_ALL_TOK = sorted({t for c in _CORPUS for t in _toks(c[0])})


def _flag(cfg, risk):
    cfg = dict(cfg)
    cfg["gen"] = True
    cfg["reviewRisk"] = risk
    return cfg


def _exercises_for(entry, i):
    hy, en, roman, topic, (fsurf, fgloss) = entry
    risk = _risk(hy)
    toks = _toks(hy)
    out = []
    # translate -> hy
    d = _rot(_ALL_HY, hy, 3, i); ai = i % 4; ch = d[:]; ch.insert(ai, hy)
    out.append(("translate_mcq", f"How do you say “{en}”?", _flag({"choices": ch, "sentence": en, "answerIndex": ai}, risk)))
    # translate -> en
    d = _rot(_ALL_EN, en, 3, i + 1); ai = (i + 2) % 4; ch = d[:]; ch.insert(ai, en)
    out.append(("translate_mcq", f"What does “{hy}” mean?", _flag({"choices": ch, "sentence": hy, "answerIndex": ai}, risk)))
    # word bank
    dt = [t for t in _rot(_ALL_TOK, None, 3, i) if t not in toks][:2]
    out.append(("word_bank", "Build the sentence.", _flag({"sentence": en, "tiles": toks + dt, "solution": toks}, risk)))
    # listen & type
    out.append(("listen_type", "Type what you hear", _flag({"ttsText": hy, "acceptedAnswers": [hy]}, risk)))
    # tap what you hear
    dt = [t for t in _rot(_ALL_TOK, None, 2, i + 3) if t not in toks][:1]
    out.append(("listen_word_bank", "Tap what you hear", _flag({"ttsText": hy, "tiles": toks + dt, "solution": toks}, risk)))
    # fill blank on the focus token
    if fsurf in toks:
        idx = toks.index(fsurf)
        before = " ".join(toks[:idx]); after = " ".join(toks[idx + 1:])
        d = _rot(_ALL_TOK, fsurf, 3, i + 5); ai = i % 4; ch = d[:]; ch.insert(ai, fsurf)
        out.append(("select_missing_word", "Complete the sentence.", _flag({"before": before, "after": after, "choices": ch, "answerIndex": ai}, risk)))
    # speak
    out.append(("speak", "Say the phrase out loud", _flag({"target": hy, "romanization": roman}, risk)))
    return out


def _build_lessons():
    """Assemble generated exercises into ~15-item lessons grouped by topic."""
    lessons = []
    pos = 300
    for topic in _TOPIC_ORDER:
        entries = [(i, e) for i, e in enumerate(_CORPUS) if e[3] == topic]
        ex = []
        for i, e in entries:
            for kind, prompt, cfg in _exercises_for(e, i):
                ex.append({"kind": kind, "prompt": prompt, "config": cfg})
        # vocab layer: match the topic's focus words in groups of up to 4
        focus = [(e[4][0], e[4][1]) for i, e in entries]
        for j in range(0, len(focus), 4):
            grp = focus[j:j + 4]
            if len(grp) >= 2:
                ex.append({"kind": "match_pairs", "prompt": "Match each word to its meaning.",
                           "config": _flag({"pairs": [{"left": l, "right": r} for l, r in grp]}, "low")})
        # chunk into lessons
        chapter = f"Practice · {topic}"
        tslug = re.sub(r"[^a-z]+", "-", topic.lower()).strip("-")
        n = 0
        for k in range(0, len(ex), _LESSON_SIZE):
            n += 1
            chunk = ex[k:k + _LESSON_SIZE]
            lessons.append((chapter, pos, f"gen-{tslug}-{n}", f"{topic} · Practice {n}", chunk))
        pos += 1
    return lessons


_LESSONS = _build_lessons()


def seed_content_batch1():
    from database import engine
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'gen-daily-life-1'")).first():
            return {"ok": True, "skipped": True, "reason": "gen-daily-life-1 already exists"}
        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        cl = ce = 0
        cfg = json.dumps({"cefr": _CEFR, "generated": True})
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
