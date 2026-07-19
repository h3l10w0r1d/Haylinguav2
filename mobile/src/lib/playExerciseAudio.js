// src/lib/playExerciseAudio.js — plays an exercise's server-generated audio
// (GET /audio/exercise/{id}). Mirrors the priority order in the web's
// src/exercises/tts.jsx, minus the legacy /tts POST fallback (deferred —
// most content already has CMS-recorded audio).
//
// Uses react-native-nitro-sound (already installed for the speak exercise's
// recording) rather than react-native-sound: react-native-sound is
// unmaintained and was confirmed broken under this app's New Architecture
// earlier this session — taps on "Play sound"/"Tap to listen again"
// silently produced no audio (the library still resolved without erroring,
// so the UI never surfaced anything wrong). Nitro Sound is JSI/New-
// Architecture-native for both record and playback, so this switches the
// whole app to one confirmed-working audio engine instead of two.
import Sound from 'react-native-nitro-sound';
import { API_BASE_URL } from './api';

export function playExerciseAudio(exerciseId, { voice = 'female' } = {}) {
  return new Promise((resolve) => {
    const url = `${API_BASE_URL}/audio/exercise/${exerciseId}?voice=${voice}`;
    let done = false;

    function finish(ok) {
      if (done) return;
      done = true;
      clearTimeout(safety);
      try {
        Sound.removePlaybackEndListener();
      } catch {
        // no-op — nothing to clean up if it was never registered
      }
      resolve(ok);
    }

    // Never leave a caller's "Playing…" state stuck forever if the end
    // event never fires (same defensive discipline as everywhere else
    // audio touches native code in this app).
    const safety = setTimeout(() => finish(false), 15000);

    try {
      Sound.addPlaybackEndListener(() => finish(true));
      Sound.startPlayer(url).catch(() => finish(false));
    } catch {
      finish(false);
    }
  });
}
