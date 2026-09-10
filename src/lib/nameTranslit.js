// src/lib/nameTranslit.js — best-effort, phonetic Latin → Armenian
// transliteration for names, built for the "how do you write my name in
// Armenian" landing page. This is the reverse direction of ./translit.js
// (Armenian → Latin, used for STT transcript display) — deliberately a
// separate module since the two directions need different rule tables,
// not a literal inversion of one map.
//
// Caveat worth keeping in mind while reading this: there is no single
// official standard for spelling foreign names in Armenian, and English
// spelling-to-sound is notoriously inconsistent. This aims for a
// consistent, good-enough-for-a-name-badge rendering that matches common
// real-world Armenian spellings of Western names (Kate → Քեյթ,
// Michael → Մայքլ, George → Ջորջ) — not a linguistic authority.

const UPPER = {
  "ա": "Ա", "բ": "Բ", "գ": "Գ", "դ": "Դ", "ե": "Ե", "զ": "Զ", "է": "Է",
  "ը": "Ը", "թ": "Թ", "ժ": "Ժ", "ի": "Ի", "լ": "Լ", "խ": "Խ", "ծ": "Ծ",
  "կ": "Կ", "հ": "Հ", "ձ": "Ձ", "ղ": "Ղ", "ճ": "Ճ", "մ": "Մ", "յ": "Յ",
  "ն": "Ն", "շ": "Շ", "ո": "Ո", "չ": "Չ", "պ": "Պ", "ջ": "Ջ", "ռ": "Ռ",
  "ս": "Ս", "վ": "Վ", "տ": "Տ", "ր": "Ր", "ց": "Ց", "ւ": "Ւ", "փ": "Փ",
  "ք": "Ք", "օ": "Օ", "ֆ": "Ֆ",
};

// English voiceless stops p/t are conventionally aspirated in Armenian
// renderings of Western names (Kate → Քեյթ, Peter → Փիթեր), so they map to
// the aspirated series (Փ/Թ) rather than the plain one (Պ/Տ) — same logic
// as k → Ք below.
const SINGLE = {
  b: "բ", d: "դ", f: "ֆ", j: "ջ", l: "լ", m: "մ", n: "ն",
  p: "փ", s: "ս", t: "թ", v: "վ", z: "զ",
};

// Small set of common English first names whose Armenian spelling is
// driven by a genuine pronunciation irregularity (not decodable from
// spelling rules alone — "Michael" and "Chloe" don't sound like their
// letters). Checked as a whole-word, case-insensitive override before the
// rule-based engine runs.
const EXCEPTIONS = {
  michael: "Մայքլ",
  chloe: "Քլոե",
  sean: "Շոն",
  siobhan: "Շիվոն",
  joaquin: "Ուոքին",
  isaac: "Այզաք",
};

const isVowelLetter = (ch) => "aeiou".includes(ch);

// A single Latin consonant → Armenian, aware of whether English spelling
// makes it "soft" here (c/g followed by e/i/y — cent, gem, gym).
// Aspirated-vs-plain follows the convention already used for real foreign
// names in Armenian: hard "c" → Կ (Carl → Կարլ) but "k" → Ք (Kate → Քեյթ);
// similarly plain/aspirated pairs for the rest.
function consonantLetter(ch, softContext) {
  switch (ch) {
    case "c": return softContext ? "ս" : "կ";
    case "g": return softContext ? "ջ" : "գ";
    case "k": return "ք";
    case "q": return "ք";
    case "x": return "քս";
    case "w": return "վ";
    default: return SINGLE[ch] ?? ch;
  }
}

// Multi-character sequences, tried longest-first before single letters.
const DIGRAPHS = [
  ["chr", "քր"],
  ["tch", "չ"],
  ["sch", "շ"],
  ["sh", "շ"],
  ["ch", "չ"],
  ["ph", "ֆ"],
  ["th", "թ"],
  ["kh", "խ"],
  ["gh", "ղ"],
  ["ck", "ք"],
  ["wh", "վ"],
  ["qu", "քու"],
  ["ee", "ի"],
  ["ea", "ի"],
  ["ie", "ի"],
  ["oo", "ու"],
  ["ou", "աու"],
  ["ow", "աու"],
  ["ay", "եյ"],
  ["ey", "եյ"],
  ["ai", "եյ"],
  ["oy", "ոյ"],
  ["oi", "ոյ"],
];

