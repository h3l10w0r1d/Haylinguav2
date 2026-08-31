# backend/seed_blog_posts.py
"""
Seeds the first-party blog (blog_posts table, see ensure_schema.py) with the
initial content batch from the SEO plan — one post per high-value keyword
cluster the site had zero coverage for (high-intent "how to learn Armenian"
queries, alphabet, dialect/FAQ questions, and vocabulary). Each post is
genuinely substantive (300+ words, real structure, internal links to the
matching landing page + at least one other post), not thin SEO filler —
same bar as the hand-verified test post from the earlier CMS pass.

_POSTS (the original 8) publish immediately. _SCHEDULED_POSTS is a second
wave of 13 more posts, one per week for the next ~3 months, so /blog reads
as an actively-maintained publication rather than a one-time content dump.
Every row is inserted with is_published=TRUE; "scheduled" just means a
future published_at — routes_blog.py's public queries require
published_at <= NOW(), so a scheduled post sits invisible until its date
arrives, no cron/worker required. days_from_now is resolved against the
DB's own NOW() when this actually runs, not a baked-in calendar date.

cover_image_url is left NULL on every post — no real photography exists
yet; add cover images later through the CMS upload UI (BlogPage.jsx/
BlogPostPage.jsx already handle a missing cover gracefully).

Idempotent: ON CONFLICT (slug) DO NOTHING, so re-running never duplicates or
overwrites hand-edited content, and never reschedules a post that's already
in the table. Triggered via POST /cms/seed/blog-posts (CMS-admin only),
same pattern as POST /cms/seed/alphabet.
"""

import json
from sqlalchemy import text
from database import engine

from _translated_posts_ru import POSTS_RU
from _translated_posts_fr import POSTS_FR
from _translated_posts_es import POSTS_ES
from _translated_posts_ar import POSTS_AR
from _translated_posts_fa import POSTS_FA
from _translated_posts_ka import POSTS_KA

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

