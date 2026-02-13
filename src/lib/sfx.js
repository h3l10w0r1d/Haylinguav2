// Simple SFX manager (no deps)
// Files live in: /public/sfx/
//   - correct.wav
//   - wrong.wav
//   - complete.wav
//
// Notes:
// - Browser autoplay restrictions: play() will only work after a user gesture.
// - We fail silently to avoid breaking the lesson flow.

const KEY = "haylingua:sfx:enabled";

export function sfxIsEnabled() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return true; // default ON
    return v === "1";
  } catch {
    return true;
  }
}

export function setSfxEnabled(enabled) {
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

function makeAudio(src, volume = 0.35) {
  const a = new Audio(src);
  a.volume = volume;
  a.preload = "auto";
  return a;
}

// Keep one instance per sound (restart by resetting currentTime).
const A = {
  correct: makeAudio("/sfx/correct.wav", 0.35),
  wrong: makeAudio("/sfx/wrong.wav", 0.35),
  complete: makeAudio("/sfx/complete.wav", 0.45),
};

async function safePlay(audio) {
  if (!sfxIsEnabled()) return;
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch {
    // Autoplay blocked or other issue - ignore
  }
}

export const sfx = {
  correct: () => safePlay(A.correct),
  wrong: () => safePlay(A.wrong),
  complete: () => safePlay(A.complete),
};
