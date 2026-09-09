// src/ArmenianTypingPage.jsx — free, no-signup Armenian typing trainer with
// live multiplayer races. Public page; a logged-in Haylingua user is picked
// up automatically from the usual hay_token and races under their real name,
// but nothing here requires an account.
//
// VISUAL NOTE: this page deliberately breaks from the site's light, rounded
// marketing look and runs its own self-contained dark "web3" treatment
// (neon glow, glass panels, animated gradient, mono type). It's a tool, not
// a marketing page, and it sits at its own URL — so it opts out of SiteNav's
// theme rather than fighting it. Everything is scoped to this file; no
// global styles are touched.
//
// KEYBOARD-LAYOUT CAVEAT: the on-screen keyboard below reuses the
// ALPHABETICAL letter grid from src/exercises/ArmenianKeyboard.jsx, which is
// a character picker, not the physical Armenian keyboard layout. That means
// this teaches "which letter comes next and how to type it" — it does NOT
// yet build muscle memory for a real Armenian keyboard layout, because we
// haven't confirmed which layout (standard Eastern vs a phonetic one)
// Haylingua wants to teach. Swapping KEY_ROWS for a real layout map is the
// only change needed once that's decided.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Keyboard, Zap, Trophy, Users, RotateCcw, ChevronRight, Wifi, WifiOff } from "lucide-react";
import usePageMeta from "./lib/usePageMeta";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  try {
    return localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "";
  } catch {
    return "";
  }
}

// Same grid as the in-app character picker (see file header caveat).
const KEY_ROWS = [
  ["ա", "բ", "գ", "դ", "ե", "զ", "է", "ը", "թ", "ժ", "ի", "լ", "խ"],
  ["ծ", "կ", "հ", "ձ", "ղ", "ճ", "մ", "յ", "ն", "շ", "ո", "չ", "պ"],
  ["ջ", "ռ", "ս", "վ", "տ", "ր", "ց", "ւ", "փ", "ք", "օ", "ֆ", "և"],
];

const FALLBACK_TEXTS = [
  "Բարև ձեզ, ինչպես եք այսօր",
  "Ես սովորում եմ հայերեն ամեն օր",
  "Այսօր եղանակը շատ լավ է",
];

// ── Typing engine (shared by practice + race) ─────────────────────────────
function useTypingRun(target) {
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const [errors, setErrors] = useState(0);

  const reset = useCallback(() => {
    setTyped(""); setStartedAt(null); setKeystrokes(0); setErrors(0);
  }, []);

  const onChange = useCallback((next) => {
    if (!target) return;
    // Never let the learner type past the end of the passage.
    const clipped = next.slice(0, target.length);
    setTyped((prev) => {
      if (clipped.length > prev.length) {
        setKeystrokes((k) => k + (clipped.length - prev.length));
        const i = clipped.length - 1;
        if (clipped[i] !== target[i]) setErrors((e) => e + 1);
      }
      return clipped;
    });
    setStartedAt((s) => s ?? Date.now());
  }, [target]);

  const done = !!target && typed.length === target.length;
  const elapsed = startedAt ? Math.max(0.001, (Date.now() - startedAt) / 1000) : 0;
  const correctChars = useMemo(() => {
    let n = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target?.[i]) n++;
    return n;
  }, [typed, target]);

  // Standard WPM convention: 5 characters = 1 word.
  const wpm = startedAt ? (correctChars / 5) / (elapsed / 60) : 0;
  const accuracy = keystrokes ? Math.max(0, ((keystrokes - errors) / keystrokes) * 100) : 100;
  const progress = target ? typed.length / target.length : 0;

  return { typed, onChange, reset, done, wpm, accuracy, progress, correctChars, startedAt };
}

