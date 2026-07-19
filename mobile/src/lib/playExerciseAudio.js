// src/lib/playExerciseAudio.js — plays an exercise's server-generated audio
// (GET /audio/exercise/{id}) via react-native-sound. Mirrors the priority
// order in the web's src/exercises/tts.jsx, minus the legacy /tts POST
// fallback (deferred — most content already has CMS-recorded audio).
import Sound from 'react-native-sound';
import { API_BASE_URL } from './api';

try {
  Sound.setCategory('Playback');
} catch {
  // react-native-sound is incompatible with RN's New Architecture on some
  // setups (throws instead of erroring through its callback) — never let a
  // broken audio backend crash app startup.
}

export function playExerciseAudio(exerciseId, { voice = 'female' } = {}) {
  return new Promise((resolve) => {
    try {
      const url = `${API_BASE_URL}/audio/exercise/${exerciseId}?voice=${voice}`;
      const sound = new Sound(url, undefined, (error) => {
        if (error) {
          resolve(false);
          return;
        }
        try {
          sound.play(() => {
            sound.release();
            resolve(true);
          });
        } catch {
          resolve(false);
        }
      });
    } catch {
      // Never leave a caller's "Playing…" state stuck forever if the native
      // module rejects synchronously instead of via the error callback.
      resolve(false);
    }
  });
}
