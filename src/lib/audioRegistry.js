// src/lib/audioRegistry.js — silences one-off <audio> playback (TTS
// pronunciation, exercise sound effects, replays) the instant the tab is
// backgrounded or closed. Browsers keep playing HTMLAudioElements in a
// hidden/background tab by default, so without this a clip just plays out
// even after the learner has switched away.
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
}

// Wrap any `new Audio(...)` with this so it gets silenced on tab hide/close.
export function trackAudio(audio) {
  playing.add(audio);
  const untrack = () => playing.delete(audio);
  audio.addEventListener("ended", untrack);
  audio.addEventListener("pause", untrack);
  audio.addEventListener("error", untrack);
  return audio;
}

// Convenience: create + track in one call, the common case.
export function newTrackedAudio(url) {
  return trackAudio(new Audio(url));
}

export { stopAllTrackedAudio };