// ── Passage renderer: per-character correctness colouring ─────────────────
function Passage({ target, typed }) {
  return (
    <p className="select-none break-words font-mono text-2xl leading-relaxed tracking-wide sm:text-3xl">
      {target.split("").map((ch, i) => {
        const state = i >= typed.length ? "pending" : typed[i] === ch ? "ok" : "bad";
        const isCursor = i === typed.length;
        return (
          <span
            key={i}
            className={
              (state === "ok" ? "text-cyan-300 " : state === "bad" ? "bg-rose-500/30 text-rose-300 " : "text-slate-500 ") +
              (isCursor ? "border-b-2 border-fuchsia-400 " : "")
            }
          >
            {ch}
          </span>
        );
      })}
    </p>
  );
}

function Stat({ label, value, accent = "text-cyan-300" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={"font-mono text-2xl font-bold tabular-nums " + accent}>{value}</div>
    </div>
  );
}

function OnScreenKeyboard({ nextChar }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      {KEY_ROWS.map((row, i) => (
        <div key={i} className="mb-1.5 flex justify-center gap-1.5 last:mb-0">
          {row.map((ch) => {
            const isNext = ch === nextChar;
            return (
              <span
                key={ch}
                className={
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-sm transition " +
                  (isNext
                    ? "scale-110 border-fuchsia-400 bg-fuchsia-500/30 text-white shadow-[0_0_18px_rgba(232,121,249,0.7)]"
                    : "border-white/10 bg-white/[0.04] text-slate-400")
                }
              >
                {ch}
              </span>
            );
          })}
        </div>
      ))}
      <div className="mt-2 text-center text-[11px] font-semibold text-slate-500">
        {nextChar === " " ? "next: space" : nextChar ? `next: ${nextChar}` : " "}
      </div>
    </div>
  );
}

