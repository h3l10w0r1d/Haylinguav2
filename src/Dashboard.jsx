// src/Dashboard.jsx — "The Journey to Ararat": a roadmap timeline, Armenian-branded.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, Play, Loader2, Trophy, Users, ChevronRight, ArrowRight, Target, Zap, Crown, Star, Check, Snowflake, Gem, Gift, Dumbbell, ShieldCheck, Heart, Store, AlertTriangle, BookOpen, BarChart2 } from "lucide-react";
import grandma from "./assets/character-grandma.png";
import { StarMotif, CarpetBorder } from "./lib/motifs";
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
        setOverlayReward({
          type: d.reward_type || "gems",
          gems: Number(d.reward_gems || 0),
          rarity: d.rarity || "wooden",
          xpBoost: !!d.xp_boost_granted,
        });
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

function ReviewCard({ token }) {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com"}/me/review/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .catch(() => {});
  }, [token]);

  // Reflect due count in the browser tab title
  React.useEffect(() => {
    const due = stats?.due_today || 0;
    document.title = due > 0 ? `(${due}) Haylingua` : "Haylingua";
    return () => { document.title = "Haylingua"; };
  }, [stats?.due_today]);

  if (!stats || stats.total === 0) return null;

  const due = stats.due_today;
  const urgent = due > 0;

  return (
    <div
      className={
        "overflow-hidden rounded-3xl p-5 shadow-sm ring-1 cursor-pointer transition hover:shadow-md " +
        (urgent
          ? "bg-gradient-to-br from-brand-50 to-white ring-brand-200"
          : "bg-white ring-slate-200")
      }
      onClick={() => navigate("/review")}
    >
      <div className="flex items-center justify-between">
        <div className="font-display text-base font-extrabold text-slate-800">Review</div>
        {urgent && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-extrabold text-brand-700">
            Due now
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={"text-4xl font-black " + (urgent ? "text-brand-600" : "text-slate-700")}>
          {due}
        </span>
        <span className="mb-1 text-sm font-semibold text-slate-500">
          {due === 1 ? "card due" : "cards due"}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {stats.mastered} mastered · {stats.learning} learning · {stats.new_cards} new
      </div>
      <button
        onClick={e => { e.stopPropagation(); navigate("/review"); }}
        className={
          "mt-4 w-full rounded-2xl py-2.5 text-sm font-extrabold text-white transition active:translate-y-0.5 " +
          (urgent
            ? "bg-brand-500 shadow-[0_3px_0_0_#c2410c]"
            : "bg-slate-400 shadow-[0_3px_0_0_#94a3b8]")
        }
      >
        {urgent ? "Start review" : "Nothing due yet"}
      </button>
    </div>
  );
}

