// src/lib/similarity.js — ports the web's ExSpeak client-side scoring
// (src/ExerciseRenderer.jsx:1373-1518): no backend scoring exists for
// speech — /me/exercises/transcribe just returns raw text, and both web and
// mobile decide correct/wrong the same way, locally.
const CORRECT_THRESHOLD = 0.85;

export function normalizeForSpeech(s) {
  return String(s ?? '')
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

export function similarityRatio(a, b) {
  const na = normalizeForSpeech(a);
  const nb = normalizeForSpeech(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

export function isSpeechMatch(transcript, expected) {
  return similarityRatio(transcript, expected) >= CORRECT_THRESHOLD;
}
