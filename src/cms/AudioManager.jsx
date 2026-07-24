// src/cms/AudioManager.jsx
import { useState, useEffect, useRef } from "react";
import { Mic, Square, Upload, Play, Pause, Trash2, Loader, Check, AlertCircle, X } from "lucide-react";
import { newTrackedAudio } from "../lib/audioRegistry";
import { getCmsToken } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function cmsHeaders(extra = {}) {
  const t = getCmsToken();
  return {
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...extra,
  };
}

// Avoid dynamic tailwind class names (Tailwind purge will remove them in prod).
const STYLE = {
  female: {
    panel: "rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-5",
    title: "text-lg font-display font-bold text-slate-900 mb-4",
    primaryBtn: "btn3d btn3d-brand text-sm w-full",
  },
  male: {
    panel: "rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-5",
    title: "text-lg font-display font-bold text-slate-900 mb-4",
    primaryBtn: "btn3d btn3d-brand text-sm w-full",
  },
};

export default function AudioManager({ exerciseId, exerciseText, targetKey = null, onClose }) {
  const [audio, setAudio] = useState({ male: null, female: null });
  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState({ male: false, female: false });
  const [uploading, setUploading] = useState({ male: false, female: false });
  const [recording, setRecording] = useState({ male: false, female: false });

  const [playing, setPlaying] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mediaRecorderRef = useRef({});
  const audioChunksRef = useRef({});
  const audioPlayerRef = useRef({});

  useEffect(() => {
    loadAudio();
    return () => {
      Object.values(mediaRecorderRef.current).forEach((recorder) => {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      });
      Object.values(audioPlayerRef.current).forEach((player) => {
        if (player) player.pause();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  async function loadAudio() {
    setLoading(true);
    setError("");
    try {
      const url = targetKey
        ? `${API_BASE}/cms/audio/targets/${exerciseId}?target_key=${encodeURIComponent(targetKey)}`
        : `${API_BASE}/cms/exercises/${exerciseId}/audio`;
      const res = await fetch(url, {
        headers: cmsHeaders(),
      });

      // If backend returns non-json error, guard it:
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.detail || `Failed to load audio (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const recordings = targetKey ? data?.targets || [] : data?.audio_recordings || [];
      setAudio({
        male: recordings.find((r) => r.voice_type === "male") || null,
        female: recordings.find((r) => r.voice_type === "female") || null,
      });
    } catch (err) {
      setError(err?.message || "Failed to load audio");
    } finally {
      setLoading(false);
    }
  }

  async function generateTTS(voiceType) {
    if (!exerciseText || !String(exerciseText).trim()) {
      setError("No text available for TTS generation (exerciseText is empty).");
      return;
    }

    setGenerating((prev) => ({ ...prev, [voiceType]: true }));
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        targetKey ? `${API_BASE}/cms/audio/targets/generate-tts` : `${API_BASE}/cms/audio/generate-tts`,
        {
        method: "POST",
        headers: cmsHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          exercise_id: exerciseId,
          ...(targetKey ? { target_key: targetKey } : {}),
          text: exerciseText,
          voice_type: voiceType,
        }),
        }
      );

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.detail || `Generation failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setSuccess(`${voiceType} AI voice generated!`);
      await loadAudio();
    } catch (err) {
      setError(err?.message || "Generation failed");
    } finally {
      setGenerating((prev) => ({ ...prev, [voiceType]: false }));
    }
  }

  async function uploadFile(voiceType, file) {
    if (!file) return;

    const allowedTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Use MP3, WAV, OGG, or WEBM.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10MB.");
      return;
    }

    setUploading((prev) => ({ ...prev, [voiceType]: true }));
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("exercise_id", String(exerciseId));
      formData.append("voice_type", voiceType);
      if (targetKey) formData.append("target_key", String(targetKey));
      formData.append("audio_file", file);

      const res = await fetch(
        targetKey ? `${API_BASE}/cms/audio/targets/upload` : `${API_BASE}/cms/audio/upload`,
        {
        method: "POST",
        headers: cmsHeaders(), // token only, do NOT set Content-Type for FormData
        body: formData,
        }
      );

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.detail || `Upload failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setSuccess(`${voiceType} audio uploaded!`);
      await loadAudio();
    } catch (err) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [voiceType]: false }));
    }
  }

  async function startRecording(voiceType) {
    setError("");
    setSuccess("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      audioChunksRef.current[voiceType] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current[voiceType].push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current[voiceType], { type: "audio/webm" });
          await saveRecording(voiceType, audioBlob);
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current[voiceType] = mediaRecorder;
      setRecording((prev) => ({ ...prev, [voiceType]: true }));
    } catch {
      setError("Microphone access denied or not available.");
    }
  }

  function stopRecording(voiceType) {
    const recorder = mediaRecorderRef.current[voiceType];
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      setRecording((prev) => ({ ...prev, [voiceType]: false }));
    }
  }

  async function saveRecording(voiceType, audioBlob) {
    setUploading((prev) => ({ ...prev, [voiceType]: true }));
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("exercise_id", String(exerciseId));
      if (targetKey) formData.append("target_key", String(targetKey));
      formData.append("voice_type", voiceType);
      formData.append("audio_file", audioBlob, "recording.webm");

      const res = await fetch(
        targetKey ? `${API_BASE}/cms/audio/targets/save-recording` : `${API_BASE}/cms/audio/save-recording`,
        {
        method: "POST",
        headers: cmsHeaders(),
        body: formData,
        }
      );

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.detail || `Save failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setSuccess(`${voiceType} recording saved!`);
      await loadAudio();
    } catch (err) {
      setError(err?.message || "Save failed");
    } finally {
      setUploading((prev) => ({ ...prev, [voiceType]: false }));
    }
  }

  function playAudio(audioId, voiceType) {
    if (playing === audioId) {
      audioPlayerRef.current[voiceType]?.pause();
      setPlaying(null);
      return;
    }

    Object.values(audioPlayerRef.current).forEach((p) => p?.pause());

    const player = newTrackedAudio(
      `${API_BASE}${targetKey ? "/cms/audio/targets" : "/cms/audio"}/${audioId}/preview`
    );
    player.onended = () => setPlaying(null);
    player.onerror = () => setError("Playback failed.");

    audioPlayerRef.current[voiceType] = player;
    setPlaying(audioId);
    player.play();
  }

  async function deleteAudio(audioId) {
    if (!confirm("Delete this audio?")) return;

    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `${API_BASE}${targetKey ? "/cms/audio/targets" : "/cms/audio"}/${audioId}`,
        {
        method: "DELETE",
        headers: cmsHeaders(),
        }
      );

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.detail || `Delete failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setSuccess("Audio deleted");
      await loadAudio();
    } catch (err) {
      setError(err?.message || "Failed to delete");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold text-slate-900">Audio Manager</h2>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-cardinal-50 ring-1 ring-cardinal-200 rounded-2xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-cardinal-600 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-cardinal-700">{error}</span>
          <button onClick={() => setError("")} className="ml-auto">
            <X className="w-4 h-4 text-cardinal-600" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-grass-50 ring-1 ring-grass-200 rounded-2xl flex items-start gap-2">
          <Check className="w-5 h-5 text-grass-600 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-grass-700">{success}</span>
          <button onClick={() => setSuccess("")} className="ml-auto">
            <X className="w-4 h-4 text-grass-600" />
          </button>
        </div>
      )}

      {exerciseText ? (
        <div className="mb-6 p-4 bg-brand-50 ring-1 ring-brand-200 rounded-2xl">
          <div className="text-xs font-extrabold text-brand-700 mb-1">EXERCISE TEXT FOR TTS:</div>
          <div className="text-sm text-brand-900">{exerciseText}</div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-amber-50 ring-1 ring-amber-200 rounded-2xl">
          <div className="text-xs font-extrabold text-amber-700 mb-1">WARNING:</div>
          <div className="text-sm text-amber-900">
            exerciseText is empty → AI generation is disabled. Make sure you pass the text into AudioManager.
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <VoicePanel
          voiceType="female"
          audio={audio.female}
          generating={generating.female}
          uploading={uploading.female}
          recording={recording.female}
          playing={playing}
          canGenerate={!!String(exerciseText || "").trim()}
          onGenerateTTS={() => generateTTS("female")}
          onUpload={(e) => uploadFile("female", e.target.files?.[0])}
          onStartRecord={() => startRecording("female")}
          onStopRecord={() => stopRecording("female")}
          onPlay={(id) => playAudio(id, "female")}
          onDelete={deleteAudio}
        />

        <VoicePanel
          voiceType="male"
          audio={audio.male}
          generating={generating.male}
          uploading={uploading.male}
          recording={recording.male}
          playing={playing}
          canGenerate={!!String(exerciseText || "").trim()}
          onGenerateTTS={() => generateTTS("male")}
          onUpload={(e) => uploadFile("male", e.target.files?.[0])}
          onStartRecord={() => startRecording("male")}
          onStopRecord={() => stopRecording("male")}
          onPlay={(id) => playAudio(id, "male")}
          onDelete={deleteAudio}
        />
      </div>
    </div>
  );
}

function VoicePanel({
  voiceType,
  audio,
  generating,
  uploading,
  recording,
  playing,
  canGenerate,
  onGenerateTTS,
  onUpload,
  onStartRecord,
  onStopRecord,
  onPlay,
  onDelete,
}) {
  const s = STYLE[voiceType];
  const label = voiceType.charAt(0).toUpperCase() + voiceType.slice(1);

  return (
    <div className={s.panel}>
      <h3 className={s.title}>{label} Voice</h3>

      {audio && (
        <div className="mb-4 p-3 bg-slate-50 rounded-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-extrabold text-slate-700">
              {audio.source_type === "tts"
                ? "🤖 AI Generated"
                : audio.source_type === "recording"
                ? "🎙️ Recorded"
                : "📁 Uploaded"}
            </div>
            <div className="text-xs text-slate-500">{(audio.audio_size / 1024).toFixed(1)} KB</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPlay(audio.id)}
              className={`flex-1 ${s.primaryBtn}`}
            >
              {playing === audio.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing === audio.id ? "Stop" : "Play"}
            </button>

            <button
              onClick={() => onDelete(audio.id)}
              className="btn3d btn3d-cardinal text-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={onGenerateTTS}
          disabled={generating || !canGenerate}
          className={s.primaryBtn}
          title={!canGenerate ? "exerciseText is empty" : ""}
        >
          {generating ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Generating AI Voice...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Generate AI Voice
            </>
          )}
        </button>

        <button
          onClick={recording ? onStopRecord : onStartRecord}
          disabled={uploading}
          className={`text-sm w-full ${recording ? "btn3d btn3d-cardinal" : s.primaryBtn}`}
        >
          {recording ? (
            <>
              <Square className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Record from Mic
            </>
          )}
        </button>

        <label
          className={`${s.primaryBtn} cursor-pointer`}
        >
          {uploading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Audio File
            </>
          )}

          <input type="file" accept="audio/*" onChange={onUpload} disabled={uploading} className="hidden" />
        </label>
      </div>
    </div>
  );
}