// English "magic e": a word-final (vowel)(single consonant)e says the
// vowel's name and drops the e — Kate, Mike, Grace, Rose, Steve. One
// pattern, huge share of common English first names, worth handling
// explicitly rather than falling through to per-letter rules that would
// leave a spurious trailing vowel sound.
const LENGTHENED_VOWEL = { a: "եյ", e: "ի", i: "այ", o: "ոու" };

function transliterateWord(word) {
  const lower = word.toLowerCase();
  if (EXCEPTIONS[lower]) return EXCEPTIONS[lower];

  let core = lower;
  let magicSuffix = "";
  const magicE = lower.match(/^(.*)([aeio])([bcdfgjklmnpqrstvz])e$/);
  if (magicE) {
    const [, prefix, vowel, cons] = magicE;
    core = prefix;
    magicSuffix = LENGTHENED_VOWEL[vowel] + consonantLetter(cons, true);
  } else {
    // Not a lengthening pattern (e.g. "u", or a doubled consonant like
    // Charlotte's "tte") — still likely a silent trailing e, so drop it
    // rather than render a spurious extra syllable.
    const silentE = lower.match(/^(.*[bcdfghjklmnpqrstvwxyz])e$/);
    if (silentE && silentE[1].length >= 2) core = silentE[1];
  }

  let out = "";
  let i = 0;
  let afterBareS = false; // English drops aspiration on p/t/k right after "s" — spin/stop/skip
  while (i < core.length) {
    const wasAfterBareS = afterBareS;
    afterBareS = false;

    if (core[i] === "y") {
      const next = core[i + 1];
      out += next && isVowelLetter(next) ? "յ" : "ի";
      i += 1;
      continue;
    }

    const rest = core.slice(i);
    let matched = false;
    for (const [pat, rep] of DIGRAPHS) {
      if (rest.startsWith(pat)) {
        out += rep;
        i += pat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const ch = core[i];
    const atStart = i === 0;
    if (ch === "e") out += atStart ? "է" : "ե";
    else if (ch === "o") out += atStart ? "օ" : "ո";
    else if (ch === "u") out += "ու";
    else if (ch === "a") out += "ա";
    else if (ch === "i") out += "ի";
    else if (ch === "r") out += atStart ? "ռ" : "ր";
    else if (ch === "x") out += atStart ? "զ" : "քս";
    else if (ch === "h") {
      // Silent after a vowel and not word-initial — John, Sarah, Hannah's
      // trailing "ah" — but a digraph (ch/sh/th/wh/kh/gh) already consumed
      // any "consonant+h" a few lines up, so an "h" reaching here is always
      // either word-initial (Henry, Harry — keep it) or post-vowel.
      if (!atStart && isVowelLetter(core[i - 1])) {
        // silent — emit nothing
      } else {
        out += "հ";
      }
    } else if (ch === "s") {
      out += "ս";
      afterBareS = true;
    } else if (ch === "t") out += wasAfterBareS ? "տ" : "թ";
    else if (ch === "p") out += wasAfterBareS ? "պ" : "փ";
    else if (ch === "k") out += wasAfterBareS ? "կ" : "ք";
    else if (ch === "c" || ch === "g") {
      const next = core[i + 1];
      out += consonantLetter(ch, next === "e" || next === "i" || next === "y");
    } else if (ch in SINGLE || ch === "q" || ch === "w") {
      out += consonantLetter(ch, false);
    } else {
      out += ch; // punctuation/digits/anything unmapped passes through
    }
    i += 1;
  }

  out += magicSuffix;

  const first = [...out][0];
  if (first && UPPER[first]) out = UPPER[first] + out.slice(first.length);
  return out;
}

/**
 * Phonetic Latin → Armenian transliteration for a name or short phrase.
 * Splits on whitespace/hyphens so multi-word names ("Anna Maria",
 * "Jean-Luc") transliterate word-by-word with separators preserved.
 */
export function transliterateToArmenian(input) {
  if (!input) return "";
  return String(input)
    .split(/([\s-]+)/)
    .map((part) => (/[a-zA-Z]/.test(part) ? transliterateWord(part) : part))
    .join("");
}
