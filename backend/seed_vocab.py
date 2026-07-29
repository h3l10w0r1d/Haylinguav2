# backend/seed_vocab.py
"""
A2 vocabulary at scale. A verified base-word bank across ~18 everyday domains,
expanded by a generator into several morphologically-safe exercise types per
word — match, translate (both directions), listen-and-type, listen/pick-image,
and true/false. Base words carry no inflection risk, so the volume stays correct.

Every kind used is in the CMS bulk-import allow-list, so this can be authored
live via the API. Module import has no DB side effects. Tagged cefr="A2".
One chapter per domain (positions 70+). Idempotent (skips if 'voc-animals-1'
exists). Triggered via POST /cms/seed/vocab.
"""

import json
import random
from sqlalchemy import text

_CEFR = "A2"
_XP = {"match_pairs": 12, "translate_mcq": 8, "listen_type": 10,
       "image_select": 8, "true_false": 6}

# (Armenian, English, emoji-or-None). Standard Eastern Armenian, hand-checked.
VOCAB = {
    "Animals": [
        ("կատու", "cat", "🐱"), ("շուն", "dog", "🐶"), ("ձուկ", "fish", "🐟"),
        ("թռչուն", "bird", "🐦"), ("ձի", "horse", "🐴"), ("կով", "cow", "🐮"),
        ("ոչխար", "sheep", "🐑"), ("խոզ", "pig", "🐷"), ("հավ", "hen", "🐔"),
        ("նապաստակ", "rabbit", "🐰"), ("առյուծ", "lion", "🦁"), ("արջ", "bear", "🐻"),
        ("գայլ", "wolf", "🐺"), ("աղվես", "fox", "🦊"), ("փիղ", "elephant", "🐘"),
        ("կապիկ", "monkey", "🐵"), ("օձ", "snake", "🐍"), ("մուկ", "mouse", "🐭"),
        ("ճագար", "hare", None), ("ագռավ", "crow", None),
    ],
    "Food": [
        ("հաց", "bread", "🍞"), ("ջուր", "water", "💧"), ("կաթ", "milk", "🥛"),
        ("պանիր", "cheese", "🧀"), ("միս", "meat", "🍖"), ("ձու", "egg", "🥚"),
        ("խնձոր", "apple", "🍎"), ("նարինջ", "orange", "🍊"), ("բանան", "banana", "🍌"),
        ("լոլիկ", "tomato", "🍅"), ("կարտոֆիլ", "potato", "🥔"), ("բրինձ", "rice", "🍚"),
        ("շաքար", "sugar", None), ("աղ", "salt", "🧂"), ("սուրճ", "coffee", "☕"),
        ("թեյ", "tea", "🍵"), ("գինի", "wine", "🍷"), ("ապուր", "soup", "🍲"),
        ("կարագ", "butter", "🧈"), ("մեղր", "honey", "🍯"),
    ],
    "Body": [
        ("գլուխ", "head", "🧠"), ("աչք", "eye", "👁️"), ("քիթ", "nose", "👃"),
        ("բերան", "mouth", "👄"), ("ականջ", "ear", "👂"), ("ձեռք", "hand", "✋"),
        ("ոտք", "foot", "🦶"), ("մազ", "hair", None), ("ատամ", "tooth", "🦷"),
        ("սիրտ", "heart", "❤️"), ("փոր", "stomach", None), ("մատ", "finger", None),
        ("դեմք", "face", None), ("լեզու", "tongue", "👅"),
    ],
    "Colors": [
        ("կարմիր", "red", "🔴"), ("կապույտ", "blue", "🔵"), ("դեղին", "yellow", "🟡"),
        ("կանաչ", "green", "🟢"), ("սև", "black", "⚫"), ("սպիտակ", "white", "⚪"),
        ("նարնջագույն", "orange", "🟠"), ("մանուշակագույն", "purple", "🟣"),
        ("շագանակագույն", "brown", "🟤"), ("վարդագույն", "pink", None),
        ("մոխրագույն", "gray", None),
    ],
    "Family": [
        ("մայր", "mother", "👩"), ("հայր", "father", "👨"), ("քույր", "sister", None),
        ("եղբայր", "brother", None), ("որդի", "son", "👦"), ("դուստր", "daughter", "👧"),
        ("տատիկ", "grandmother", "👵"), ("պապիկ", "grandfather", "👴"),
        ("ընտանիք", "family", "👨‍👩‍👧"), ("երեխա", "child", "🧒"),
        ("ամուսին", "husband", None), ("կին", "woman", "👩"), ("տղամարդ", "man", "👨"),
    ],
    "House": [
        ("տուն", "house", "🏠"), ("դուռ", "door", "🚪"), ("պատուհան", "window", "🪟"),
        ("սեղան", "table", None), ("աթոռ", "chair", "🪑"), ("մահճակալ", "bed", "🛏️"),
        ("խոհանոց", "kitchen", None), ("սենյակ", "room", None), ("լոգարան", "bathroom", "🛁"),
        ("պատ", "wall", None), ("հատակ", "floor", None), ("բանալի", "key", "🔑"),
        ("ժամացույց", "clock", "🕐"), ("լամպ", "lamp", "💡"),
    ],
    "Nature": [
        ("արև", "sun", "☀️"), ("լուսին", "moon", "🌙"), ("աստղ", "star", "⭐"),
        ("երկինք", "sky", None), ("ծով", "sea", "🌊"), ("լեռ", "mountain", "⛰️"),
        ("գետ", "river", None), ("ծառ", "tree", "🌳"), ("ծաղիկ", "flower", "🌸"),
        ("անտառ", "forest", "🌲"), ("քար", "stone", "🪨"), ("կրակ", "fire", "🔥"),
        ("ամպ", "cloud", "☁️"), ("ձյուն", "snow", "❄️"), ("անձրև", "rain", "🌧️"),
        ("քամի", "wind", "💨"),
    ],
    "Clothing": [
        ("շապիկ", "shirt", "👕"), ("տաբատ", "trousers", "👖"), ("զգեստ", "dress", "👗"),
        ("կոշիկ", "shoes", "👟"), ("գլխարկ", "hat", "🧢"), ("բաճկոն", "jacket", "🧥"),
        ("գուլպա", "sock", "🧦"), ("շարֆ", "scarf", "🧣"), ("ձեռնոց", "glove", "🧤"),
        ("վերարկու", "coat", "🧥"),
    ],
    "City": [
        ("քաղաք", "city", "🏙️"), ("փողոց", "street", None), ("խանութ", "shop", "🏪"),
        ("դպրոց", "school", "🏫"), ("հիվանդանոց", "hospital", "🏥"), ("գրադարան", "library", None),
        ("ռեստորան", "restaurant", None), ("բանկ", "bank", "🏦"), ("այգի", "park", "🏞️"),
        ("եկեղեցի", "church", "⛪"), ("կայարան", "station", "🚉"), ("շուկա", "market", None),
        ("կամուրջ", "bridge", "🌉"), ("հյուրանոց", "hotel", "🏨"),
    ],
    "Jobs": [
        ("ուսուցիչ", "teacher", "👩‍🏫"), ("բժիշկ", "doctor", "👨‍⚕️"), ("ուսանող", "student", None),
        ("ոստիկան", "police officer", "👮"), ("հրշեջ", "firefighter", "🧑‍🚒"),
        ("խոհարար", "cook", "👨‍🍳"), ("վարորդ", "driver", None), ("երգիչ", "singer", "🎤"),
        ("նկարիչ", "artist", "🎨"), ("գրող", "writer", None), ("մատուցող", "waiter", None),
        ("ֆերմեր", "farmer", "🧑‍🌾"),
    ],
    "Transport": [
        ("ավտոբուս", "bus", "🚌"), ("մեքենա", "car", "🚗"), ("գնացք", "train", "🚆"),
        ("ինքնաթիռ", "airplane", "✈️"), ("հեծանիվ", "bicycle", "🚲"), ("նավ", "ship", "🚢"),
        ("տաքսի", "taxi", "🚕"), ("մոտոցիկլ", "motorcycle", "🏍️"),
    ],
    "School": [
        ("գիրք", "book", "📖"), ("գրիչ", "pen", "🖊️"), ("մատիտ", "pencil", "✏️"),
        ("տետր", "notebook", "📓"), ("դասարան", "classroom", None), ("դաս", "lesson", None),
        ("թուղթ", "paper", "📄"), ("պայուսակ", "bag", "🎒"), ("քարտեզ", "map", "🗺️"),
        ("համակարգիչ", "computer", "💻"),
    ],
    "Fruit & Veg": [
        ("տանձ", "pear", "🍐"), ("խաղող", "grapes", "🍇"), ("ելակ", "strawberry", "🍓"),
        ("ձմերուկ", "watermelon", "🍉"), ("կիտրոն", "lemon", "🍋"), ("դեղձ", "peach", "🍑"),
        ("բալ", "cherry", "🍒"), ("վարունգ", "cucumber", "🥒"), ("գազար", "carrot", "🥕"),
        ("սոխ", "onion", "🧅"), ("սունկ", "mushroom", "🍄"), ("եգիպտացորեն", "corn", "🌽"),
    ],
    "Verbs": [
        ("գնալ", "to go", None), ("գալ", "to come", None), ("ուտել", "to eat", None),
        ("խմել", "to drink", None), ("խոսել", "to speak", None), ("կարդալ", "to read", None),
        ("գրել", "to write", None), ("տեսնել", "to see", None), ("լսել", "to hear", None),
        ("ասել", "to say", None), ("սիրել", "to love", None), ("ուզել", "to want", None),
        ("աշխատել", "to work", None), ("սովորել", "to learn", None), ("խաղալ", "to play", None),
        ("վազել", "to run", None), ("քայլել", "to walk", None), ("քնել", "to sleep", None),
        ("երգել", "to sing", None), ("պարել", "to dance", None), ("գնել", "to buy", None),
        ("բացել", "to open", None), ("փակել", "to close", None), ("տալ", "to give", None),
    ],
    "Adjectives": [
        ("մեծ", "big", None), ("փոքր", "small", None), ("լավ", "good", None),
        ("վատ", "bad", None), ("նոր", "new", None), ("հին", "old", None),
        ("գեղեցիկ", "beautiful", None), ("երկար", "long", None), ("կարճ", "short", None),
        ("բարձր", "tall", None), ("արագ", "fast", None), ("դանդաղ", "slow", None),
        ("տաք", "hot", None), ("սառը", "cold", None), ("հեշտ", "easy", None),
        ("դժվար", "difficult", None), ("մաքուր", "clean", None), ("կեղտոտ", "dirty", None),
    ],
    "Time": [
        ("օր", "day", None), ("շաբաթ", "week", None), ("ամիս", "month", "📅"),
        ("տարի", "year", None), ("ժամ", "hour", "⏰"), ("րոպե", "minute", None),
        ("այսօր", "today", None), ("վաղը", "tomorrow", None), ("երեկ", "yesterday", None),
        ("հիմա", "now", None), ("առավոտ", "morning", None), ("գիշեր", "night", "🌙"),
    ],
    "Drinks & Kitchen": [
        ("բաժակ", "cup", "🥤"), ("պնակ", "plate", "🍽️"), ("դանակ", "knife", "🔪"),
        ("գդալ", "spoon", "🥄"), ("պատառաքաղ", "fork", "🍴"), ("շիշ", "bottle", "🍾"),
        ("հյութ", "juice", "🧃"), ("սառնարան", "fridge", None), ("վառարան", "stove", None),
        ("թխվածք", "cookie", "🍪"),
    ],
    "Sports": [
        ("ֆուտբոլ", "football", "⚽"), ("բասկետբոլ", "basketball", "🏀"), ("թենիս", "tennis", "🎾"),
        ("լող", "swimming", "🏊"), ("վազք", "running", "🏃"), ("շախմատ", "chess", "♟️"),
        ("դահուկ", "skiing", "⛷️"), ("գնդակ", "ball", "⚽"), ("հեծանվավազք", "cycling", "🚴"),
        ("բռնցքամարտ", "boxing", "🥊"),
    ],
    "Music": [
        ("երգ", "song", "🎵"), ("դաշնամուր", "piano", "🎹"), ("կիթառ", "guitar", "🎸"),
        ("ջութակ", "violin", "🎻"), ("թմբուկ", "drum", "🥁"), ("շեփոր", "trumpet", "🎺"),
        ("նվագել", "to play (music)", None), ("պար", "dance", "💃"),
    ],
    "Technology": [
        ("հեռախոս", "phone", "📱"), ("ինտերնետ", "internet", "🌐"), ("հեռուստացույց", "television", "📺"),
        ("ռադիո", "radio", "📻"), ("տեսախցիկ", "camera", "📷"), ("լիցքավորիչ", "charger", "🔌"),
        ("ստեղնաշար", "keyboard", "⌨️"), ("էկրան", "screen", None), ("նամակ", "email/letter", "✉️"),
        ("ֆայլ", "file", "📁"),
    ],
    "Sea Animals": [
        ("կետ", "whale", "🐋"), ("դելֆին", "dolphin", "🐬"), ("շնաձուկ", "shark", "🦈"),
        ("ութոտնուկ", "octopus", "🐙"), ("խեցգետին", "crab", "🦀"), ("կրիա", "turtle", "🐢"),
        ("գորտ", "frog", "🐸"), ("խխունջ", "snail", "🐌"),
    ],
    "Insects": [
        ("մեղու", "bee", "🐝"), ("թիթեռ", "butterfly", "🦋"), ("մրջյուն", "ant", "🐜"),
        ("ճանճ", "fly", "🪰"), ("մոծակ", "mosquito", "🦟"), ("սարդ", "spider", "🕷️"),
    ],
    "Feelings": [
        ("վախ", "fear", "😨"), ("զայրույթ", "anger", "😠"), ("ուրախություն", "joy", "😄"),
        ("սեր", "love", "❤️"), ("տխրություն", "sadness", "😢"), ("զարմանք", "surprise", "😮"),
    ],
    "Directions": [
        ("վերև", "up", "⬆️"), ("ներքև", "down", "⬇️"), ("ձախ", "left", "⬅️"),
        ("աջ", "right", "➡️"), ("առաջ", "forward", None), ("հետ", "back", None),
        ("մոտ", "near", None), ("հեռու", "far", None),
    ],
    "Question Words": [
        ("ով", "who", None), ("ինչ", "what", None), ("որտեղ", "where", None),
        ("երբ", "when", None), ("ինչու", "why", None), ("ինչպես", "how", None),
        ("որքան", "how much", None), ("որ", "which", None),
    ],
    "Everyday Objects": [
        ("խաղալիք", "toy", "🧸"), ("նկար", "picture", "🖼️"), ("հայելի", "mirror", "🪞"),
        ("թերթ", "newspaper", "📰"), ("գումար", "money", "💰"), ("նվեր", "gift", "🎁"),
        ("տոմս", "ticket", "🎫"), ("հովանոց", "umbrella", "☂️"), ("ակնոց", "glasses", "👓"),
        ("ժամացույց", "watch", "⌚"),
    ],
    "Places in Nature": [
        ("լիճ", "lake", None), ("կղզի", "island", "🏝️"), ("անապատ", "desert", "🏜️"),
        ("դաշտ", "field", None), ("ափ", "beach", "🏖️"), ("ջրվեժ", "waterfall", None),
        ("քարանձավ", "cave", None), ("բլուր", "hill", None),
    ],
    "Materials": [
        ("ոսկի", "gold", None), ("արծաթ", "silver", None), ("փայտ", "wood", None),
        ("ապակի", "glass", None), ("մետաղ", "metal", None), ("թուղթ", "paper", None),
        ("քար", "stone", "🪨"), ("կաշի", "leather", None),
    ],
    "Weather Extra": [
        ("ամպրոպ", "thunderstorm", "⛈️"), ("ծիածան", "rainbow", "🌈"), ("մառախուղ", "fog", "🌫️"),
        ("սառույց", "ice", "🧊"), ("ջերմություն", "heat", "🔥"), ("ցուրտ", "cold", "🥶"),
    ],
    "Tools": [
        ("մուրճ", "hammer", "🔨"), ("սղոց", "saw", "🪚"), ("պտուտակ", "screw", "🔩"),
        ("գործիք", "tool", "🛠️"), ("մեխ", "nail", None), ("սանդուղք", "ladder", "🪜"),
        ("վրձին", "brush", "🖌️"), ("մկրատ", "scissors", "✂️"),
    ],
    "Office": [
        ("գրասենյակ", "office", "🏢"), ("հանդիպում", "meeting", None), ("փաստաթուղթ", "document", "📃"),
        ("ստորագրություն", "signature", "✍️"), ("աշխատակից", "colleague", None), ("ղեկավար", "boss", None),
        ("աշխատանք", "work / job", "💼"), ("ժամանակացույց", "schedule", "📆"),
    ],
    "Birds": [
        ("արծիվ", "eagle", "🦅"), ("բու", "owl", "🦉"), ("աղավնի", "dove", "🕊️"),
        ("բադ", "duck", "🦆"), ("սագ", "goose", "🪿"), ("ճնճղուկ", "sparrow", None),
        ("սիրամարգ", "peacock", "🦚"), ("թութակ", "parrot", "🦜"),
    ],
    "Garden": [
        ("այգի", "garden", None), ("խոտ", "grass", "🌿"), ("տերև", "leaf", "🍃"),
        ("արմատ", "root", None), ("սերմ", "seed", "🌱"), ("ճյուղ", "branch", None),
        ("պտուղ", "fruit", "🍏"), ("փուշ", "thorn", None),
    ],
    "Bathroom": [
        ("օճառ", "soap", "🧼"), ("սրբիչ", "towel", None), ("սանր", "comb", None),
        ("շամպուն", "shampoo", None), ("ատամի խոզանակ", "toothbrush", "🪥"), ("հայելի", "mirror", "🪞"),
        ("ջրծորակ", "tap", "🚰"), ("ցնցուղ", "shower", "🚿"),
    ],
    "Body Extra": [
        ("ծունկ", "knee", "🦵"), ("արմունկ", "elbow", None), ("ուս", "shoulder", None),
        ("մեջք", "back", None), ("կուրծք", "chest", None), ("եղունգ", "nail", "💅"),
        ("այտ", "cheek", None), ("ճակատ", "forehead", None),
    ],
    "Food Extra": [
        ("շոկոլադ", "chocolate", "🍫"), ("պաղպաղակ", "ice cream", "🍦"), ("կարկանդակ", "cake", "🍰"),
        ("երշիկ", "sausage", "🌭"), ("ձիթապտուղ", "olive", "🫒"), ("ընկույզ", "walnut", None),
        ("ձմերուկ", "watermelon", "🍉"), ("պիցցա", "pizza", "🍕"), ("համբուրգեր", "burger", "🍔"),
        ("ջեմ", "jam", None),
    ],
    "Cooking Verbs": [
        ("եփել", "to cook", None), ("տապակել", "to fry", None), ("կտրել", "to cut", None),
        ("խառնել", "to mix", None), ("լվանալ", "to wash", None), ("մաքրել", "to clean", None),
        ("չափել", "to measure", None), ("լցնել", "to pour", None),
    ],
    "Adverbs": [
        ("շատ", "very", None), ("քիչ", "little", None), ("միշտ", "always", None),
        ("երբեք", "never", None), ("հաճախ", "often", None), ("երբեմն", "sometimes", None),
        ("այստեղ", "here", None), ("այնտեղ", "there", None),
    ],
    "Abstract": [
        ("ժամանակ", "time", "⏳"), ("կյանք", "life", None), ("աշխարհ", "world", "🌍"),
        ("պատմություն", "story", "📜"), ("ճշմարտություն", "truth", None), ("խնդիր", "problem", None),
        ("գաղափար", "idea", "💡"), ("երազ", "dream", "💭"), ("անուն", "name", None),
        ("լեզու", "language", "🗣️"),
    ],
    "More Verbs": [
        ("հասկանալ", "to understand", None), ("մտածել", "to think", None), ("հիշել", "to remember", None),
        ("մոռանալ", "to forget", None), ("սպասել", "to wait", None), ("օգնել", "to help", None),
        ("փնտրել", "to look for", None), ("գտնել", "to find", None), ("բերել", "to bring", None),
        ("սկսել", "to start", None), ("ավարտել", "to finish", None), ("բացատրել", "to explain", None),
        ("հարցնել", "to ask", None), ("պատասխանել", "to answer", None),
    ],
    "Numbers 11–20": [
        ("տասնմեկ", "eleven", None), ("տասներկու", "twelve", None), ("տասներեք", "thirteen", None),
        ("տասնչորս", "fourteen", None), ("տասնհինգ", "fifteen", None), ("տասնվեց", "sixteen", None),
        ("տասնյոթ", "seventeen", None), ("տասնութ", "eighteen", None), ("տասնինը", "nineteen", None),
        ("քսան", "twenty", None),
    ],
    "Shapes": [
        ("շրջան", "circle", "⭕"), ("քառակուսի", "square", "🟦"), ("եռանկյունի", "triangle", "🔺"),
        ("ուղղանկյուն", "rectangle", None), ("գիծ", "line", "➖"), ("կետ", "point", None),
    ],
}