// ── Practice mode ─────────────────────────────────────────────────────────
function PracticeMode({ levels, texts }) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [drillIdx, setDrillIdx] = useState(0);
  const inputRef = useRef(null);

  const level = levels[levelIdx];
  const target = level ? level.drills[drillIdx % level.drills.length] : texts[0] || FALLBACK_TEXTS[0];
  const run = useTypingRun(target);
  const submitted = useRef(false);

  useEffect(() => { run.reset(); submitted.current = false; inputRef.current?.focus(); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!run.done || submitted.current) return;
    submitted.current = true;
    // Best-effort: a failed score post must never interrupt practice.
    fetch(`${API_BASE}/typing/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify({ wpm: run.wpm, accuracy: run.accuracy, name: "Practice" }),
    }).catch(() => {});
  }, [run.done, run.wpm, run.accuracy]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {levels.map((l, i) => (
          <button
            key={l.id}
            onClick={() => { setLevelIdx(i); setDrillIdx(0); }}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-bold transition " +
              (i === levelIdx
                ? "border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200")
            }
          >
            {l.name}
          </button>
        ))}
      </div>

      {level?.letters && level.letters !== "all" && (
        <div className="text-sm font-semibold text-slate-400">
          New letters this level: <span className="font-mono text-lg text-fuchsia-300">{level.letters}</span>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
        <Passage target={target} typed={run.typed} />
      </div>

      <input
        ref={inputRef}
        value={run.typed}
        onChange={(e) => run.onChange(e.target.value)}
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Start typing here…"
        aria-label="Typing input"
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 font-mono text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_24px_rgba(34,211,238,0.25)]"
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="WPM" value={run.wpm.toFixed(0)} />
        <Stat label="Accuracy" value={`${run.accuracy.toFixed(0)}%`} accent="text-fuchsia-300" />
        <Stat label="Progress" value={`${Math.round(run.progress * 100)}%`} accent="text-violet-300" />
      </div>

      <OnScreenKeyboard nextChar={target[run.typed.length]} />

      {run.done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-5">
          <div className="font-bold text-cyan-200">
            Done — {run.wpm.toFixed(0)} WPM at {run.accuracy.toFixed(0)}% accuracy
          </div>
          <button
            onClick={() => setDrillIdx((i) => i + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-slate-900 transition hover:brightness-110"
          >
            Next drill <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Race mode ─────────────────────────────────────────────────────────────
function RaceMode() {
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("hay_typing_name") || ""; } catch { return ""; }
  });
  const [phase, setPhase] = useState("idle"); // idle | connecting | lobby | countdown | racing | results
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [target, setTarget] = useState("");
  const [youId, setYouId] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const wsRef = useRef(null);
  const inputRef = useRef(null);

  const run = useTypingRun(target);
  const finishedRef = useRef(false);

  // Stream progress to the room while racing.
  useEffect(() => {
    if (phase !== "racing" || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({
      type: "progress", progress: run.progress, wpm: run.wpm, accuracy: run.accuracy,
    }));
  }, [run.progress, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "racing" || !run.done || finishedRef.current) return;
    finishedRef.current = true;
    wsRef.current?.send(JSON.stringify({ type: "finish", wpm: run.wpm, accuracy: run.accuracy }));
  }, [run.done, phase, run.wpm, run.accuracy]);

  function connect() {
    const nick = name.trim() || "Anonymous";
    try { localStorage.setItem("hay_typing_name", nick); } catch { /* private mode */ }
    setError("");
    setPhase("connecting");
    finishedRef.current = false;
    run.reset();

    const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws/typing-race";
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setError("Could not open a connection.");
      setPhase("idle");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "join", name: nick, token: getToken() || undefined }));
    ws.onerror = () => { setError("Connection failed — check you're online and try again."); setPhase("idle"); };
    ws.onclose = () => { if (phase !== "results") wsRef.current = null; };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "joined") { setYouId(msg.youId); setAuthed(!!msg.authed); setPlayers(msg.players || []); setPhase("lobby"); }
      else if (msg.type === "lobby") setPlayers(msg.players || []);
      else if (msg.type === "countdown") { setPhase("countdown"); setCountdown(msg.seconds); setTarget(msg.text || ""); setPlayers(msg.players || []); }
      else if (msg.type === "start") { setPhase("racing"); setTarget(msg.text || ""); setPlayers(msg.players || []); setTimeout(() => inputRef.current?.focus(), 30); }
      else if (msg.type === "progress") setPlayers(msg.players || []);
      else if (msg.type === "results") { setPhase("results"); setPlayers(msg.players || []); }
    };
  }

  useEffect(() => () => wsRef.current?.close(), []);

  if (phase === "idle" || phase === "connecting") {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-center backdrop-blur">
        <Users className="mx-auto h-8 w-8 text-fuchsia-300" />
        <h2 className="font-display text-2xl font-extrabold text-white">Race someone</h2>
        <p className="text-sm font-semibold text-slate-400">
          No account needed — pick a name and you'll be matched with whoever's online.
          Logged in? You'll race under your Haylingua name automatically.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="Your name"
          aria-label="Your racing name"
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-white outline-none focus:border-fuchsia-400/60"
        />
        {error && <div className="text-sm font-semibold text-rose-300">{error}</div>}
        <button
          onClick={connect}
          disabled={phase === "connecting"}
          className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-5 py-3 font-extrabold text-slate-900 transition hover:brightness-110 disabled:opacity-60"
        >
          {phase === "connecting" ? "Connecting…" : "Find a race"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          {wsRef.current?.readyState === 1 ? <Wifi className="h-3.5 w-3.5 text-cyan-400" /> : <WifiOff className="h-3.5 w-3.5 text-rose-400" />}
          {authed ? "Racing as your Haylingua account" : "Racing as a guest"}
        </span>
        <span className="text-slate-500">{players.length} in this race</span>
      </div>

      {/* Live standings */}
      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={p.id} className={"rounded-2xl border p-3 " + (p.id === youId ? "border-cyan-400/50 bg-cyan-400/[0.07]" : "border-white/10 bg-white/[0.03]")}>
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span className={p.id === youId ? "text-cyan-200" : "text-slate-300"}>
                {p.finished && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-300" />}
                {i + 1}. {p.name}{p.id === youId ? " (you)" : ""}
              </span>
              <span className="font-mono tabular-nums text-slate-400">{p.wpm.toFixed(0)} wpm · {p.accuracy.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-[width] duration-200"
                style={{ width: `${Math.round((p.progress || 0) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {phase === "lobby" && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="animate-pulse font-display text-xl font-extrabold text-white">Waiting for racers…</div>
          <p className="mt-1 text-sm font-semibold text-slate-400">Starting shortly whether or not anyone else joins.</p>
        </div>
      )}

      {phase === "countdown" && (
        <div className="rounded-3xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-10 text-center">
          <div className="font-mono text-6xl font-black text-fuchsia-300">{countdown}</div>
          <p className="mt-2 text-sm font-bold text-slate-300">Get ready…</p>
        </div>
      )}

      {(phase === "racing" || phase === "results") && target && (
        <>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <Passage target={target} typed={run.typed} />
          </div>
          <input
            ref={inputRef}
            value={run.typed}
            onChange={(e) => run.onChange(e.target.value)}
            disabled={phase === "results" || run.done}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={phase === "results" ? "Race over" : "Type the passage…"}
            aria-label="Race typing input"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 font-mono text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 disabled:opacity-50"
          />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="WPM" value={run.wpm.toFixed(0)} />
            <Stat label="Accuracy" value={`${run.accuracy.toFixed(0)}%`} accent="text-fuchsia-300" />
            <Stat label="Progress" value={`${Math.round(run.progress * 100)}%`} accent="text-violet-300" />
          </div>
          {phase === "racing" && <OnScreenKeyboard nextChar={target[run.typed.length]} />}
        </>
      )}

      {phase === "results" && (
        <button
          onClick={() => { wsRef.current?.close(); setPhase("idle"); setTarget(""); setPlayers([]); }}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-5 py-3 font-extrabold text-slate-900 transition hover:brightness-110"
        >
          <RotateCcw className="h-4 w-4" /> Race again
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ArmenianTypingPage() {
  const [mode, setMode] = useState("practice");
  const [levels, setLevels] = useState([]);
  const [texts, setTexts] = useState(FALLBACK_TEXTS);
  const [board, setBoard] = useState([]);

  usePageMeta(
    "Armenian Typing Practice & Races — Free, No Signup",
    "Learn to type in Armenian for free, then race other people in real time. No account required — practice the Armenian alphabet, build speed, and track your WPM.",
    {
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: "Armenian Typing", item: "https://www.haylingua.am/armenian-typing" },
        ],
      }],
    }
  );

  useEffect(() => {
    fetch(`${API_BASE}/typing/texts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setLevels(d.levels || []); setTexts(d.race_texts || FALLBACK_TEXTS); } })
      .catch(() => {});
    fetch(`${API_BASE}/typing/leaderboard?range=today`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBoard(d.entries || []))
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070c] text-white">
      {/* Ambient gradient wash — decorative only. */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-cyan-500/20 blur-[120px]" />

      <div className="relative mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-white/90 hover:text-white">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-slate-900">Հ</span>
            Haylingua
          </Link>
          <Link to="/armenian-alphabet" className="text-xs font-bold text-slate-400 hover:text-cyan-300">
            Learn the alphabet →
          </Link>
        </div>

        <header className="mb-8 text-center">
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-fuchsia-400 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Armenian typing
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm font-semibold text-slate-400">
            Learn the Armenian keyboard, then race real people. Free, no signup, no ads.
          </p>
        </header>

        <div className="mb-7 flex justify-center gap-2">
          {[["practice", "Practice", Keyboard], ["race", "Race", Zap]].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={
                "inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-extrabold transition " +
                (mode === key
                  ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200")
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {mode === "practice"
          ? <PracticeMode levels={levels.length ? levels : [{ id: 0, name: "Warm up", letters: "all", drills: texts }]} texts={texts} />
          : <RaceMode />}

        {board.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-widest text-slate-400">
              <Trophy className="h-4 w-4 text-amber-300" /> Fastest today
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {board.slice(0, 8).map((e, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm last:border-0">
                  <span className="font-bold text-slate-300">{i + 1}. {e.display_name}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {Number(e.wpm).toFixed(0)} wpm · {Number(e.accuracy).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