function MistakesCard({ token, navigate }) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com"}/me/mistakes/count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCount(Number(d.count) || 0); })
      .catch(() => {});
  }, [token]);

  if (count === 0) return null;

  return (
    <div
      className="mt-4 cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br from-cardinal-50 to-white p-5 shadow-sm ring-1 ring-cardinal-200 transition hover:shadow-md"
      onClick={() => navigate("/mistakes")}
    >
      <div className="flex items-center justify-between">
        <div className="font-display text-base font-extrabold text-slate-800">Your mistakes</div>
        <span className="rounded-full bg-cardinal-100 px-2 py-0.5 text-xs font-extrabold text-cardinal-700">Fix them</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-4xl font-black text-cardinal-600">{count}</span>
        <span className="mb-1 text-sm font-semibold text-slate-500">{count === 1 ? "exercise to re-master" : "exercises to re-master"}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/mistakes"); }}
        className="mt-4 w-full rounded-2xl bg-cardinal-500 py-2.5 text-sm font-extrabold text-white shadow-[0_3px_0_0_#9f1239] transition active:translate-y-0.5"
      >
        Review mistakes
      </button>
    </div>
  );
}

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
// The hero band — greeting, streak, primary CTA and unit progress fused into
// one confident zone. The dashboard has ONE job: get the learner into today's
// lesson; this is where that happens.
function HeroBand({ firstName, streak, lesson, unitTitle, unitDone, unitTotal, loading, isNewUser, onStart, navigate }) {
  const pct = Math.max(0, Math.min(100, Number(lesson?.completion_pct || 0)));
  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-500 to-pom-500 p-5 text-white shadow-[0_6px_0_0_#B84B00] sm:p-6">
      {/* Ararat watermark */}
      <Ararat className="pointer-events-none absolute -right-4 -top-2 h-32 w-48 opacity-[0.18]" />
      <StarMotif className="pointer-events-none absolute right-24 bottom-3 h-6 w-6 text-white/20" />

      <div className="relative flex items-center gap-3.5">
        <img src={grandma} alt="" className="h-14 w-14 shrink-0 animate-floaty rounded-2xl object-cover ring-2 ring-white/40" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-extrabold uppercase tracking-[0.14em] text-white/75">
            Բարև{firstName ? `, ${firstName}` : ""} 👋
          </div>
          <h1 className="truncate font-display text-2xl font-extrabold leading-tight">
            {loading ? "Loading your journey…" : lesson ? "Ready for today's lesson?" : "You've reached the summit!"}
          </h1>
        </div>
        {streak > 0 && (
          <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm sm:inline-flex">
            <Flame className="h-4 w-4 fill-gold-400 text-gold-400" />
            <span className="font-display text-sm font-extrabold tabular-nums">{streak}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="relative mt-5 h-14 animate-pulse rounded-2xl bg-white/20" />
      ) : lesson ? (
        <button
          type="button"
          onClick={() => onStart(lesson)}
          className="relative mt-5 flex w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 text-left shadow-[0_5px_0_0_rgba(0,0,0,0.22)] transition hover:brightness-[1.03] active:translate-y-1 active:shadow-none"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
            <Play className="h-5 w-5 fill-brand-500" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-500">
              {pct > 0 ? "Continue" : "Start"}{unitTitle ? ` · ${unitTitle}` : ""}
            </span>
            <span className="block truncate font-display text-lg font-extrabold text-slate-800">{lesson.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-brand-500" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate("/practice")}
          className="relative mt-5 flex w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 text-left shadow-[0_5px_0_0_rgba(0,0,0,0.22)] transition active:translate-y-1 active:shadow-none"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-grass-50 text-grass-600">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-grass-600">All lessons complete</span>
            <span className="block font-display text-lg font-extrabold text-slate-800">Keep sharp with practice</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-grass-600" />
        </button>
      )}

      {/* Unit progress under the CTA */}
      {!loading && lesson && unitTotal > 0 && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-white/75">
            <span className="truncate">{unitTitle}</span>
            <span className="tabular-nums">{unitDone}/{unitTotal}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${unitTotal ? Math.round((unitDone / unitTotal) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Placement invite for brand-new users, inside the hero — not a card */}
      {isNewUser && (
        <button
          type="button"
          onClick={() => navigate("/placement")}
          className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white/90 underline decoration-white/40 underline-offset-4 transition hover:text-white"
        >
          <Target className="h-4 w-4" /> Not a beginner? Take the placement test
        </button>
      )}
    </section>
  );
}

// Serpentine horizontal offsets — nodes weave left/right down the page like
// Duolingo's path. The cycle reads as a gentle S-curve.
const PATH_OFFSETS = [0, -58, -86, -58, 0, 58, 86, 58];

// One milestone on the winding path.
function PathNode({ lesson, offset, onStart }) {
  const status = lesson.status || "locked";
  const done = status === "completed";
  const current = status === "current";
  const locked = status === "locked";
  return (
    <div className="relative flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      {/* START bubble bobbing over the current node */}
      {current && (
        <span className="absolute -top-9 z-10 animate-bouncey rounded-xl bg-white px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wide text-brand-600 shadow-md ring-1 ring-brand-200">
          Start
          <span className="absolute left-1/2 top-full -ml-1.5 h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-white" />
        </span>
      )}
      <button
        type="button"
        disabled={locked}
        onClick={() => !locked && onStart(lesson)}
        title={locked ? "Finish the previous lesson to unlock" : lesson.title}
        aria-label={lesson.title}
        className={
          "relative grid h-[68px] w-[68px] place-items-center rounded-full transition active:translate-y-1 " +
          (done
            ? "bg-grass-500 text-white shadow-[0_6px_0_0_#3A8A00] hover:brightness-105"
            : current
            ? "bg-brand-500 text-white shadow-node-brand hover:brightness-105"
            : "cursor-default bg-slate-200 text-slate-400 shadow-[0_6px_0_0_#CBD5E1]")
        }
      >
        {current && <span className="absolute inset-0 animate-ringPulse rounded-full ring-4 ring-brand-300" />}
        {done ? (
          <Check className="h-8 w-8" strokeWidth={3.5} />
        ) : current ? (
          <Play className="h-7 w-7 fill-white" />
        ) : (
          <Lock className="h-6 w-6" />
        )}
        {done && (
          <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-gold-400 text-white ring-2 ring-white">
            <Star className="h-3.5 w-3.5 fill-white" />
          </span>
        )}
      </button>
      <span className={"mt-2 max-w-[120px] text-center text-xs font-bold leading-tight " + (locked ? "text-slate-400" : "text-slate-600")}>
        {lesson.title}
      </span>
    </div>
  );
}

// A unit on the journey: ornamental gradient band + its lessons weaving down
// the page + a gold checkpoint medallion as the unit's final milestone.
function PathUnit({ unit, index, onStart, onCheckpoint }) {
  const theme = UNIT_THEMES[index % UNIT_THEMES.length];
  const total = unit.items.length;
  const done = unit.items.filter((l) => l.status === "completed").length;
  const complete = total > 0 && done === total;
  return (
    <section className="mb-4">
      {/* Unit band — the Armenian carpet identity */}
      <div className={`overflow-hidden rounded-2xl bg-gradient-to-r ${theme.band} ${theme.shadow}`}>
        <div className="flex items-center justify-between px-5 py-3 text-white">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">Unit {index + 1}</div>
            <div className="truncate font-display text-lg font-extrabold">{unit.title}</div>
          </div>
          <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-sm font-extrabold tabular-nums">
            {done}/{total}
          </span>
        </div>
        <CarpetBorder />
      </div>

      {/* The winding milestones */}
      <div className="flex flex-col items-center gap-7 py-8">
        {unit.items.map((lesson, i) => (
          <PathNode
            key={lesson.id ?? lesson.slug}
            lesson={lesson}
            offset={PATH_OFFSETS[i % PATH_OFFSETS.length]}
            onStart={onStart}
          />
        ))}

        {/* Checkpoint medallion — the unit's summit gate */}
        <div
          className="relative flex flex-col items-center"
          style={{ transform: `translateX(${PATH_OFFSETS[unit.items.length % PATH_OFFSETS.length]}px)` }}
        >
          <button
            type="button"
            disabled={!complete}
            onClick={() => complete && onCheckpoint(unit)}
            title={complete ? `Test your ${unit.title} knowledge` : "Finish every lesson in this unit to unlock"}
            className={
              "grid h-[76px] w-[76px] place-items-center rounded-full transition active:translate-y-1 " +
              (complete
                ? "bg-gold-500 text-white shadow-[0_6px_0_0_#B45309] hover:brightness-105"
                : "cursor-default bg-slate-200 text-slate-400 shadow-[0_6px_0_0_#CBD5E1]")
            }
          >
            <ShieldCheck className="h-9 w-9" />
          </button>
          <span className={"mt-2 text-xs font-extrabold uppercase tracking-wide " + (complete ? "text-gold-600" : "text-slate-400")}>
            Checkpoint
          </span>
        </div>
      </div>
    </section>
  );
}

// The journey's end — Ararat waits at the bottom of the path.
function PathSummit({ pct }) {
  return (
    <div className="flex flex-col items-center pb-10 pt-2 text-center">
      <Ararat className="h-20 w-32" />
      <div className="mt-2 font-display text-base font-extrabold text-slate-700">The Summit</div>
      <div className="text-xs font-semibold text-slate-400">{pct}% of the journey climbed</div>
    </div>
  );
}

// Compact quick-access tiles (replaces the tall sidebar card stack).
function QuickTiles({ navigate }) {
  const tiles = [
    { icon: Dumbbell, label: "Practice", to: "/practice", tone: "bg-brand-50 text-brand-600" },
    { icon: BookOpen, label: "Words", to: "/vocabulary", tone: "bg-grass-50 text-grass-600" },
    { icon: BarChart2, label: "Progress", to: "/progress", tone: "bg-feather-50 text-feather-700" },
    { icon: Trophy, label: "Leaderboard", to: "/leaderboard", tone: "bg-amber-50 text-gold-600" },
    { icon: Users, label: "Friends", to: "/friends", tone: "bg-feather-50 text-feather-600" },
    { icon: Store, label: "Shop", to: "/shop", tone: "bg-pom-50 text-pom-500" },
    { icon: Star, label: "Achievements", to: "/achievements", tone: "bg-gold-50 text-gold-600" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <button
          key={t.to}
          type="button"
          onClick={() => navigate(t.to)}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 ring-1 ring-slate-200 shadow-sm transition hover:ring-brand-200 active:translate-y-0.5"
        >
          <span className={"grid h-10 w-10 place-items-center rounded-2xl " + t.tone}>
            <t.icon className="h-5 w-5" />
          </span>
          <span className="w-full truncate text-center text-[11px] font-extrabold text-slate-600">{t.label}</span>
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

  // Progress within the current unit (for the hero's progress bar).
  const currentUnit = useMemo(
    () => units.find((unit) => unit.key === currentUnitKey) || null,
    [units, currentUnitKey]
  );
  const unitDone = currentUnit ? currentUnit.items.filter((l) => l.status === "completed").length : 0;
  const unitTotal = currentUnit ? currentUnit.items.length : 0;

  const openCheckpoint = (unit) => {
    const ids = unit.items.map((l) => l.id).filter((id) => id != null).join(",");
    navigate(`/checkpoint?lessons=${encodeURIComponent(ids)}&title=${encodeURIComponent(unit.title)}`);
  };

  // ── Architecture ──────────────────────────────────────────────────────────
  // One job per screen: get the learner into today's lesson. The hero owns
  // that action; the winding path IS the page; everything else lives in a
  // sticky rail on desktop and stacks after the path on mobile.
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <StreakCelebration streak={stats.streak} />
      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
        {/* ── Main: hero + the journey ── */}
        <main className="mx-auto w-full max-w-xl lg:mx-0 lg:justify-self-center">
          <HeroBand
            firstName={firstName}
            streak={stats.streak}
            lesson={currentLesson}
            unitTitle={currentUnitTitle}
            unitDone={unitDone}
            unitTotal={unitTotal}
            loading={loadingLessons}
            isNewUser={!loadingLessons && doneLessons === 0 && totalLessons > 0}
            onStart={handleStart}
            navigate={navigate}
          />

          {/* Stat strip (mobile only — header already shows these on md+) */}
          <StatStrip token={token} streak={stats.streak} xp={stats.total_xp} />

          {error && (
            <div className="mb-4 rounded-2xl border-2 border-cardinal-100 bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-600">
              {error}
            </div>
          )}

          {/* The Journey to Ararat — the page's centerpiece */}
          {loadingLessons ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Mapping your journey…</span>
            </div>
          ) : units.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center font-semibold text-slate-600 ring-1 ring-slate-200">
              No lessons available yet. Check back soon!
            </div>
          ) : (
            <>
              {units.map((unit, ui) => (
                <PathUnit
                  key={unit.key}
                  unit={unit}
                  index={ui}
                  onStart={handleStart}
                  onCheckpoint={openCheckpoint}
                />
              ))}
              <PathSummit pct={journeyPct} />
            </>
          )}
        </main>

        {/* ── Rail: everything that supports the journey ── */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <DailyGoalCard todayXp={stats.today_xp} />
          <DailyQuestsCard token={token} />
          <ReviewCard token={token} />
          <MistakesCard token={token} navigate={navigate} />
          <StreakCard token={token} streak={stats.streak} />
          <ChestCard token={token} />
          <QuickTiles navigate={navigate} />
        </aside>
      </div>
    </div>
  );
}
