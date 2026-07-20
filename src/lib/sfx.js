// src/lib/sfx.js
// Simple sound effects for exercise feedback.
// Uses the Web Audio API so no external files are needed.
//
// IMPORTANT: we keep ONE shared AudioContext for the whole session. Creating a
// new context per sound (the old behaviour) leaks contexts — browsers cap them
// at ~6 and then silently refuse to play — so feedback would die after a few
// answers. A single context, resumed on demand, plays reliably forever.

import { isMuted } from "./muteAudio";

let _ctx = null;

// Web Audio keeps generating sound in a hidden/background tab by default —
// suspend the shared context the instant the tab is hidden or closed so
// nothing plays out unheard. getContext() resumes it again on the next
// real sfx call, which only ever happens from a foreground user action.
if (typeof document !== "undefined") {
  const suspendIfHidden = () => {
    if (_ctx && _ctx.state === "running") _ctx.suspend().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspendIfHidden();
  });
  window.addEventListener("pagehide", suspendIfHidden);
}

function getContext() {
  try {
    // A background loop (e.g. the landing page's autoplay demo) can still
    // call sfx functions on a timer while the tab is hidden — don't let that
    // resume a context we just suspended for exactly that reason.
    if (typeof document !== "undefined" && document.hidden) return null;
    if (isMuted()) return null;
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

// Oscillator with a frequency glide — sub-bass drops ("booms") and risers.
function playSweep(f0, f1, type, duration, gain = 0.2, when = 0) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + duration);
    vol.gain.setValueAtTime(0.0001, t0);
    vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    // ignore
  }
}

// Shared 1s white-noise buffer, built lazily once.
let _noiseBuf = null;
function getNoiseBuffer(ctx) {
  if (_noiseBuf && _noiseBuf.sampleRate === ctx.sampleRate) return _noiseBuf;
  const len = ctx.sampleRate;
  _noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = _noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

// Filtered noise burst — crashes (lowpass falling), risers (bandpass rising),
// bright splashes (highpass). fType: "lowpass" | "highpass" | "bandpass".
function playNoise(duration, gain = 0.2, when = 0, fType = "lowpass", fFrom = 4000, fTo = 400) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = fType;
    filter.frequency.setValueAtTime(Math.max(10, fFrom), t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(10, fTo), t0 + duration);
    filter.Q.value = fType === "bandpass" ? 1.2 : 0.7;
    const vol = ctx.createGain();
    src.connect(filter);
    filter.connect(vol);
    vol.connect(ctx.destination);
    vol.gain.setValueAtTime(0.0001, t0);
    vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  } catch {
    // ignore
  }
}

// Two slightly-detuned voices per note — instantly fuller than a bare sine.
function playRichTone(frequency, type, duration, gain, when) {
  playTone(frequency, type, duration, gain * 0.6, when);
  playTone(frequency * 1.004, type, duration, gain * 0.45, when);
}

