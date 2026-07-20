// src/lib/audioRegistry.js — silences one-off <audio> playback (TTS
// pronunciation, exercise sound effects, replays) the instant the tab is
// backgrounded or closed, or whenever the learner hits the mute toggle.
// Browsers keep playing HTMLAudioElements in a hidden/background tab by
// default, so without this a clip just plays out even after the learner
// has switched away.
import { isMuted } from "./muteAudio";

const playing = new Set();

function stopAllTrackedAudio() {
  for (const audio of playing) {
    try {
      audio.pause();
    } catch {
      // ignore
    }
  }
  playing.clear();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAllTrackedAudio();
  });
  window.addEventListener("pagehide", stopAllTrackedAudio);
  window.addEventListener("hay_muted_changed", (e) => {
    if (e?.detail?.muted) stopAllTrackedAudio();
  });
}

// Wrap any `new Audio(...)` with this so it gets silenced on tab hide/close
// and never plays at all while muted.
export function trackAudio(audio) {
  playing.add(audio);
  const untrack = () => playing.delete(audio);
  audio.addEventListener("ended", untrack);
  audio.addEventListener("pause", untrack);
  audio.addEventListener("error", untrack);

  const rawPlay = audio.play.bind(audio);
  audio.play = () => {
    if (isMuted()) return Promise.resolve();
    return rawPlay();
  };

  return audio;
}

// Convenience: create + track in one call, the common case.
export function newTrackedAudio(url) {
  return trackAudio(new Audio(url));
}

export { stopAllTrackedAudio };
