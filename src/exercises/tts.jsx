// src/exercises/tts.js
export async function ttsFetch(apiBaseUrl, text) {
  const base =
    apiBaseUrl ||
    import.meta.env.VITE_API_BASE_URL ||
    "https://haylinguav2.onrender.com";

  const res = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