export const sfx = {
  // Bright, rising two-note chime. Pitch climbs with the combo streak —
  // semitone steps every 3 correct answers, capped so it stays musical.
  correct(combo = 0) {
    const semitones = Math.min(7, Math.floor(Math.max(0, combo) / 3) * 2);
    const mul = Math.pow(2, semitones / 12);
    playTone(660 * mul, "sine", 0.16, 0.2, 0);
    playTone(990 * mul, "sine", 0.22, 0.2, 0.09);
  },
  // Soft, short low "thud" — clear but not harsh.
  wrong() {
    playTone(196, "triangle", 0.26, 0.16, 0);
    playTone(146, "sine", 0.3, 0.12, 0.04);
  },
  // Quiet tactile "pock" for tapping a tile/word/pill — a short downward
  // chirp, mixed low so it never competes with correct/wrong feedback.
  tileTap() {
    playSweep(900, 650, "triangle", 0.045, 0.055, 0);
  },
  // Celebratory fanfare for lesson completion — richer layered chord stack
  // (detuned pairs + warm lower octave) with a trailing sparkle, scaled down
  // from gemReveal's shape but distinct from the chest/reward sounds.
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => {
      playRichTone(f, "sine", 0.28, 0.2, i * 0.085);
      playTone(f / 2, "triangle", 0.32, 0.05, i * 0.085);
    });
    playTone(1319, "sine", 0.3, 0.16, 0.36);
  },
  // Cinematic riser during the final shake (930ms): swelling noise sweep +
  // climbing tone over a pulsing low rumble. intensity 1..3 scales the drama.
  chestRumble(intensity = 1) {
    const k = Math.min(3, Math.max(1, intensity));
    // Swelling riser — noise sweeping up through a bandpass
    playNoise(0.85, 0.10 + 0.05 * k, 0, "bandpass", 220, 2600);
    // Climbing tension tone underneath
    playSweep(70, 200 + 40 * k, "sawtooth", 0.85, 0.07 + 0.03 * k, 0);
    // Pulsing ground rumble
    playTone(55, "sawtooth", 0.14, 0.26, 0);
    playTone(62, "sawtooth", 0.12, 0.18, 0.24);
    playTone(55, "sawtooth", 0.10, 0.14, 0.48);
    playTone(70, "sawtooth", 0.10, 0.12, 0.68);
  },
  // Escalating knock/crack per tap while prying a rarity chest open (level 1..3).
  chestCrack(level = 1) {
    playTone(120 + level * 40, "square", 0.05, 0.22, 0);
    playTone(80 + level * 30, "triangle", 0.09, 0.18, 0.03);
    // Splintering — short bright noise snap that grows with each tap
    playNoise(0.09 + level * 0.02, 0.10 + level * 0.04, 0, "highpass", 2500, 1200);
  },
  // The lid blows off: sub-bass BOOM + explosion crash + bright shatter,
  // then a detuned ascending arpeggio. intensity 1..3 scales the impact.
  chestOpen(intensity = 1) {
    const k = Math.min(3, Math.max(1, intensity));
    // Sub-bass drop — the cinematic body of the impact
    playSweep(160, 38, "sine", 0.55, 0.30 + 0.08 * k, 0);
    if (k >= 2) playSweep(90, 30, "sine", 0.7, 0.22, 0.03); // extra floor for golden+
    // Explosion crash — noise falling through a lowpass
    playNoise(0.6 + 0.12 * k, 0.16 + 0.06 * k, 0, "lowpass", 6500, 320);
    // Bright shatter on top
    playNoise(0.28, 0.10 + 0.04 * k, 0.02, "highpass", 2800, 5200);
    // Magical ascending arpeggio, detuned pairs for richness
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
      playRichTone(f, "sine", 0.24, 0.20, 0.14 + i * 0.065)
    );
    if (k >= 3) playRichTone(1568, "sine", 0.3, 0.2, 0.14 + 6 * 0.065); // legendary reaches higher
  },
  // Grand fanfare when the reward is revealed — layered major-chord stack
  // with trailing sparkles. intensity 1..3 widens and lengthens it.
  gemReveal(intensity = 1) {
    const k = Math.min(3, Math.max(1, intensity));
    // Chord stack C-E-G-C, sine + soft triangle layer, staggered entries
    [523, 659, 784, 1047].forEach((f, i) => {
      playRichTone(f, "sine", 0.34 + 0.06 * k, 0.20, i * 0.085);
      playTone(f / 2, "triangle", 0.4, 0.06, i * 0.085); // warm lower octave
    });
    // Trailing sparkles
    playTone(1319, "sine", 0.35, 0.24, 0.40);
    playTone(1568, "sine", 0.3, 0.14, 0.52);
    if (k >= 2) playTone(2093, "sine", 0.32, 0.12, 0.62);
    // Legendary: held top note + one last deep swell underneath
    if (k >= 3) {
      playRichTone(1047, "sine", 0.8, 0.16, 0.7);
      playSweep(65, 130, "sine", 0.8, 0.10, 0.55);
    }
  },
};
