// src/Dashboard.jsx — "The Journey to Ararat": a roadmap timeline, Armenian-branded.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, Play, Loader2, Trophy, Users, ChevronRight, ChevronDown, ArrowRight, RotateCcw, Target, Zap, Crown, Star, Check, Snowflake, Gem, Gift, Dumbbell, ShieldCheck, Heart, Store, AlertTriangle } from "lucide-react";
import grandma from "./assets/character-grandma.png";
import { StarMotif } from "./lib/motifs";
import StreakFlame from "./lib/StreakFlame";
import StreakCelebration from "./lib/StreakCelebration";
import ChestOpening from "./lib/ChestOpening";

const QICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

// Animated checkmark — the stroke draws itself in via CSS (.quest-tick-path).
function QuestTick({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 12.5l4.2 4.2L19 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="quest-tick-path"
      />
    </svg>
  );
}

function DailyQuestsCard({ token }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const prevAllDone = React.useRef(null);

  const load = () =>
    fetch(`${API_BASE_URL}/me/quests`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});

  useEffect(() => { load(); }, [token]);

  // "All done" = every quest completed and nothing left to claim.
  const quests = data?.quests || [];
  const allDone =
    quests.length > 0 &&
    quests.every((q) => q.done) &&
    !quests.some((q) => q.claimable);

  // Play the big celebration only on a real transition into "all done"
  // (e.g. right after claiming the last quest) — not on a fresh page load
  // where they were already complete.
  useEffect(() => {
    if (!data) return;
    const prev = prevAllDone.current;
    prevAllDone.current = allDone;
    if (prev === false && allDone) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 1900);
      return () => clearTimeout(t);
    }
  }, [allDone, data]);

  async function claim(id) {
    setClaiming(id);
    try {
      await fetch(`${API_BASE_URL}/me/rewards/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ kind: "quest", id }),
      });
      await load();
      window.dispatchEvent(new CustomEvent("hay_xp_changed"));
    } catch {
    } finally {
      setClaiming("");
    }
  }

  if (!data?.quests?.length) return null;

  // Completed state — big celebratory tick, then a compact "done" card.
  if (allDone) {
    if (celebrating) {
      return (
        <div className="quests-celebrate flex flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-br from-grass-50 to-white p-6 text-center ring-1 ring-grass-200 shadow-sm">
          <div className="relative grid place-items-center">
            <span className="quests-ring absolute h-16 w-16 rounded-full bg-grass-300/50" />
            <span className="quests-ring quests-ring-2 absolute h-16 w-16 rounded-full bg-grass-300/40" />
            <div className="quests-badge-pop relative grid h-16 w-16 place-items-center rounded-full bg-grass-500 text-white shadow-[0_6px_0_0_#3f8f34]">
              <QuestTick className="h-9 w-9" />
            </div>
          </div>
          <div className="mt-4 font-display text-base font-extrabold text-slate-800">All quests complete! 🎉</div>
          <div className="mt-0.5 text-xs font-semibold text-slate-500">Amazing work today — come back tomorrow.</div>
        </div>
      );
    }
    return (
      <div className="quests-collapse flex items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-grass-50 to-white p-4 ring-1 ring-grass-200 shadow-sm">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-500 text-white">
          <QuestTick className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-extrabold text-slate-800">Daily quests complete</div>
          <div className="text-xs font-semibold text-slate-500">All {quests.length} done — back tomorrow!</div>
        </div>
        <span className="shrink-0 rounded-full bg-grass-100 px-2 py-0.5 text-xs font-bold text-grass-600">
          {quests.length}/{quests.length}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-display text-base font-extrabold text-slate-800">Daily quests</div>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">{data.completed}/{data.total}</span>
      </div>
      <div className="mt-3 space-y-3">
        {data.quests.map((q) => {
          const Icon = QICON[q.icon] || Target;
          const pct = q.target ? Math.round((q.progress / q.target) * 100) : 0;
          return (
            <div key={q.id} className="flex items-center gap-3">
              <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl " + (q.done ? "bg-grass-100 text-grass-600" : "bg-brand-50 text-brand-500")}>
                {q.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-bold text-slate-700">{q.desc}</div>
                  {q.claimed ? (
                    <span className="shrink-0 text-xs font-bold text-grass-600">Claimed ✓</span>
                  ) : (
                    <div className="shrink-0 text-xs font-bold text-slate-400">{q.progress}/{q.target}</div>
                  )}
                </div>
                {q.claimable ? (
                  <button
                    onClick={() => claim(q.id)}
                    disabled={claiming === q.id}
                    className="mt-1.5 w-full rounded-xl bg-gold-500 py-1.5 text-xs font-extrabold uppercase text-white shadow-[0_3px_0_0_#B45309] transition active:translate-y-0.5 disabled:opacity-60"
                  >
                    {claiming === q.id ? "…" : `Claim +${q.reward_xp} XP`}
                  </button>
                ) : (
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={"h-full rounded-full " + (q.done ? "bg-grass-500" : "bg-brand-500")} style={{ width: `${Math.max(pct, 4)}%` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChestCard({ token }) {
  const [chests, setChests] = useState(0);
  const [opening, setOpening] = useState(false);
  const [openErr, setOpenErr] = useState(false);
  const [overlayReward, setOverlayReward] = useState(null); // number → show opening animation

  useEffect(() => {
    fetch(`${API_BASE_URL}/me/wallet`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChests(Number(d.chests || 0)))
      .catch(() => {});
  }, [token]);

  async function open() {
    if (opening) return;
    setOpening(true);
    setOpenErr(false);
    try {
      const r = await fetch(`${API_BASE_URL}/me/chests/open`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d) {
        setChests(Number(d.chests || 0));
        window.dispatchEvent(new CustomEvent("hay_wallet", { detail: { gems: d.gems } }));
        setOverlayReward({ type: d.reward_type || "gems", gems: Number(d.reward_gems || 0) });
      } else {
        setOpenErr(true);
      }
    } catch {
      setOpenErr(true);
    } finally {
      setOpening(false);
    }
  }

  if (chests <= 0 && overlayReward == null) return null;

  return (
    <>
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-white p-5 text-center shadow-sm ring-1 ring-amber-200">
        <div className="text-5xl" style={opening ? { animation: "chestShake .85s ease-in-out" } : undefined}>🎁</div>
        <div className="mt-2 font-display text-base font-extrabold text-slate-800">
          {chests} chest{chests === 1 ? "" : "s"} to open!
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">Open for gems or an XP boost!</p>
        {openErr && (
          <p className="mt-2 text-xs font-semibold text-red-500">Couldn't open — try again.</p>
        )}
        <button
          onClick={open}
          disabled={opening || chests <= 0}
          className="btn3d btn3d-brand mt-4 w-full text-sm uppercase disabled:opacity-60"
        >
          <Gift className="h-4 w-4" /> {opening ? "Opening…" : "Open chest"}
        </button>
      </div>

      {overlayReward != null && (
        <ChestOpening reward={overlayReward} onClose={() => setOverlayReward(null)} />
      )}
    </>
  );
}

function StreakCard({ token, streak }) {
  const navigate = useNavigate();
  const [days, setDays] = useState(null);
  const [freeze, setFreeze] = useState({ freezes: 0, freeze_cap: 2 });
  const [practicedToday, setPracticedToday] = useState(true);

  useEffect(() => {
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE_URL}/me/activity/last7days`, { headers: h })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.days && setDays(d.days))
      .catch(() => {});
    fetch(`${API_BASE_URL}/me/streak`, { headers: h })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setFreeze({ freezes: Number(d.freezes || 0), freeze_cap: Number(d.freeze_cap || 2), frozen: !!d.frozen });
        setPracticedToday(!!d.practiced_today);
      })
      .catch(() => {});
  }, [token]);

  const n = Number(streak) || 0;
  const frozen = !!freeze.frozen;
  // The flame only burns once today's practice is done — otherwise it's an
  // "at risk" ember even if the streak number is > 0. When a freeze is holding
  // the streak, show the icy "frozen" flame instead.
  const lit = n > 0 && practicedToday && !frozen;
  const atRisk = n > 0 && !practicedToday && !frozen;
  const week = Array.isArray(days) ? days.slice(-7) : [];
  const cap = freeze.freeze_cap || 2;

  return (
    <div className={"overflow-hidden rounded-3xl p-5 shadow-sm ring-1 " + (frozen ? "bg-gradient-to-br from-feather-50 to-white ring-feather-200" : lit ? "bg-gradient-to-br from-brand-50 to-white ring-brand-100" : atRisk ? "bg-gradient-to-br from-amber-50 to-white ring-amber-100" : "bg-white ring-slate-200")}>

      {/* Header: flame + count + state badge */}
      <div className="flex items-center gap-3">
        <StreakFlame size={56} lit={lit} frozen={frozen} />
        <div className="flex-1">
          <div className="font-display text-4xl font-extrabold leading-none tabular-nums text-slate-800">{n}</div>
          <div className="mt-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">day streak</div>
        </div>
        {lit && (
          <span className="rounded-full bg-grass-100 px-2.5 py-1 text-xs font-extrabold text-grass-700 ring-1 ring-grass-200">Lit 🔥</span>
        )}
        {frozen && (
          <span className="rounded-full bg-feather-100 px-2.5 py-1 text-xs font-extrabold text-feather-700 ring-1 ring-feather-200">Frozen ❄️</span>
        )}
        {atRisk && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700 ring-1 ring-amber-200">At risk</span>
        )}
      </div>

      {/* 7-day activity dots */}
      {week.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5">
          {week.map((d, i) => {
            const on = Number(d?.value ?? 0) > 0;
            const label = (String(d?.label ?? "").trim()[0] || "·").toUpperCase();
            return (
              <div
                key={i}
                title={`${d?.label ?? ""}: ${Number(d?.value ?? 0)} XP`}
                className={"flex-1 grid place-items-center h-8 rounded-xl text-[11px] font-extrabold transition " +
                  (on ? "bg-brand-500 text-white shadow-[0_2px_0_0_#C2410C]" : "bg-slate-100 text-slate-400")}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      {/* Status line */}
      <p className="mt-3 text-sm font-semibold text-slate-500">
        {frozen
          ? "A streak freeze is protecting your flame — practice today to thaw it."
          : lit
          ? "Flame lit for today! Come back tomorrow to keep it going."
          : atRisk
          ? "Practice today to keep your streak alive."
          : "Complete a lesson to light your streak."}
      </p>

      {/* Practice CTA — only shown when at risk with no freezes left */}
      {atRisk && freeze.freezes === 0 && (
        <button
          onClick={() => navigate("/practice")}
          className="btn3d btn3d-brand mt-3 w-full text-sm"
        >
          Practice now <ArrowRight className="h-4 w-4" />
        </button>
      )}

      {/* Freeze count + buy chip */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div
          className="flex items-center gap-2"
          title="A streak freeze covers one missed day. Buy them in the shop with gems."
        >
          <div className="flex gap-0.5">
            {Array.from({ length: cap }).map((_, i) => (
              <Snowflake
                key={i}
                className={"h-4 w-4 " + (i < freeze.freezes ? "fill-feather-200 text-feather-500" : "text-slate-200")}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-slate-400">
            {freeze.freezes}/{cap} freeze{cap === 1 ? "" : "s"}
          </span>
        </div>
        {freeze.freezes < cap && (
          <button
            onClick={() => navigate("/shop")}
            className="inline-flex items-center gap-1 rounded-xl bg-feather-50 px-2.5 py-1.5 text-xs font-extrabold text-feather-600 ring-1 ring-feather-100 transition hover:bg-feather-100"
          >
            <Gem className="h-3 w-3" /> Buy freeze
          </button>
        )}
      </div>
    </div>
  );
}

function AchievementsCard({ token, onOpen }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}/me/achievements`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, [token]);
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-gold-600">
          <StarMotif className="h-5 w-5" />
        </div>
        <div className="font-display text-base font-extrabold text-slate-800">Achievements</div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">
        {data ? `${data.earned} of ${data.total} unlocked` : "Earn badges as you learn."}
      </p>
      <button onClick={onOpen} className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-brand-500 hover:text-brand-600">
        View all <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const DAILY_GOAL_OPTIONS = [10, 20, 30, 50];

function DailyGoalCard({ todayXp }) {
  const [goal, setGoal] = React.useState(() => {
    const saved = parseInt(localStorage.getItem("hay_daily_goal") || "20", 10);
    return DAILY_GOAL_OPTIONS.includes(saved) ? saved : 20;
  });

  function pickGoal(g) {
    setGoal(g);
    localStorage.setItem("hay_daily_goal", String(g));
  }

  const xp = Number(todayXp) || 0;
  const pct = Math.min(100, Math.round((xp / goal) * 100));
  const done = xp >= goal;

  return (
    <div className={"overflow-hidden rounded-3xl p-5 shadow-sm ring-1 " + (done ? "bg-gradient-to-br from-grass-50 to-white ring-grass-200" : "bg-white ring-slate-200")}>
      <div className="flex items-center justify-between">
        <div className="font-display text-base font-extrabold text-slate-800">Daily goal</div>
        {done ? <span className="rounded-full bg-grass-100 px-2 py-0.5 text-xs font-extrabold text-grass-700">Done! 🎉</span> : null}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="font-display text-3xl font-extrabold leading-none text-slate-800 tabular-nums">{xp}</div>
        <div className="mb-0.5 text-sm font-bold text-slate-400">/ {goal} XP today</div>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={"h-full rounded-full transition-all duration-500 " + (done ? "bg-grass-500" : "bg-brand-500")}
          style={{ width: `${Math.max(pct, xp > 0 ? 6 : 0)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {DAILY_GOAL_OPTIONS.map((g) => (
          <button
            key={g}
            disabled={done}
            onClick={() => !done && pickGoal(g)}
            className={"flex-1 rounded-xl py-1 text-xs font-extrabold transition " + (done ? (goal === g ? "bg-grass-500 text-white cursor-default" : "bg-slate-100 text-slate-300 cursor-default") : goal === g ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

// Warm Armenian palette rotation for unit bands (no Duolingo green).
const UNIT_THEMES = [
  { band: "from-brand-500 to-brand-600", shadow: "shadow-btn-brand", dot: "bg-gold-400" },
  { band: "from-pom-500 to-pom-600", shadow: "shadow-[0_4px_0_0_#8F1033]", dot: "bg-gold-400" },
  { band: "from-gold-500 to-gold-600", shadow: "shadow-[0_4px_0_0_#B45309]", dot: "bg-pom-400" },
];

// Stylized Mount Ararat (greater + lesser peaks) with a summit flag.
function Ararat({ className }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden>
      <path d="M2 74 L40 20 L58 46 L70 30 L84 50 L96 36 L118 74 Z" fill="#E85F00" />
      <path d="M40 20 L31 33 L40 30 L49 35 L58 46 Z" fill="#fff" opacity="0.95" />
      <path d="M84 50 L78 41 L84 44 L90 41 L96 50 Z" fill="#fff" opacity="0.95" />
      <line x1="40" y1="20" x2="40" y2="6" stroke="#B71540" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 6 L52 9 L40 13 Z" fill="#E11D48" />
    </svg>
  );
}

// Compact stat pills — shown on mobile only (the top header already shows
// these on md+). Keeps hearts/streak/XP/gems visible on phones.
function StatStrip({ token, streak, xp }) {
  const [hearts, setHearts] = useState(null);
  const [gems, setGems] = useState(null);

  useEffect(() => {
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    const loadHearts = () =>
      fetch(`${API_BASE_URL}/me/hearts`, { headers: h })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setHearts(d))
        .catch(() => {});
    const loadWallet = () =>
      fetch(`${API_BASE_URL}/me/wallet`, { headers: h })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setGems(Number(d.gems || 0)))
        .catch(() => {});
    loadHearts();
    loadWallet();
    const onHearts = () => loadHearts();
    const onWallet = (e) =>
      Number.isFinite(e?.detail?.gems) ? setGems(Number(e.detail.gems)) : loadWallet();
    window.addEventListener("hay_hearts", onHearts);
    window.addEventListener("haylingua:hearts", onHearts);
    window.addEventListener("hay_wallet", onWallet);
    return () => {
      window.removeEventListener("hay_hearts", onHearts);
      window.removeEventListener("haylingua:hearts", onHearts);
      window.removeEventListener("hay_wallet", onWallet);
    };
  }, [token]);

  const heartLabel = hearts
    ? hearts.is_premium
      ? "∞"
      : `${hearts.current ?? hearts.hearts_current ?? 0}`
    : "–";

  const Pill = ({ icon: Icon, tone, children }) => (
    <div className={"flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-sm font-extrabold " + tone}>
      <Icon className="h-4 w-4" />
      <span className="tabular-nums">{children}</span>
    </div>
  );

  return (
    <div className="mb-4 flex items-center gap-2 md:hidden">
      <Pill icon={Heart} tone="bg-cardinal-50 text-cardinal-600">{heartLabel}</Pill>
      <Pill icon={Flame} tone="bg-brand-50 text-brand-600">{streak}</Pill>
      <Pill icon={Zap} tone="bg-gold-50 text-gold-600">{xp}</Pill>
      <Pill icon={Gem} tone="bg-feather-50 text-feather-600">{gems == null ? "–" : gems}</Pill>
    </div>
  );
}

// The single most important element: resume the current lesson.
function ResumeHero({ lesson, unitTitle, loading, onStart }) {
  if (loading) {
    return <div className="mb-6 h-28 animate-pulse rounded-3xl bg-brand-50 ring-1 ring-brand-100" />;
  }
  if (!lesson) {
    return (
      <div className="mb-6 flex items-center gap-4 rounded-3xl bg-grass-50 p-5 ring-1 ring-grass-200">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-grass-500 text-white">
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-extrabold text-slate-800">You're all caught up! 🎉</div>
          <div className="text-sm font-semibold text-slate-500">Review a lesson below or practice your weak spots.</div>
        </div>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, Number(lesson.completion_pct || 0)));
  return (
    <button
      type="button"
      onClick={() => onStart(lesson)}
      className="mb-6 flex w-full items-center gap-4 rounded-3xl bg-white p-5 text-left ring-2 ring-brand-400 shadow-sm transition hover:ring-brand-500 active:translate-y-0.5"
    >
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <Play className="h-7 w-7 fill-brand-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-brand-500">
          Continue{unitTitle ? ` · ${unitTitle}` : ""}
        </div>
        <div className="truncate font-display text-lg font-extrabold text-slate-800">{lesson.title}</div>
        {pct > 0 && (
          <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 6)}%` }} />
          </div>
        )}
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-extrabold uppercase text-white shadow-btn-brand sm:inline-flex">
        {pct > 0 ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

// One lesson row inside a unit card.
function LessonRow({ lesson, onStart }) {
  const status = lesson.status || "locked";
  const done = status === "completed";
  const current = status === "current";
  const locked = status === "locked";
  const pct = Math.max(0, Math.min(100, Number(lesson.completion_pct || (done ? 100 : 0))));
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => !locked && onStart(lesson)}
      className={
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition " +
        (current
          ? "bg-brand-50 ring-1 ring-brand-300 hover:bg-brand-100"
          : done
          ? "bg-grass-50/70 ring-1 ring-grass-100 hover:bg-grass-50"
          : "bg-slate-50 ring-1 ring-slate-100 cursor-default")
      }
    >
      <span
        className={
          "grid h-8 w-8 shrink-0 place-items-center rounded-full " +
          (done ? "bg-grass-500 text-white" : current ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-400")
        }
      >
        {done ? (
          <Check className="h-4 w-4" strokeWidth={3} />
        ) : current ? (
          <Play className="h-4 w-4 fill-white" />
        ) : (
          <Lock className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={"block truncate text-sm font-bold " + (locked ? "text-slate-400" : "text-slate-800")}>
          {lesson.title}
        </span>
        {current && pct > 0 && (
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white">
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 8)}%` }} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide">
        {done ? (
          <span className="inline-flex items-center gap-1 text-grass-600"><RotateCcw className="h-3.5 w-3.5" /></span>
        ) : current ? (
          <span className="text-brand-500">{pct > 0 ? "Continue" : "Start"}</span>
        ) : (
          <span className="text-slate-300">Locked</span>
        )}
      </span>
    </button>
  );
}

// A unit as an expandable card (rethought roadmap).
function UnitCard({ unit, index, expanded, onToggle, onStart, onCheckpoint }) {
  const theme = UNIT_THEMES[index % UNIT_THEMES.length];
  const total = unit.items.length;
  const done = unit.items.filter((l) => l.status === "completed").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className={"grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white font-display text-lg font-extrabold " + theme.band + " " + theme.shadow}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Unit {index + 1}</div>
          <div className="truncate font-display text-base font-extrabold text-slate-800">{unit.title}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={"h-full rounded-full " + (complete ? "bg-grass-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs font-extrabold tabular-nums text-slate-500">{done}/{total}</span>
          </div>
        </div>
        <ChevronDown className={"h-5 w-5 shrink-0 text-slate-400 transition-transform " + (expanded ? "rotate-180" : "")} />
      </button>

      {expanded && (
        <div className="space-y-2 px-4 pb-4">
          {unit.items.map((lesson) => (
            <LessonRow key={lesson.id ?? lesson.slug} lesson={lesson} onStart={onStart} />
          ))}
          {complete && (
            <button
              type="button"
              onClick={() => onCheckpoint(unit)}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gold-400 bg-amber-50 p-3 text-left transition hover:border-gold-500 active:translate-y-0.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500 text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-extrabold text-slate-800">Unit Checkpoint</span>
                <span className="block text-xs font-semibold text-slate-500">Test your {unit.title} knowledge</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gold-500" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Compact quick-access tiles (replaces the tall sidebar card stack).
function QuickTiles({ navigate }) {
  const tiles = [
    { icon: Dumbbell, label: "Practice", to: "/practice", tone: "bg-brand-50 text-brand-600" },
    { icon: Trophy, label: "Leaderboard", to: "/leaderboard", tone: "bg-amber-50 text-gold-600" },
    { icon: Users, label: "Friends", to: "/friends", tone: "bg-feather-50 text-feather-600" },
    { icon: Store, label: "Shop", to: "/shop", tone: "bg-pom-50 text-pom-500" },
    { icon: Star, label: "Achievements", to: "/achievements", tone: "bg-gold-50 text-gold-600" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {tiles.map((t) => (
        <button
          key={t.to}
          type="button"
          onClick={() => navigate(t.to)}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 ring-1 ring-slate-200 shadow-sm transition hover:ring-brand-200 active:translate-y-0.5"
        >
          <span className={"grid h-10 w-10 place-items-center rounded-2xl " + t.tone}>
            <t.icon className="h-5 w-5" />
          </span>
          <span className="text-center text-xs font-extrabold text-slate-600">{t.label}</span>
        </button>
      ))}
    </div>
  );
}


export default function Dashboard({ user }) {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total_xp: 0, lessons_completed: 0, streak: 0, today_xp: 0 });
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(
    () => localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "",
    []
  );
  const _greetBase = user?.display_name || user?.first_name || user?.name || user?.username || "";
  const firstName = _greetBase
    ? _greetBase.split(" ")[0]
    : (user?.email || "").split("@")[0];

  useEffect(() => {
    (async () => {
      try {
        setLoadingLessons(true);
        const res = await fetch(`${API_BASE_URL}/me/lessons/progress`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || `Failed to load lessons (${res.status})`);
        setLessons(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load lessons");
      } finally {
        setLoadingLessons(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/me/stats`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data) {
          setStats({
            total_xp: Number(data.total_xp || 0),
            lessons_completed: Number(data.lessons_completed || 0),
            streak: Number(data.streak || 0),
            today_xp: Number(data.today_xp || 0),
          });
        }
      } catch {
        /* stats failure shouldn't kill the page */
      }
    })();
  }, [token]);

  const handleStart = (lesson) => lesson?.slug && navigate(`/lesson/${lesson.slug}`);

  const units = useMemo(() => {
    const groups = new Map();
    lessons.forEach((l) => {
      const hasChapter = l.chapter_id != null;
      const key = hasChapter ? `c${l.chapter_id}` : `l${Number(l.level ?? l.unit ?? 1)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: hasChapter ? l.chapter_title || "Chapter" : `Chapter ${Number(l.level ?? l.unit ?? 1)}`,
          position: hasChapter ? Number(l.chapter_position ?? 9999) : Number(l.level ?? l.unit ?? 1),
          items: [],
        });
      }
      groups.get(key).items.push(l);
    });
    return [...groups.values()].sort((a, b) => a.position - b.position);
  }, [lessons]);

  const totalLessons = lessons.length;
  const doneLessons = lessons.filter((l) => l.status === "completed").length;
  const journeyPct = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;

  // The one lesson the user should resume, and the unit that contains it.
  const currentLesson = useMemo(() => lessons.find((l) => l.status === "current") || null, [lessons]);
  const currentUnitKey = useMemo(() => {
    if (!currentLesson) return null;
    const key = currentLesson.id ?? currentLesson.slug;
    const u = units.find((unit) => unit.items.some((l) => (l.id ?? l.slug) === key));
    return u ? u.key : null;
  }, [units, currentLesson]);
  const currentUnitTitle = useMemo(() => {
    const u = units.find((unit) => unit.key === currentUnitKey);
    return u ? u.title : "";
  }, [units, currentUnitKey]);

  // Accordion: open the current unit by default (first unit as fallback).
  const [expandedKey, setExpandedKey] = useState(null);
  useEffect(() => {
    setExpandedKey((prev) => prev ?? currentUnitKey ?? units[0]?.key ?? null);
  }, [currentUnitKey, units]);

  const openCheckpoint = (unit) => {
    const ids = unit.items.map((l) => l.id).filter((id) => id != null).join(",");
    navigate(`/checkpoint?lessons=${encodeURIComponent(ids)}&title=${encodeURIComponent(unit.title)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <StreakCelebration streak={stats.streak} />
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Greeting + overall journey progress */}
        <div className="mb-4 flex items-center gap-3">
          <img src={grandma} alt="" className="h-12 w-12 shrink-0 animate-floaty rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-xl font-extrabold text-slate-800">
              Բարև{firstName ? `, ${firstName}` : ""}! 👋
            </div>
            <div className="text-sm font-semibold text-slate-500">
              {doneLessons} of {totalLessons || "…"} lessons · {journeyPct}% to fluency
            </div>
          </div>
          <Ararat className="hidden h-12 w-16 shrink-0 sm:block" />
        </div>

        {/* Stat strip (mobile only — header already shows these on md+) */}
        <StatStrip token={token} streak={stats.streak} xp={stats.total_xp} />

        {/* Placement nudge for brand-new users */}
        {!loadingLessons && doneLessons === 0 && totalLessons > 0 && (
          <button
            type="button"
            onClick={() => navigate("/placement")}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-left ring-1 ring-brand-100 transition hover:bg-brand-100"
          >
            <Target className="h-4 w-4 shrink-0 text-brand-500" />
            <span className="flex-1 text-sm font-bold text-brand-700">Not a beginner? Take the placement test</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-brand-400" />
          </button>
        )}

        {/* Resume hero — the primary action */}
        <ResumeHero
          lesson={currentLesson}
          unitTitle={currentUnitTitle}
          loading={loadingLessons}
          onStart={handleStart}
        />

        {/* Today: daily goal + quests */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <DailyGoalCard todayXp={stats.today_xp} />
          <DailyQuestsCard token={token} />
        </div>

        {/* Streak + chest + quick access — above the lesson list */}
        <div className="mb-6 space-y-4">
          <StreakCard token={token} streak={stats.streak} />
          <ChestCard token={token} />
          <QuickTiles navigate={navigate} />
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border-2 border-cardinal-100 bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-600">
            {error}
          </div>
        )}

        {/* Learning path — units as expandable cards */}
        <div className="mb-2 flex items-center justify-between">
          <div className="font-display text-lg font-extrabold text-slate-800">Your path</div>
          <Ararat className="h-6 w-9" />
        </div>
        {loadingLessons ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Mapping your journey…</span>
          </div>
        ) : units.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center font-semibold text-slate-600 ring-1 ring-slate-200">
            No lessons available yet. Check back soon!
          </div>
        ) : (
          <div className="space-y-3">
            {units.map((unit, ui) => (
              <UnitCard
                key={unit.key}
                unit={unit}
                index={ui}
                expanded={expandedKey === unit.key}
                onToggle={() => setExpandedKey((k) => (k === unit.key ? null : unit.key))}
                onStart={handleStart}
                onCheckpoint={openCheckpoint}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
