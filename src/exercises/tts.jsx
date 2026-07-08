// src/exercises/tts.jsx
// Unified audio fetcher for learner exercises.
// Priority:
// 1) If CMS uploaded/recorded audio exists for this exercise + voice, use it.
// 2) Otherwise fall back to legacy /tts endpoint (direct speech).

// In-memory URL cache: same audio won't be fetched twice in a session.
// Keys are "${exerciseId}:${targetKey}:${voice}" or "tts:${text}".
const _audioCache = new Map();

function getBase(apiBaseUrl) {
  return (
    apiBaseUrl ||
    import.meta.env.VITE_API_BASE_URL ||
    "https://haylinguav2.onrender.com"
  );
}

function normalizeVoicePref(v) {
  const s = (v || "").toString().toLowerCase();
  if (s === "male" || s === "female") return s;
  // "both" is deprecated; treat as random.
  if (s === "both") return "random";
  if (s === "random") return "random";
  return "female";
}

function voiceCandidates(pref) {
  const p = normalizeVoicePref(pref);
  if (p === "male") return ["male"];
  if (p === "female") return ["female"];
  // random
  return Math.random() < 0.5 ? ["female", "male"] : ["male", "female"];
}

async function tryFetchExerciseAudio(base, exerciseId, voice) {
  const url = `${base}/audio/exercise/${exerciseId}?voice=${encodeURIComponent(voice)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function tryFetchTargetAudio(base, exerciseId, targetKey, voice) {
  const url = `${base}/audio/target/${exerciseId}?key=${encodeURIComponent(
    targetKey
  )}&voice=${encodeURIComponent(voice)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function fetchLegacyTts(base, text) {
  const res = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * @param {string} apiBaseUrl
 * @param {string|{text:string, exerciseId?:number, voice?:string}} input
 */
export async function ttsFetch(apiBaseUrl, input) {
  const base = getBase(apiBaseUrl);

  // Backward-compatible: ttsFetch(baseUrl, "text")
  if (typeof input === "string") {
    const cacheKey = `tts:${input}`;
    if (_audioCache.has(cacheKey)) return _audioCache.get(cacheKey);
    const url = await fetchLegacyTts(base, input);
    _audioCache.set(cacheKey, url);
    return url;
  }

  const text = input?.text ?? "";
  const exerciseId = input?.exerciseId;
  const targetKey = input?.targetKey;
  const voicePref = input?.voice ?? localStorage.getItem("hay_voice_pref") ?? "";

  // 1) Prefer stored CMS audio if exerciseId provided
  if (exerciseId) {
    for (const v of voiceCandidates(voicePref)) {
      if (targetKey) {
        const cacheKey = `${exerciseId}:${targetKey}:${v}`;
        if (_audioCache.has(cacheKey)) return _audioCache.get(cacheKey);
        const tu = await tryFetchTargetAudio(base, exerciseId, targetKey, v);
        if (tu) { _audioCache.set(cacheKey, tu); return tu; }
      }
      const cacheKey = `${exerciseId}::${v}`;
      if (_audioCache.has(cacheKey)) return _audioCache.get(cacheKey);
      const u = await tryFetchExerciseAudio(base, exerciseId, v);
      if (u) { _audioCache.set(cacheKey, u); return u; }
    }
  }

  // 2) Fallback: legacy /tts
  if (!text) throw new Error("Missing text");
  const cacheKey = `tts:${text}`;
  if (_audioCache.has(cacheKey)) return _audioCache.get(cacheKey);
  const url = await fetchLegacyTts(base, text);
  _audioCache.set(cacheKey, url);
  return url;
}
