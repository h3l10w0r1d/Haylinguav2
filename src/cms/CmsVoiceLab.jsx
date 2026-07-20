// src/cms/CmsVoiceLab.jsx — A/B compare ElevenLabs voices + settings for Armenian.
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Play, Loader2, Star, Volume2 } from "lucide-react";
import CmsLayout from "./CmsLayout";
import { newTrackedAudio } from "../lib/audioRegistry";

const TEST_PHRASES = [
  "Բարև ձեզ, ինչպե՞ս եք: Ես Արամն եմ, ձեր հայերենի ուսուցիչը:",
  "Այսօր եղանակը շատ գեղեցիկ է, եկեք զբոսնենք զբոսայգում:",
  "Կներեք, կարո՞ղ եք կրկնել: Ես լավ չհասկացա:",
  "Շնորհակալություն օգնության համար, դուք իսկապես բարի եք:",
];

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

function Slider({ label, value, onChange, hint }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="font-mono text-xs font-bold text-brand-600">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand-500"
      />
      {hint ? <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div> : null}
    </label>
  );
}

export default function CmsVoiceLab() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [voices, setVoices] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_v3");
  const [text, setText] = useState(TEST_PHRASES[0]);
  const [stability, setStability] = useState(0.45);
  const [similarity, setSimilarity] = useState(0.8);
  const [style, setStyle] = useState(0.25);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rated, setRated] = useState({}); // voiceId -> note text
  const audioRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    api
      .listVoices()
      .then((d) => {
        setVoices(d.voices || []);
        setCurrent(d);
        if (!voiceId && d.current_default_voice_id) setVoiceId(d.current_default_voice_id);
        if (d.current_model_id) setModelId(d.current_model_id);
        if (d.current_voice_settings) {
          setStability(d.current_voice_settings.stability ?? 0.45);
          setSimilarity(d.current_voice_settings.similarity_boost ?? 0.8);
          setStyle(d.current_voice_settings.style ?? 0.25);
          setSpeakerBoost(d.current_voice_settings.use_speaker_boost ?? true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function play() {
    if (!voiceId || !text.trim() || playing) return;
    setPlaying(true);
    setError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com"}/tts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            text: text.trim(),
            voice_id: voiceId,
            model_id: modelId,
            voice_settings: {
              stability,
              similarity_boost: similarity,
              style,
              use_speaker_boost: speakerBoost,
            },
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = newTrackedAudio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (e) {
      setError(e.message || "Playback failed");
      setPlaying(false);
    }
  }

  const selectedVoice = voices.find((v) => v.voice_id === voiceId);
  const isCurrentDefault = current?.current_default_voice_id === voiceId;

  return (
    <CmsLayout active="voice-lab" title="Voice Lab">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Compare ElevenLabs voices for Armenian speech. Pick a voice, adjust the sliders, hit Play,
          and listen. Once you find one that sounds right, tell Claude the voice name/ID and settings
          to lock in as the new default across the app.
        </div>

        {error ? (
          <div className="rounded-xl bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading voices…
          </div>
        ) : (
          <>
            {/* Voice picker */}
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-3 font-display text-sm font-extrabold text-slate-800">
                Voice ({voices.length} available)
              </div>
              <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {voices.map((v) => (
                  <button
                    key={v.voice_id}
                    onClick={() => setVoiceId(v.voice_id)}
                    className={
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-2 transition " +
                      (voiceId === v.voice_id
                        ? "bg-brand-50 text-brand-700 ring-brand-400"
                        : "bg-slate-50 text-slate-700 ring-transparent hover:ring-slate-200")
                    }
                  >
                    <Volume2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{v.name}</span>
                    {v.voice_id === current?.current_default_voice_id ? (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-gold-400 text-gold-500" />
                    ) : null}
                  </button>
                ))}
              </div>
              {selectedVoice ? (
                <div className="mt-2 text-xs font-mono text-slate-400">{selectedVoice.voice_id}</div>
              ) : null}
              {isCurrentDefault ? (
                <div className="mt-1 text-xs font-bold text-gold-600">★ Current app default</div>
              ) : null}
            </div>

            {/* Test text */}
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-2 font-display text-sm font-extrabold text-slate-800">Test phrase</div>
              <div className="mb-2 flex flex-wrap gap-2">
                {TEST_PHRASES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setText(p)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    Phrase {i + 1}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                dir="auto"
                className={inputCls}
              />
            </div>

            {/* Settings */}
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-3 font-display text-sm font-extrabold text-slate-800">Voice settings</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Slider label="Stability" value={stability} onChange={setStability} hint="Lower = more expressive, higher = more monotone/consistent" />
                <Slider label="Similarity" value={similarity} onChange={setSimilarity} hint="How closely it matches the original voice" />
                <Slider label="Style" value={style} onChange={setStyle} hint="0 = flat/robotic, higher = more natural inflection" />
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={speakerBoost} onChange={(e) => setSpeakerBoost(e.target.checked)} />
                Speaker boost
              </label>
              <div className="mt-3">
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Model</label>
                <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={inputCls + " mt-1"}>
                  <option value="eleven_v3">eleven_v3 (most expressive, best multilingual)</option>
                  <option value="eleven_multilingual_v2">eleven_multilingual_v2 (more mature/stable)</option>
                  <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 (fastest, lower quality)</option>
                </select>
              </div>
            </div>

            <button
              onClick={play}
              disabled={playing || !voiceId || !text.trim()}
              className="btn3d btn3d-brand w-full uppercase"
            >
              {playing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              {playing ? "Playing…" : "Play"}
            </button>
          </>
        )}
      </div>
    </CmsLayout>
  );
}