_DOMAIN_ORDER = list(VOCAB.keys())


def _mk(kind, prompt, config):
    return {"kind": kind, "prompt": prompt, "config": config, "xp": _XP[kind]}


def build_lessons():
    """Deterministically expand VOCAB into (chapter, position, slug, title,
    exercises) tuples — several exercise types per word, grouped into lessons of
    ~5 words each. Reproducible: a fixed RNG seed keeps distractor order stable."""
    rng = random.Random(1453)
    lessons = []
    pos = 70
    for domain in _DOMAIN_ORDER:
        words = VOCAB[domain]
        emoji_words = [w for w in words if w[2]]
        slug_base = "voc-" + domain.lower().replace(" & ", "-").replace(" ", "-")
        # chunk into groups of 5 words -> one lesson per chunk; fold a tiny
        # trailing chunk (<3 words) into the previous one so no lesson is thin.
        chunks = [words[i:i + 5] for i in range(0, len(words), 5)]
        if len(chunks) > 1 and len(chunks[-1]) < 3:
            chunks[-2] = chunks[-2] + chunks[-1]
            chunks.pop()
        for ci, chunk in enumerate(chunks, start=1):
            exs = []
            # 1) match_pairs over the chunk (up to 4)
            grp = chunk[:4]
            if len(grp) >= 3:
                exs.append(_mk("match_pairs", "Match each word to its meaning.",
                               {"pairs": [{"left": hy, "right": en} for hy, en, _ in grp]}))
            # 2) translate EN->AR for each word
            for hy, en, _emoji in chunk:
                pool = [w for w in words if w[0] != hy]
                distract = rng.sample(pool, min(3, len(pool)))
                opts = [hy] + [d[0] for d in distract]
                rng.shuffle(opts)
                exs.append(_mk("translate_mcq", f"How do you say “{en}”?",
                               {"choices": opts, "sentence": en, "answerIndex": opts.index(hy)}))
            # 3) translate AR->EN for each word
            for hy, en, _emoji in chunk:
                pool = [w for w in words if w[1] != en]
                distract = rng.sample(pool, min(3, len(pool)))
                opts = [en] + [d[1] for d in distract]
                rng.shuffle(opts)
                exs.append(_mk("translate_mcq", f"What does “{hy}” mean?",
                               {"choices": opts, "sentence": "", "answerIndex": opts.index(en)}))
            # 4) listen-and-type for every word in the chunk
            for hy, en, _emoji in chunk:
                exs.append(_mk("listen_type", "Type what you hear",
                               {"ttsText": hy, "acceptedAnswers": [hy]}))
            # 5) image_select for every emoji word in the chunk
            chunk_emoji = [w for w in chunk if w[2]]
            for hy, en, emoji in chunk_emoji:
                pool = [w for w in emoji_words if w[0] != hy]
                distract = rng.sample(pool, min(3, len(pool))) if len(pool) >= 3 else pool
                items = [(emoji, en)] + [(d[2], d[1]) for d in distract]
                rng.shuffle(items)
                ans = next(i for i, it in enumerate(items) if it[1] == en)
                exs.append(_mk("image_select", f"Tap the “{en}”.",
                               {"choices": [{"emoji": e, "label": l} for e, l in items], "answerIndex": ans}))
            # 6) two true/false — one true, one false, on different words
            hy0, en0, _ = chunk[0]
            exs.append(_mk("true_false", "True or False?",
                           {"correct": True, "statement": f"«{hy0}» means “{en0}.”"}))
            hy1, en1, _ = chunk[1 % len(chunk)]
            if len(words) > 1:
                wrong = rng.choice([w for w in words if w[1] != en1])[1]
                exs.append(_mk("true_false", "True or False?",
                               {"correct": False, "statement": f"«{hy1}» means “{wrong}.”"}))

            title = f"{domain}" + (f" · {ci}" if len(chunks) > 1 else "")
            lessons.append((f"A2 · Vocabulary: {domain}", pos, f"{slug_base}-{ci}", title, exs))
        pos += 1
    return lessons


