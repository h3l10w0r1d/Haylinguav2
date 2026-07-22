// src/Dashboard.jsx — a vibrant, premium dashboard with light + dark themes.
// A gradient hero anchors the page, cards lift on soft shadows (light) or a
// hairline ring (dark), colored tinted chips carry energy, the mascot has life.
// Theme is class-based (Tailwind darkMode: "class"); see src/lib/theme.js.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, Play, Loader2, Trophy, Users, ChevronRight, ArrowRight, Target, Zap, Crown, Star, Check, Snowflake, Gem, Gift, Dumbbell, ShieldCheck, Heart, Store, BookOpen, BarChart2 } from "lucide-react";
import owl from "./assets/character-owl.png";
import StreakFlame from "./lib/StreakFlame";
import StreakCelebration from "./lib/StreakCelebration";
import ChestOpening from "./lib/ChestOpening";
import { preloadLesson } from "./lib/lessonPreload";

const QICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

// One card primitive: white lifted on a soft shadow (light) / dark surface with
// a hairline ring (dark).
const CARD =
  "rounded-2xl bg-white shadow-[0_2px_10px_-2px_rgba(28,25,23,0.08)] ring-1 ring-black/[0.03] " +
  "dark:bg-[#18181b] dark:shadow-none dark:ring-white/[0.07]";

// Accent chip presets — tinted circle bg + icon color, both themes. Color lives
// here so the whole page pulls from one palette.
const ACCENT = {
  brand:    { chip: "bg-brand-50 dark:bg-brand-500/15",       icon: "text-brand-500 dark:text-brand-400" },
  grass:    { chip: "bg-grass-50 dark:bg-grass-500/15",       icon: "text-grass-600 dark:text-grass-400" },
  amber:    { chip: "bg-amber-50 dark:bg-amber-500/15",       icon: "text-amber-500 dark:text-amber-400" },
  feather:  { chip: "bg-feather-50 dark:bg-feather-500/15",   icon: "text-feather-500 dark:text-feather-400" },
  cardinal: { chip: "bg-cardinal-50 dark:bg-cardinal-500/15", icon: "text-cardinal-500 dark:text-cardinal-400" },
  pom:      { chip: "bg-pom-50 dark:bg-pom-500/15",           icon: "text-pom-500 dark:text-pom-400" },
  gold:     { chip: "bg-gold-100 dark:bg-gold-500/20",        icon: "text-gold-600 dark:text-gold-400" },
};

// Small section label used across every card header.
function Label({ children }) {
  return <div className="text-[13px] font-extrabold text-stone-800 dark:text-stone-100">{children}</div>;
}

