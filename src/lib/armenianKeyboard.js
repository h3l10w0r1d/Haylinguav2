// src/lib/armenianKeyboard.js — the Armenian PHONETIC keyboard layout, the
// touch-typing finger map, and the ten-finger lesson curriculum built on top.
//
// WHY PHONETIC: this is the layout Armen uses (confirmed from his macOS
// keyboard viewer), and it's the right one for a diaspora audience — the
// home row maps almost letter-for-letter onto QWERTY (a→ա s→ս d→դ f→ֆ
// g→գ h→հ j→յ k→կ l→լ), so anyone who already touch-types Latin is halfway
// there. It is NOT the OS-standard "Armenian — Eastern" layout; if we ever
// want to teach that too, add a second LAYOUT object and let the lesson
// screen switch between them.
//
// ⚠️ CONFIDENCE, AND WHY THE LESSON ORDER MATTERS ⚠️
// The home and bottom rows were read cleanly off the keyboard viewer and are
// trusted. Several number-row and top-row glyphs are visually near-identical
// at screenshot resolution (ձ/ծ, ո/ռ, ը/ւ, ի/հ) and are marked `unsure`
// below. Teaching a wrong key position would train muscle memory that
// transfers to nothing, so the curriculum deliberately introduces the
// trusted rows first and quarantines every unsure key in the final lesson.
// To correct one: fix the character here, drop its `unsure` flag, done —
// nothing else in the app hard-codes these.

// Each entry: [qwerty key, armenian character, unsure?]
export const LAYOUT = {
  number: [
    ["1", "է"], ["2", "թ"], ["3", "փ"], ["4", "ձ", true], ["5", "ջ"],
    ["6", "ւ", true], ["7", "ն", true], ["8", "ր"], ["9", "չ"], ["0", "ճ"],
  ],
  top: [
    ["q", "ք"], ["w", "ո"], ["e", "ե"], ["r", "ռ"], ["t", "տ"],
    ["y", "ը", true], ["u", "լ", true], ["i", "ի", true], ["o", "օ"], ["p", "պ"],
  ],
  home: [
    ["a", "ա"], ["s", "ս"], ["d", "դ"], ["f", "ֆ"], ["g", "գ"],
    ["h", "հ"], ["j", "յ"], ["k", "կ"], ["l", "լ"],
  ],
  bottom: [
    ["z", "զ"], ["x", "ղ"], ["c", "ց"], ["v", "վ"], ["b", "բ"],
    ["n", "ն"], ["m", "մ"],
  ],
};

export const ROW_ORDER = ["number", "top", "home", "bottom"];

// Finger zones are a property of the PHYSICAL keyboard, not of which
// alphabet is printed on it — so this map is the standard touch-typing
// assignment and stays correct regardless of any layout question above.
const FINGER_BY_KEY = {
  "1": "lPinky", q: "lPinky", a: "lPinky", z: "lPinky",
  "2": "lRing", w: "lRing", s: "lRing", x: "lRing",
  "3": "lMiddle", e: "lMiddle", d: "lMiddle", c: "lMiddle",
  "4": "lIndex", r: "lIndex", f: "lIndex", v: "lIndex",
  "5": "lIndex", t: "lIndex", g: "lIndex", b: "lIndex",
  "6": "rIndex", y: "rIndex", h: "rIndex", n: "rIndex",
  "7": "rIndex", u: "rIndex", j: "rIndex", m: "rIndex",
  "8": "rMiddle", i: "rMiddle", k: "rMiddle",
  "9": "rRing", o: "rRing", l: "rRing",
  "0": "rPinky", p: "rPinky",
};

export const FINGERS = {
  lPinky: { label: "Left pinky", hue: 350 },
  lRing: { label: "Left ring", hue: 25 },
  lMiddle: { label: "Left middle", hue: 45 },
  lIndex: { label: "Left index", hue: 145 },
  rIndex: { label: "Right index", hue: 190 },
  rMiddle: { label: "Right middle", hue: 225 },
  rRing: { label: "Right ring", hue: 265 },
  rPinky: { label: "Right pinky", hue: 315 },
};

// armenian char → { key, finger, unsure }
export const CHAR_INFO = (() => {
  const out = {};
  for (const row of ROW_ORDER) {
    for (const [key, ch, unsure] of LAYOUT[row]) {
      out[ch] = { key, row, finger: FINGER_BY_KEY[key], unsure: !!unsure };
      // Capitals are typed with shift but sit on the same physical key.
      const upper = ch.toUpperCase();
      if (upper !== ch) out[upper] = out[ch];
    }
  }
  return out;
})();

export function fingerForChar(ch) {
  return CHAR_INFO[ch]?.finger || null;
}

