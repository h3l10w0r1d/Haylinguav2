// src/lib/transcribeAudio.js — records a short speech clip and uploads it
// to POST /me/exercises/transcribe. Mirrors the web's ExSpeak
// (src/ExerciseRenderer.jsx:1343-1394): MediaRecorder there -> react-native-
// nitro-sound here (the actively-maintained, Nitro/New-Architecture-native
// successor to the now-deprecated react-native-audio-recorder-player — same
// API surface). api.js is JSON-only, so the upload bypasses it entirely
// with a raw fetch + FormData, exactly like the web's own multipart call.
import { Platform } from 'react-native';
import Sound from 'react-native-nitro-sound';
import { API_BASE_URL } from './api';
import { getToken } from './authStore';

let recording = false;

export async function startRecording() {
  if (recording) return;
  recording = true;
  // No path passed: a bare relative filename (e.g. 'speech.m4a') resolves
  // to a non-writable directory on iOS ("Recording setup failed: Directory
  // is not writable") — omitting `uri` lets the native module pick its own
  // writable cache/temp location, which is exactly what we want since we
  // only need the file transiently to upload it.
  await Sound.startRecorder();
}

export async function stopRecording() {
  if (!recording) return null;
  recording = false;
  const uri = await Sound.stopRecorder();
  return uri;
}

export async function cancelRecording() {
  if (!recording) return;
  recording = false;
  try {
    await Sound.stopRecorder();
  } catch {
    // already stopped/never started cleanly — nothing to clean up
  }
}

export async function transcribe(fileUri, { languageCode } = {}) {
  const token = await getToken();
  const form = new FormData();
  form.append('audio', {
    uri: fileUri,
    type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
    name: Platform.OS === 'ios' ? 'speech.m4a' : 'speech.mp4',
  });
  if (languageCode) form.append('language_code', languageCode);

  const res = await fetch(`${API_BASE_URL}/me/exercises/transcribe`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || `Transcription failed (${res.status})`);
  return data?.text || '';
}
