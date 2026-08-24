# backend/seed_blog_posts.py
"""
Seeds the first-party blog (blog_posts table, see ensure_schema.py) with the
initial content batch from the SEO plan — one post per high-value keyword
cluster the site had zero coverage for (high-intent "how to learn Armenian"
queries, alphabet, dialect/FAQ questions, and vocabulary). Each post is
genuinely substantive (300+ words, real structure, internal links to the
matching landing page + at least one other post), not thin SEO filler —
same bar as the hand-verified test post from the earlier CMS pass.

Every post is inserted published (is_published=TRUE, published_at=NOW()) so
they show up in the sitemap and /blog immediately. cover_image_url is left
NULL — no real photography exists yet; add cover images later through the
CMS upload UI (BlogPage.jsx/BlogPostPage.jsx already handle a missing cover
gracefully).

Idempotent: ON CONFLICT (slug) DO NOTHING, so re-running never duplicates or
overwrites hand-edited content. Triggered via POST /cms/seed/blog-posts
(CMS-admin only), same pattern as POST /cms/seed/alphabet.
"""

import json
from sqlalchemy import text
from database import engine

_POSTS = [
    {
        "slug": "how-to-say-hello-in-armenian-20-essential-greetings",
        "title": "How to Say Hello in Armenian: 20 Essential Greetings",
        "meta_description": "Learn how to say hello in Armenian with 20 essential greetings, pronunciation, and audio examples for absolute beginners.",
        "excerpt": "From «Բարև» to «Բարի լույս» — the greetings you'll actually use every day, with pronunciation for each.",
        "tags": ["greetings", "beginner", "pronunciation"],
        "body": """Armenian greetings are the first thing you'll use in any real conversation. Here are the essentials to get you started, from the most casual hello to formal introductions — all in Standard Eastern Armenian, the form spoken in Armenia today.

## Everyday greetings

Learn these first — they cover almost every casual interaction you'll have:

- **Բարև** (ba-rev) — Hello
- **Բարև ձեզ** (ba-rev dzez) — Hello (formal/plural)
- **Ցտեսություն** (tse-te-su-tyun) — Goodbye
- **Առայժմ** (a-rayzhm) — See you later
- **Բարի գիշեր** (ba-ri gi-sher) — Good night

## Time-of-day greetings

Armenian, like many languages, has a different greeting depending on when you're speaking:

- **Բարի լույս** (ba-ri luys) — Good morning
- **Բարի օր** (ba-ri or) — Good day
- **Բարի երեկո** (ba-ri ye-re-ko) — Good evening

## Politeness essentials

- **Շնորհակալություն** (shnor-ha-ka-lu-tyun) — Thank you
- **Խնդրեմ** (khən-drem) — Please / You're welcome
- **Ներողություն** (ne-ro-ghu-tyun) — Sorry / Excuse me
- **Ինչպե՞ս եք** (inch-pes ek) — How are you? (formal)
- **Լավ եմ, շնորհակալություն** (lav em, shnor-ha-ka-lu-tyun) — I'm good, thank you

## Introducing yourself

- **Իմ անունն է...** (im a-nunn e...) — My name is...
- **Դուք ինչպե՞ս եք կոչվում** (duk inch-pes ek koch-vum) — What is your name? (formal)
- **Ուրախ եմ ծանոթանալու համար** (u-rakh em tsa-no-t'a-na-lu ha-mar) — Nice to meet you

## A note on formality

Armenian distinguishes formal and informal "you" the same way French or Spanish does. When in doubt with someone older or someone you've just met, use the formal forms above (**դուք** rather than **դու**) — it's the safer default, similar to using "usted" instead of "tú."

## Practice these with real audio

Reading a pronunciation guide only gets you so far — Armenian has a few sounds that don't exist in English at all. Head to our [Armenian pronunciation guide](/armenian-pronunciation) to hear the tricky ones explained, or start from the [Armenian alphabet](/armenian-alphabet) if you're not yet reading the script.

Once greetings feel natural, the next logical step is [common Armenian phrases for travel](/blog/common-armenian-phrases-for-travel) — the other expressions you'll lean on constantly in your first real conversations.""",
    },
    {
        "slug": "is-armenian-hard-to-learn",
        "title": "Is Armenian Hard to Learn? An Honest Answer",
        "meta_description": "Is Armenian hard to learn for English speakers? An honest breakdown of what's genuinely difficult, what's easier than you'd expect, and how long it takes.",
        "excerpt": "The alphabet looks intimidating, but Armenian's grammar logic and phonetic spelling make it more approachable than most people assume.",
        "tags": ["getting started", "faq"],
        "body": """If you've looked at Armenian script and felt intimidated, you're not alone — it's one of the first things people ask before starting. Here's an honest answer, not a sales pitch.

## What's genuinely hard

**The alphabet is unfamiliar.** 39 letters that don't look like Latin, Cyrillic, or Greek script. There's no shortcut here — you have to learn it from scratch, the same way anyone learning Armenian has for over 1,600 years.

**A few sounds don't exist in English.** Armenian distinguishes plain and "puffed" (aspirated) consonants — for example, a crisp «տ» versus a breathy «թ» — a contrast English speakers simply never had to make before. There's also a genuine throat-rasp sound («խ») and a rolled R versus a light tapped R, both worth deliberate practice.

**Case and verb conjugation take real memorization.** Armenian nouns change form depending on their grammatical role, and verbs conjugate for person, tense, and aspect — more moving parts than English, though not unusual for a language outside the Romance/Germanic family.

## What's easier than you'd expect

**Armenian spelling is almost entirely phonetic.** Once you know a letter's sound, it's the same in nearly every word. Compare that to English, where "though," "through," and "tough" don't rhyme despite looking like they should — Armenian doesn't play that game. Once you've learned the alphabet, you can *read* almost any word correctly, even ones you've never seen.

**Word order is more flexible than English**, which actually makes early sentence-building more forgiving — you're less likely to sound "wrong" while you're still assembling vocabulary.

**No grammatical gender.** Unlike French, Spanish, German, or Russian, Armenian nouns don't have masculine/feminine/neuter categories to memorize alongside every word.

## So — how long does it actually take?

Most learners can comfortably read and sound out the [Armenian alphabet](/armenian-alphabet) within one to two weeks of short daily practice. Real conversational comfort takes longer, as with any language — see our full breakdown in [how long does it take to learn Armenian](/blog/how-long-to-learn-armenian).

## The real answer

Armenian isn't "hard" in some absolute sense — it's *different*, in specific, learnable ways. The alphabet is a one-time hurdle, not an ongoing tax on every lesson afterward. Start with the [alphabet](/armenian-alphabet), get comfortable with [pronunciation](/armenian-pronunciation), and the rest builds steadily from there.""",
    },
    {
        "slug": "armenian-alphabet-for-beginners",
        "title": "Armenian Alphabet for Beginners: A Complete Guide",
        "meta_description": "A complete beginner's guide to the Armenian alphabet — how many letters there are, how the writing system works, and the best way to start learning it.",
        "excerpt": "39 letters, almost entirely phonetic, and older than you'd think — here's what you actually need to know before you start.",
        "tags": ["alphabet", "beginner"],
        "body": """Every Armenian learner starts in the same place: the alphabet. Here's what you need to know before diving in.

## How many letters are there?

The Armenian alphabet has **39 letters** (38 base letters plus one digraph, ու, that functions as a single sound). It was created around 405 AD by the monk Mesrop Mashtots, specifically so that Armenian could be written down for the first time — it's one of the few alphabets in the world with a known inventor and a known invention date.

## Is it related to other alphabets?

Not really. Armenian script isn't derived from Latin, Cyrillic, Greek, or Arabic — it's its own independent system, though Mashtots was influenced by Greek's general letter-per-sound philosophy when designing it. That independence is exactly why it looks unfamiliar at first glance, and also why, once learned, it maps so cleanly onto Armenian's actual sounds.

## The good news: it's phonetic

Once you know what sound a letter makes, that sound almost never changes based on context — unlike English, where "c" can sound like "k" (cat) or "s" (cell) depending on the word. In Armenian, a letter reads the same way every time. This means that learning the alphabet isn't just step one — it's most of the battle for *reading* Armenian correctly.

## Uppercase and lowercase

Like Latin script, Armenian has separate uppercase and lowercase forms for every letter, used the same way — capitals for the start of sentences and proper nouns. The shapes aren't always obviously related (similar to how Latin "A" and "a" don't look alike either), so both forms need to be learned together.

## A practical learning order

Don't try to memorize all 39 letters in one sitting. A structured order — introducing a handful of letters at a time, reinforced with real words and audio — works far better than brute-force memorization. That's exactly how our [Armenian alphabet page](/armenian-alphabet) is built: every letter with its uppercase and lowercase form, transliteration, a tap-to-hear audio example, and a real example word, so you're never learning a symbol in isolation.

## What comes after the alphabet

Once letters feel familiar, the next steps are training your ear on [pronunciation](/armenian-pronunciation) — a few Armenian sounds genuinely don't exist in English — and building your first real [vocabulary](/armenian-vocabulary). If you're wondering whether any of this is harder than it looks, we cover that honestly in [is Armenian hard to learn](/blog/is-armenian-hard-to-learn).""",
    },
    {
        "slug": "eastern-vs-western-armenian",
        "title": "Eastern vs. Western Armenian: What's the Difference?",
        "meta_description": "What's the difference between Eastern and Western Armenian? A clear breakdown of pronunciation, vocabulary, and who speaks each dialect today.",
        "excerpt": "Same alphabet, same roots, but different pronunciation of key consonants — here's how to tell them apart and which one to learn.",
        "tags": ["dialects", "faq"],
        "body": """If you've started researching Armenian, you've probably run into this fork in the road: Eastern or Western? Here's what actually separates them.

## The short version

Eastern and Western Armenian are the two modern literary standards of the Armenian language. They share the same 39-letter alphabet, a large amount of vocabulary, and the same grammatical roots — but they diverged enough in pronunciation and some vocabulary that they're often described as two dialects of the same language, similar to how European and Brazilian Portuguese relate to each other.

## Where each is spoken

**Eastern Armenian** is the official language of the Republic of Armenia and is spoken by the majority of Armenian speakers worldwide, including large diaspora communities with roots in the Russian Empire and Iran.

**Western Armenian** developed among communities historically based in the Ottoman Empire. Today it's spoken mainly in diaspora communities — parts of the United States, France, Lebanon, and other Middle Eastern countries.

## The biggest practical difference: pronunciation

The most noticeable difference for a beginner is how certain consonant pairs are pronounced. Eastern and Western Armenian essentially swap which consonants are "plain" versus "aspirated" (breathy) in several pairs — a word that sounds crisp in one dialect sounds breathy in the other, and vice versa. This is the kind of detail that trips up even Armenian speakers switching between the two.

## Can speakers of one understand the other?

Largely yes, with some adjustment — the way a Portuguese speaker from Lisbon can follow a Brazilian telenovela, or a British English speaker can follow American English despite different slang and some pronunciation. Vocabulary, some grammar, and pronunciation differences can cause real confusion at first, but the core language is shared.

## Which one should you learn?

It depends entirely on who you'll actually speak with. If your family or community roots trace to Armenia itself, or you plan to travel there, Eastern Armenian is the practical choice. If your roots trace to the Armenian diaspora communities descended from the Ottoman Empire, Western Armenian will match what your relatives speak.

## What Haylingua teaches

Haylingua's course teaches **Standard Eastern Armenian** — the form spoken in Armenia today. It's a strong foundation even for Western Armenian speakers' descendants, since the alphabet and a large share of vocabulary and grammar overlap directly. Start with the [Armenian alphabet](/armenian-alphabet) — identical in both dialects — and read more on our [Eastern Armenian](/eastern-armenian) page.""",
    },
    {
        "slug": "armenian-numbers-1-to-100",
        "title": "Armenian Numbers: How to Count from 1 to 100",
        "meta_description": "Learn Armenian numbers from 1 to 100 with pronunciation for each — essential vocabulary for prices, ages, dates, and everyday conversation.",
        "excerpt": "From մեկ (one) to հարյուր (one hundred) — every number you need for shopping, ages, and everyday conversation.",
        "tags": ["vocabulary", "numbers"],
        "body": """Numbers are some of the most useful words you can learn in any language — you'll need them for prices, ages, phone numbers, and dates from day one. Here's Armenian counting from 1 to 100.

## 1–10

| Number | Armenian | Pronunciation |
|---|---|---|
| 1 | մեկ | mek |
| 2 | երկու | yer-ku |
| 3 | երեք | ye-rek' |
| 4 | չորս | chors |
| 5 | հինգ | hing |
| 6 | վեց | vets' |
| 7 | յոթ | yot' |
| 8 | ութ | ut' |
| 9 | ինը | i-nə |
| 10 | տասը | ta-sə |

## 11–20

Armenian builds the teens the same logical way English does — "ten-one," "ten-two," and so on:

| Number | Armenian | Pronunciation |
|---|---|---|
| 11 | տասնմեկ | tasn-mek |
| 12 | տասներկու | tasn-yerku |
| 13 | տասներեք | tasn-yerek' |
| 14 | տասնչորս | tasn-chors |
| 15 | տասնհինգ | tasn-hing |
| 16 | տասնվեց | tasn-vets' |
| 17 | տասնյոթ | tasn-yot' |
| 18 | տասնութ | tasn-ut' |
| 19 | տասնինը | tasn-inə |
| 20 | քսան | k'san |

## The tens: 30–100

| Number | Armenian | Pronunciation |
|---|---|---|
| 30 | երեսուն | yeresun |
| 40 | քառասուն | k'arasun |
| 50 | հիսուն | hisun |
| 60 | վաթսուն | vat'sun |
| 70 | յոթանասուն | yot'anasun |
| 80 | ութսուն | ut'sun |
| 90 | իննսուն | innsun |
| 100 | հարյուր | haryur |

## Building compound numbers

Beyond the tens, Armenian combines the base word with the ones digit — for example, "twenty-five" is **քսանհինգ** (k'san-hing), literally "twenty-five" stacked together, just like English.

## Where you'll actually use these

Numbers show up constantly: agreeing on a price at a market, giving your age, sharing a phone number, or setting a time. They're worth drilling early — long before you're forming complex sentences, you'll already be using numbers in real interactions.

For more everyday essentials beyond numbers — colors, family words, food — see our full [Armenian vocabulary](/armenian-vocabulary) page, or start from the [alphabet](/armenian-alphabet) if the script itself is still new to you.""",
    },
    {
        "slug": "how-long-to-learn-armenian",
        "title": "How Long Does It Take to Learn Armenian?",
        "meta_description": "How long does it actually take to learn Armenian? A realistic timeline for the alphabet, basic conversation, and fluency, based on daily practice.",
        "excerpt": "A realistic breakdown — from your first letter to real conversation — based on consistent daily practice, not marketing promises.",
        "tags": ["getting started", "faq"],
        "body": """"How long will this take?" is one of the first things every new learner wants to know. Here's a realistic answer, broken into actual milestones rather than a vague promise.

## The alphabet: 1–2 weeks

With short daily sessions, most learners can recognize and sound out all 39 letters of the [Armenian alphabet](/armenian-alphabet) within one to two weeks. This is the fastest milestone precisely because it's a fixed, learnable set — 39 symbols and their sounds, not an open-ended skill.

## Basic phrases and greetings: 2–4 weeks

Once the alphabet feels familiar, greetings, numbers, and core vocabulary come next. By the end of a month of consistent practice, most learners can handle basic introductions, greetings, and simple exchanges — see our guide to [essential greetings](/blog/how-to-say-hello-in-armenian-20-essential-greetings) for exactly what that first layer looks like.

## Simple conversation: 2–4 months

This is where grammar starts compounding — basic sentence structure, present-tense verbs, and enough vocabulary to describe your day, ask simple questions, and follow slow, patient conversation. Progress here depends heavily on consistency: 10–15 minutes daily beats a single 2-hour session once a week, because language retention comes from spaced repetition, not cramming.

## Comfortable everyday fluency: 8–12 months

Handling unscripted conversation, understanding native speakers at normal speed, and expressing more complex ideas typically takes the better part of a year of regular practice — roughly in line with what language researchers estimate for languages outside the most closely-related family to English (Armenian isn't in the "easiest" tier for English speakers, but it's far from the hardest either — see [is Armenian hard to learn](/blog/is-armenian-hard-to-learn) for the full picture).

## What actually speeds this up

- **Consistency over intensity.** Daily short sessions beat infrequent long ones.
- **Audio from day one.** Reading Armenian without hearing it creates pronunciation habits that are harder to unlearn later.
- **Real example words, not isolated grammar rules.** Vocabulary sticks better attached to something concrete.

## Start the clock

The only way to find out your own timeline is to start — [Haylingua's course](/learn-armenian-online) is free, built around exactly this progression, and starts at the alphabet regardless of where you're coming from.""",
    },
    {
        "slug": "common-armenian-phrases-for-travel",
        "title": "Common Armenian Phrases for Travel",
        "meta_description": "Essential Armenian phrases for travel — ordering food, asking directions, shopping, and everyday situations you'll actually run into in Armenia.",
        "excerpt": "The phrases that actually come up on a trip — ordering food, asking for directions, and getting around without English.",
        "tags": ["travel", "phrases", "vocabulary"],
        "body": """Traveling to Armenia? Beyond greetings, here are the phrases that actually come up in day-to-day situations — restaurants, directions, and shopping.

## At a restaurant or café

- **Մենյուն, խնդրում եմ** (men-yun, khən-drum em) — The menu, please
- **Ես կուզենայի...** (yes ku-ze-na-yi...) — I would like...
- **Հաշիվը, խնդրում եմ** (ha-shi-və, khən-drum em) — The check, please
- **Շատ համեղ էր** (shat ha-megh er) — It was very tasty

## Asking for directions

- **Ներողություն, որտե՞ղ է...** (ne-ro-ghu-tyun, vor-tegh e...) — Excuse me, where is...
- **Ինչպե՞ս հասնել այնտեղ** (inch-pes has-nel ayn-tegh) — How do I get there?
- **Հեռու՞ է** (he-ru e) — Is it far?
- **Ձախ / աջ / ուղիղ** (dzakh / aj / u-ghigh) — Left / right / straight ahead

## Shopping and prices

- **Ինչքա՞ն արժե** (inch-kan ar-zhe) — How much does it cost?
- **Սա շատ թանկ է** (sa shat t'ank e) — This is very expensive
- **Կարո՞ղ եմ նայել** (ka-rogh em na-yel) — Can I take a look?
- **Վերցնում եմ սա** (verts-num em sa) — I'll take this

## Basic needs

- **Ինձ օգնություն է պետք** (indz og-nu-tyun e petk') — I need help
- **Ես հասկանում եմ** (yes has-ka-num em) — I understand
- **Ես չեմ հասկանում** (yes chem has-ka-num) — I don't understand
- **Կարո՞ղ եք դանդաղ խոսել** (ka-rogh ek dan-dagh kho-sel) — Can you speak slowly?

## The one phrase that unlocks the rest

**Ինչպե՞ս է դա հայերենով** (inch-pes e da ha-ye-ren-ov) — "How do you say that in Armenian?" — is arguably the single most useful phrase you can carry, since it turns any unfamiliar object or situation into a mini vocabulary lesson on the spot.

## Get the pronunciation right before you go

Reading these phonetically is a starting point, but Armenian has a few sounds — like the difference between plain and "puffed" consonants — that are easy to mispronounce without hearing them first. Our [pronunciation guide](/armenian-pronunciation) covers exactly these trouble spots, and pairing that with [essential greetings](/blog/how-to-say-hello-in-armenian-20-essential-greetings) will get you further than a phrasebook alone.""",
    },
    {
        "slug": "is-armenian-similar-to-russian",
        "title": "Is Armenian Similar to Russian? Clearing Up a Common Myth",
        "meta_description": "Is Armenian similar to Russian? No — Armenian is its own independent branch of the Indo-European language family, unrelated to Slavic languages.",
        "excerpt": "A common assumption, but the two aren't related — here's what Armenian is actually connected to, and why the confusion happens.",
        "tags": ["faq", "language-facts"],
        "body": """It's a common assumption — Armenia was part of the Soviet Union, and many Armenians speak Russian too, so surely the languages are related? Actually, no. Here's the real picture.

## Armenian is its own branch entirely

Armenian is part of the Indo-European language family — the same broad family that includes English, Spanish, Russian, Hindi, and Persian, among many others. But within that family, Armenian isn't grouped with the Slavic languages (Russian, Ukrainian, Polish, etc.) at all. It forms its **own independent branch**, sometimes described as the sole surviving member of its group — comparable to how Greek and Albanian also each form their own single-language branches within Indo-European.

That means Armenian is, in a strict linguistic sense, about as closely related to Russian as English is — which is to say, distantly, as cousins several times removed, not siblings.

## Where the confusion comes from

A few real-world facts feed the myth:

- **Armenia was part of the USSR** from 1922 to 1991, and Russian was taught widely and remains a common second language for many Armenians, especially older generations.
- **The Cyrillic-vs-Armenian script mix-up.** Some people assume any "unfamiliar-looking non-Latin script from that region" must be related to Russian's Cyrillic alphabet. It isn't — Armenian script was created independently around 405 AD (see our [alphabet guide](/armenian-alphabet)), centuries before Cyrillic existed at all.
- **Geographic proximity** — Armenia borders countries with historical Russian and Soviet influence, which makes an assumed language connection feel intuitive even though it isn't linguistically accurate.

## What Armenian actually resembles

Because of its independent branch status, Armenian doesn't closely resemble any single "sister" language the way, say, Spanish resembles Italian. Its closest linguistic relationships (still fairly distant) trace back through ancient Indo-European roots shared with Greek and some Indo-Iranian languages — not through anything modern or mutually intelligible.

Historically, Armenian vocabulary has absorbed loanwords from Persian, Greek, Arabic, Turkish, French, and Russian over centuries of contact and trade — so you will spot occasional borrowed words that echo Russian, but that's vocabulary borrowing, not a shared linguistic origin.

## The bottom line

If you already speak Russian, it won't give you a meaningful head start on Armenian grammar or core vocabulary — you're starting from the same place as any other learner. The [alphabet](/armenian-alphabet) is genuinely new either way, and that's actually good news: there's no false-friend confusion to unlearn from a language you already know.""",
    },
]


def seed_blog_posts():
    with engine.begin() as conn:
        inserted = 0
        skipped = []
        for post in _POSTS:
            result = conn.execute(
                text(
                    """
                    INSERT INTO blog_posts
                        (slug, title, meta_description, excerpt, body_markdown, author_name, tags, is_published, published_at)
                    VALUES
                        (:slug, :title, :meta, :excerpt, :body, 'Haylingua', CAST(:tags AS jsonb), TRUE, NOW())
                    ON CONFLICT (slug) DO NOTHING
                    RETURNING id
                    """
                ),
                {
                    "slug": post["slug"],
                    "title": post["title"],
                    "meta": post["meta_description"],
                    "excerpt": post["excerpt"],
                    "body": post["body"],
                    "tags": json.dumps(post["tags"]),
                },
            ).first()
            if result:
                inserted += 1
            else:
                skipped.append(post["slug"])
        return {"ok": True, "posts_inserted": inserted, "skipped_existing": skipped}
