// src/exercises/choiceHelpers.js — ports getChoices/getSingleCorrectIndex from
// src/ExerciseRenderer.jsx. Real exercise content stores choices in
// `exercise.config.choices` (+ `config.answerIndex` or a matching
// `expected_answer`), NOT `exercise.options` (confirmed empty `[]` on every
// real translate_mcq/letter_recognition/select_missing_word/minimal_pairs
// exercise checked against the live backend) — `exercise.options` only gets
// populated for content authored the older way. Both are supported here,
// options taking priority when present, exactly like the web.
function normalizeText(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export function getChoices(exercise, cfg) {
  const opts = Array.isArray(exercise?.options) ? exercise.options : [];
  if (opts.length) return opts.map((o) => String(o?.text ?? ''));
  const fromCfg = cfg.choices ?? cfg.options ?? [];
  return Array.isArray(fromCfg) ? fromCfg.map((x) => String(x ?? '')) : [];
}

export function getSingleCorrectIndex(exercise, cfg, choices) {
  const opts = Array.isArray(exercise?.options) ? exercise.options : [];
  if (opts.length) {
    const i = opts.findIndex((o) => !!o?.is_correct);
    return i >= 0 ? i : null;
  }
  if (Number.isFinite(cfg.answerIndex)) return Number(cfg.answerIndex);
  const expected = exercise?.expected_answer;
  if (expected != null) {
    const j = choices.findIndex((c) => normalizeText(c) === normalizeText(expected));
    return j >= 0 ? j : null;
  }
  return null;
}

export { normalizeText };
