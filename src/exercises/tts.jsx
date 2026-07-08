// src/exercises/tts.jsx
// Unified audio fetcher for learner exercises.
// Priority:
// 1) If CMS uploaded/recorded audio exists for this exercise + voice, use it.
// 2) Otherwise fall back to legacy /tts endpoint (direct speech).

// TTS-1: Cache raw ArrayBuffer data instead of blob URLs.
// Blob URLs created from cached data must always be fresh — a revoked blob URL
// stored in _audioCache would cause silent playback failures on the second call.
// Callers are responsible for revoking the blob URL they receive when done with it.
const _dataCache = new Map(); // cacheKey → ArrayBuffer

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

function bufferToObjectUrl(buffer, contentType) {
  const blob = new Blob([buffer], { type: contentType || "audio/mpeg" });
  return URL.createObjectURL(blob);
}

async function tryFetchExerciseAudio(base, exerciseId, voice) {
  const cacheKey = `ex:${exerciseId}::${voice}`;
  if (_dataCache.has(cacheKey)) {
    return bufferToObjectUrl(_dataCache.get(cacheKey).buf, _dataCache.get(cacheKey).ct);
  }
  const url = `${base}/audio/exercise/${exerciseId}?voice=${encodeURIComponent(voice)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "audio/mpeg";
  const buffer = await res.arrayBuffer();
  _dataCache.set(cacheKey, { buf: buffer, ct });
  return bufferToObjectUrl(buffer, ct);
}

async function tryFetchTargetAudio(base, exerciseId, targetKey, voice) {
  const cacheKey = `ex:${exerciseId}:${targetKey}:${voice}`;
  if (_dataCache.has(cacheKey)) {
    return bufferToObjectUrl(_dataCache.get(cacheKey).buf, _dataCache.get(cacheKey).ct);
  }
  const url = `${base}/audio/target/${exerciseId}?key=${encodeURIComponent(
    targetKey
  )}&voice=${encodeURIComponent(voice)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "audio/mpeg";
  const buffer = await res.arrayBuffer();
  _dataCache.set(cacheKey, { buf: buffer, ct });
  return bufferToObjectUrl(buffer, ct);
}

async function fetchLegacyTts(base, text) {
  const cacheKey = `tts:${text}`;
  if (_dataCache.has(cacheKey)) {
    return bufferToObjectUrl(_dataCache.get(cacheKey).buf, _dataCache.get(cacheKey).ct);
  }
  const res = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const ct = res.headers.get("content-type") || "audio/mpeg";
  const buffer = await res.arrayBuffer();
  _dataCache.set(cacheKey, { buf: buffer, ct });
  return bufferToObjectUrl(buffer, ct);
}

/**
 * @param {string} apiBaseUrl
 * @param {string|{text:string, exerciseId?:number, targetKey?:string, voice?:string}} input
 * @returns {Promise<string>} A fresh blob URL. The caller must revoke it via
 *   URL.revokeObjectURL() when no longer needed (e.g. on cleanup or before
 *   fetching the next audio). The underlying audio data is cached in memory so
 *   repeated calls do NOT re-fetch from the network.
 */
export async function ttsFetch(apiBaseUrl, input) {
  const base = getBase(apiBaseUrl);

  // Backward-compatible: ttsFetch(baseUrl, "text")
  if (typeof input === "string") {
    return fetchLegacyTts(base, input);
  }

  const text = input?.text ?? "";
  const exerciseId = input?.exerciseId;
  const targetKey = input?.targetKey;
  const voicePref = input?.voice ?? localStorage.getItem("hay_voice_pref") ?? "";

  // 1) Prefer stored CMS audio if exerciseId provided
  if (exerciseId) {
    for (const v of voiceCandidates(voicePref)) {
      if (targetKey) {
        const tu = await tryFetchTargetAudio(base, exerciseId, targetKey, v);
        if (tu) return tu;
      }
      const u = await tryFetchExerciseAudio(base, exerciseId, v);
      if (u) return u;
    }
  }

  // 2) Fallback: legacy /tts
  if (!text) throw new Error("Missing text");
  return fetchLegacyTts(base, text);
}
