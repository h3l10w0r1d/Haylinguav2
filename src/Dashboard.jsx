// src/Dashboard.jsx — a dark, glowing, modern command-center dashboard.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, Play, Loader2, Trophy, Users, ChevronRight, ArrowRight, Target, Zap, Crown, Star, Check, Snowflake, Gem, Gift, Dumbbell, ShieldCheck, Heart, Store, BookOpen, BarChart2 } from "lucide-react";
import owl from "./assets/character-owl.png";
import StreakFlame from "./lib/StreakFlame";
import StreakCelebration from "./lib/StreakCelebration";
import ChestOpening from "./lib/ChestOpening";

const QICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

// Glow colors keyed to the Tailwind brand palette (rgba, not utility classes —
// arbitrary colored box-shadows need a literal value to glow reliably).
const GLOW = {
  brand: "rgba(255,122,26,.45)",
  grass: "rgba(88,204,2,.4)",
  gold: "rgba(255,200,0,.4)",
  cardinal: "rgba(255,75,75,.4)",
  feather: "rgba(28,176,246,.4)",
  pom: "rgba(225,29,72,.4)",
};

// Shared dark glass-card shell used across the whole page.
const CARD = "relative rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl";

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
        <div className={"quests-celebrate flex flex-col items-center overflow-hidden text-center " + CARD}>
          <div className="relative grid place-items-center">
            <span className="quests-ring absolute h-14 w-14 rounded-full bg-grass-500/30" />
            <span className="quests-ring quests-ring-2 absolute h-14 w-14 rounded-full bg-grass-500/30" />
            <div
              className="quests-badge-pop relative grid h-14 w-14 place-items-center rounded-2xl bg-grass-500 text-white"
              style={{ boxShadow: `0 0 24px -4px ${GLOW.grass}` }}
            >
              <QuestTick className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-3 text-sm font-extrabold text-white">All quests complete</div>
          <div className="mt-0.5 text-xs font-semibold text-white/40">Come back tomorrow for more.</div>
        </div>
      );
    }
    return (
      <div className={"quests-collapse flex items-center gap-3 overflow-hidden " + CARD}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-grass-500/15 text-grass-400">
          <QuestTick className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-white">Daily quests complete</div>
          <div className="text-xs font-semibold text-white/40">All {quests.length} done</div>
        </div>
        <span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-xs font-bold tabular-nums text-white/50">
          {quests.length}/{quests.length}
        </span>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-white">Daily quests</div>
        <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs font-bold tabular-nums text-white/50">{data.completed}/{data.total}</span>
      </div>
      <div className="mt-4 space-y-3.5">
        {data.quests.map((q) => {
          const Icon = QICON[q.icon] || Target;
          const pct = q.target ? Math.round((q.progress / q.target) * 100) : 0;
          return (
            <div key={q.id} className="flex items-center gap-3">
              <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl " + (q.done ? "bg-grass-500/15 text-grass-400" : "bg-white/[0.06] text-white/40")}>
                {q.done ? <Check className="h-4.5 w-4.5" /> : <Icon className="h-4.5 w-4.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-bold text-white/85">{q.desc}</div>
                  {q.claimed ? (
                    <span className="shrink-0 text-xs font-bold text-grass-400">Claimed</span>
                  ) : (
                    <div className="shrink-0 text-xs font-bold tabular-nums text-white/35">{q.progress}/{q.target}</div>
                  )}
                </div>
                {q.claimable ? (
                  <button
                    onClick={() => claim(q.id)}
                    disabled={claiming === q.id}
                    className="mt-1.5 w-full rounded-lg bg-gold-500 py-1.5 text-xs font-extrabold uppercase text-black/80 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                    style={{ boxShadow: `0 0 16px -4px ${GLOW.gold}` }}
                  >
                    {claiming === q.id ? "…" : `Claim +${q.reward_xp} XP`}
                  </button>
                ) : (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
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
      <div className={"text-center " + CARD}>
        <div
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-2xl"
          style={opening ? { animation: "chestShake .85s ease-in-out" } : undefined}
        >
          🎁
        </div>
        <div className="mt-3 text-sm font-extrabold text-white">
          {chests} chest{chests === 1 ? "" : "s"} to open
        </div>
        <p className="mt-1 text-xs font-semibold text-white/40">Gems or an XP boost inside</p>
        {openErr && (
          <p className="mt-2 text-xs font-semibold text-cardinal-400">Couldn't open — try again.</p>
        )}
        <button
          onClick={open}
          disabled={opening || chests <= 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-extrabold uppercase text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          style={{ boxShadow: `0 0 20px -5px ${GLOW.brand}` }}
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
  const lit = n > 0 && practicedToday && !frozen;
  const atRisk = n > 0 && !practicedToday && !frozen;
  const week = Array.isArray(days) ? days.slice(-7) : [];
  const cap = freeze.freeze_cap || 2;

  const badge = frozen
    ? { text: "Frozen", tone: "bg-feather-500/15 text-feather-400" }
    : lit
    ? { text: "Lit", tone: "bg-grass-500/15 text-grass-400" }
    : atRisk
    ? { text: "At risk", tone: "bg-gold-500/15 text-gold-400" }
    : null;

  return (
    <div className={CARD}>
      <div className="flex items-center gap-3">
        <StreakFlame size={44} lit={lit} frozen={frozen} />
        <div className="flex-1">
          <div className="text-2xl font-extrabold leading-none tabular-nums text-white">{n}</div>
          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-white/40">day streak</div>
        </div>
        {badge && (
          <span className={"rounded-lg px-2.5 py-1 text-xs font-extrabold " + badge.tone}>{badge.text}</span>
        )}
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
                  (on ? "bg-brand-500 text-white" : "bg-white/[0.06] text-white/30")}
                style={on ? { boxShadow: `0 0 10px -3px ${GLOW.brand}` } : undefined}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs font-semibold text-white/40">
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
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-extrabold text-white transition hover:brightness-105 active:scale-[0.98]"
          style={{ boxShadow: `0 0 20px -5px ${GLOW.brand}` }}
        >
          Practice now <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <div
          className="flex items-center gap-2"
          title="A streak freeze covers one missed day. Buy them in the shop with gems."
        >
          <div className="flex gap-0.5">
            {Array.from({ length: cap }).map((_, i) => (
              <Snowflake
                key={i}
                className={"h-4 w-4 " + (i < freeze.freezes ? "fill-feather-400/40 text-feather-400" : "text-white/15")}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-white/40">
            {freeze.freezes}/{cap} freeze{cap === 1 ? "" : "s"}
          </span>
        </div>
        {freeze.freezes < cap && (
          <button
            onClick={() => navigate("/shop")}
            className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-extrabold text-white/60 transition hover:bg-white/[0.1]"
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
    <div className={CARD}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-500/15 text-gold-400">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="text-sm font-extrabold text-white">Achievements</div>
      </div>
      <p className="mt-3 text-xs font-semibold text-white/40">
        {data ? `${data.earned} of ${data.total} unlocked` : "Earn badges as you learn."}
      </p>
      <button onClick={onOpen} className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-white/70 hover:text-white">
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

  React.useEffect(() => {
    const due = stats?.due_today || 0;
    document.title = due > 0 ? `(${due}) Haylingua` : "Haylingua";
    return () => { document.title = "Haylingua"; };
  }, [stats?.due_today]);

  if (!stats || stats.total === 0) return null;

  const due = stats.due_today;
  const urgent = due > 0;

  return (
    <div className={"cursor-pointer transition hover:border-white/[0.14] " + CARD} onClick={() => navigate("/review")}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-white">Review</div>
        {urgent && (
          <span className="rounded-lg bg-brand-500/15 px-2 py-0.5 text-xs font-extrabold text-brand-400">
            Due now
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={"text-3xl font-extrabold tabular-nums " + (urgent ? "text-white" : "text-white/70")}>
          {due}
        </span>
        <span className="mb-1 text-sm font-semibold text-white/40">
          {due === 1 ? "card due" : "cards due"}
        </span>
      </div>
      <div className="mt-1 text-xs text-white/35">
        {stats.mastered} mastered · {stats.learning} learning · {stats.new_cards} new
      </div>
      <button
        onClick={e => { e.stopPropagation(); navigate("/review"); }}
        className={
          "mt-4 w-full rounded-xl py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98] " +
          (urgent ? "bg-brand-500 hover:brightness-105" : "bg-white/[0.08] text-white/50")
        }
        style={urgent ? { boxShadow: `0 0 20px -5px ${GLOW.brand}` } : undefined}
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
    <div className={"cursor-pointer transition hover:border-white/[0.14] " + CARD} onClick={() => navigate("/mistakes")}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-white">Your mistakes</div>
        <span className="rounded-lg bg-cardinal-500/15 px-2 py-0.5 text-xs font-extrabold text-cardinal-400">Fix them</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-extrabold tabular-nums text-white">{count}</span>
        <span className="mb-1 text-sm font-semibold text-white/40">{count === 1 ? "exercise to re-master" : "exercises to re-master"}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/mistakes"); }}
        className="mt-4 w-full rounded-xl bg-cardinal-500 py-2.5 text-sm font-extrabold text-white transition hover:brightness-105 active:scale-[0.98]"
        style={{ boxShadow: `0 0 20px -5px ${GLOW.cardinal}` }}
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
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-white">Daily goal</div>
        {done ? <span className="rounded-lg bg-grass-500/15 px-2 py-0.5 text-xs font-extrabold text-grass-400">Done</span> : null}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="text-2xl font-extrabold leading-none text-white tabular-nums">{xp}</div>
        <div className="mb-0.5 text-sm font-bold text-white/40">/ {goal} XP today</div>
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
            className={"flex-1 rounded-lg py-1 text-xs font-extrabold transition " + (done ? (goal === g ? "bg-grass-500 text-white cursor-default" : "bg-white/[0.05] text-white/20 cursor-default") : goal === g ? "bg-brand-500 text-white" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1]")}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact always-visible KPI row — hearts / streak / XP / gems, each with a
// glowing icon badge, dashboard-style.
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
    { icon: Heart, label: "Hearts", value: heartLabel, tint: "bg-cardinal-500/15 text-cardinal-400", glow: GLOW.cardinal },
    { icon: Flame, label: "Streak", value: streak, tint: "bg-brand-500/15 text-brand-400", glow: GLOW.brand },
    { icon: Zap, label: "Total XP", value: xp, tint: "bg-gold-500/15 text-gold-400", glow: GLOW.gold },
    { icon: Gem, label: "Gems", value: gems == null ? "–" : gems, tint: "bg-feather-500/15 text-feather-400", glow: GLOW.feather },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={"flex items-center gap-3 " + CARD}>
          <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl " + it.tint} style={{ boxShadow: `0 0 14px -5px ${it.glow}` }}>
            <it.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-base font-extrabold leading-none tabular-nums text-white">{it.value}</div>
            <div className="text-[11px] font-semibold text-white/40">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// The single most important element: resume the current lesson. A glowing
// glass panel with an ambient orange radial behind it — the page's anchor.
function HeroCard({ firstName, lesson, unitTitle, unitDone, unitTotal, loading, isNewUser, onStart, navigate }) {
  const pct = unitTotal ? Math.round((unitDone / unitTotal) * 100) : 0;
  return (
    <section className={"mb-5 overflow-hidden p-6 sm:p-7 " + CARD}>
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF7A1A, transparent 70%)" }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
            Բարև{firstName ? `, ${firstName}` : ""}
          </div>
          <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {loading ? "Loading your journey…" : lesson ? "Ready for today's lesson?" : "You've reached the summit"}
          </h1>
        </div>
        <img src={owl} alt="" className="hidden h-16 w-auto shrink-0 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] sm:block" />
      </div>

      {loading ? (
        <div className="relative mt-6 h-16 animate-pulse rounded-2xl bg-white/[0.06]" />
      ) : lesson ? (
        <button
          type="button"
          onClick={() => onStart(lesson)}
          className="relative mt-6 flex w-full items-center gap-4 rounded-2xl bg-brand-500 px-5 py-4 text-left text-white transition hover:brightness-105 active:scale-[0.99]"
          style={{ boxShadow: `0 0 32px -6px ${GLOW.brand}` }}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
            <Play className="h-5 w-5 fill-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">
              {pct > 0 ? "Continue" : "Start"}{unitTitle ? ` · ${unitTitle}` : ""}
            </span>
            <span className="block truncate text-lg font-extrabold">{lesson.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate("/practice")}
          className="relative mt-6 flex w-full items-center gap-4 rounded-2xl bg-grass-500 px-5 py-4 text-left text-white transition hover:brightness-105 active:scale-[0.99]"
          style={{ boxShadow: `0 0 32px -6px ${GLOW.grass}` }}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70">All lessons complete</span>
            <span className="block text-lg font-extrabold">Keep sharp with practice</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80" />
        </button>
      )}

      {!loading && lesson && unitTotal > 0 && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-white/40">
            <span className="truncate">{unitTitle}</span>
            <span className="tabular-nums">{unitDone}/{unitTotal}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%`, boxShadow: `0 0 8px -1px ${GLOW.brand}` }} />
          </div>
        </div>
      )}

      {isNewUser && (
        <button
          type="button"
          onClick={() => navigate("/placement")}
          className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white/50 transition hover:text-white/80"
        >
          <Target className="h-4 w-4" /> Not a beginner? Take the placement test
        </button>
      )}
    </section>
  );
}

// One lesson, rendered as a compact tile inside the unit's grid.
function LessonTile({ lesson, onStart }) {
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
      aria-label={lesson.title}
      className={
        "group relative flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition active:scale-[0.97] " +
        (current
          ? "bg-brand-500/10 ring-2 ring-brand-500"
          : done
          ? "bg-white/[0.03] ring-1 ring-white/[0.08] hover:ring-white/[0.16]"
          : "cursor-default bg-white/[0.015] ring-1 ring-white/[0.04]")
      }
      style={current ? { boxShadow: `0 0 20px -6px ${GLOW.brand}` } : undefined}
    >
      {current && (
        <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-brand-500 ring-2 ring-[#0c0a08]" />
      )}
      <span
        className={
          "grid h-10 w-10 place-items-center rounded-xl " +
          (done ? "bg-grass-500 text-white" : current ? "bg-brand-500 text-white" : "bg-white/[0.06] text-white/25")
        }
      >
        {done ? <Check className="h-5 w-5" strokeWidth={3} /> : current ? <Play className="h-4 w-4 fill-white" /> : <Lock className="h-4 w-4" />}
      </span>
      <span className={"line-clamp-2 text-[11px] font-bold leading-tight " + (locked ? "text-white/30" : "text-white/75")}>
        {lesson.title}
      </span>
    </button>
  );
}

// Warm Armenian palette rotation for the unit accent stripe.
const UNIT_ACCENTS = ["#FF7A1A", "#E11D48", "#FFC800"];

// A unit: header + progress bar + a clean grid of lesson tiles ending in a
// checkpoint tile. Replaces the old winding "snake path" with a scannable grid.
function CurriculumUnit({ unit, index, onStart, onCheckpoint }) {
  const total = unit.items.length;
  const done = unit.items.filter((l) => l.status === "completed").length;
  const complete = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const accent = UNIT_ACCENTS[index % UNIT_ACCENTS.length];
  return (
    <section className={"mb-4 overflow-hidden p-5 " + CARD}>
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent, boxShadow: `0 0 12px -1px ${accent}` }} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">Unit {index + 1}</div>
          <h3 className="truncate text-lg font-extrabold text-white">{unit.title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-extrabold tabular-nums text-white/80">{done}/{total}</div>
          <div className="text-[11px] font-semibold text-white/35">{pct}%</div>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2.5 sm:grid-cols-5 md:grid-cols-6">
        {unit.items.map((lesson) => (
          <LessonTile key={lesson.id ?? lesson.slug} lesson={lesson} onStart={onStart} />
        ))}

        <button
          type="button"
          disabled={!complete}
          onClick={() => complete && onCheckpoint(unit)}
          title={complete ? `Test your ${unit.title} knowledge` : "Finish every lesson in this unit to unlock"}
          className={
            "flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition active:scale-[0.97] " +
            (complete ? "bg-gold-500/10 ring-1 ring-gold-500/40 hover:ring-gold-500/70" : "cursor-default bg-white/[0.015] ring-1 ring-white/[0.04]")
          }
          style={complete ? { boxShadow: `0 0 16px -6px ${GLOW.gold}` } : undefined}
        >
          <span className={"grid h-10 w-10 place-items-center rounded-xl " + (complete ? "bg-gold-500 text-black/80" : "bg-white/[0.06] text-white/25")}>
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className={"text-[11px] font-bold leading-tight " + (complete ? "text-gold-400" : "text-white/30")}>Checkpoint</span>
        </button>
      </div>
    </section>
  );
}

function CurriculumSummit({ pct }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <div className="text-sm font-extrabold text-white/70">You're at the summit</div>
      <div className="text-xs font-semibold text-white/35">{pct}% of the journey climbed</div>
    </div>
  );
}

// Compact quick-access tiles.
function QuickLinks({ navigate }) {
  const tiles = [
    { icon: Dumbbell, label: "Practice", to: "/practice", tint: "bg-brand-500/15 text-brand-400" },
    { icon: BookOpen, label: "Words", to: "/vocabulary", tint: "bg-grass-500/15 text-grass-400" },
    { icon: BarChart2, label: "Progress", to: "/progress", tint: "bg-feather-500/15 text-feather-400" },
    { icon: Trophy, label: "Leaderboard", to: "/leaderboard", tint: "bg-gold-500/15 text-gold-400" },
    { icon: Users, label: "Friends", to: "/friends", tint: "bg-feather-500/15 text-feather-400" },
    { icon: Store, label: "Shop", to: "/shop", tint: "bg-pom-500/15 text-pom-400" },
    { icon: Star, label: "Achievements", to: "/achievements", tint: "bg-gold-500/15 text-gold-400" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <button
          key={t.to}
          type="button"
          onClick={() => navigate(t.to)}
          className={"flex flex-col items-center gap-1.5 px-1 py-3 transition hover:border-white/[0.16] active:scale-[0.97] " + CARD}
        >
          <span className={"grid h-10 w-10 place-items-center rounded-xl " + t.tint}>
            <t.icon className="h-5 w-5" />
          </span>
          <span className="w-full truncate text-center text-[11px] font-extrabold text-white/60">{t.label}</span>
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
  // A dark, glowing command center: a KPI row up top, a "continue" panel with
  // an ambient orange glow, curriculum as a scannable grid of units, and a
  // sidebar of supporting glass cards — sticky on desktop, stacked on mobile.
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0c0a08]">
      {/* Ambient background glow — fixed, behind everything, purely atmospheric. */}
      <div
        className="pointer-events-none fixed left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(ellipse at top, #FF7A1A, transparent 65%)" }}
      />

      <StreakCelebration streak={stats.streak} />
      <div className="relative mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        {/* ── Main: KPIs + hero + curriculum ── */}
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
            <div className="mb-4 rounded-2xl border border-cardinal-500/30 bg-cardinal-500/10 px-4 py-3 text-sm font-semibold text-cardinal-300">
              {error}
            </div>
          )}

          {loadingLessons ? (
            <div className="flex items-center justify-center gap-2 py-20 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Mapping your journey…</span>
            </div>
          ) : units.length === 0 ? (
            <div className={"p-8 text-center font-semibold text-white/50 " + CARD}>
              No lessons available yet. Check back soon!
            </div>
          ) : (
            <>
              {units.map((unit, ui) => (
                <CurriculumUnit
                  key={unit.key}
                  unit={unit}
                  index={ui}
                  onStart={handleStart}
                  onCheckpoint={openCheckpoint}
                />
              ))}
              <CurriculumSummit pct={journeyPct} />
            </>
          )}
        </main>

        {/* ── Rail: everything that supports the journey ── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-6">
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
