// src/exercises/tts.jsx
// Unified audio fetcher for learner exercises.
// Priority:
// 1) If CMS uploaded/recorded audio exists for this exercise + voice, use it.
// 2) Otherwise fall back to legacy /tts endpoint (direct speech).

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
    return await fetchLegacyTts(base, input);
  }

  const text = input?.text ?? "";
  const exerciseId = input?.exerciseId;
  const targetKey = input?.targetKey;
  // Voice preference: allow caller override, otherwise use onboarding value stored locally.
  const voicePref = input?.voice ?? localStorage.getItem("hay_voice_pref") ?? "";

  // 1) Prefer stored CMS audio if exerciseId provided
  if (exerciseId) {
    for (const v of voiceCandidates(voicePref)) {
      // 0) If per-target audio exists, prefer it.
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
  return await fetchLegacyTts(base, text);
}
