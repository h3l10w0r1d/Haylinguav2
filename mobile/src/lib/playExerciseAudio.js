// src/lib/playExerciseAudio.js — plays an exercise's server-generated audio
// (GET /audio/exercise/{id}), falling back to live ElevenLabs TTS
// (GET /tts?text=...) when no CMS recording exists — mirrors the priority
// order in the web's src/exercises/tts.jsx. Confirmed this session that
// virtually no exercises currently have CMS-recorded audio (every one
// checked 404s), so this fallback is load-bearing, not a nice-to-have.
//
// The backend's canonical /tts is POST-only (JSON body), but
// react-native-nitro-sound's startPlayer(uri) only does GET-style fetches
// against a bare URI — no way to attach a POST body. Rather than add a
// fetch+write-local-file+play pipeline (a new native dependency just to
// bridge this), the backend also exposes a GET /tts?text=... variant that
// startPlayer() can hit directly, same as the CMS-audio URL.
import Sound from 'react-native-nitro-sound';
import { API_BASE_URL } from './api';

function playUrl(url) {
  return new Promise((resolve) => {
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

export async function playExerciseAudio(exerciseId, { voice = 'female', text } = {}) {
  const cmsUrl = `${API_BASE_URL}/audio/exercise/${exerciseId}?voice=${voice}`;
  const ok = await playUrl(cmsUrl);
  if (ok) return true;

  // startPlayer()'s naive fetch (Data(contentsOf:)) doesn't distinguish a
  // 404 body from real audio bytes, so a failed CMS lookup and a genuine
  // playback error both resolve here as `false` — falling back to TTS is
  // safe either way since it's a fresh, independent request.
  if (!text) return false;
  const ttsUrl = `${API_BASE_URL}/tts?text=${encodeURIComponent(text)}`;
  return playUrl(ttsUrl);
}
