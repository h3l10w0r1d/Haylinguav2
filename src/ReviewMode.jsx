// src/ReviewMode.jsx — Spaced-repetition review session (SM-2)
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, ChevronLeft, CheckCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const QUALITY = [
  { value: 1, label: "Again",  color: "bg-red-500   shadow-[0_4px_0_0_#b91c1c]",   text: "Forgot it" },
  { value: 3, label: "Hard",   color: "bg-amber-500 shadow-[0_4px_0_0_#b45309]",   text: "Struggled" },
  { value: 4, label: "Good",   color: "bg-emerald-500 shadow-[0_4px_0_0_#047857]", text: "Got it" },
  { value: 5, label: "Easy",   color: "bg-blue-500  shadow-[0_4px_0_0_#1d4ed8]",   text: "Perfect" },
];

function authHeader() {
  const t = localStorage.getItem("hay_token") || localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchDueCards() {
  const res = await fetch(`${API_BASE}/me/review?limit=20`, { headers: authHeader() });
  if (!res.ok) throw new Error("Failed to load review cards");
  return res.json();
}

async function submitReview(exercise_id, quality) {
  const res = await fetch(`${API_BASE}/me/review/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ exercise_id, quality }),
  });
  if (!res.ok) throw new Error("Failed to submit review");
  return res.json();
}

// ── Card display helpers ────────────────────────────────────────────────────

function AudioButton({ src }) {
  if (!src) return null;
  return (
    <button
      onClick={() => new Audio(src).play().catch(() => {})}
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-200 transition"
    >
      <Volume2 size={14} /> Play audio
    </button>
  );
}

function ExerciseView({ card, revealed }) {
  const config = (() => { try { return JSON.parse(card.config || "{}"); } catch { return {}; } })();
  const kind = card.kind;

  // ── Flashcard ─────────────────────────────────────────────────────────────
  if (kind === "flashcard") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Flashcard</p>
        <p className="text-2xl font-extrabold text-slate-800">{config.front || card.prompt}</p>
        {revealed && (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-6 py-4 ring-1 ring-emerald-200">
            <p className="text-xl font-bold text-emerald-800">{config.back || card.expected_answer}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Translate / type answer ───────────────────────────────────────────────
  if (kind === "translate" || kind === "listen_type" || kind === "listen_type_am") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {kind.startsWith("listen") ? "Listen & translate" : "Translate"}
        </p>
        {config.audio_url && <AudioButton src={config.audio_url} />}
        {!kind.startsWith("listen") && (
          <p className="text-2xl font-extrabold text-slate-800">{card.prompt}</p>
        )}
        {revealed && (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-6 py-4 ring-1 ring-emerald-200">
            <p className="font-semibold text-slate-500 text-sm mb-1">Correct answer</p>
            <p className="text-xl font-bold text-emerald-800">{card.expected_answer}</p>
          </div>
        )}
      </div>
    );
  }

  // ── MCQ / char_mcq / etc. ─────────────────────────────────────────────────
  const correctOpt = (card.options || []).find(o => o.is_correct);
  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {card.lesson_title || "Review"}
      </p>
      {config.audio_url && <AudioButton src={config.audio_url} />}
      <p className="text-2xl font-extrabold text-slate-800">{card.prompt}</p>
      {revealed && correctOpt && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-6 py-4 ring-1 ring-emerald-200">
          <p className="font-semibold text-slate-500 text-sm mb-1">Correct answer</p>
          <p className="text-xl font-bold text-emerald-800">{correctOpt.text}</p>
        </div>
      )}
    </div>
  );
}

// ── Completion screen ───────────────────────────────────────────────────────

function CompletionScreen({ total, onDone }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-50/40 to-white px-4">
      <div className="rounded-3xl bg-white px-10 py-10 text-center shadow-sm ring-1 ring-slate-200 max-w-sm w-full">
        <CheckCircle className="mx-auto mb-4 text-emerald-500" size={52} strokeWidth={1.5} />
        <h2 className="font-display text-2xl font-extrabold text-slate-800">
          Session complete!
        </h2>
        <p className="mt-2 text-slate-500">
          You reviewed <span className="font-bold text-slate-700">{total}</span>{" "}
          {total === 1 ? "card" : "cards"}.
        </p>
        <p className="mt-1 text-sm text-slate-400">Cards will return based on how well you knew them.</p>
        <button
          onClick={onDone}
          className="mt-7 w-full rounded-2xl bg-brand-500 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_0_#c2410c] transition active:translate-y-0.5"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ReviewMode() {
  const navigate = useNavigate();
  const [cards, setCards]       = useState([]);
  const [idx, setIdx]           = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    fetchDueCards()
      .then(data => {
        setCards(data.cards || []);
        setLoading(false);
        if (!data.cards?.length) setDone(true);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const handleReveal = useCallback(() => setRevealed(true), []);

  const handleQuality = useCallback(async (quality) => {
    if (submitting || !cards[idx]) return;
    setSubmitting(true);
    try {
      await submitReview(cards[idx].id, quality);
    } catch {
      // swallow — card still advances
    }
    setReviewed(r => r + 1);
    const nextIdx = idx + 1;
    if (nextIdx >= cards.length) {
      setDone(true);
    } else {
      setIdx(nextIdx);
      setRevealed(false);
    }
    setSubmitting(false);
  }, [submitting, cards, idx]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-600">{error}</p>
        <button onClick={() => navigate("/dashboard")} className="text-brand-600 font-bold underline text-sm">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (done) {
    return <CompletionScreen total={reviewed} onDone={() => navigate("/dashboard")} />;
  }

  const card = cards[idx];
  const progress = ((idx) / cards.length) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50/30 to-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 sm:px-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-3 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-bold text-slate-500 tabular-nums">
          {idx + 1} / {cards.length}
        </span>
      </header>

      {/* Card */}
      <div className="mx-auto w-full max-w-lg flex-1 flex flex-col justify-center px-4 pb-8 sm:px-6">
        <div className="rounded-3xl bg-white px-6 py-10 shadow-sm ring-1 ring-slate-200 min-h-[220px] flex flex-col items-center justify-center">
          <ExerciseView card={card} revealed={revealed} />
        </div>

        {/* Action area */}
        <div className="mt-6">
          {!revealed ? (
            <button
              onClick={handleReveal}
              className="w-full rounded-2xl bg-brand-500 py-3.5 text-base font-extrabold text-white shadow-[0_4px_0_0_#c2410c] transition active:translate-y-0.5"
            >
              Reveal answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {QUALITY.map(q => (
                <button
                  key={q.value}
                  disabled={submitting}
                  onClick={() => handleQuality(q.value)}
                  className={`flex flex-col items-center rounded-2xl ${q.color} py-3 text-white transition active:translate-y-0.5 disabled:opacity-60`}
                >
                  <span className="text-sm font-extrabold">{q.label}</span>
                  <span className="mt-0.5 text-[10px] font-semibold opacity-80">{q.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SR hint */}
        {revealed && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Rate how well you remembered — this adjusts when you'll see it next.
          </p>
        )}
      </div>
    </div>
  );
}
