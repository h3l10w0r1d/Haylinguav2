# backend/_scheduled_batch2_a.py
"""
Third content wave — 5 more posts continuing the weekly cadence established
in seed_blog_posts.py's _SCHEDULED_POSTS (13 posts, days_from_now 7-91).
This batch picks up right where that one left off: days_from_now 98, 105,
112, 119, 126. Same format, same quality bar (300+ words, real ## structure,
internal links to a landing page + another post, romanized pronunciation on
every Armenian word). Not wired into seed_blog_posts.py — another process
merges BATCH2_A into _SCHEDULED_POSTS.
"""

BATCH2_A = [
    {
        "slug": "armenian-animals-vocabulary",
        "days_from_now": 98,
        "title": "Armenian Animals Vocabulary: Pets, Farm, and Wildlife",
        "meta_description": "Learn Armenian animal names with pronunciation — pets, farm animals, and wildlife — plus a classic Armenian proverb about a dog and a caravan.",
        "excerpt": "From շուն (dog) to առյուծ (lion) — every animal word worth learning, with pronunciation and one memorable proverb.",
        "tags": ["vocabulary", "animals"],
        "body": """Animal vocabulary is some of the most fun to learn in any language — it comes up in conversation, children's stories, and even in idioms. Here's a full set of Armenian animal names, organized by category.

## Pets

- **շուն** (shun) — dog
- **կատու** (ka-tu) — cat
- **ձուկ** (dzuk) — fish
- **թռչուն** (t'rr-chun) — bird

## Farm animals

- **կով** (kov) — cow
- **ձի** (dzi) — horse
- **ոչխար** (voch-khar) — sheep
- **այծ** (ayts) — goat
- **խոզ** (khoz) — pig
- **հավ** (hav) — chicken
- **բադ** (bad) — duck

## Wild animals

- **առյուծ** (a-rryuts) — lion
- **արջ** (arj) — bear
- **գայլ** (gayl) — wolf
- **աղվես** (agh-ves) — fox
- **նապաստակ** (na-pas-tak) — rabbit
- **փիղ** (p'igh) — elephant

## A proverb worth knowing

Armenian has a well-known saying: **«Շունը հաչում է, քարավանն անցնում է»** (shu-nə ha-chum e, k'a-ra-vann an-tsnum e) — "The dog barks, the caravan moves on." It's used the way English speakers might say "let them talk" — a reminder not to let critics or noise distract you from your own path. It's a great example of how learning animal vocabulary can unlock real cultural expressions, not just zoo flashcards.

## Using these in a sentence

A simple, reusable pattern: **Ես ունեմ [animal]** ("I have a...") — for example, **Ես ունեմ կատու** (yes u-nem ka-tu), "I have a cat." Swap in any word from the lists above and you've got a real sentence.

**Ես սիրում եմ շներին** (yes si-rum em shne-rin) — "I love dogs" — is another useful pattern, built from the verb **սիրել** ("to love") plus the animal word. It's a natural way to talk about preferences once you're past simple identification sentences.

## Animals in Armenian children's stories

Just like in English, Armenian folk tales lean heavily on animal characters — the fox as clever, the wolf as dangerous, the lion as noble. If you ever pick up an Armenian children's book to practice reading, expect **աղվես**, **գայլ**, and **առյուծ** to show up constantly as recurring characters, which makes them worth memorizing early even beyond the proverb above.

## Keep building

Animal words pair naturally with other everyday vocabulary — see our full [Armenian vocabulary](/armenian-vocabulary) page for colors, family, and food words, or work through [50 basic Armenian words every beginner should know](/blog/50-basic-armenian-words) for a broader foundation.""",
    },
    {
        "slug": "armenian-body-parts-vocabulary",
        "days_from_now": 105,
        "title": "Armenian Body Parts Vocabulary: Head to Toe",
        "meta_description": "Learn Armenian words for body parts, head to toe, with pronunciation — useful for describing symptoms, pointing things out, and everyday conversation.",
        "excerpt": "From գլուխ (head) to ոտք (foot) — every body part word you need, plus how to say something hurts.",
        "tags": ["vocabulary", "body"],
        "body": """Body part vocabulary isn't just useful for anatomy class — it's genuinely practical, especially if you ever need to describe a symptom to a doctor or just point something out. Here's the full set, organized head to toe.

## Head and face

- **գլուխ** (glukh) — head
- **դեմք** (demk') — face
- **աչք** (achk') — eye
- **ականջ** (a-kanj) — ear
- **քիթ** (k'it') — nose
- **բերան** (be-ran) — mouth
- **ատամ** (a-tam) — tooth
- **լեզու** (le-zu) — tongue

## Torso and arms

- **վիզ** (viz) — neck
- **ուս** (us) — shoulder
- **ձեռք** (dzerrk') — hand / arm
- **մատ** (mat) — finger
- **ստամոքս** (sta-moks) — stomach
- **մեջք** (mejk') — back
- **սիրտ** (sirt) — heart

## Legs and feet

- **ոտք** (votk') — foot / leg
- **ծունկ** (tsunk) — knee

## How to say something hurts

The most useful practical pattern here is **ինձ ցավում է [body part]-ը** (indz tsa-vum e...) — "my [body part] hurts," literally "to me hurts the [body part]." For example: **Ինձ ցավում է գլուխը** (indz tsa-vum e glu-khə) — "My head hurts." Swap in any word above: **ինձ ցավում է ականջը** — "my ear hurts."

## Pointing things out

**Սա իմ ձեռքն է** (sa im dzerr-k'n e) — "This is my hand" — is a simple pattern for identifying any body part directly, useful with kids, at a doctor's office, or just describing yourself.

## A note on plurals

Armenian typically forms plurals by adding **-եր** or **-ներ** to a noun. So **ձեռք** (hand) becomes **ձեռքեր** (dzerr-k'er, "hands"), and **ոտք** (foot) becomes **ոտքեր** (vot-k'er, "feet"). Since we naturally talk about many body parts in pairs — two eyes, two ears, two hands — this plural pattern comes up constantly the moment you start describing yourself in full sentences rather than single words.

## Keep building

Body vocabulary pairs well with everyday phrases — see our [Armenian vocabulary](/armenian-vocabulary) page for more categories, or check out [50 basic Armenian words every beginner should know](/blog/50-basic-armenian-words) to round out your core vocabulary before tackling more specialized word sets like this one.""",
    },
    {
        "slug": "armenian-question-words",
        "days_from_now": 112,
        "title": "Armenian Question Words: Who, What, Where, When, Why, How",
        "meta_description": "Learn the essential Armenian question words — ինչ, ով, որտեղ, երբ, ինչու, ինչպես — with pronunciation and example sentences for beginners.",
        "excerpt": "The six question words that unlock real conversation, each with a simple example sentence you can start using today.",
        "tags": ["vocabulary", "grammar", "beginner"],
        "body": """Question words are some of the highest-leverage vocabulary you can learn — a handful of words that let you ask about almost anything. Here are Armenian's six core question words, each with an example sentence.

## What — ինչ

**ինչ** (inch) — what

**Ինչ ես անում** (inch yes a-num) — "What are you doing?" This is one of the most common questions in casual conversation, and a great one to have ready early.

## Who — ով

**ով** (ov) — who

**Ով է սա** (ov e sa) — "Who is this?" Useful the moment you're introduced to someone new, or asking about a person in a photo or story.

## Where — որտեղ

**որտեղ** (vor-tegh) — where

**Որտեղ ես ապրում** (vor-tegh yes ap-rum) — "Where do you live?" One of the standard questions in any first real conversation.

## When — երբ

**երբ** (yerb) — when

**Երբ ես գալիս** (yerb yes ga-lis) — "When are you coming?" Handy for making plans or confirming a schedule.

## Why — ինչու

**ինչու** (in-chu) — why

**Ինչու ես ուշանում** (in-chu yes u-sha-num) — "Why are you late?" A word that comes up constantly once you're past basic greetings and into real exchanges.

## How — ինչպես

**ինչպես** (inch-pes) — how

**Ինչպես ես** (inch-pes yes) — "How are you?" — almost certainly the very first question-word question you'll ever ask in Armenian, and one you already know from everyday greetings.

## A note on word order

Notice that in every example above, the question word simply comes first, with the rest of the sentence following normal order — you don't need to rearrange anything else the way English sometimes does (compare "You are late" → "Why are you late?"). That makes question words one of the easiest grammar patterns to start using immediately.

## Where to go next

These six words unlock an enormous amount of real conversation on their own. For the grammar behind how Armenian sentences fit together more broadly, see [Armenian grammar basics](/blog/armenian-grammar-basics), or explore the full [Armenian vocabulary](/armenian-vocabulary) page to keep building your word bank.""",
    },
    {
        "slug": "history-of-the-armenian-alphabet",
        "days_from_now": 119,
        "title": "The Real History of the Armenian Alphabet",
        "meta_description": "The history of the Armenian alphabet — how Mesrop Mashtots created it in 405 AD, why it was invented, and why its letterforms endure 1,600 years later.",
        "excerpt": "Created by one man in a single generation, for a very specific reason — the story behind the 39 letters you're learning today.",
        "tags": ["culture", "history", "alphabet"],
        "body": """Most alphabets in the world evolved gradually, over centuries, shaped by countless anonymous hands. Armenian's did not. It has a known inventor, a known invention date, and a known reason for existing — and that story is genuinely one of the more remarkable ones in linguistic history.

## A monk, a mission, and the year 405 AD

Around 405 AD, a scholar and monk named Mesrop Mashtots created the Armenian alphabet. This wasn't a side project or a personal hobby — it was a deliberate, urgent undertaking backed by the Armenian church and royal court. Armenia had adopted Christianity as its state religion earlier, in 301 AD — making it the first nation to do so officially — but there was a problem: Armenian had no native writing system. Scripture, church services, and scholarship all had to run through Greek or Syriac, languages most ordinary Armenians didn't read.

Mashtots set out to fix that. According to tradition, he studied existing scripts, consulted with scholars, and worked to design a system that could capture every sound of spoken Armenian precisely — no borrowed, ill-fitting letters standing in for sounds they weren't built for.

## Why it mattered beyond religion

The immediate goal was practical: translate the Bible into Armenian so people could read scripture in their own language. That project succeeded almost immediately — the Armenian translation of the Bible, completed within a few decades of the alphabet's creation, is still admired today for its literary quality, sometimes called the "Queen of Translations."

But the deeper stakes were cultural and political, not just religious. Armenia sat wedged between larger, more powerful empires — Byzantine and Persian — each pulling the region toward its own language, religion, and cultural sphere. A native script gave Armenians something no neighboring empire could fully absorb or erase: a written language, and with it, an independent literary and religious tradition entirely their own. In a very real sense, the alphabet became a form of cultural self-preservation, not just a communication tool.

## Letterforms that have barely changed

Here's the part that genuinely surprises people: the 39 letters used in Armenian today are, in their essential shapes, remarkably close to what Mashtots designed over 1,600 years ago. Compare that to Latin script, which has been through the wringer — printing-press standardization, the addition and dropping of letters, wildly different national conventions. Armenian's core alphabet has stayed largely intact the entire time.

Part of the reason is that it worked so well from the start. Mashtots built the alphabet to map cleanly onto Armenian's actual sounds — nearly one letter per sound, phonetic and consistent — so there was little pressure to "fix" it later the way irregular systems get patched over centuries. When a system already fits the language it was built for, there's simply less reason to change it.

## What this means for you as a learner

When you sit down to learn the [Armenian alphabet](/armenian-alphabet) today, you're not learning a modern simplification or a reconstruction — you're learning essentially the same 39 symbols an Armenian reader in the 5th century would recognize. Few living languages can say that about their writing system. It's also worth pairing this history with a look at [Eastern vs. Western Armenian](/blog/eastern-vs-western-armenian) — proof that even though the spoken language split into two modern standards over the centuries, the alphabet itself never did.

## A legacy worth appreciating

Every time you write or read an Armenian letter, you're using a system built, on purpose, by one person, for a very specific reason — to make sure a language and a culture survived on its own terms. That's a nice thing to carry with you the next time flashcards feel tedious.""",
    },
    {
        "slug": "armenian-past-tense-verbs",
        "days_from_now": 126,
        "title": "Armenian Past Tense Verbs: A Beginner's Guide",
        "meta_description": "Learn how Armenian forms the past tense with a clear beginner's guide to conjugating գնալ (to go) and անել (to do), with example sentences.",
        "excerpt": "Once you know the present tense, the past tense pattern for common Armenian verbs is easier than it looks — here's how it works.",
        "tags": ["grammar", "verbs"],
        "body": """If you've already got a handle on the [present tense](/blog/armenian-verb-conjugation-present-tense), the past tense is a natural next step — and Armenian's simple past (called the aorist) is refreshingly compact once you see the pattern.

## The verb that means "to go": գնալ

**գնալ** (gə-nal) — to go — conjugates in the past tense like this:

- **ես գնացի** (yes gna-tsi) — I went
- **դու գնացիր** (du gna-tsir) — you went (informal)
- **նա գնաց** (na gnats) — he/she went
- **մենք գնացինք** (menk' gna-tsink') — we went
- **դուք գնացիք** (duk' gna-tsik') — you went (formal/plural)
- **նրանք գնացին** (nrank' gna-tsin) — they went

Notice the shared root **գնաց-** across every form, with a different ending attached for each person — a much shorter set of endings than you might expect after learning the present tense's two-part structure.

## Trying it in a sentence

**Ես գնացի դպրոց** (yes gna-tsi dpr-ots) — "I went to school." Simple, direct, and built entirely from the pattern above plus one noun.

## The verb that means "to do": անել

**անել** (a-nel) — to do — is a genuinely irregular verb in the past tense, so it's worth learning as its own pattern rather than assuming it follows **գնալ**'s template:

- **ես արեցի** (yes a-re-tsi) — I did
- **դու արեցիր** (du a-re-tsir) — you did (informal)
- **նա արեց** (na a-rets) — he/she did
- **մենք արեցինք** (menk' a-re-tsink') — we did
- **դուք արեցիք** (duk' a-re-tsik') — you did (formal/plural)
- **նրանք արեցին** (nrank' a-re-tsin) — they did

You'll hear **ի՞նչ արեցիր** (inch a-re-tsir) — "what did you do?" constantly in casual conversation, so it's worth memorizing this one even before the pattern fully clicks.

## What to notice across both verbs

Even though **անել** doesn't share **գնալ**'s root, the *endings* attached to each person are strikingly similar — **-ի, -իր, [nothing added], -ինք, -իք, -ին**. That consistency is the real payoff: once you've internalized this ending set on two verbs, recognizing it on new verbs gets noticeably faster, the same way the present tense's "to be" endings repeat across every verb you learned in that pattern.

## Building from here

Past tense combines naturally with time words like **երեկ** (ye-rek, "yesterday") from [50 basic Armenian words](/blog/50-basic-armenian-words) — try building your own sentence: **Ես երեկ գնացի աշխատանքի** ("I went to work yesterday"). For the fuller grammar picture — word order, cases, and how tense fits together — see [Armenian grammar basics](/blog/armenian-grammar-basics), or keep practicing with real audio at [Haylingua's course](/learn-armenian-online).""",
    },
]
