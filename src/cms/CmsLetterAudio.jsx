// src/cms/CmsLetterAudio.jsx — record real human pronunciation for every
// Armenian alphabet letter, male + female, in one flat list instead of
// hunting through each letter's lesson editor one at a time.
//
// Zero backend/schema changes beyond the new GET /cms/letters listing
// endpoint: this reuses the exact exercise_audio_targets (target_key=
// "letter") + AudioManager plumbing that char_intro exercises already had
// available one at a time via AudioTargetsManager. The learner-facing
// playback pipeline (src/exercises/tts.jsx ttsFetch, called from
// ExerciseRenderer's ExCharIntro) already prefers this recorded audio over
// live TTS — so recording a letter here fixes its pronunciation in the app
// immediately, with no other code changes.
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Check, Loader2, Mic } from "lucide-react";
import { getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";
import AudioManager from "./AudioManager";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function CmsLetterAudio() {
  const token = getCmsToken();

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/cms/letters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setLetters(data?.letters || []);
    } catch (e) {
      setError(e.message || "Failed to load letters");
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <Navigate to="/cms/login" replace />;

  const doneCount = letters.filter((l) => l.has_male && l.has_female).length;

  return (
    <CmsLayout active="letter-audio" title="Letter Audio">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Record a real human saying each Armenian letter, in both a male and a
          female voice. Once recorded, the app plays this instead of the live
          TTS voice for that letter — no other changes needed.
          {letters.length > 0 && (
            <span className="ml-1 font-extrabold">
              {doneCount}/{letters.length} letters fully recorded.
            </span>
          )}
        </div>

        {error ? (
          <div className="rounded-xl bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading letters…
          </div>
        ) : (
          <div className="grid gap-2">
            {letters.map((l) => (
              <div
                key={l.exercise_id}
                className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div dir="auto" className="font-display text-3xl font-extrabold text-slate-800">
                    {l.letter}
                    {l.lower && l.lower !== l.letter ? (
                      <span className="text-slate-300"> / {l.lower}</span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-400">
                      {l.transliteration ? `"${l.transliteration}" · ` : ""}
                      {l.lesson_title}
                    </div>
                    <div className="mt-1 flex gap-2">
                      <VoiceBadge label="Female" done={l.has_female} />
                      <VoiceBadge label="Male" done={l.has_male} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActive(l)}
                  className="btn3d btn3d-brand shrink-0 text-sm"
                >
                  <Mic className="h-4 w-4" /> Manage audio
                </button>
              </div>
            ))}

            {letters.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                No char_intro letter exercises found yet.
              </div>
            ) : null}
          </div>
        )}

        {active ? (
          <AudioManager
            exerciseId={active.exercise_id}
            exerciseText={active.letter}
            targetKey="letter"
            onClose={() => {
              setActive(null);
              load();
            }}
          />
        ) : null}
      </div>
    </CmsLayout>
  );
}

function VoiceBadge({ label, done }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold " +
        (done ? "bg-grass-50 text-grass-700" : "bg-slate-100 text-slate-400")
      }
    >
      {done ? <Check className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}
