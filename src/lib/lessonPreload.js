// src/lib/lessonPreload.js
// Warms the lesson-JSON + TTS caches for a lesson before the learner opens
// it, so the first exercise (and its audio) is instant instead of showing a
// loading spinner / silent "Listen" button. Two call sites: Dashboard fires
// this for the learner's next-up lesson as soon as it's known, and a lesson
// row's onMouseEnter fires it for whichever lesson is hovered.
import { ttsFetch } from "../exercises/tts";

const _lessonCache = new Map(); // slug -> Promise<lessonData|null>

// Only warm the first few exercises' audio — a lesson can have a dozen+
// exercises and the learner may never reach most of them in one sitting.
const MAX_EXERCISES_TO_WARM = 3;

function collectTtsRequests(exercise) {
  const cfg = exercise?.config || {};
  const exerciseId = exercise?.id;
  const requests = [];
  const seen = new Set();

  const add = (text) => {
    const t = (text || "").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    requests.push({ text: t, exerciseId });
  };

  add(cfg.ttsText ?? cfg.text);
  add(exercise?.expected_answer ?? cfg.answer ?? cfg.target ?? cfg.phrase);
  if (Array.isArray(cfg.lines)) {
    cfg.lines.forEach((l) => add(l?.text));
  }

  return requests;
}

/**
 * Fetch a lesson's JSON and warm its TTS cache in the background.
 * Safe to call multiple times for the same slug — subsequent calls return
 * the same in-flight/resolved promise instead of re-fetching.
 */
export function preloadLesson(slug, apiBase) {
  if (!slug) return null;
  if (_lessonCache.has(slug)) return _lessonCache.get(slug);

  const base = apiBase || import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

  const promise = fetch(`${base}/lessons/${slug}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return null;

      const exercises = Array.isArray(data.exercises) ? data.exercises : [];
      exercises.slice(0, MAX_EXERCISES_TO_WARM).forEach((ex) => {
        collectTtsRequests(ex).forEach(({ text, exerciseId }) => {
          ttsFetch(base, { text, exerciseId })
            .then((url) => URL.revokeObjectURL(url)) // only warming _dataCache, not using the blob now
            .catch(() => {}); // best-effort — a failed warm-up just means a normal fetch later
        });
      });

      return data;
    })
    .catch(() => null);

  _lessonCache.set(slug, promise);
  return promise;
}

/** Returns the in-flight/resolved preload promise for a slug, if any. */
export function getPreloadedLesson(slug) {
  return slug ? _lessonCache.get(slug) || null : null;
}