# Second content wave — scheduled one per week for the next ~3 months rather
# than dumped all at once, so /blog looks like an actively-maintained
# publication instead of a one-time content drop (also spreads out how fast
# Google needs to crawl/index new URLs). days_from_now is resolved against
# the DB's own NOW() at the moment this seed actually runs, not baked in as
# a calendar date, so re-running this script on a different day still lands
# a sane weekly cadence starting from "today."
_SCHEDULED_POSTS = [
    {
        "slug": "armenian-colors-vocabulary-guide",
        "days_from_now": 7,
        "title": "Armenian Colors: A Complete Vocabulary Guide",
        "meta_description": "Learn all the essential Armenian color words with pronunciation — from the basics like red and blue to shades you'll actually use in conversation.",
        "excerpt": "From կարմիր (red) to մանուշակագույն (purple) — every color word worth learning, with pronunciation.",
        "tags": ["vocabulary", "colors"],
        "body": """Colors are some of the most useful descriptive words in any language — they show up constantly, from describing clothes to talking about a sunset. Here's the full set in Armenian.

## The basics

- **կարմիր** (kar-mir) — red
- **կապույտ** (ka-puyt) — blue
- **դեղին** (de-ghin) — yellow
- **կանաչ** (ka-nach) — green
- **սպիտակ** (spi-tak) — white
- **սև** (sev) — black
- **նարնջագույն** (nar-nja-guyn) — orange
- **մանուշակագույն** (ma-nu-sha-ka-guyn) — purple

## Beyond the basics

- **վարդագույն** (var-da-guyn) — pink (literally "rose-colored")
- **շագանակագույն** (sha-ga-na-ka-guyn) — brown
- **մոխրագույն** (mokh-ra-guyn) — gray
- **ոսկեգույն** (vos-ke-guyn) — golden

## A pattern worth noticing

You've probably spotted it already — many Armenian color words end in **-գույն** (guyn), which literally means "color." That's not a coincidence: several colors are built as "[something]-colored" rather than having a fully separate root word, similar to how English sometimes says "rose-colored" instead of just "pink." Once you notice this pattern, new color words become much easier to guess and remember.

## Using colors in a sentence

Armenian adjectives (including colors) typically come before the noun they describe, just like in English — so "կարմիր տուն" is simply "red house," in the same word order you'd expect. That makes colors one of the easier vocabulary categories to start actively using in real sentences right away.

## Keep building your vocabulary

Colors are just one category — see our full [Armenian vocabulary](/armenian-vocabulary) page for greetings, numbers, family, and food words, or work through [50 basic Armenian words every beginner should know](/blog/50-basic-armenian-words) for a broader starting set.""",
    },
    {
        "slug": "armenian-family-words",
        "days_from_now": 14,
        "title": "Armenian Family Words: Mother, Father, and Everyone In Between",
        "meta_description": "Learn Armenian words for family members — mother, father, siblings, grandparents, and more — with pronunciation for each.",
        "excerpt": "Family vocabulary comes up constantly in real conversation — here's the full set, from mayr to tatik.",
        "tags": ["vocabulary", "family"],
        "body": """Family vocabulary is some of the most-used vocabulary in everyday Armenian conversation — people ask about your family constantly, and it's often one of the first real conversations you'll have.

## Immediate family

- **մայր** (mayr) — mother
- **հայր** (hayr) — father
- **քույր** (k'uyr) — sister
- **եղբայր** (yegh-bayr) — brother
- **երեխա** (ye-re-kha) — child
- **ամուսին** (a-mu-sin) — spouse / husband
- **կին** (kin) — wife / woman

## Extended family

- **տատիկ** (ta-tik) — grandmother
- **պապիկ** (pa-pik) — grandfather
- **մորաքույր** (mo-ra-k'uyr) — aunt (mother's side)
- **հորաքույր** (ho-ra-k'uyr) — aunt (father's side)
- **քեռի** (k'e-ri) — uncle (mother's side)
- **հորեղբայր** (ho-regh-bayr) — uncle (father's side)
- **զարմիկ** (zar-mik) — cousin (male)
- **զարմուհի** (zar-mu-hi) — cousin (female)

## A detail worth knowing

Notice that aunts and uncles have *different words* depending on whether they're on your mother's or father's side — Armenian, like several other languages, distinguishes maternal and paternal relatives more precisely than English does. This is genuinely useful to know early, since it's the kind of detail that comes up the moment you're introduced to someone's extended family.

## Talking about your own family

A simple, useful pattern: **Իմ [family word]-ը...** ("My [family member] is...") lets you build real sentences immediately. For example, **Իմ մայրը Երևանից է** — "My mother is from Yerevan."

## Where to go next

Once family words feel comfortable, [Armenian numbers](/blog/armenian-numbers-1-to-100) and [colors](/blog/armenian-colors-vocabulary-guide) round out the core vocabulary you'll lean on daily — or start from the [Armenian alphabet](/armenian-alphabet) if you're still building up to reading these words yourself.""",
    },
    {
        "slug": "days-of-the-week-in-armenian",
        "days_from_now": 21,
        "title": "Days of the Week in Armenian",
        "meta_description": "Learn the days of the week in Armenian with pronunciation — essential vocabulary for making plans and talking about schedules.",
        "excerpt": "From երկուշաբթի (Monday) to կիրակի (Sunday) — every day of the week, with pronunciation and the logic behind the names.",
        "tags": ["vocabulary", "days-of-the-week"],
        "body": """Whether you're making plans or just talking about your schedule, the days of the week are essential everyday vocabulary. Here's the full week in Armenian.

## The seven days

- **երկուշաբթի** (yer-ku-shab-t'i) — Monday
- **երեքշաբթի** (ye-rek'-shab-t'i) — Tuesday
- **չորեքշաբթի** (cho-rek'-shab-t'i) — Wednesday
- **հինգշաբթի** (hing-shab-t'i) — Thursday
- **ուրբաթ** (ur-bat') — Friday
- **շաբաթ** (sha-bat') — Saturday
- **կիրակի** (ki-ra-ki) — Sunday

## The pattern that makes these easy to remember

Look closely and you'll spot it: **երկու** (2), **երեք** (3), **չորս** (4), and **հինգ** (5) are hiding inside Monday through Thursday's names, each attached to **-շաբթի** ("week"). Armenian literally names its weekdays "day 2 of the week," "day 3 of the week," and so on — Monday is the second day because the week traditionally starts counting from Sunday. Once you know your [Armenian numbers](/blog/armenian-numbers-1-to-100), four of the seven days become almost free to remember.

**Ուրբաթ** (Friday), **շաբաթ** (Saturday), and **կիրակի** (Sunday) break the pattern — they have their own distinct roots rather than being numbered, similar to how Saturday and Sunday stand apart from the numbered logic in some other languages too.

## Using days in a sentence

**Ես կիրակի օրը հանգստանում եմ** — "I rest on Sunday." The structure **[day] օրը** ("on the day of...") is a simple, reusable pattern for talking about when things happen.

## Build on this

Days of the week pair naturally with talking about plans and schedules — a great next step is [common Armenian phrases for travel](/blog/common-armenian-phrases-for-travel), or continue building core vocabulary with [Armenian family words](/blog/armenian-family-words).""",
    },
    {
        "slug": "armenian-food-vocabulary",
        "days_from_now": 28,
        "title": "Armenian Food Vocabulary: 30 Words for Your Next Meal",
        "meta_description": "Essential Armenian food vocabulary — 30 words for ingredients, dishes, and drinks, with pronunciation for your next meal or trip to Armenia.",
        "excerpt": "From հաց (bread) to խորոված (barbecue) — the food words you'll actually use at the table.",
        "tags": ["vocabulary", "food"],
        "body": """Food vocabulary is some of the most rewarding to learn — it's useful immediately, whether you're at an Armenian restaurant, cooking with family recipes, or traveling.

## Everyday staples

- **հաց** (hats) — bread
- **ջուր** (jur) — water
- **կաթ** (kat) — milk
- **պանիր** (pa-nir) — cheese
- **միս** (mis) — meat
- **ձու** (dzu) — egg
- **բրինձ** (brindz) — rice
- **կարտոֆիլ** (kar-to-fil) — potato

## Fruits and vegetables

- **խնձոր** (khn-dzor) — apple
- **նարինջ** (na-rinj) — orange
- **խաղող** (kha-ghogh) — grape
- **լոլիկ** (lo-lik) — tomato
- **վարունգ** (va-rung) — cucumber
- **սոխ** (sokh) — onion

## Dishes worth knowing

- **խորոված** (kho-ro-vats) — barbecue/grilled meat, a cornerstone of Armenian cuisine
- **դոլմա** (dol-ma) — dolma, grape leaves stuffed with rice and meat
- **լավաշ** (la-vash) — lavash, the thin traditional flatbread (UNESCO-recognized as intangible cultural heritage)
- **խաշ** (khash) — khash, a traditional slow-cooked dish
- **գաթա** (ga-t'a) — gata, a sweet pastry often served with coffee

## At the table

- **համեղ է** (ha-megh e) — it's tasty
- **շատ եմ ուզում** (shat em u-zum) — I want a lot / more
- **հագեցած եմ** (ha-ge-tsats em) — I'm full
- **բարի ախորժակ** (ba-ri a-khor-zhak) — bon appétit / enjoy your meal

## Practice ordering for real

Pair this vocabulary with our [common Armenian phrases for travel](/blog/common-armenian-phrases-for-travel), which covers exactly how to order, ask for the check, and compliment the food — or explore [50 basic Armenian words every beginner should know](/blog/50-basic-armenian-words) to round out your core vocabulary.""",
    },
    {
        "slug": "50-basic-armenian-words",
        "days_from_now": 35,
        "title": "50 Basic Armenian Words Every Beginner Should Know",
        "meta_description": "50 essential Armenian words for beginners, organized by category — greetings, numbers, questions, and everyday essentials with pronunciation.",
        "excerpt": "A starter vocabulary list organized by category — the words that show up constantly, in one place.",
        "tags": ["vocabulary", "beginner"],
        "body": """Every learner needs a starting vocabulary — words common enough that you'll hear and need them constantly. Here are 50, organized by category so you can focus on what's relevant to you first.

## Question words (7)

- **ինչ** (inch) — what
- **ով** (ov) — who
- **որտեղ** (vor-tegh) — where
- **ե՞րբ** (yerb) — when
- **ինչու** (in-chu) — why
- **ինչպես** (inch-pes) — how
- **ինչքան** (inch-k'an) — how much/many

## Everyday essentials (10)

- **այո** (a-yo) — yes
- **ոչ** (voch) — no
- **խնդրում եմ** (khən-drum em) — please
- **շնորհակալություն** (shnor-ha-ka-lu-tyun) — thank you
- **ներողություն** (ne-ro-ghu-tyun) — sorry / excuse me
- **լավ** (lav) — good
- **վատ** (vat) — bad
- **մեծ** (mets) — big
- **փոքր** (p'ok'r) — small
- **նոր** (nor) — new

## People and pronouns (8)

- **ես** (yes) — I
- **դու / դուք** (du / duk) — you (informal/formal)
- **նա** (na) — he/she
- **մենք** (menk) — we
- **նրանք** (nrank) — they
- **մարդ** (mard) — person
- **ընկեր** (ən-ker) — friend
- **ընտանիք** (ən-ta-nik') — family

## Time (6)

- **այսօր** (ay-sor) — today
- **վաղը** (va-ghə) — tomorrow
- **երեկ** (ye-rek) — yesterday
- **հիմա** (hi-ma) — now
- **ժամանակ** (zha-ma-nak) — time
- **օր** (or) — day

## Places and objects (10)

- **տուն** (tun) — house
- **քաղաք** (k'a-ghak') — city
- **երկիր** (yer-kir) — country
- **ճանապարհ** (chan-a-parh) — road/way
- **դուռ** (dur) — door
- **պատուհան** (pa-tu-han) — window
- **գիրք** (girk') — book
- **գրիչ** (grich) — pen
- **հեռախոս** (he-ra-khos) — phone
- **փող** (p'ogh) — money

## Common verbs, in their basic form (9)

- **ուզել** (u-zel) — to want
- **գնալ** (gə-nal) — to go
- **գալ** (gal) — to come
- **տեսնել** (tes-nel) — to see
- **ասել** (a-sel) — to say
- **անել** (a-nel) — to do
- **սիրել** (si-rel) — to love
- **ուտել** (u-tel) — to eat
- **խոսել** (kho-sel) — to speak

## What to do with this list

Don't try to memorize all 50 in one sitting — pick one category that's most relevant to what you need right now, and build from there. For a structured, audio-backed path through vocabulary like this from the very beginning, [Haylingua's course](/learn-armenian-online) sequences words exactly this way, paired with real pronunciation on every one.""",
    },
    {
        "slug": "how-to-read-armenian",
        "days_from_now": 42,
        "title": "How to Read Armenian: A Step-by-Step Guide",
        "meta_description": "A step-by-step guide to reading Armenian — from recognizing individual letters to sounding out full words and sentences with confidence.",
        "excerpt": "Reading Armenian is a skill you build in stages — here's the exact progression, from single letters to full sentences.",
        "tags": ["alphabet", "reading", "beginner"],
        "body": """Knowing the alphabet and being able to *read* Armenian fluently are two different milestones. Here's the practical path between them.

## Stage 1: Recognize individual letters

Before you can read anything, you need instant recognition of all 39 letters — both uppercase and lowercase — without having to stop and think. This is the foundation everything else builds on. Our [Armenian alphabet page](/armenian-alphabet) is built exactly for this stage: every letter with audio, so you're linking the shape to the sound from the very first look, not memorizing symbols in silence.

## Stage 2: Sound out short, familiar words

Once letters are automatic, start sounding out words you already know the meaning of — greetings, family words, numbers. Reading **մայր** and recognizing it as "mother" (a word you already know from [Armenian family vocabulary](/blog/armenian-family-words)) reinforces both the reading skill and the vocabulary at the same time, rather than treating them as separate tasks.

## Stage 3: Read without translating in your head

This is the real turning point — reading **ջուր** and picturing water directly, instead of mentally converting "ջ-ու-ր → sounds like 'jur' → oh, that means water." It happens gradually with repeated exposure, not through a single trick — the words you encounter most often become instant the fastest.

## Stage 4: Read full sentences at a natural pace

Once individual words are fast, sentence-level reading is mostly about handling word order and grammatical endings — Armenian nouns change form depending on their role in the sentence, which affects how a word looks at the end even when the root is the same.

## Why phonetic spelling makes this easier than it sounds

Armenian's biggest advantage for readers: spelling is almost entirely consistent. Once you know what sound a letter makes, it makes that same sound in virtually every word — unlike English, where "read" is pronounced two different ways depending on tense. This means Stage 1 (letter recognition) does most of the heavy lifting; there's no separate, unpredictable "spelling rules" phase to layer on top the way there is in English.

## A realistic timeline

Most learners hit Stage 1 within one to two weeks of daily practice — see our full breakdown in [how long does it take to learn Armenian](/blog/how-long-to-learn-armenian) for what the stages after that typically take.""",
    },
    {
        "slug": "armenian-grammar-basics",
        "days_from_now": 49,
        "title": "Armenian Grammar Basics: Sentence Structure for Beginners",
        "meta_description": "An introduction to Armenian grammar for beginners — sentence structure, word order, and the core concepts you need before building real sentences.",
        "excerpt": "Word order, cases, and verb basics — the grammar concepts that unlock real sentence-building, explained simply.",
        "tags": ["grammar", "beginner"],
        "body": """Vocabulary gets you words; grammar is what turns those words into sentences. Here's a beginner-friendly map of how Armenian grammar actually works.

## Basic word order

Armenian's default word order is Subject-Object-Verb (SOV) — the verb typically comes at the end of the sentence, unlike English's Subject-Verb-Object order. For example, "I water drink" rather than "I drink water." This feels backward at first if you're coming from English, but it's a fixed, learnable pattern, not something that varies unpredictably sentence to sentence.

In casual speech, word order is actually more flexible than this rule suggests — Armenian uses noun endings (not just position) to signal who's doing what, so meaning often stays clear even when the order shifts for emphasis.

## No grammatical gender

Unlike French, Spanish, German, or Russian, Armenian nouns don't belong to masculine/feminine/neuter categories. Every noun is grammatically neutral — which means one entire category of memorization (which gender is "table," which is "chair") simply doesn't exist here.

## Noun cases: what they are and why they matter

Armenian nouns change form depending on their grammatical role in a sentence — whether they're the subject, the object, showing possession, and so on. This is called a case system. English does a light version of this too (he/him/his changes depending on role), but Armenian applies it more broadly across nouns generally, not just pronouns. It sounds intimidating listed abstractly, but in practice you absorb the common patterns through repeated exposure to real sentences, the same way English speakers never consciously "learn" that it's "he sees her" and not "he sees she."

## Verbs and tense

Armenian verbs conjugate for person (I/you/he-she/we/they) and tense (past/present/future), similar in spirit to Spanish or French conjugation, though with different specific endings. We cover the present tense in detail in [Armenian verb conjugation: the present tense explained](/blog/armenian-verb-conjugation-present-tense).

## Questions

Yes/no questions in Armenian are often formed just by changing intonation — rising pitch at the end of a statement — rather than rearranging word order the way English does ("You are here." → "Are you here?"). This is actually a simplification compared to English, not an added complication.

## Where grammar meets vocabulary

Grammar rules feel abstract in isolation — they click once you're applying them to real vocabulary. Build your word bank with [50 basic Armenian words](/blog/50-basic-armenian-words), then come back to see these patterns in action, or jump into [Haylingua's course](/learn-armenian-online), which introduces grammar gradually alongside real sentences rather than as a separate unit to memorize upfront.""",
    },
    {
        "slug": "best-way-to-learn-armenian-online",
        "days_from_now": 56,
        "title": "Best Way to Learn Armenian Online in 2026",
        "meta_description": "Looking for the best way to learn Armenian online? Compare your real options — apps, tutors, and structured courses — and what actually works.",
        "excerpt": "Apps, tutors, immersion, structured courses — an honest comparison of what actually works for learning Armenian online.",
        "tags": ["getting started", "online-learning"],
        "body": """If you've searched for how to learn Armenian online, you've probably found a scattered mix of options. Here's an honest breakdown of what each approach actually offers.

## Structured courses and apps

A well-built structured course sequences content deliberately — alphabet before words, words before sentences, simple grammar before complex — instead of leaving you to guess what to study next. The advantage is consistency and a clear sense of progress; the tradeoff is that you're following someone else's curriculum rather than chasing whatever interests you that day. This matters most in the first few months, when not knowing *what* to study is the biggest obstacle, more than motivation.

## One-on-one tutors

A tutor gives you real conversation practice and personalized correction — genuinely valuable, especially once you have a vocabulary base to work with. The tradeoffs are cost and scheduling, and a tutor alone (without structured material alongside) can leave gaps, since sessions tend to follow conversation rather than systematically covering the language.

## Immersion content (shows, music, podcasts)

Great for training your ear and picking up natural rhythm and slang, but genuinely difficult before you have foundational vocabulary and grammar — total immersion with zero prior knowledge mostly produces frustration, not learning, in the first weeks. It's a strong *supplement* once you're past the very beginning, not a starting point.

## Language exchange partners

Free, and gives real conversation practice with a native speaker in exchange for helping them with your own language. The catch is consistency — quality depends entirely on who you're paired with, and there's no structured curriculum behind it.

## What actually works: layering approaches

The most effective learners typically combine a structured foundation (so you always know what to study) with real audio exposure (so pronunciation is correct from day one) and eventually conversation practice (to apply what you've learned). Trying to skip straight to conversation without vocabulary, or consuming immersion content without any structure, are the two most common ways beginners stall out.

## What Haylingua does

[Haylingua](/learn-armenian-online) is built as that structured foundation — bite-sized lessons sequenced from the [alphabet](/armenian-alphabet) onward, with real audio on every single word rather than just a sample. It's free to start, and pairs naturally with a tutor or exchange partner once you've built a real vocabulary base to converse with.""",
    },
    {
        "slug": "armenian-for-heritage-speakers",
        "days_from_now": 63,
        "title": "Armenian for Heritage Speakers: Where to Start",
        "meta_description": "A guide for Armenian heritage speakers — how to formalize the Armenian you already understand into real reading, writing, and speaking ability.",
        "excerpt": "You understand more than you think — here's how to turn passive family Armenian into real reading, writing, and speaking skills.",
        "tags": ["heritage-speakers", "getting started"],
        "body": """If you grew up hearing Armenian at home — from parents, grandparents, or a diaspora community — but never formally learned to read, write, or speak it confidently, you're a heritage speaker. Your starting point is genuinely different from a complete beginner's, and it's worth learning differently too.

## What heritage speakers usually already have

Most heritage speakers have real advantages most learners spend months building: natural pronunciation (your ear is already trained on real Armenian sounds, even if you can't explain the rules), a passive vocabulary that's often much larger than you realize, and cultural context that makes idioms and references land immediately instead of needing explanation.

## What's usually the actual gap

For most heritage speakers, the gap isn't vocabulary or listening comprehension — it's **reading, writing, and active production**. You can understand a conversation but freeze when asked to respond, or you speak fluently but have never learned the alphabet at all. That's an extremely common, specific gap, not a sign you're "not really" a speaker.

## Where to actually start

**Don't start at zero.** Skipping straight to basic greetings and "hello, how are you" wastes the real advantage you already have and gets boring fast. Instead:

1. **Learn the [alphabet](/armenian-alphabet) properly**, even if you already speak — this is very often the single missing piece for heritage speakers specifically.
2. **Bridge spoken vocabulary to written form.** Words you already know how to *say* become dramatically easier to learn to *read and write*, since you're attaching a new skill to an existing one rather than learning from nothing.
3. **Focus early on production, not comprehension.** You likely don't need much listening practice — prioritize speaking and writing practice instead, since that's almost always the actual gap.

## A note on dialect

Many diaspora heritage speakers grew up with Western Armenian, while most formal online resources — including Haylingua — teach Standard Eastern Armenian. The two share the same alphabet and a large amount of vocabulary and grammar; see our full breakdown in [Eastern vs. Western Armenian](/blog/eastern-vs-western-armenian) to understand exactly where they overlap and where they diverge, so you know what to expect either way.

## Start where it counts

If reading and writing are your real gap, the [Armenian alphabet](/armenian-alphabet) is the highest-leverage place to spend your first real study session — not because you're starting from zero, but because it unlocks everything else you already know how to say.""",
    },
    {
        "slug": "how-to-write-in-armenian",
        "days_from_now": 70,
        "title": "How to Write in Armenian: Alphabet, Keyboard, and Practice Tips",
        "meta_description": "Learn how to write in Armenian — from forming letters by hand to typing on an Armenian keyboard, with practical tips for beginners.",
        "excerpt": "Handwriting, typing, and the practice habits that actually build real writing ability — a practical starting guide.",
        "tags": ["writing", "alphabet", "beginner"],
        "body": """Reading Armenian and writing it are related but distinct skills. Here's how to approach writing specifically, whether by hand or on a keyboard.

## Handwriting: where to start

Before worrying about speed or style, focus on learning each letter's basic form correctly — both uppercase and lowercase, since they don't always resemble each other the way you might expect. Tracing letters while saying their sound out loud reinforces both the shape and pronunciation together, rather than treating writing as a purely visual exercise disconnected from the spoken language.

Armenian handwriting, like any script, develops its own natural "cursive-ish" flow with practice — but there's no need to worry about that early on. Clean, deliberate letterforms first; speed and personal style come later, the same progression as learning to write any new script.

## Typing Armenian on a keyboard

You don't need a physical Armenian keyboard to type Armenian:

- **Phone keyboards**: iOS and Android both support adding an Armenian keyboard layout in your system language settings — once added, you can switch to it like any other language keyboard.
- **Computer keyboards**: Windows, macOS, and Linux all support installing an Armenian keyboard layout without any extra software, through your system's language/input settings.
- **Phonetic/transliteration typing tools**: Several online tools let you type Armenian phonetically using Latin letters (typing roughly how a word sounds) and auto-convert to Armenian script — useful for occasional typing without learning a new key layout, though less useful for building genuine typing fluency.

## Practice habits that actually help

**Copy real words, not random letters.** Writing out words you're also learning to read and speak — like the ones in [50 basic Armenian words](/blog/50-basic-armenian-words) — reinforces multiple skills in the same practice session instead of treating writing as isolated drilling.

**Write, don't just trace, once letters feel familiar.** Tracing builds initial muscle memory, but producing letters from memory (writing a word you're only thinking of, not copying) is what actually cements the skill.

**Short, frequent sessions beat long infrequent ones.** Ten minutes of handwriting practice most days will get you further than one long session per week — the same spaced-repetition logic that applies to vocabulary applies to motor skills like handwriting too.

## Start with the shapes themselves

If you haven't yet, the [Armenian alphabet](/armenian-alphabet) is the natural starting point — every letter's uppercase and lowercase form, ready to trace and practice, before you move on to full words and sentences.""",
    },
    {
        "slug": "armenian-verb-conjugation-present-tense",
        "days_from_now": 77,
        "title": "Armenian Verb Conjugation: The Present Tense Explained",
        "meta_description": "A clear explanation of Armenian present tense verb conjugation for beginners, with real examples and the patterns that make it predictable.",
        "excerpt": "Armenian present-tense verbs follow predictable patterns once you see the logic — here's a clear walkthrough with real examples.",
        "tags": ["grammar", "verbs"],
        "body": """Verb conjugation is where Armenian grammar starts feeling like a real system rather than a list of vocabulary. Here's a clear walkthrough of the present tense.

## The basic idea

Just like English changes "I go" to "she goes," Armenian verbs change their ending depending on who's doing the action. The difference is that Armenian marks this more consistently across all persons (I/you/he-she/we/you-all/they), not just the third person singular the way English does.

## A regular verb, conjugated

Take **խոսել** (kho-sel) — "to speak." Its present tense follows a predictable pattern:

- **ես խոսում եմ** (yes kho-sum em) — I speak
- **դու խոսում ես** (du kho-sum es) — you speak (informal)
- **նա խոսում է** (na kho-sum e) — he/she speaks
- **մենք խոսում ենք** (menk' kho-sum enk') — we speak
- **դուք խոսում եք** (duk' kho-sum ek') — you speak (formal/plural)
- **նրանք խոսում են** (nrank' kho-sum en) — they speak

## The pattern to notice

Armenian present tense is built from two pieces: the verb's present participle form (**խոսում**, roughly "speaking") plus a conjugated form of "to be" (**եմ / ես / է / ենք / եք / են**) that changes with the subject. Once you recognize this two-part structure, you're really just learning one small set of "to be" endings and reusing them across every verb — not memorizing a completely new ending set per verb.

## Trying it with another verb

**ուտել** (u-tel) — "to eat" — follows the same shape:

- **ես ուտում եմ** (yes u-tum em) — I eat
- **նա ուտում է** (na u-tum e) — he/she eats
- **նրանք ուտում են** (nrank' u-tum en) — they eat

Notice the ending pattern (**եմ / է / են**) is identical to **խոսել** above — that consistency is exactly what makes Armenian conjugation learnable as a system rather than case-by-case memorization.

## Why this matters early

Once this pattern clicks, you can conjugate *any* regular verb in the present tense correctly, immediately — including verbs you're learning for the first time. That's a disproportionately high return for one grammar concept, which is why it's worth understanding deliberately rather than picking it up passively.

## Keep building

This is one piece of the larger picture — see [Armenian grammar basics](/blog/armenian-grammar-basics) for how word order, cases, and verbs fit together, or start applying this directly with vocabulary from [50 basic Armenian words](/blog/50-basic-armenian-words).""",
    },
    {
        "slug": "common-mistakes-english-speakers-learning-armenian",
        "days_from_now": 84,
        "title": "Top 10 Mistakes English Speakers Make Learning Armenian",
        "meta_description": "The most common mistakes English speakers make when learning Armenian — pronunciation, grammar, and study-habit pitfalls, and how to avoid them.",
        "excerpt": "From mixing up plain and puffed consonants to skipping the alphabet — the pitfalls that trip up English-speaking learners most.",
        "tags": ["tips", "beginner"],
        "body": """After the alphabet itself, these are the specific mistakes that come up again and again for English speakers learning Armenian.

## 1. Skipping the alphabet to "save time"

Trying to learn Armenian through romanized transliteration instead of the real script feels faster at first, but it caps how far you can go and builds habits you'll have to unlearn. The [alphabet](/armenian-alphabet) is a one-time investment, not an optional detour.

## 2. Confusing plain and "puffed" consonants

Armenian distinguishes crisp, unaspirated consonants from breathy, aspirated ones — a contrast English simply doesn't make. Mixing up «տ» (plain t) and «թ» (puffed t) is probably the single most common pronunciation error. See our [pronunciation guide](/armenian-pronunciation) for exactly which pairs to watch for.

## 3. Mixing up the two R sounds

Eastern Armenian has both a light, single tongue-tap «ր» and a strongly rolled «ռ». English has neither distinction, so both tend to collapse into "the English R" for new learners — worth deliberately practicing as two separate sounds.

## 4. Assuming word order works like English

Armenian defaults to Subject-Object-Verb rather than English's Subject-Verb-Object. Direct word-for-word translation from English routinely produces backward-sounding sentences — see [Armenian grammar basics](/blog/armenian-grammar-basics) for the full picture.

## 5. Ignoring noun case endings

Because English barely marks grammatical case (mostly just pronouns — he/him/his), it's easy to under-weight how much Armenian nouns change form based on their role in a sentence. Skimming past this early creates confusion later, when the same word looks "wrong" in a new sentence.

## 6. Not using formal vs. informal "you"

Armenian distinguishes formal and informal "you" (similar to French tu/vous). English speakers, who don't have this distinction at all, often default to informal even with strangers or elders — a real, noticeable etiquette slip, not just a grammar quirk.

## 7. Learning vocabulary without audio

Because Armenian spelling is phonetic, it's tempting to assume you can learn pronunciation purely from reading. But a few sounds (see mistake #2 and #3) simply can't be reverse-engineered from spelling alone — they have to be heard.

## 8. Studying in long, infrequent sessions

One two-hour session per week is measurably less effective than 15 minutes daily, because language retention depends heavily on spaced repetition, not raw study time. See [how long does it take to learn Armenian](/blog/how-long-to-learn-armenian) for the timeline consistency actually produces.

## 9. Assuming Armenian is related to Russian

A common but incorrect assumption based on geography and Soviet history — Armenian is its own independent Indo-European branch, unrelated to Russian in any way that gives you a head start. Full explanation in [is Armenian similar to Russian](/blog/is-armenian-similar-to-russian).

## 10. Avoiding speaking until you feel "ready"

Waiting for total confidence before speaking out loud delays the exact practice that builds that confidence. Mistakes while speaking are how the language actually sticks — treat them as part of the process, not a sign you're behind.

## Turn this into a study plan

Most of these are avoided simply by starting with real audio and structured sequencing from day one — exactly how [Haylingua's course](/learn-armenian-online) is built.""",
    },
    {
        "slug": "armenian-idioms-and-expressions",
        "days_from_now": 91,
        "title": "Armenian Culture Through Its Language: Idioms and Expressions",
        "meta_description": "Explore Armenian culture through its language — common idioms and expressions, what they literally mean, and the stories behind them.",
        "excerpt": "Idioms reveal how a culture thinks — here are some of the most common Armenian expressions and what they really mean.",
        "tags": ["culture", "idioms", "expressions"],
        "body": """Idioms and set expressions are where language and culture meet most directly — the phrases a language reaches for reveal what that culture actually values. Here's a starting point, built around one expression every Armenian learner runs into almost immediately, plus the cultural themes worth knowing as you go deeper.

## Ապրե՛ս — the phrase you'll hear constantly

**Ապրե՛ս** (a-pres) is one of the most common things you'll hear in casual Armenian conversation — used as praise or encouragement, roughly like "well done," "bravo," or "nice one" in English. Its literal root is the verb "to live," so it carries a warmer, more personal weight than a plain "good job" — closer to "may you live [long/well]" compressed into a single everyday exclamation. You'll hear it after someone answers a question well, finishes a task, or does something worth a compliment — it's woven into ordinary encouragement, not reserved for special occasions.

## Hospitality as a cultural throughline

Hospitality runs deep in Armenian culture, and it shows up constantly in how people talk about home and guests — offering food immediately when someone visits, insisting guests eat more, treating a shared meal as a meaningful social act rather than a formality. This isn't unique to Armenia (it's a broader Caucasus and Middle Eastern tradition too), but it's genuinely central to how Armenians talk about family and community, and it's worth understanding as context before you're a guest in an Armenian home yourself.

## Resilience as a recurring theme

Armenian history includes long periods of hardship and displacement, and that history shows up in the culture's language and storytelling — themes of endurance, memory, and "we're still here" recur often, in everything from proverbs parents pass down to how national holidays are talked about. You don't need to know specific quoted phrases to notice this theme — it surfaces naturally once you're consuming real Armenian content (conversations, shows, music).

## Family and community language

Armenian conversation leans heavily on family and community framing — how someone's doing is often discussed in terms of their family, and community ties (village, church, diaspora organization) come up as identity markers in a way that's more prominent than in a lot of English conversation. Our guide to [Armenian family vocabulary](/blog/armenian-family-words) covers the actual words behind these relationships.

## A note on learning idioms

Idioms are genuinely an advanced-stage skill — they rely on vocabulary, grammar, and cultural context all at once, which is exactly why they don't make sense translated word-for-word. If some of the phrases above don't fully click yet, that's completely normal; they're worth encountering early as motivation and cultural context, even before you can produce them yourself.

## Why this matters for learning

Idioms are a strong signal that you've moved from "translating a language" to actually "thinking in it" — they're one of the most rewarding milestones precisely because they can't be learned mechanically. Build toward them with real vocabulary and grammar first: [50 basic Armenian words](/blog/50-basic-armenian-words) and [Armenian grammar basics](/blog/armenian-grammar-basics) are the foundation that eventually makes idioms make sense.

## Keep exploring

Language and culture are inseparable — the more Armenian you learn, the more of these expressions will start to click into place on their own, not just as vocabulary but as a genuine way of seeing the world.""",
    },
]


