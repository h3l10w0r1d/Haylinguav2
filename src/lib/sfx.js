// src/lib/sfx.js
// Simple sound effects for exercise feedback.
// Uses the Web Audio API so no external files are needed.

function createContext() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  } catch {
    return null;
  }
}

function playTone(frequency, type, duration, gain = 0.18) {
  try {
    const ctx = createContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // ignore
  }
}

export const sfx = {
  correct() {
    playTone(880, "sine", 0.18);
    setTimeout(() => playTone(1100, "sine", 0.18), 80);
  },
  wrong() {
    playTone(220, "sawtooth", 0.22, 0.12);
  },
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, "sine", 0.25), i * 90);
    });
  },
};
