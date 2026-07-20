// src/lib/muteAudio.js — global "mute all sound" switch, same pattern as
// theme.js. A safety net on top of the tab-visibility fixes: whatever the
// cause, a learner can always silence every sfx/TTS sound themselves without
// digging through OS volume mixers.
const KEY = "hay_muted";

export function isMuted() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {}
  window.dispatchEvent(new CustomEvent("hay_muted_changed", { detail: { muted } }));
}

export function toggleMuted() {
  const next = !isMuted();
  setMuted(next);
  return next;
}