# Russian/French/Spanish translations of the original 8 _POSTS (not
# _SCHEDULED_POSTS — that's a deliberately separate follow-up pass). Each
# entry keeps the SAME slug as its English original (locale, not slug,
# disambiguates the row — see the (slug, locale) unique constraint in
# ensure_schema.py) and every internal link is re-prefixed with the locale
# (e.g. "/armenian-pronunciation" -> "/ru/armenian-pronunciation",
# "/blog/some-slug" -> "/ru/blog/some-slug") so a reader never gets bounced
# back into English mid-article.
_TRANSLATED_POSTS = {
    "ru": POSTS_RU,
    "fr": POSTS_FR,
    "es": POSTS_ES,
    "ar": POSTS_AR,
    "fa": POSTS_FA,
    "ka": POSTS_KA,
}


def _insert_post(conn, post, days_from_now, locale="en", translation_group=None):
    result = conn.execute(
        text(
            """
            INSERT INTO blog_posts
                (slug, title, meta_description, excerpt, body_markdown, author_name, tags, is_published, published_at,
                 locale, translation_group)
            VALUES
                (:slug, :title, :meta, :excerpt, :body, 'Haylingua', CAST(:tags AS jsonb), TRUE,
                 NOW() + (:days || ' days')::interval, :locale, :translation_group)
            ON CONFLICT (slug, locale) DO NOTHING
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
            "days": days_from_now,
            "locale": locale,
            "translation_group": translation_group or post["slug"],
        },
    ).first()
    return bool(result)


def seed_blog_posts():
    """Publishes all waves: _POSTS immediately (days_from_now=0 — this is
    the original batch, already live since the first run of this script),
    _SCHEDULED_POSTS spread across the next ~3 months per-post via each
    entry's own days_from_now, and _TRANSLATED_POSTS (Russian/French/Spanish
    versions of the original 8 _POSTS, linked to their English original via
    translation_group=the English slug) published immediately alongside
    them. All go through the same is_published=TRUE + future-dated
    published_at mechanism — routes_blog.py's public queries gate on
    "published_at <= NOW()", so a scheduled post simply becomes visible on
    its own once that date passes. No cron/worker involved."""
    with engine.begin() as conn:
        # Backfill translation_group for English posts inserted before this
        # column existed (production already has the original 8 live) — a
        # slug's own value is a stable, always-available group key.
        conn.execute(text(
            "UPDATE blog_posts SET translation_group = slug WHERE translation_group IS NULL AND locale = 'en'"
        ))
        inserted = 0
        skipped = []
        for post in _POSTS:
            if _insert_post(conn, post, 0, locale="en"):
                inserted += 1
            else:
                skipped.append(post["slug"])
        for post in _SCHEDULED_POSTS:
            if _insert_post(conn, post, post["days_from_now"], locale="en"):
                inserted += 1
            else:
                skipped.append(post["slug"])
        for locale, posts in _TRANSLATED_POSTS.items():
            for post in posts:
                if _insert_post(conn, post, 0, locale=locale, translation_group=post["slug"]):
                    inserted += 1
                else:
                    skipped.append(f"{post['slug']} ({locale})")
        return {"ok": True, "posts_inserted": inserted, "skipped_existing": skipped}
