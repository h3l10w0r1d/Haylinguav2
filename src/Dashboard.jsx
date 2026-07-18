// src/Dashboard.jsx — a minimal, modern dashboard.
// Flat near-black ground, hairline surfaces, one accent (apricot orange),
// calm typography. Primitive by design: no glow, no nested card chrome,
// one consistent radius scale, restraint over decoration.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, Play, Loader2, Trophy, Users, ChevronRight, ArrowRight, Target, Zap, Crown, Star, Check, Snowflake, Gem, Gift, Dumbbell, ShieldCheck, Heart, Store, BookOpen, BarChart2 } from "lucide-react";
import owl from "./assets/character-owl.png";
import StreakFlame from "./lib/StreakFlame";
import StreakCelebration from "./lib/StreakCelebration";
import ChestOpening from "./lib/ChestOpening";

const QICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

// One card primitive: hairline border, barely-there surface, single radius.
const CARD = "rounded-2xl border border-white/[0.07] bg-white/[0.02]";

// Small muted section label used across every card header.
function Label({ children }) {
  return <div className="text-[13px] font-bold text-white/90">{children}</div>;
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
            <div className="quests-badge-pop relative grid h-14 w-14 place-items-center rounded-full bg-grass-500 text-white">
              <QuestTick className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-3 text-sm font-bold text-white">All quests complete</div>
          <div className="mt-0.5 text-xs text-white/40">Come back tomorrow for more.</div>
        </div>
      );
    }
    return (
      <div className={"quests-collapse flex items-center gap-3 overflow-hidden p-4 " + CARD}>
        <QuestTick className="h-5 w-5 shrink-0 text-grass-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white">Daily quests complete</div>
          <div className="text-xs text-white/40">All {quests.length} done</div>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-white/40">{quests.length}/{quests.length}</span>
      </div>
    );
  }

  return (
    <div className={"p-5 " + CARD}>
      <div className="flex items-center justify-between">
        <Label>Daily quests</Label>
        <span className="text-xs font-semibold tabular-nums text-white/40">{data.completed}/{data.total}</span>
      </div>
      <div className="mt-4 space-y-4">
        {data.quests.map((q) => {
          const Icon = QICON[q.icon] || Target;
          const pct = q.target ? Math.round((q.progress / q.target) * 100) : 0;
          return (
            <div key={q.id}>
              <div className="flex items-center gap-2.5">
                {q.done ? (
                  <Check className="h-4 w-4 shrink-0 text-grass-400" strokeWidth={3} />
                ) : (
                  <Icon className="h-4 w-4 shrink-0 text-white/35" />
                )}
                <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/80">{q.desc}</div>
                {q.claimed ? (
                  <span className="shrink-0 text-xs font-semibold text-grass-400">Claimed</span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-white/35">{q.progress}/{q.target}</span>
                )}
              </div>
              {q.claimable ? (
                <button
                  onClick={() => claim(q.id)}
                  disabled={claiming === q.id}
                  className="mt-2 w-full rounded-lg bg-brand-500 py-1.5 text-xs font-bold text-white transition hover:bg-brand-400 active:scale-[0.99] disabled:opacity-60"
                >
                  {claiming === q.id ? "…" : `Claim +${q.reward_xp} XP`}
                </button>
              ) : (
                <div className="mt-2 ml-6 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className={"h-full rounded-full " + (q.done ? "bg-grass-500" : "bg-brand-500")} style={{ width: `${Math.max(pct, 4)}%` }} />
                </div>
              )}
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
          className="grid h-10 w-10 shrink-0 place-items-center text-2xl"
          style={opening ? { animation: "chestShake .85s ease-in-out" } : undefined}
        >
          🎁
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white">
            {chests} chest{chests === 1 ? "" : "s"} to open
          </div>
          <div className="text-xs text-white/40">
            {openErr ? <span className="text-cardinal-400">Couldn't open — try again.</span> : "Gems or an XP boost inside"}
          </div>
        </div>
        <button
          onClick={open}
          disabled={opening || chests <= 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-400 active:scale-[0.98] disabled:opacity-60"
        >
          <Gift className="h-3.5 w-3.5" /> {opening ? "Opening…" : "Open"}
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
    ? { text: "Frozen", color: "text-feather-400" }
    : lit
    ? { text: "Lit", color: "text-grass-400" }
    : atRisk
    ? { text: "At risk", color: "text-gold-400" }
    : null;

  return (
    <div className={"p-5 " + CARD}>
      <div className="flex items-center gap-3">
        <StreakFlame size={40} lit={lit} frozen={frozen} />
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold leading-none tabular-nums text-white">{n}</span>
            <span className="text-[13px] font-medium text-white/50">day streak</span>
          </div>
          {status && <div className={"mt-1 text-xs font-semibold " + status.color}>{status.text}</div>}
        </div>
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
                className={"flex-1 grid place-items-center h-7 rounded-md text-[10px] font-bold transition " +
                  (on ? "bg-brand-500 text-white" : "bg-white/[0.05] text-white/30")}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-white/45">
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
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400 active:scale-[0.98]"
        >
          Practice now <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-2" title="A streak freeze covers one missed day.">
          <div className="flex gap-0.5">
            {Array.from({ length: cap }).map((_, i) => (
              <Snowflake key={i} className={"h-3.5 w-3.5 " + (i < freeze.freezes ? "text-feather-400" : "text-white/15")} />
            ))}
          </div>
          <span className="text-xs text-white/40">
            {freeze.freezes}/{cap} freeze{cap === 1 ? "" : "s"}
          </span>
        </div>
        {freeze.freezes < cap && (
          <button
            onClick={() => navigate("/shop")}
            className="text-xs font-semibold text-white/50 transition hover:text-white"
          >
            Buy freeze
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
    <button onClick={onOpen} className={"flex w-full items-center gap-3 p-4 text-left transition hover:border-white/[0.14] " + CARD}>
      <Trophy className="h-5 w-5 shrink-0 text-gold-400" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-white">Achievements</div>
        <div className="text-xs text-white/40">{data ? `${data.earned} of ${data.total} unlocked` : "Earn badges as you learn."}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
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
        {urgent && <span className="text-xs font-semibold text-brand-400">Due now</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={"text-3xl font-extrabold tabular-nums " + (urgent ? "text-white" : "text-white/60")}>{due}</span>
        <span className="text-sm text-white/45">{due === 1 ? "card due" : "cards due"}</span>
      </div>
      <div className="mt-1 text-xs text-white/35">
        {stats.mastered} mastered · {stats.learning} learning · {stats.new_cards} new
      </div>
      <button
        onClick={() => navigate("/review")}
        className={
          "mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.99] " +
          (urgent ? "bg-brand-500 text-white hover:bg-brand-400" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1]")
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
        <span className="text-xs font-semibold text-cardinal-400">Fix them</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums text-white">{count}</span>
        <span className="text-sm text-white/45">{count === 1 ? "to re-master" : "to re-master"}</span>
      </div>
      <button
        onClick={() => navigate("/mistakes")}
        className="mt-4 w-full rounded-xl bg-white/[0.06] py-2.5 text-sm font-bold text-white transition hover:bg-white/[0.1] active:scale-[0.99]"
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
    <div className={"p-5 " + CARD}>
      <div className="flex items-center justify-between">
        <Label>Daily goal</Label>
        {done && <span className="text-xs font-semibold text-grass-400">Done</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold leading-none text-white tabular-nums">{xp}</span>
        <span className="text-sm text-white/45">/ {goal} XP today</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
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
            className={"flex-1 rounded-lg py-1.5 text-xs font-bold transition " + (done ? (goal === g ? "bg-grass-500/80 text-white cursor-default" : "bg-white/[0.04] text-white/20 cursor-default") : goal === g ? "bg-brand-500 text-white" : "bg-white/[0.05] text-white/45 hover:bg-white/[0.09]")}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact always-visible stat row — hearts / streak / XP / gems. Flat mini
// cards: muted label with a small colored icon, then a big number. The color
// lives only in the small icon so the row reads as one calm system.
function KpiStrip({ token, streak, xp }) {
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

  const items = [
    { icon: Heart, label: "Hearts", value: heartLabel, color: "text-cardinal-400" },
    { icon: Flame, label: "Streak", value: streak, color: "text-brand-400" },
    { icon: Zap, label: "XP", value: xp, color: "text-gold-400" },
    { icon: Gem, label: "Gems", value: gems == null ? "–" : gems, color: "text-feather-400" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={"px-4 py-3 " + CARD}>
          <div className="flex items-center gap-1.5 text-white/45">
            <it.icon className={"h-3.5 w-3.5 " + it.color} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">{it.label}</span>
          </div>
          <div className="mt-1.5 text-2xl font-extrabold leading-none tabular-nums text-white">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

// The anchor of the page: greeting + the single next action. The one place
// the accent fills a whole surface, so "what do I do now" is never a question.
function HeroCard({ firstName, lesson, unitTitle, unitDone, unitTotal, loading, isNewUser, onStart, navigate }) {
  const pct = unitTotal ? Math.round((unitDone / unitTotal) * 100) : 0;
  return (
    <section className={"mb-4 p-6 sm:p-8 " + CARD}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/45">
            Բարև{firstName ? `, ${firstName}` : ""} 👋
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
            {loading ? "Loading your journey…" : lesson ? "Ready for today's lesson?" : "You've reached the summit"}
          </h1>
        </div>
        <img src={owl} alt="" className="hidden h-14 w-auto shrink-0 object-contain sm:block" />
      </div>

      {loading ? (
        <div className="mt-6 h-16 animate-pulse rounded-xl bg-white/[0.05]" />
      ) : lesson ? (
        <button
          type="button"
          onClick={() => onStart(lesson)}
          className="mt-6 flex w-full items-center gap-4 rounded-xl bg-brand-500 px-5 py-4 text-left text-white transition hover:bg-brand-400 active:scale-[0.99]"
        >
          <Play className="h-5 w-5 shrink-0 fill-white" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {pct > 0 ? "Continue lesson" : "Start lesson"}
            </span>
            <span className="block truncate text-lg font-bold">{lesson.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate("/practice")}
          className="mt-6 flex w-full items-center gap-4 rounded-xl bg-grass-500 px-5 py-4 text-left text-white transition hover:bg-grass-400 active:scale-[0.99]"
        >
          <Check className="h-5 w-5 shrink-0" strokeWidth={3} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/70">All lessons complete</span>
            <span className="block text-lg font-bold">Keep sharp with practice</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80" />
        </button>
      )}

      {!loading && lesson && unitTotal > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/45">
            <span className="truncate font-medium">{unitTitle}</span>
            <span className="tabular-nums">{unitDone}/{unitTotal}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isNewUser && (
        <button
          type="button"
          onClick={() => navigate("/placement")}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/50 transition hover:text-white"
        >
          <Target className="h-4 w-4" /> Not a beginner? Take the placement test
        </button>
      )}
    </section>
  );
}

// One lesson as a full-width row: status dot, title, plain-word state. Reads
// top-to-bottom like an outline — no icon-grid decoding.
function LessonRow({ lesson, onStart, last }) {
  const status = lesson.status || "locked";
  const done = status === "completed";
  const current = status === "current";
  const locked = status === "locked";
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => !locked && onStart(lesson)}
      title={locked ? "Finish the previous lesson to unlock" : lesson.title}
      className={
        "flex w-full items-center gap-3 py-3 text-left transition " +
        (last ? "" : "border-b border-white/[0.05] ") +
        (current ? "" : done ? "hover:opacity-80" : "cursor-default")
      }
    >
      <span
        className={
          "grid h-7 w-7 shrink-0 place-items-center rounded-full " +
          (current ? "bg-brand-500 text-white" : done ? "bg-grass-500 text-white" : "border border-white/10 text-white/25")
        }
      >
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : current ? <Play className="h-3.5 w-3.5 fill-white" /> : <Lock className="h-3.5 w-3.5" />}
      </span>
      <span className={"min-w-0 flex-1 truncate text-sm font-medium " + (current ? "text-white" : locked ? "text-white/30" : "text-white/75")}>
        {lesson.title}
      </span>
      {current ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-bold text-white">
          Continue <ArrowRight className="h-3 w-3" />
        </span>
      ) : done ? (
        <span className="shrink-0 text-xs font-semibold text-grass-400">Done</span>
      ) : (
        <span className="shrink-0 text-xs text-white/25">Locked</span>
      )}
    </button>
  );
}

// A unit: a plain header (number · title · count) with a thin status-colored
// progress bar, then its lessons as a clean divided list ending in the
// checkpoint. No decorative stripe — the progress bar carries the state.
function CurriculumUnit({ unit, index, isCurrent, onStart, onCheckpoint }) {
  const total = unit.items.length;
  const done = unit.items.filter((l) => l.status === "completed").length;
  const complete = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const barColor = complete ? "bg-grass-500" : isCurrent ? "bg-brand-500" : "bg-white/15";
  return (
    <section className={"mb-3 p-5 " + CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/35">Unit {index + 1}</span>
          <h3 className="truncate text-base font-bold text-white">{unit.title}</h3>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-white/45">{done}/{total}</span>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={"h-full rounded-full transition-all " + barColor} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2">
        {unit.items.map((lesson, i) => (
          <LessonRow
            key={lesson.id ?? lesson.slug}
            lesson={lesson}
            onStart={onStart}
            last={i === unit.items.length - 1}
          />
        ))}

        <button
          type="button"
          disabled={!complete}
          onClick={() => complete && onCheckpoint(unit)}
          title={complete ? `Test your ${unit.title} knowledge` : "Finish every lesson in this unit to unlock"}
          className={
            "mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition " +
            (complete ? "bg-gold-500/10 hover:bg-gold-500/15" : "cursor-default bg-white/[0.02]")
          }
        >
          <span className={"grid h-7 w-7 shrink-0 place-items-center rounded-full " + (complete ? "bg-gold-500 text-black/80" : "border border-white/10 text-white/25")}>
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className={"min-w-0 flex-1 text-sm font-medium " + (complete ? "text-gold-300" : "text-white/30")}>
            Unit checkpoint
          </span>
          {complete ? (
            <span className="shrink-0 text-xs font-bold text-gold-300">Test now</span>
          ) : (
            <span className="shrink-0 text-xs text-white/25">Locked</span>
          )}
        </button>
      </div>
    </section>
  );
}

function CurriculumSummit({ pct }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <div className="text-sm font-bold text-white/60">You're at the summit</div>
      <div className="text-xs text-white/35">{pct}% of the journey climbed</div>
    </div>
  );
}

// Quick access — one card holding a clean grid of icon+label targets.
function QuickLinks({ navigate }) {
  const tiles = [
    { icon: Dumbbell, label: "Practice", to: "/practice", color: "text-brand-400" },
    { icon: BookOpen, label: "Words", to: "/vocabulary", color: "text-grass-400" },
    { icon: BarChart2, label: "Progress", to: "/progress", color: "text-feather-400" },
    { icon: Trophy, label: "Leaderboard", to: "/leaderboard", color: "text-gold-400" },
    { icon: Users, label: "Friends", to: "/friends", color: "text-feather-400" },
    { icon: Store, label: "Shop", to: "/shop", color: "text-pom-400" },
    { icon: Star, label: "Achievements", to: "/achievements", color: "text-gold-400" },
  ];
  return (
    <div className={"grid grid-cols-4 gap-1 p-2 " + CARD}>
      {tiles.map((t) => (
        <button
          key={t.to}
          type="button"
          onClick={() => navigate(t.to)}
          className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition hover:bg-white/[0.04] active:scale-[0.97]"
        >
          <t.icon className={"h-5 w-5 " + t.color} />
          <span className="w-full truncate text-center text-[11px] font-medium text-white/55">{t.label}</span>
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
  // A calm, minimal command center: a flat stat row, a single-action hero,
  // curriculum as a plain outline of units, and a sidebar of quiet cards —
  // sticky on desktop, stacked on mobile. One accent, lots of air.
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <StreakCelebration streak={stats.streak} />
      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:gap-6">
        {/* ── Main: stats + hero + curriculum ── */}
        <main className="mx-auto w-full max-w-xl lg:mx-0 lg:justify-self-center">
          <KpiStrip token={token} streak={stats.streak} xp={stats.total_xp} />

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
          />

          {error && (
            <div className="mb-4 rounded-xl border border-cardinal-500/30 bg-cardinal-500/10 px-4 py-3 text-sm font-medium text-cardinal-300">
              {error}
            </div>
          )}

          {loadingLessons ? (
            <div className="flex items-center justify-center gap-2 py-20 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Mapping your journey…</span>
            </div>
          ) : units.length === 0 ? (
            <div className={"p-8 text-center font-medium text-white/50 " + CARD}>
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
