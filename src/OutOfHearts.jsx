// src/OutOfHearts.jsx — shown in a lesson when the learner runs out of hearts.
import React, { useEffect, useState, useRef } from "react";
import { Heart, Crown, Dumbbell, Loader2, X } from "lucide-react";
import grandma from "./assets/character-grandma.png";
import ExerciseRenderer from "./ExerciseRenderer";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}
function fmt(total) {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Inline mini-practice: answer review exercises to earn a heart back. Progress
 *  is driven by the server (/me/hearts/earn), so it can't be gamed client-side. */
function HeartPractice({ onEarned, onCancel }) {
  const [phase, setPhase] = useState("loading"); // loading | practicing | granting | empty | error
  const [exercises, setExercises] = useState([]);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [required, setRequired] = useState(5);
  const busyRef = useRef(false);

  // Load a batch of review exercises and the current earn-progress.
  useEffect(() => {
    const token = getToken();
    Promise.all([
      fetch(`${API_BASE}/me/practice`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : { exercises: [] })),
      fetch(`${API_BASE}/me/hearts/earn`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([prac, earn]) => {
        if (earn?.granted) { onEarned?.(earn); return; }
        if (earn) { setProgress(earn.progress || 0); setRequired(earn.required || 5); }
        const exs = (prac?.exercises || []).filter((e) => e && e.kind !== "reading_section");
        if (exs.length === 0) { setPhase("empty"); return; }
        setExercises(exs);
        setPhase("practicing");
      })
      .catch(() => setPhase("error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnswer(payload = {}) {
    if (busyRef.current) return;
    // Info cards auto-advance and don't count toward the heart.
    if (payload.autoAdvance) { advance(); return; }
    busyRef.current = true;

    if (payload.isCorrect) {
      // Ask the server whether this correct answer earned the heart yet.
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/me/hearts/earn`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = res.ok ? await res.json() : null;
        if (d?.granted) { setPhase("granting"); onEarned?.(d); return; }
        if (d) { setProgress(d.progress || 0); setRequired(d.required || required); }
      } catch { /* keep practicing */ }
    }
    busyRef.current = false;
    advance();
  }

  function advance() {
    setIdx((i) => {
      const next = i + 1;
      // Loop back through the batch if the learner needs more reps.
      return next >= exercises.length ? 0 : next;
    });
  }

  if (phase === "loading" || phase === "granting") {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-10 text-center ring-1 ring-slate-200 shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
        <p className="mt-3 font-semibold text-slate-500">
          {phase === "granting" ? "Heart earned! 💚" : "Loading practice…"}
        </p>
      </div>
    );
  }

  if (phase === "empty" || phase === "error") {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
        <p className="font-semibold text-slate-600">
          {phase === "empty" ? "No review exercises available right now." : "Couldn’t load practice."}
        </p>
        <button onClick={onCancel} className="btn3d btn3d-neutral mt-4 w-full uppercase">Back</button>
      </div>
    );
  }

  const ex = exercises[idx];
  const pct = Math.min(100, Math.round((progress / Math.max(1, required)) * 100));

  return (
    <div className="mx-auto max-w-lg">
      {/* Earn progress header */}
      <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-sm font-extrabold text-slate-700">
            <Heart className="h-5 w-5 fill-cardinal-500 text-cardinal-500" />
            Answer {required} correctly to earn a heart
          </div>
          <button onClick={onCancel} aria-label="Cancel practice" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-3 rounded-full bg-grass-500 transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <div className="mt-1 text-right text-xs font-bold text-slate-400">{progress}/{required}</div>
      </div>

      {/* One review exercise at a time */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
        {ex ? (
          <ExerciseRenderer
            key={`${ex.id}-${idx}`}
            exercise={ex}
            apiBaseUrl={API_BASE}
            onAnswer={handleAnswer}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function OutOfHearts({ nextRegenSeconds = 0, onGoPremium, onBack, onRefilled }) {
  const [remaining, setRemaining] = useState(nextRegenSeconds || 0);
  const [practicing, setPracticing] = useState(false);

  useEffect(() => {
    setRemaining(nextRegenSeconds || 0);
  }, [nextRegenSeconds]);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Once the timer reaches 0, keep polling the server until a heart is actually
  // back. The server is the source of truth — if it regenerated one we unlock
  // immediately; if not yet, we resync our countdown from its ETA and wait.
  useEffect(() => {
    if (practicing || remaining > 0) return;
    const token = getToken();
    if (!token) return;

    let stopped = false;
    const check = () => {
      fetch(`${API_BASE}/me/hearts`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (stopped || !d) return;
          const cur = Number(d.current ?? d.hearts_current ?? 0);
          if (d.is_premium || cur >= 1) {
            onRefilled?.(d); // a heart is available — parent dismisses the gate
          } else {
            const eta = Number(d.next_regen_seconds ?? 0);
            if (eta > 0) setRemaining(eta); // resume an accurate countdown
          }
        })
        .catch(() => {});
    };

    check(); // immediate check the moment we hit 0
    const id = setInterval(check, 10000); // then retry until refilled
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [remaining === 0, practicing, onRefilled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (practicing) {
    return (
      <HeartPractice
        onEarned={(state) => {
          // Normalize to the hearts event shape the app listens for.
          onRefilled?.({
            current: state.hearts_current,
            hearts_current: state.hearts_current,
            hearts_max: state.hearts_max,
            is_premium: state.is_premium,
            next_regen_seconds: state.next_regen_seconds,
          });
        }}
        onCancel={() => setPracticing(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
      <img src={grandma} alt="" className="mx-auto h-24 w-24 rounded-3xl object-cover" />

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Heart key={i} className="h-6 w-6 fill-slate-200 text-slate-200" />
        ))}
      </div>

      <h2 className="mt-4 font-display text-2xl font-extrabold text-slate-800">You’re out of hearts!</h2>
      <p className="mt-1 font-semibold text-slate-500">
        {remaining > 0 ? (
          <>Next heart in <span className="font-display font-extrabold text-cardinal-500">{fmt(remaining)}</span></>
        ) : (
          "A heart should be ready — checking…"
        )}
      </p>

      <div className="mt-6 space-y-3">
        <button onClick={() => setPracticing(true)} className="btn3d btn3d-grass w-full uppercase">
          <Dumbbell className="h-5 w-5" /> Practice to earn a heart
        </button>
        <button onClick={onGoPremium} className="btn3d btn3d-brand w-full uppercase">
          <Crown className="h-5 w-5" /> Get unlimited hearts
        </button>
        <button onClick={onBack} className="btn3d btn3d-neutral w-full uppercase">
          Back to learning
        </button>
      </div>
    </div>
  );
}
