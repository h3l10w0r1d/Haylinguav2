// src/lib/hearts.js — single source of truth for the hearts (lives) state.
// Shape: { current, max, is_premium, next_regen_seconds }

export function normalizeHearts(d) {
  if (!d) return null;
  const current = Number(d.current ?? d.hearts_current);
  const max = Number(d.max ?? d.hearts_max);
  if (!Number.isFinite(current) || !Number.isFinite(max)) return null;
  return {
    current,
    max,
    is_premium: !!d.is_premium,
    next_regen_seconds: Number(d.next_regen_seconds ?? 0) || 0,
  };
}

export function readHearts() {
  try {
    const v = JSON.parse(localStorage.getItem("hay_hearts") || "null");
    return v && Number.isFinite(v.current) ? v : null;
  } catch {
    return null;
  }
}

/** Persist + broadcast a hearts update (accepts an API response or our shape). */
export function writeHearts(data) {
  const s = normalizeHearts(data);
  if (!s) return;
  try {
    localStorage.setItem("hay_hearts", JSON.stringify(s));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("hay_hearts", { detail: s }));
  } catch {}
}
