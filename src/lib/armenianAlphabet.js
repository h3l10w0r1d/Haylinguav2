// src/lib/armenianAlphabet.js — the 39 letters of the modern Eastern Armenian
// alphabet, in alphabetical order, for offline/printable use.
//
// PROVENANCE: every row here was extracted from the product's own course data
// (the char_intro exercises in lessons hl-alphabet-1 … hl-alphabet-11, seeded
// by backend/seed_alphabet.py) — not typed out by hand and not sourced from
// the open web. The handwriting worksheets therefore can't teach a different
// romanization or example word from the lessons themselves, which is the same
// discipline ArmenianNumbersPage.jsx follows against the numbers blog post.
// Regenerating: pull /lessons/hl-alphabet-{1..11}, take config.letter /
// config.lower / config.transliteration / config.exampleWord /
// config.exampleMeaning from each char_intro.
//
// ORDER: standard modern ordering, which differs from the classical 36 in two
// places — ՈՒ occupies Ւ's slot at 34, and և sits at 37 between Ք and Օ. The
// course data contains exactly these 39 and no standalone Ւ, so the two agree.
//
// INCOMPLETE FIELD: only 13 of the 39 letters carry an exampleWord/meaning in
// the course data (lessons 5-11 introduce letters without one), so `word` and
// `meaning` are null for the other 26. Don't build UI that assumes they're
// present — the worksheets deliberately show letter + romanization only rather
// than showing example words for a third of the alphabet and blanks for the
// rest, and inventing the missing 26 would defeat the point of sourcing this
// from the course in the first place.
//
// `vowel` marks the eight letters treated as vowels, used only to offer a
// "vowels first" worksheet preset — it is a teaching convenience, not a
// phonological claim about ը or ո in every position.
export const ALPHABET = [
  { n: 1, upper: "Ա", lower: "ա", translit: "a", word: "Արև", meaning: "sun", vowel: true },
  { n: 2, upper: "Բ", lower: "բ", translit: "b", word: "Բարև", meaning: "hello", vowel: false },
  { n: 3, upper: "Գ", lower: "գ", translit: "g", word: "Գիրք", meaning: "book", vowel: false },
  { n: 4, upper: "Դ", lower: "դ", translit: "d", word: "Դուռ", meaning: "door", vowel: false },
  { n: 5, upper: "Ե", lower: "ե", translit: "e/ye", word: "Երեխա", meaning: "child", vowel: true },
  { n: 6, upper: "Զ", lower: "զ", translit: "z", word: "Զանգ", meaning: "bell", vowel: false },
  { n: 7, upper: "Է", lower: "է", translit: "e", word: null, meaning: null, vowel: true },
  { n: 8, upper: "Ը", lower: "ը", translit: "uh", word: null, meaning: null, vowel: true },
  { n: 9, upper: "Թ", lower: "թ", translit: "t'", word: null, meaning: null, vowel: false },
  { n: 10, upper: "Ժ", lower: "ժ", translit: "zh", word: null, meaning: null, vowel: false },
  { n: 11, upper: "Ի", lower: "ի", translit: "i", word: "Ինքնաթիռ", meaning: "airplane", vowel: true },
  { n: 12, upper: "Լ", lower: "լ", translit: "l", word: "Լուսին", meaning: "moon", vowel: false },
  { n: 13, upper: "Խ", lower: "խ", translit: "kh", word: null, meaning: null, vowel: false },
  { n: 14, upper: "Ծ", lower: "ծ", translit: "ts", word: null, meaning: null, vowel: false },
  { n: 15, upper: "Կ", lower: "կ", translit: "k", word: "Կատու", meaning: "cat", vowel: false },
  { n: 16, upper: "Հ", lower: "հ", translit: "h", word: "Հաց", meaning: "bread", vowel: false },
  { n: 17, upper: "Ձ", lower: "ձ", translit: "dz", word: null, meaning: null, vowel: false },
  { n: 18, upper: "Ղ", lower: "ղ", translit: "gh", word: null, meaning: null, vowel: false },
  { n: 19, upper: "Ճ", lower: "ճ", translit: "ch", word: null, meaning: null, vowel: false },
  { n: 20, upper: "Մ", lower: "մ", translit: "m", word: "Մայր", meaning: "mother", vowel: false },
  { n: 21, upper: "Յ", lower: "յ", translit: "y", word: null, meaning: null, vowel: false },
  { n: 22, upper: "Ն", lower: "ն", translit: "n", word: "Նարինջ", meaning: "orange", vowel: false },
  { n: 23, upper: "Շ", lower: "շ", translit: "sh", word: null, meaning: null, vowel: false },
  { n: 24, upper: "Ո", lower: "ո", translit: "o/vo", word: null, meaning: null, vowel: true },
  { n: 25, upper: "Չ", lower: "չ", translit: "ch'", word: null, meaning: null, vowel: false },
  { n: 26, upper: "Պ", lower: "պ", translit: "p", word: null, meaning: null, vowel: false },
  { n: 27, upper: "Ջ", lower: "ջ", translit: "j", word: null, meaning: null, vowel: false },
  { n: 28, upper: "Ռ", lower: "ռ", translit: "rr", word: null, meaning: null, vowel: false },
  { n: 29, upper: "Ս", lower: "ս", translit: "s", word: "Սիրտ", meaning: "heart", vowel: false },
  { n: 30, upper: "Վ", lower: "վ", translit: "v", word: null, meaning: null, vowel: false },
  { n: 31, upper: "Տ", lower: "տ", translit: "t", word: null, meaning: null, vowel: false },
  { n: 32, upper: "Ր", lower: "ր", translit: "r", word: null, meaning: null, vowel: false },
  { n: 33, upper: "Ց", lower: "ց", translit: "ts'", word: null, meaning: null, vowel: false },
  { n: 34, upper: "ՈՒ", lower: "ու", translit: "u", word: null, meaning: null, vowel: true },
  { n: 35, upper: "Փ", lower: "փ", translit: "p'", word: null, meaning: null, vowel: false },
  { n: 36, upper: "Ք", lower: "ք", translit: "k'", word: null, meaning: null, vowel: false },
  { n: 37, upper: "և", lower: "և", translit: "ev", word: null, meaning: null, vowel: false },
  { n: 38, upper: "Օ", lower: "օ", translit: "o", word: null, meaning: null, vowel: true },
  { n: 39, upper: "Ֆ", lower: "ֆ", translit: "f", word: null, meaning: null, vowel: false },];

export const VOWELS = ALPHABET.filter((l) => l.vowel);
export const CONSONANTS = ALPHABET.filter((l) => !l.vowel);

/** Letters 1-indexed, inclusive, clamped to the alphabet's bounds. */
export function slice(from, to) {
  const a = Math.max(1, Math.min(ALPHABET.length, from));
  const b = Math.max(a, Math.min(ALPHABET.length, to));
  return ALPHABET.slice(a - 1, b);
}