// ── Curriculum ────────────────────────────────────────────────────────────
// Ordered the way every touch-typing course is: start on the home row under
// the resting fingers, add one pair of keys at a time, and only reach off
// the home row once the anchors are automatic. Drills are letter patterns
// before they are words — with nine letters you cannot yet write Armenian,
// and pretending otherwise would mean drilling nonsense "words".
//
// `accuracyGate` is the accuracy needed to consider a lesson passed.
export const LESSONS = [
  {
    id: 1,
    name: "Home keys: ֆ յ",
    teach: "Rest your index fingers on ֆ (f) and յ (j). These two keys have a raised bump — they're how your hands find the keyboard without looking.",
    keys: ["ֆ", "յ"],
    drills: ["ֆֆֆ յյյ ֆֆֆ յյյ", "ֆյ ֆյ յֆ յֆ ֆյֆ", "ֆյյ յֆֆ ֆյֆ յֆյ"],
    accuracyGate: 90,
  },
  {
    id: 2,
    name: "Add դ կ",
    teach: "Middle fingers now: դ (d) and կ (k). Keep your index fingers touching ֆ and յ the whole time — never let the hand drift.",
    keys: ["ֆ", "յ", "դ", "կ"],
    drills: ["դդդ կկկ դկ կդ", "ֆդ յկ դֆ կյ", "դկֆ կդյ ֆյդ կֆդ"],
    accuracyGate: 90,
  },
  {
    id: 3,
    name: "Add ս լ",
    teach: "Ring fingers: ս (s) and լ (l). These are weaker fingers — go slower and keep the movement small.",
    keys: ["ֆ", "յ", "դ", "կ", "ս", "լ"],
    drills: ["սսս լլլ սլ լս", "սդ լկ դս կլ", "սլֆ լսյ դկս լֆյ"],
    accuracyGate: 90,
  },
  {
    id: 4,
    name: "Add ա — the full home row",
    teach: "Left pinky reaches ա (a), and your index fingers stretch inward for գ (g) and հ (h). That completes the home row.",
    keys: ["ա", "ս", "դ", "ֆ", "գ", "հ", "յ", "կ", "լ"],
    drills: ["աաա գգգ հհհ", "ագ հա գահ հագ", "ասդ ֆգհ յկլ", "ալ կա սագ դահ"],
    accuracyGate: 90,
  },
  {
    id: 5,
    name: "Home row words",
    teach: "Real Armenian now — every one of these words uses only home-row keys. If a word feels slow, slow down further: accuracy first, speed follows.",
    keys: ["ա", "ս", "դ", "ֆ", "գ", "հ", "յ", "կ", "լ"],
    drills: ["գահ հաս կաս լաս", "աղ սագ դագ հագ", "կալ սալ հալ գալ", "ասա կակա լալա"],
    accuracyGate: 92,
  },
  {
    id: 6,
    name: "Bottom row: զ ղ ց վ բ ն մ",
    teach: "Reach down without moving your wrists. Each finger drops straight to the key below its home position and comes straight back.",
    keys: ["զ", "ղ", "ց", "վ", "բ", "ն", "մ", "ա", "ս", "դ", "ֆ", "գ", "հ", "յ", "կ", "լ"],
    drills: ["զզզ վվվ բբբ նննմ", "զա վս բդ նֆ մգ", "բան ման վազ նամ", "մամ բաց ղաս ցան"],
    accuracyGate: 92,
  },
  {
    id: 7,
    name: "Top row: ք ո ե ռ տ օ պ",
    teach: "Now reach up. Same rule — the finger goes up and returns to its home key immediately. Don't let the whole hand travel.",
    keys: ["ք", "ո", "ե", "ռ", "տ", "օ", "պ", "ա", "ս", "դ", "ֆ", "գ", "հ", "յ", "կ", "լ", "ն", "մ", "վ", "բ"],
    drills: ["քքք ոոո եեե ռռռ տտտ", "որ տա պես քաղ", "երբ տես ոսկ պատ", "տոն սեր քար ոտք"],
    accuracyGate: 92,
  },
  {
    id: 8,
    name: "Everyday words",
    teach: "Full sentences from the trusted keys. Aim for a steady rhythm rather than bursts — even pacing is what actually raises your speed.",
    keys: null,
    drills: ["բարև ձեզ", "շնորհակալ եմ", "ես սովորում եմ", "դպրոց ուսուցիչ գիրք"],
    accuracyGate: 94,
  },
  {
    id: 9,
    name: "Number row (needs checking)",
    teach: "These keys are transcribed from a screenshot and a few are unverified — see the note under the keyboard. Skip this lesson until they're confirmed.",
    keys: ["է", "թ", "փ", "ձ", "ջ", "ւ", "ն", "ր", "չ", "ճ"],
    drills: ["էէէ թթթ փփփ", "էջ թիվ փակ ձայ", "րոպե չափ ճամ"],
    accuracyGate: 90,
    unverified: true,
  },
];