// A colored tinted circle behind an icon — the page's unit of "energy".
function Chip({ chip, icon: Icon, size = "h-9 w-9", ic = "h-4.5 w-4.5" }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${size} ${chip.chip}`}>
      <Icon className={`${ic} ${chip.icon}`} />
    </span>
  );
}

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

  const quests = data?.quests || [];
  const allDone =
    quests.length > 0 &&
    quests.every((q) => q.done) &&
    !quests.some((q) => q.claimable);

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

  if (allDone) {
    if (celebrating) {
      return (
        <div className={"quests-celebrate flex flex-col items-center overflow-hidden p-6 text-center " + CARD}>
          <div className="relative grid place-items-center">
            <span className="quests-ring absolute h-14 w-14 rounded-full bg-grass-500/25" />
            <span className="quests-ring quests-ring-2 absolute h-14 w-14 rounded-full bg-grass-500/25" />
            <div className="quests-badge-pop relative grid h-14 w-14 place-items-center rounded-full bg-grass-500 text-white shadow-[0_6px_16px_-4px_rgba(88,204,2,0.6)]">
              <QuestTick className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-3 text-sm font-extrabold text-stone-900 dark:text-white">All quests complete!</div>
          <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">Come back tomorrow for more.</div>
        </div>
      );
    }
    return (
      <div className={"quests-collapse flex items-center gap-3 overflow-hidden p-4 " + CARD}>
        <Chip chip={ACCENT.grass} icon={QuestTick} size="h-10 w-10" ic="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-stone-900 dark:text-white">Daily quests complete</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">All {quests.length} done</div>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-grass-600 dark:text-grass-400">{quests.length}/{quests.length}</span>
      </div>
    );
  }

  return (
    <div className={"p-5 " + CARD}>
      <div className="flex items-center justify-between">
        <Label>Daily quests</Label>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold tabular-nums text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">{data.completed}/{data.total}</span>
      </div>
      <div className="mt-4 space-y-4">
        {data.quests.map((q) => {
          const Icon = QICON[q.icon] || Target;
          const pct = q.target ? Math.round((q.progress / q.target) * 100) : 0;
          return (
            <div key={q.id} className="flex items-center gap-3">
              <Chip chip={q.done ? ACCENT.grass : ACCENT.brand} icon={q.done ? Check : Icon} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[13px] font-semibold text-stone-700 dark:text-stone-200">{q.desc}</div>
                  {q.claimed ? (
                    <span className="shrink-0 text-xs font-bold text-grass-600 dark:text-grass-400">Claimed</span>
                  ) : (
                    <span className="shrink-0 text-xs font-bold tabular-nums text-stone-400 dark:text-stone-500">{q.progress}/{q.target}</span>
                  )}
                </div>
                {q.claimable ? (
                  <button
                    onClick={() => claim(q.id)}
                    disabled={claiming === q.id}
                    className="mt-1.5 w-full rounded-lg bg-gradient-to-r from-brand-500 to-pom-500 py-1.5 text-xs font-extrabold text-white shadow-[0_4px_12px_-4px_rgba(232,95,0,0.6)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
                  >
                    {claiming === q.id ? "…" : `Claim +${q.reward_xp} XP`}
                  </button>
                ) : (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-white/[0.07]">
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
  const [overlayReward, setOverlayReward] = useState(null);

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
      <div className={"flex items-center gap-3 p-4 " + CARD}>
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-2xl dark:bg-amber-500/15"
          style={opening ? { animation: "chestShake .85s ease-in-out" } : undefined}
        >
          🎁
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-stone-900 dark:text-white">
            {chests} chest{chests === 1 ? "" : "s"} to open
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500">
            {openErr ? <span className="text-cardinal-500 dark:text-cardinal-400">Couldn't open — try again.</span> : "Gems or an XP boost inside"}
          </div>
        </div>
        <button
          onClick={open}
          disabled={opening || chests <= 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-pom-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-[0_4px_12px_-4px_rgba(232,95,0,0.6)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
        >
          <Gift className="h-3.5 w-3.5" /> {opening ? "…" : "Open"}
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
  const lit = n > 0 && practicedToday && !frozen;
  const atRisk = n > 0 && !practicedToday && !frozen;
  const week = Array.isArray(days) ? days.slice(-7) : [];
  const cap = freeze.freeze_cap || 2;

  const status = frozen
    ? { text: "Frozen", cls: "bg-feather-50 text-feather-600 dark:bg-feather-500/15 dark:text-feather-400" }
    : lit
    ? { text: "Lit", cls: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400" }
    : atRisk
    ? { text: "At risk", cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" }
    : null;

  return (
    <div className={"p-5 " + CARD}>
      <div className="flex items-center gap-3">
        <StreakFlame size={44} lit={lit} frozen={frozen} />
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold leading-none tabular-nums text-stone-900 dark:text-white">{n}</span>
            <span className="text-[13px] font-semibold text-stone-500 dark:text-stone-400">day streak</span>
          </div>
        </div>
        {status && <span className={"rounded-full px-2.5 py-1 text-xs font-extrabold " + status.cls}>{status.text}</span>}
      </div>

      {week.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5">
          {week.map((d, i) => {
            const on = Number(d?.value ?? 0) > 0;
            const label = (String(d?.label ?? "").trim()[0] || "·").toUpperCase();
            return (
              <div
                key={i}
                title={`${d?.label ?? ""}: ${Number(d?.value ?? 0)} XP`}
                className={"flex-1 grid place-items-center h-7 rounded-lg text-[10px] font-extrabold transition " +
                  (on ? "bg-gradient-to-b from-brand-400 to-brand-500 text-white shadow-[0_2px_6px_-2px_rgba(232,95,0,0.5)]" : "bg-stone-100 text-stone-400 dark:bg-white/[0.07] dark:text-stone-500")}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
        {frozen
          ? "A streak freeze is protecting your flame — practice today to thaw it."
          : lit
          ? "Flame lit for today. Come back tomorrow to keep it going."
          : atRisk
          ? "Practice today to keep your streak alive."
          : "Complete a lesson to light your streak."}
      </p>

      {atRisk && freeze.freezes === 0 && (
        <button
          onClick={() => navigate("/practice")}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(255,122,26,0.6)] transition hover:bg-brand-600 active:scale-[0.98]"
        >
          Practice now <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-white/[0.07]">
        <div className="flex items-center gap-2" title="A streak freeze covers one missed day.">
          <div className="flex gap-0.5">
            {Array.from({ length: cap }).map((_, i) => (
              <Snowflake key={i} className={"h-3.5 w-3.5 " + (i < freeze.freezes ? "text-feather-500" : "text-stone-300 dark:text-stone-600")} />
            ))}
          </div>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {freeze.freezes}/{cap} freeze{cap === 1 ? "" : "s"}
          </span>
        </div>
        {freeze.freezes < cap && (
          <button
            onClick={() => navigate("/shop")}
            className="inline-flex items-center gap-1 rounded-lg bg-feather-50 px-2.5 py-1.5 text-xs font-extrabold text-feather-600 transition hover:bg-feather-100 dark:bg-feather-500/15 dark:text-feather-300 dark:hover:bg-feather-500/25"
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
    <button onClick={onOpen} className={"flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 " + CARD}>
      <Chip chip={ACCENT.amber} icon={Trophy} size="h-10 w-10" ic="h-5 w-5" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-stone-900 dark:text-white">Achievements</div>
        <div className="text-xs text-stone-400 dark:text-stone-500">{data ? `${data.earned} of ${data.total} unlocked` : "Earn badges as you learn."}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
    </button>
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

  React.useEffect(() => {
    const due = stats?.due_today || 0;
    document.title = due > 0 ? `(${due}) Haylingua` : "Haylingua";
    return () => { document.title = "Haylingua"; };
  }, [stats?.due_today]);

  if (!stats || stats.total === 0) return null;

  const due = stats.due_today;
  const urgent = due > 0;

  return (
    <div className={"p-5 " + CARD}>
      <div className="flex items-center justify-between">
        <Label>Review</Label>
        {urgent && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">Due now</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={"text-3xl font-extrabold tabular-nums " + (urgent ? "text-brand-600 dark:text-brand-400" : "text-stone-400 dark:text-stone-500")}>{due}</span>
        <span className="text-sm text-stone-500 dark:text-stone-400">{due === 1 ? "card due" : "cards due"}</span>
      </div>
      <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">
        {stats.mastered} mastered · {stats.learning} learning · {stats.new_cards} new
      </div>
      <button
        onClick={() => navigate("/review")}
        className={
          "mt-4 w-full rounded-xl py-2.5 text-sm font-extrabold transition active:scale-[0.99] " +
          (urgent
            ? "bg-brand-500 text-white shadow-[0_6px_16px_-6px_rgba(255,122,26,0.6)] hover:bg-brand-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-white/[0.07] dark:text-stone-300 dark:hover:bg-white/[0.12]")
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
    <div className={"p-5 " + CARD}>
      <div className="flex items-center justify-between">
        <Label>Your mistakes</Label>
        <span className="rounded-full bg-cardinal-50 px-2 py-0.5 text-xs font-bold text-cardinal-500 dark:bg-cardinal-500/15 dark:text-cardinal-400">Fix them</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums text-cardinal-500 dark:text-cardinal-400">{count}</span>
        <span className="text-sm text-stone-500 dark:text-stone-400">{count === 1 ? "to re-master" : "to re-master"}</span>
      </div>
      <button
        onClick={() => navigate("/mistakes")}
        className="mt-4 w-full rounded-xl bg-cardinal-500 py-2.5 text-sm font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(255,75,75,0.6)] transition hover:bg-cardinal-600 active:scale-[0.99]"
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
  const [celebrating, setCelebrating] = useState(false);
  const prevDone = React.useRef(null);

  function pickGoal(g) {
    setGoal(g);
    localStorage.setItem("hay_daily_goal", String(g));
  }

  const xp = Number(todayXp) || 0;
  const pct = Math.min(100, Math.round((xp / goal) * 100));
  const done = xp >= goal;

  // Same "just finished" one-shot celebration as the daily quests card,
  // then it collapses the same way — the two "you're done for today" cards
  // should feel like one visual language, not two different patterns.
  useEffect(() => {
    const prev = prevDone.current;
    prevDone.current = done;
    if (prev === false && done) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 1900);
      return () => clearTimeout(t);
    }
  }, [done]);

  if (done) {
    if (celebrating) {
      return (
        <div className={"quests-celebrate flex flex-col items-center overflow-hidden p-6 text-center " + CARD}>
          <div className="relative grid place-items-center">
            <span className="quests-ring absolute h-14 w-14 rounded-full bg-grass-500/25" />
            <span className="quests-ring quests-ring-2 absolute h-14 w-14 rounded-full bg-grass-500/25" />
            <div className="quests-badge-pop relative grid h-14 w-14 place-items-center rounded-full bg-grass-500 text-white shadow-[0_6px_16px_-4px_rgba(88,204,2,0.6)]">
              <Check className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-3 text-sm font-extrabold text-stone-900 dark:text-white">Daily goal complete!</div>
          <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{xp} XP today — nice work.</div>
        </div>
      );
    }
    return (
      <div className={"quests-collapse flex items-center gap-3 overflow-hidden p-4 " + CARD}>
        <Chip chip={ACCENT.grass} icon={Check} size="h-10 w-10" ic="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-stone-900 dark:text-white">Daily goal met</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">{goal} XP today</div>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-grass-600 dark:text-grass-400">{xp}/{goal}</span>
      </div>
    );
  }

  return (
    <div className={"p-5 " + CARD}>
      <div className="flex items-center justify-between">
        <Label>Daily goal</Label>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold leading-none text-stone-900 tabular-nums dark:text-white">{xp}</span>
        <span className="text-sm text-stone-500 dark:text-stone-400">/ {goal} XP today</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-500"
          style={{ width: `${Math.max(pct, xp > 0 ? 6 : 0)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {DAILY_GOAL_OPTIONS.map((g) => (
          <button
            key={g}
            onClick={() => pickGoal(g)}
            className={"flex-1 rounded-lg py-1.5 text-xs font-extrabold transition " + (goal === g ? "bg-brand-500 text-white shadow-[0_4px_10px_-4px_rgba(255,122,26,0.6)]" : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-white/[0.07] dark:text-stone-300 dark:hover:bg-white/[0.12]")}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

// Stat row — hearts / streak / XP / gems. Each a lifted card with a colored
// tinted chip + big number. This is where the palette gets to sing.
function KpiStrip({ token, streak, xp, onPremiumChange }) {
  const [hearts, setHearts] = useState(null);
  const [gems, setGems] = useState(null);

  useEffect(() => {
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    const loadHearts = () =>
      fetch(`${API_BASE_URL}/me/hearts`, { headers: h })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setHearts(d);
          onPremiumChange?.(!!d.is_premium);
        })
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

  const items = [
    { icon: hearts?.is_premium ? Crown : Heart, label: "Hearts", value: heartLabel, accent: hearts?.is_premium ? ACCENT.gold : ACCENT.cardinal },
    { icon: Flame, label: "Streak", value: streak, accent: ACCENT.brand },
    { icon: Zap, label: "XP", value: xp, accent: ACCENT.amber },
    { icon: Gem, label: "Gems", value: gems == null ? "–" : gems, accent: ACCENT.feather },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={"flex items-center gap-2.5 px-3.5 py-3 " + CARD}>
          <Chip chip={it.accent} icon={it.icon} size="h-9 w-9" ic="h-4.5 w-4.5" />
          <div className="min-w-0">
            <div className="text-xl font-extrabold leading-none tabular-nums text-stone-900 dark:text-white">{it.value}</div>
            <div className="text-[11px] font-semibold text-stone-400 dark:text-stone-500">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// The hero: a warm apricot→pomegranate gradient with the mascot, the greeting,
// and the single next action on a white button. Identical in both themes — the
// signature colorful anchor.
function HeroCard({ firstName, lesson, unitTitle, unitDone, unitTotal, loading, isNewUser, onStart, navigate, isPremium }) {
  const pct = unitTotal ? Math.round((unitDone / unitTotal) * 100) : 0;
  const complete = !loading && !lesson;
  return (
    <section
      className={
        "relative mb-4 overflow-hidden rounded-3xl p-6 text-white sm:p-8 " +
        (complete
          ? "bg-gradient-to-br from-grass-400 via-grass-500 to-feather-500 shadow-[0_18px_40px_-16px_rgba(88,204,2,0.5)]"
          : "bg-gradient-to-br from-brand-400 via-brand-500 to-pom-500 shadow-[0_18px_40px_-16px_rgba(232,95,0,0.5)]")
      }
    >
      {/* soft depth blobs */}
      <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-black/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-white/85">
              Բարև{firstName ? `, ${firstName}` : ""} 👋
            </div>
            {isPremium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-[0_2px_0_0_#B45309]">
                <Crown className="h-3 w-3" /> Premium
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight drop-shadow-sm sm:text-[30px]">
            {loading ? "Loading your journey…" : lesson ? "Ready for today's lesson?" : "You've reached the summit!"}
          </h1>
        </div>
        <img src={owl} alt="" className="hidden h-20 w-auto shrink-0 animate-floaty object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.3)] sm:block" />
      </div>

      {loading ? (
        <div className="relative mt-6 h-[72px] animate-pulse rounded-2xl bg-white/20" />
      ) : lesson ? (
        <button
          type="button"
          onClick={() => onStart(lesson)}
          className="relative mt-6 flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left text-stone-900 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-pom-500 text-white shadow-[0_6px_14px_-4px_rgba(232,95,0,0.6)]">
            <Play className="h-5 w-5 fill-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold uppercase tracking-wide text-brand-600">
              {pct > 0 ? "Continue lesson" : "Start lesson"}
            </span>
            <span className="block truncate text-lg font-extrabold">{lesson.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-brand-500" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate("/practice")}
          className="relative mt-6 flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left text-stone-900 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-grass-500 text-white shadow-[0_6px_14px_-4px_rgba(88,204,2,0.6)]">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold uppercase tracking-wide text-grass-600">All lessons complete</span>
            <span className="block text-lg font-extrabold">Keep sharp with practice</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-grass-600" />
        </button>
      )}

      {!loading && lesson && unitTotal > 0 && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-xs font-semibold text-white/85">
            <span className="truncate">{unitTitle}</span>
            <span className="tabular-nums">{unitDone}/{unitTotal}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/15">
            <div className="h-full rounded-full bg-white shadow-sm" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

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

// One lesson as a full-width row: a colored status circle, the title, and a
// plain-word state. The current lesson gets a warm tinted highlight so the
// next step pops off the outline.
// Duolingo-style winding path: nodes zigzag left/right down the unit,
// connected by a smooth SVG curve drawn through their (deterministic —
// no DOM measurement needed) centers. The checkpoint is the path's final
// node, styled distinctly (amber/trophy) same as before.
const PATH_NODE = 64; // node diameter, px
const PATH_ROW_H = 92; // vertical spacing between node centers, px
const PATH_OFFSETS = [0, 64, 96, 64, 0, -64, -96, -64]; // horizontal offset cycle, px
const PATH_HALF_W = 96 + PATH_NODE / 2 + 8; // half the widest offset + node radius + margin

function pathNodeCenter(i) {
  return { x: PATH_HALF_W + PATH_OFFSETS[i % PATH_OFFSETS.length], y: PATH_ROW_H / 2 + i * PATH_ROW_H };
}

// A course can run hundreds of lessons across dozens of units — mounting
// every unit's LearningPath (one absolutely-positioned node + button per
// lesson, plus an SVG curve) all at once on load is what actually made the
// dashboard slow/crash-prone, not the API payload (that's small — scalar
// fields only). This mounts a unit's path only once it's about to scroll
// into view, and never unmounts it again afterward (no re-virtualizing on
// scroll-away — a few hundred already-mounted nodes is cheap; the expensive
// part was mounting them all in the same initial frame).
function useMountWhenNear(eager, rootMargin = "1000px 0px") {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(eager);

  useEffect(() => {
    if (mounted || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMounted(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  return [ref, mounted];
}

function LearningPathNode({ lesson, index, onStart }) {
  const status = lesson.status || "locked";
  const done = status === "completed";
  const current = status === "current";
  const locked = status === "locked";
  const { x, y } = pathNodeCenter(index);

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: x - PATH_NODE / 2, top: y - PATH_NODE / 2, width: PATH_NODE }}
    >
      {current ? (
        <span className="absolute -top-9 whitespace-nowrap rounded-xl bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-600 shadow-md ring-1 ring-brand-100 dark:bg-[#232327] dark:text-brand-400 dark:ring-brand-500/25">
          Start
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-[#232327]" />
        </span>
      ) : null}
      <button
        type="button"
        disabled={locked}
        onClick={() => !locked && onStart(lesson)}
        onMouseEnter={() => !locked && lesson.slug && preloadLesson(lesson.slug, API_BASE_URL)}
        title={locked ? "Finish the previous lesson to unlock" : lesson.title}
        style={{ width: PATH_NODE, height: PATH_NODE, boxShadow: locked ? undefined : "0 5px 0 0 rgba(0,0,0,0.15)" }}
        className={
          "relative grid shrink-0 place-items-center rounded-full transition active:translate-y-1 active:shadow-none " +
          (current
            ? "bg-brand-500 text-white"
            : done
            ? "bg-grass-500 text-white hover:brightness-105"
            : "cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-white/[0.12] dark:text-stone-400")
        }
      >
        {current ? <span className="absolute inset-0 rounded-full bg-brand-400 opacity-60 animate-ping" /> : null}
        {done ? (
          <Check className="relative h-7 w-7" strokeWidth={3} />
        ) : current ? (
          <Play className="relative h-6 w-6 fill-white" />
        ) : (
          <Lock className="relative h-5 w-5" />
        )}
      </button>
      <span
        className={
          "mt-1.5 max-w-[6.5rem] truncate text-center text-[11px] font-bold " +
          (current ? "text-stone-900 dark:text-white" : locked ? "text-stone-400 dark:text-stone-500" : "text-stone-500 dark:text-stone-400")
        }
      >
        {lesson.title}
      </span>
    </div>
  );
}

function LearningPathCheckpoint({ unit, complete, onCheckpoint, index }) {
  const { x, y } = pathNodeCenter(index);
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - PATH_NODE / 2, top: y - PATH_NODE / 2, width: PATH_NODE }}>
      <button
        type="button"
        disabled={!complete}
        onClick={() => complete && onCheckpoint(unit)}
        title={complete ? `Test your ${unit.title} knowledge` : "Finish every lesson in this unit to unlock"}
        style={{ width: PATH_NODE, height: PATH_NODE, boxShadow: complete ? "0 5px 0 0 rgba(0,0,0,0.15)" : undefined }}
        className={
          "grid shrink-0 place-items-center rounded-full transition active:translate-y-1 active:shadow-none " +
          (complete
            ? "bg-amber-500 text-white hover:brightness-105"
            : "cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-white/[0.12] dark:text-stone-400")
        }
      >
        <ShieldCheck className="h-7 w-7" />
      </button>
      <span className={"mt-1.5 text-center text-[11px] font-bold " + (complete ? "text-amber-700 dark:text-amber-400" : "text-stone-400 dark:text-stone-500")}>
        Checkpoint
      </span>
    </div>
  );
}

function LearningPath({ unit, onStart, onCheckpoint, complete }) {
  const nodeCount = unit.items.length + 1; // + checkpoint node
  const width = PATH_HALF_W * 2;
  const height = PATH_ROW_H * (nodeCount - 1) + PATH_ROW_H;

  // Smooth curve through every node center, one cubic-bezier segment per
  // consecutive pair — control points offset vertically so the line eases
  // into each turn instead of kinking at it.
  const d = useMemo(() => {
    const pts = Array.from({ length: nodeCount }, (_, i) => pathNodeCenter(i));
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const midY = (prev.y + cur.y) / 2;
      path += ` C ${prev.x} ${midY}, ${cur.x} ${midY}, ${cur.x} ${cur.y}`;
    }
    return path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeCount]);

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
        <path d={d} fill="none" strokeWidth={10} strokeLinecap="round" className="stroke-stone-100 dark:stroke-white/[0.06]" />
        <path
          d={d}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray="2 20"
          className="stroke-stone-300 dark:stroke-white/[0.14]"
        />
      </svg>
      {unit.items.map((lesson, i) => (
        <LearningPathNode key={lesson.id ?? lesson.slug} lesson={lesson} index={i} onStart={onStart} />
      ))}
      <LearningPathCheckpoint unit={unit} complete={complete} onCheckpoint={onCheckpoint} index={unit.items.length} />
    </div>
  );
}

// A unit card: header, a colored progress bar, then its lessons as a list
// ending in a distinctly-styled checkpoint.
function CurriculumUnit({ unit, index, isCurrent, onStart, onCheckpoint }) {
  const total = unit.items.length;
  const done = unit.items.filter((l) => l.status === "completed").length;
  const complete = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = complete
    ? "bg-gradient-to-r from-grass-400 to-grass-500"
    : isCurrent
    ? "bg-gradient-to-r from-brand-400 to-brand-500"
    : "bg-stone-200 dark:bg-white/10";

  // The header/progress-bar above is cheap and always renders — only the
  // path itself (one node per lesson) is deferred. Eager for the current
  // unit and the first couple, so there's no placeholder flash on load for
  // whatever's already above the fold.
  const [pathRef, pathMounted] = useMountWhenNear(isCurrent || index < 2);
  const placeholderHeight = PATH_ROW_H * total + PATH_ROW_H / 2;

  return (
    <section className={"mb-3 p-5 " + CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-extrabold uppercase tracking-wide text-stone-400 dark:text-stone-500">Unit {index + 1}</span>
          <h3 className="truncate text-base font-extrabold text-stone-900 dark:text-white">{unit.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold tabular-nums text-stone-500 dark:bg-white/[0.07] dark:text-stone-300">{done}/{total}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-white/[0.07]">
        <div className={"h-full rounded-full transition-all " + bar} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4" ref={pathRef}>
        {pathMounted ? (
          <LearningPath unit={unit} onStart={onStart} onCheckpoint={onCheckpoint} complete={complete} />
        ) : (
          <div style={{ height: placeholderHeight }} className="flex items-center justify-center text-stone-300 dark:text-stone-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
    </section>
  );
}

function CurriculumSummit({ pct }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <div className="text-sm font-extrabold text-stone-600 dark:text-stone-300">You're at the summit 🎉</div>
      <div className="text-xs text-stone-400 dark:text-stone-500">{pct}% of the journey climbed</div>
    </div>
  );
}

// Quick access — colored tinted chips in one card.
function QuickLinks({ navigate }) {
  const tiles = [
    { icon: Dumbbell, label: "Practice", to: "/practice", accent: ACCENT.brand },
    { icon: BookOpen, label: "Words", to: "/vocabulary", accent: ACCENT.grass },
    { icon: BarChart2, label: "Progress", to: "/progress", accent: ACCENT.feather },
    { icon: Trophy, label: "Leaderboard", to: "/leaderboard", accent: ACCENT.amber },
    { icon: Users, label: "Friends", to: "/friends", accent: ACCENT.feather },
    { icon: Store, label: "Shop", to: "/shop", accent: ACCENT.pom },
    { icon: Star, label: "Achievements", to: "/achievements", accent: ACCENT.amber },
  ];
  return (
    <div className={"grid grid-cols-4 gap-1 p-2.5 " + CARD}>
      {tiles.map((t) => (
        <button
          key={t.to}
          type="button"
          onClick={() => navigate(t.to)}
          className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition hover:bg-stone-50 active:scale-[0.96] dark:hover:bg-white/[0.04]"
        >
          <Chip chip={t.accent} icon={t.icon} size="h-10 w-10" ic="h-5 w-5" />
          <span className="w-full truncate text-center text-[11px] font-bold text-stone-600 dark:text-stone-300">{t.label}</span>
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
  const [isPremium, setIsPremium] = useState(false);

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

  const currentLesson = useMemo(() => lessons.find((l) => l.status === "current") || null, [lessons]);

  // Warm the lesson-JSON + TTS caches for the learner's next-up lesson as
  // soon as we know which one it is, so opening it is instant instead of a
  // spinner + silent audio on first "Listen" tap.
  useEffect(() => {
    if (currentLesson?.slug) preloadLesson(currentLesson.slug, API_BASE_URL);
  }, [currentLesson?.slug]);

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
  // A vibrant command center: a colored stat row, a gradient hero that owns the
  // primary action, curriculum as lifted cards, and a sidebar of colorful
  // supporting cards. Light + dark via Tailwind's class strategy.
  return (
    <div className="min-h-screen bg-[#f5f4f1] dark:bg-[#0d0d0f]">
      <StreakCelebration streak={stats.streak} />
      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:gap-6">
        {/* ── Main: stats + hero + curriculum ── */}
        <main className="mx-auto w-full max-w-xl lg:mx-0 lg:justify-self-center">
          <KpiStrip token={token} streak={stats.streak} xp={stats.total_xp} onPremiumChange={setIsPremium} />

          <HeroCard
            firstName={firstName}
            lesson={currentLesson}
            unitTitle={currentUnitTitle}
            unitDone={unitDone}
            unitTotal={unitTotal}
            loading={loadingLessons}
            isNewUser={!loadingLessons && doneLessons === 0 && totalLessons > 0}
            onStart={handleStart}
            navigate={navigate}
            isPremium={isPremium}
          />

          {error && (
            <div className="mb-4 rounded-xl border border-cardinal-200 bg-cardinal-50 px-4 py-3 text-sm font-medium text-cardinal-600 dark:border-cardinal-500/30 dark:bg-cardinal-500/10 dark:text-cardinal-300">
              {error}
            </div>
          )}

          {loadingLessons ? (
            <div className="flex items-center justify-center gap-2 py-20 text-stone-400 dark:text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Mapping your journey…</span>
            </div>
          ) : units.length === 0 ? (
            <div className={"p-8 text-center font-medium text-stone-500 dark:text-stone-400 " + CARD}>
              No lessons available yet. Check back soon!
            </div>
          ) : (
            <>
              {units.map((unit, ui) => (
                <CurriculumUnit
                  key={unit.key}
                  unit={unit}
                  index={ui}
                  isCurrent={unit.key === currentUnitKey}
                  onStart={handleStart}
                  onCheckpoint={openCheckpoint}
                />
              ))}
              <CurriculumSummit pct={journeyPct} />
            </>
          )}
        </main>

        {/* ── Rail: everything that supports the journey ── */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-6">
          <DailyGoalCard todayXp={stats.today_xp} />
          <DailyQuestsCard token={token} />
          <ReviewCard token={token} />
          <MistakesCard token={token} navigate={navigate} />
          <StreakCard token={token} streak={stats.streak} />
          <ChestCard token={token} />
          <QuickLinks navigate={navigate} />
        </aside>
      </div>
    </div>
  );
}
