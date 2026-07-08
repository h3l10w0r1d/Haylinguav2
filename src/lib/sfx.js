// src/lib/sfx.js
// Simple sound effects for exercise feedback.
// Uses the Web Audio API so no external files are needed.
//
// IMPORTANT: we keep ONE shared AudioContext for the whole session. Creating a
// new context per sound (the old behaviour) leaks contexts — browsers cap them
// at ~6 and then silently refuse to play — so feedback would die after a few
// answers. A single context, resumed on demand, plays reliably forever.

let _ctx = null;

function getContext() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_ctx) _ctx = new AC();
    // Autoplay policies start the context "suspended" until a user gesture.
    // We call this from click/keypress handlers, so resume() is allowed here.
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch {
    return null;
  }
}

function playTone(frequency, type, duration, gain = 0.18, when = 0) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    // Tiny attack avoids the click/pop of starting at full gain.
    vol.gain.setValueAtTime(0.0001, t0);
    vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    // ignore
  }
}

export const sfx = {
  // Bright, rising two-note chime.
  correct() {
    playTone(660, "sine", 0.16, 0.2, 0);
    playTone(990, "sine", 0.22, 0.2, 0.09);
  },
  // Soft, short low "thud" — clear but not harsh.
  wrong() {
    playTone(196, "triangle", 0.26, 0.16, 0);
    playTone(146, "sine", 0.3, 0.12, 0.04);
  },
  // Celebratory ascending arpeggio for lesson completion.
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.26, 0.2, i * 0.09));
  },
  // Low rumble during chest shake phase.
  chestRumble() {
    playTone(55, "sawtooth", 0.12, 0.28, 0);
    playTone(73, "sawtooth", 0.08, 0.12, 0.28);
    playTone(55, "sawtooth", 0.07, 0.10, 0.52);
    playTone(65, "sawtooth", 0.06, 0.08, 0.72);
  },
  // Sharp crack + magical rising sparkle when lid flies open.
  chestOpen() {
    playTone(260, "square", 0.06, 0.20, 0);
    playTone(310, "square", 0.04, 0.10, 0.06);
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
      playTone(f, "sine", 0.22, 0.19, 0.12 + i * 0.07)
    );
  },
  // Bright fanfare when the gem reward is revealed.
  gemReveal() {
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.28, 0.22, i * 0.09));
    playTone(1319, "sine", 0.35, 0.28, 0.42);
  },
};
