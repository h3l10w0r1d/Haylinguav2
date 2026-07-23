// src/cms/CmsSttLab.jsx — A/B compare STT providers (hispeech.ai, Azure,
// ElevenLabs Scribe) on the same Armenian recording. The live endpoint
// (routes_audio.py's transcribe_speech) already routes by utterance length
// based on an A/B session here: Azure for 1-2 word answers, hispeech.ai for
// full sentences, ElevenLabs Scribe as the last-resort fallback for both.
import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Mic, Square, Loader2 } from "lucide-react";
import { getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const PROVIDERS = [
  { key: "hispeech", label: "hispeech.ai", hint: "live default for full sentences" },
  { key: "azure", label: "Azure AI Speech", hint: "live default for 1-2 word answers" },
  { key: "elevenlabs", label: "ElevenLabs Scribe", hint: "last-resort fallback for both" },
];

export default function CmsSttLab() {
  const token = getCmsToken();

  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [clipUrl, setClipUrl] = useState("");

  const streamRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function startRecording() {
    setError("");
    setResults(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (clipUrl) URL.revokeObjectURL(clipUrl);
        setClipUrl(URL.createObjectURL(blob));
        if (blob.size) await compare(blob);
      };
      mrRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    mrRef.current?.stop();
    setRecording(false);
  }

  async function compare(blob) {
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");
      const res = await fetch(`${API_BASE}/cms/stt/compare`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      setResults(await res.json());
    } catch (e) {
      setError(e.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CmsLayout active="stt-lab" title="STT Lab">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Record a single word or a full sentence in Armenian, and see what hispeech.ai, Azure AI
          Speech, and ElevenLabs Scribe each transcribe it as. The live app already routes by
          length (Azure for 1-2 word answers, hispeech.ai for sentences) based on an earlier
          session here — keep using this to sanity-check that split, or to re-tune the word-count
          cutoff (SHORT_UTTERANCE_MAX_WORDS in routes_audio.py) if it stops holding up.
        </div>

        {error ? (
          <div className="rounded-xl bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
            className={
              "btn3d mx-auto w-fit uppercase " +
              (recording ? "btn3d-cardinal" : "btn3d-brand")
            }
          >
            {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {recording ? "Stop recording" : "Record a clip"}
          </button>

          {clipUrl ? (
            <audio className="mx-auto mt-4 w-full max-w-sm" controls src={clipUrl} />
          ) : null}

          {loading ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Transcribing with every provider…
            </div>
          ) : null}
        </div>

        {results ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <div key={p.key} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="font-display text-sm font-extrabold text-slate-800">{p.label}</div>
                <div className="text-[11px] font-semibold text-slate-400">{p.hint}</div>
                <div dir="auto" className="mt-3 min-h-[3rem] text-base font-bold text-slate-800">
                  {results[p.key] || <span className="text-slate-300">—</span>}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </CmsLayout>
  );
}
