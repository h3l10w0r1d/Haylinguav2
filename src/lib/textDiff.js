// src/lib/textDiff.js
// Character-level diff between a learner's typed answer and the correct
// answer, so the result panel can show exactly which letters were wrong
// instead of just revealing the correct answer as an opaque string.

function toChars(s) {
  return Array.from(String(s ?? ""));
}

/**
 * Align `typed` against `correct` via edit distance (Wagner-Fischer with
 * backtrace) and return two parallel tagged-segment arrays:
 *   typed:   what the learner typed, each char tagged "match" | "wrong" | "extra"
 *   correct: the correct answer, each char tagged "match" | "missing"
 * ("wrong" = typed the wrong letter here; "extra" = typed a letter that
 * shouldn't be there; "missing" = a letter the learner didn't type at all.)
 */
export function diffAnswer(typed, correct) {
  const a = toChars(typed);
  const b = toChars(correct);
  const n = a.length;
  const m = b.length;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  const typedOut = [];
  const correctOut = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      typedOut.push({ char: a[i - 1], type: "match" });
      correctOut.push({ char: b[j - 1], type: "match" });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      typedOut.push({ char: a[i - 1], type: "wrong" });
      correctOut.push({ char: b[j - 1], type: "missing" });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      typedOut.push({ char: a[i - 1], type: "extra" });
      i--;
    } else {
      correctOut.push({ char: b[j - 1], type: "missing" });
      j--;
    }
  }
  typedOut.reverse();
  correctOut.reverse();
  return { typed: typedOut, correct: correctOut, distance: dp[n][m] };
}

// Kinds graded as free-text (mirrors backend/grading.py's _TYPO_KINDS) — the
// only kinds where "what the user typed" is raw comparable text worth diffing.
export const DIFFABLE_KINDS = new Set([
  "letter_typing",
  "word_spelling",
  "fill_blank",
  "listen_type",
  "write_translate",
]);
