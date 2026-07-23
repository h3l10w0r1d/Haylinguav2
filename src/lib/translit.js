// src/lib/translit.js
// Lightweight Eastern-Armenian → Latin transliteration, matching the
// romanization style the curriculum already uses in its pre-alphabet
// "Sounds" lessons (հաց→hats, ջուր→jur, սար→sar, ձի→dzi …). Used to show a
// speak exercise's STT transcript in Latin letters when the learner hasn't
// been taught the Armenian alphabet yet (cfg.hideScript) — otherwise the
// "We heard …" feedback comes back as script they can't read, so they can't
// tell whether they said the word right.

const MAP = {
  "ա": "a", "բ": "b", "գ": "g", "դ": "d", "ե": "e", "զ": "z", "է": "e",
  "ը": "ə", "թ": "t'", "ժ": "zh", "ի": "i", "լ": "l", "խ": "kh", "ծ": "ts",
  "կ": "k", "հ": "h", "ձ": "dz", "ղ": "gh", "ճ": "ch", "մ": "m", "յ": "y",
  "ն": "n", "շ": "sh", "ո": "o", "չ": "ch'", "պ": "p", "ջ": "j", "ռ": "r",
  "ս": "s", "վ": "v", "տ": "t", "ր": "r", "ց": "ts'", "ւ": "w", "փ": "p'",
  "ք": "k'", "օ": "o", "ֆ": "f",
};

/**
 * Transliterate an Armenian string to a readable Latin approximation.
 * Non-Armenian characters pass through unchanged, so mixed/Latin input is
 * safe to pass in. The first letter of each word is capitalized to mirror
 * how STT returns proper-cased words.
 */
export function translitArmenian(input) {
  if (!input) return input;
  // Digraphs first (ու→u, և→ev), on the lowercased form so the uppercase
  // ligatures (ՈՒ / Եւ) collapse too.
  let s = String(input).toLowerCase().replace(/ու/g, "u").replace(/և/g, "ev");
  let out = "";
  for (const ch of s) out += MAP[ch] ?? ch;
  return out.replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase());
}