def seed_vocab():
    from database import engine
    lessons = build_lessons()
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM lessons WHERE slug = 'voc-animals-1'")).first()
        if exists:
            return {"ok": True, "skipped": True, "reason": "voc-animals-1 already exists"}

        chapter_ids = {}
        max_level = conn.execute(text("SELECT COALESCE(MAX(level), 0) FROM lessons")).scalar()
        cl = ce = 0
        cfg = json.dumps({"cefr": _CEFR})
        for chapter_title, position, slug, title, exercises in lessons:
            if chapter_title not in chapter_ids:
                cid = conn.execute(text("SELECT id FROM chapters WHERE title = :t"), {"t": chapter_title}).scalar()
                if not cid:
                    cid = conn.execute(
                        text("""INSERT INTO chapters (title, position, is_published) VALUES (:t,:p,TRUE) RETURNING id"""),
                        {"t": chapter_title, "p": position}).scalar()
                chapter_ids[chapter_title] = cid
            max_level += 1
            lesson_xp = sum(e["xp"] for e in exercises)
            lid = conn.execute(
                text("""INSERT INTO lessons (slug,title,level,xp,xp_reward,is_published,chapter_id,lesson_type,config)
                        VALUES (:s,:t,:l,:xp,:xp,TRUE,:c,'standard',CAST(:cfg AS jsonb)) RETURNING id"""),
                {"s": slug, "t": title, "l": max_level, "xp": lesson_xp, "c": chapter_ids[chapter_title], "cfg": cfg}).scalar()
            cl += 1
            for i, e in enumerate(exercises, start=1):
                conn.execute(
                    text("""INSERT INTO exercises (lesson_id,kind,prompt,"order",xp,config)
                            VALUES (:l,:k,:p,:o,:xp,CAST(:cfg AS jsonb))"""),
                    {"l": lid, "k": e["kind"], "p": e["prompt"], "o": i, "xp": e["xp"], "cfg": json.dumps(e["config"])})
                ce += 1
        return {"ok": True, "cefr": _CEFR, "chapters": len(chapter_ids), "lessons": cl, "exercises": ce}
