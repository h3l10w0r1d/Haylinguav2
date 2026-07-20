// src/LessonCompletionScreen.jsx
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Zap,
  Target,
  CheckCircle2,
  Star,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  BarChart3,
  AlertTriangle,
  Share2,
  Check,
  Flame,
  Trophy,
  Gift,
  Sparkles,
  Clock,
} from "lucide-react";
import Illustration from "./lib/Illustration";
import ChestOpening from "./lib/ChestOpening";
import { sfx } from "./lib/sfx";

const RS_API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function rsToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Ease-out count-up used for the XP roll-up. */
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const to = Number(target) || 0;
    if (to <= 0) { setN(0); return; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

/** One staged row that slides + fades in when `show` flips true. */
function RevealRow({ show, children }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 transition-all duration-500"
      style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)" }}
    >
      {children}
    </div>
  );
}

/**
 * Post-lesson reward sequence — reveals real reward state in stages:
 * XP roll-up (+ combo bonus) → streak → daily-quest progress → league → chest.
 * All values are fetched live; nothing is faked.
 */
function RewardReveal({ xp, comboBonusXp = 0 }) {
  const [d, setD] = useState({ streak: null, quests: null, league: null, wallet: null, stats: null, loaded: false });
  const [stage, setStage] = useState(0);
  const xpCount = useCountUp(xp);

  // Inline chest opening — the earn moment and the open moment belong together.
  const [chestsLeft, setChestsLeft] = useState(null); // null until wallet loads
  const [openingChest, setOpeningChest] = useState(false);
  const [chestReward, setChestReward] = useState(null); // {type, gems} → full-screen reveal
  const [chestErr, setChestErr] = useState(false);

  async function openChest() {
    if (openingChest) return;
    setOpeningChest(true);
    setChestErr(false);
    try {
      const r = await fetch(`${RS_API_BASE}/me/chests/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${rsToken()}` },
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data) {
        setChestsLeft(Number(data.chests || 0));
        window.dispatchEvent(new CustomEvent("hay_wallet", { detail: { gems: data.gems } }));
        setChestReward({
          type: data.reward_type || "gems",
          gems: Number(data.reward_gems || 0),
          rarity: data.rarity || "wooden",
          xpBoost: !!data.xp_boost_granted,
        });
      } else {
        setChestErr(true);
      }
    } catch {
      setChestErr(true);
    } finally {
      setOpeningChest(false);
    }
  }

  const dailyGoal = useMemo(() => {
    const saved = parseInt(localStorage.getItem("hay_daily_goal") || "20", 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 20;
  }, []);

  useEffect(() => {
    const h = { Authorization: `Bearer ${rsToken()}` };
    const get = (p) => fetch(`${RS_API_BASE}${p}`, { headers: h }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("/me/streak"), get("/me/quests"), get("/me/league"), get("/me/wallet"), get("/me/stats")])
      .then(([streak, quests, league, wallet, stats]) => setD({ streak, quests, league, wallet, stats, loaded: true }));
  }, []);

  // Reveal each row on a stagger once data is in.
  useEffect(() => {
    if (!d.loaded) return;
    const timers = [1, 2, 3, 4, 5].map((s, i) => setTimeout(() => setStage((v) => Math.max(v, s)), 320 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [d.loaded]);

  const streakN = Number(d.streak?.streak ?? 0);
  const practicedToday = !!d.streak?.practiced_today;

  const quests = Array.isArray(d.quests?.quests) ? d.quests.quests : [];
  const activeQuests = quests
    .slice()
    .sort((a, b) => (b.claimable === true) - (a.claimable === true))
    .slice(0, 2);

  const self = Array.isArray(d.league?.division) ? d.league.division.find((x) => x.is_self) : null;
  const leagueTier = d.league?.tier;
  const leagueRank = self?.rank;

  const chests = chestsLeft != null ? chestsLeft : Number(d.wallet?.chests ?? 0);

  const todayXp = Number(d.stats?.today_xp ?? 0);
  const goalPct = Math.min(100, Math.round((todayXp / Math.max(1, dailyGoal)) * 100));
  const goalMet = todayXp >= dailyGoal;
  const goalLeft = Math.max(0, dailyGoal - todayXp);

  return (
    <div className="mx-auto mt-6 max-w-md divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200 shadow-sm dark:divide-white/[0.06] dark:bg-[#18181b] dark:ring-white/[0.08]">
      {/* XP roll-up — always visible, counts up on mount */}
      <RevealRow show>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-lg font-extrabold leading-none text-slate-800 dark:text-white">+{xpCount} XP</div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">This lesson</div>
        </div>
        {comboBonusXp > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-extrabold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
            <Sparkles className="h-3.5 w-3.5" /> +{comboBonusXp} combo
          </span>
        ) : null}
      </RevealRow>

      {/* Daily goal nudge */}
      {d.stats ? (
        <RevealRow show={stage >= 1}>
          <div className={"grid h-10 w-10 place-items-center rounded-xl " + (goalMet ? "bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400" : "bg-feather-50 text-feather-600 dark:bg-feather-500/15 dark:text-feather-400")}>
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold text-slate-800 dark:text-white">
                {goalMet ? "Daily goal reached! 🎉" : `${goalLeft} XP to your daily goal`}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-400 dark:text-stone-500">{todayXp}/{dailyGoal}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div className={"h-2 rounded-full transition-all duration-700 " + (goalMet ? "bg-grass-500" : "bg-feather-500")} style={{ width: `${Math.max(goalPct, 3)}%` }} />
            </div>
          </div>
        </RevealRow>
      ) : null}

      {/* Streak */}
      {d.streak ? (
        <RevealRow show={stage >= 2}>
          <div className={"grid h-10 w-10 place-items-center rounded-xl " + (streakN > 0 ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400" : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-stone-500")}>
            <Flame className={"h-5 w-5 " + (streakN > 0 ? "fill-brand-400" : "")} />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-extrabold leading-none text-slate-800 dark:text-white">
              {streakN} day{streakN === 1 ? "" : "s"}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">Streak</div>
          </div>
          {practicedToday ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2.5 py-1 text-xs font-extrabold text-grass-700 dark:bg-grass-500/15 dark:text-grass-400">
              <Check className="h-3.5 w-3.5" /> Today done
            </span>
          ) : null}
        </RevealRow>
      ) : null}

      {/* Daily quests progress */}
      {activeQuests.length ? (
        <RevealRow show={stage >= 3}>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-feather-50 text-feather-600 dark:bg-feather-500/15 dark:text-feather-400">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {activeQuests.map((q, i) => {
              const prog = Number(q.progress ?? 0);
              const tgt = Math.max(1, Number(q.target ?? q.goal ?? 1));
              const pct = Math.min(100, Math.round((prog / tgt) * 100));
              return (
                <div key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-slate-600 dark:text-stone-300">{q.title || "Daily quest"}</span>
                    <span className="shrink-0 text-xs font-bold text-slate-400 dark:text-stone-500">
                      {q.claimable ? "Claimable!" : `${Math.min(prog, tgt)}/${tgt}`}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div className={"h-2 rounded-full transition-all duration-700 " + (q.claimable || q.done ? "bg-grass-500" : "bg-feather-500")} style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </RevealRow>
      ) : null}

      {/* League standing */}
      {self && leagueTier ? (
        <RevealRow show={stage >= 4}>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold-100 text-gold-600 dark:bg-gold-500/20 dark:text-gold-400">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-extrabold leading-none text-slate-800 dark:text-white">#{leagueRank} in {leagueTier}</div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">League this week</div>
          </div>
          {leagueRank <= 7 ? (
            <span className="rounded-full bg-grass-50 px-2.5 py-1 text-xs font-extrabold text-grass-700 dark:bg-grass-500/15 dark:text-grass-400">Promotion zone</span>
          ) : null}
        </RevealRow>
      ) : null}

      {/* Chest — openable right here, at the peak of the celebration */}
      {chests > 0 ? (
        <RevealRow show={stage >= 5}>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-extrabold leading-none text-slate-800 dark:text-white">
              {chests} chest{chests === 1 ? "" : "s"} to open
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">
              {chestErr ? "Couldn't open — try again" : "Gems or an XP boost inside"}
            </div>
          </div>
          <button
            onClick={openChest}
            disabled={openingChest}
            className="shrink-0 rounded-xl bg-gold-500 px-4 py-2 font-display text-xs font-extrabold uppercase text-white shadow-[0_3px_0_0_#B45309] transition active:translate-y-0.5 disabled:opacity-60"
          >
            {openingChest ? "…" : "Open now"}
          </button>
        </RevealRow>
      ) : null}

      {chestReward != null && (
        <ChestOpening reward={chestReward} onClose={() => setChestReward(null)} />
      )}
    </div>
  );
}

const CONFETTI_COLORS = ["#FF7A1A", "#58CC02", "#1CB0F6", "#FFC800", "#E11D48"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        left: Math.round((i * 37) % 100),
        delay: (i % 7) * 0.18,
        dur: 2.4 + (i % 5) * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 7 + (i % 3) * 3,
        round: i % 2 === 0,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function StarsRow({ percent }) {
  const p = Math.max(0, Math.min(100, Number(percent || 0)));
  const filled = Math.max(0, Math.min(5, Math.round(p / 20)));
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={"h-7 w-7 " + (i <= filled ? "text-gold-500 fill-gold-500" : "text-slate-200 fill-slate-200 dark:text-stone-600 dark:fill-stone-600")}
          />
        ))}
      </div>
      <div className="font-display text-lg font-extrabold text-grass-600 dark:text-grass-400">{p}%</div>
    </div>
  );
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms) || 0) / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatCard({ icon: Icon, value, label, tone = "brand" }) {
  const tones = {
    brand: "text-brand-500 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/15",
    grass: "text-grass-600 bg-grass-50 dark:text-grass-400 dark:bg-grass-500/15",
    feather: "text-feather-600 bg-feather-50 dark:text-feather-400 dark:bg-feather-500/15",
    pom: "text-pom-600 bg-pom-50 dark:text-pom-400 dark:bg-pom-500/15",
  };
  return (
    <div className="rounded-2xl bg-white px-4 py-4 text-center ring-1 ring-slate-200/80 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className={`mx-auto grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold leading-none text-slate-800 dark:text-white">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">{label}</div>
    </div>
  );
}

async function shareLesson({ lessonTitle, xp, accuracy }) {
  const text = `🇦🇲 Just completed "${lessonTitle}" on Haylingua! +${xp} XP · ${accuracy}% accuracy. Learning Armenian one lesson at a time 💪 haylingua.am`;
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch {}
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {}
}

export default function LessonCompletionScreen({
  lesson,
  sessionXpEarned,
  comboBonusXp = 0,
  mistakes = 0,
  analytics,
  analyticsLoading,
  analyticsError,
  onOpenExercise,
  onRetry,
  onDone,
  isSaving,
  timeMs,
}) {
  const perfect = Number(mistakes) === 0;
  const [detailsOpen, setDetailsOpen] = useState(!perfect);
  const [shareDone, setShareDone] = useState(false);

  const ratio = useMemo(() => clamp01(analytics?.completion_ratio), [analytics]);
  const percent = Math.round(ratio * 100);

  const earnedXp = Number(analytics?.earned_xp ?? 0) || 0;
  const totalXp = Number(analytics?.lesson_total_xp ?? 0) || 0;
  const correct = Number(analytics?.correct_exercises ?? analytics?.completed_exercises ?? 0) || 0;
  const total = Number(analytics?.total_exercises ?? 0) || 0;

  const accuracy = useMemo(() => {
    const attempts = Number(analytics?.total_attempts ?? 0) || 0;
    const correctAttempts = Number(analytics?.correct_attempts ?? 0) || 0;
    if (!attempts) return total > 0 ? Math.round((correct / total) * 100) : percent;
    return Math.round((correctAttempts / attempts) * 100);
  }, [analytics, correct, total, percent]);

  const message =
    percent >= 100
      ? "Կեցցե՛ս! You nailed every question!"
      : percent >= 70
      ? "Nice work! You’re above the completion threshold."
      : "Good effort — retry to hit 70% and complete the lesson.";

  // Fanfare on mount for a passing lesson — the confetti's silent partner.
  // Fires once per mount (a fresh LessonCompletionScreen instance per attempt).
  useEffect(() => {
    if (percent >= 70) sfx.complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
      {percent >= 70 ? <Confetti /> : null}

      <div className="relative px-6 py-10 sm:px-10 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <Illustration
            name="mascot-cheer"
            alt="Tatik celebrating"
            className="mx-auto block h-28 w-28 rounded-3xl object-cover"
          />

          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-brand-500 sm:text-5xl dark:text-brand-400">
            {perfect ? "Perfect Lesson!" : "Lesson Complete!"}
          </h2>
          <p className="mt-2 text-base font-semibold text-slate-500 dark:text-stone-400">
            {perfect
              ? "Կեցցե՛ս! Flawless — not a single mistake. 🎉"
              : `Done! ${mistakes} mistake${Number(mistakes) === 1 ? "" : "s"} along the way — review them to master it.`}
          </p>
          {perfect ? (
            <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-gold-600 dark:bg-gold-500/20 dark:text-gold-400">
              ★ No mistakes
            </div>
          ) : null}

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Zap} value={`+${sessionXpEarned ?? earnedXp}`} label="XP" tone="brand" />
            <StatCard icon={Target} value={`${accuracy}%`} label="Accuracy" tone="feather" />
            <StatCard icon={CheckCircle2} value={total ? `${correct}/${total}` : `${correct}`} label="Correct" tone="grass" />
            {Number.isFinite(timeMs) ? (
              <StatCard icon={Clock} value={formatDuration(timeMs)} label="Time" tone="pom" />
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl bg-brand-50 px-5 py-3 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:ring-brand-500/30">
            <StarsRow percent={percent} />
          </div>

          <div className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-grass-50 px-5 py-3 font-bold text-grass-700 ring-1 ring-grass-100 dark:bg-grass-500/15 dark:text-grass-400 dark:ring-grass-500/30">
            <span aria-hidden>✨</span>
            <span>{message}</span>
          </div>

          {/* Animated reward roll-up: XP → streak → quests → league → chest */}
          <RewardReveal xp={sessionXpEarned ?? earnedXp} comboBonusXp={comboBonusXp} />

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              disabled={isSaving}
              className="btn3d btn3d-neutral uppercase"
            >
              <RotateCcw className="h-5 w-5" />
              Retry
            </button>
            <button
              type="button"
              onClick={onDone}
              disabled={isSaving}
              className="btn3d btn3d-brand min-w-[200px] uppercase"
            >
              Continue Learning <span aria-hidden>→</span>
            </button>
          </div>

          {/* Share card */}
          <button
            type="button"
            onClick={async () => {
              const result = await shareLesson({
                lessonTitle: lesson?.title || "a lesson",
                xp: sessionXpEarned ?? earnedXp,
                accuracy,
              });
              if (result === "copied") {
                setShareDone(true);
                setTimeout(() => setShareDone(false), 2500);
              } else if (result === undefined && navigator.share) {
                // shared via native sheet — no toast needed
              } else {
                setShareDone(true);
                setTimeout(() => setShareDone(false), 2500);
              }
            }}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-feather-50 px-5 py-2.5 text-sm font-bold text-feather-700 ring-1 ring-feather-200 transition hover:bg-feather-100 active:scale-95 dark:bg-feather-500/15 dark:text-feather-400 dark:ring-feather-500/30 dark:hover:bg-feather-500/20"
          >
            {shareDone
              ? <><Check className="h-4 w-4 text-grass-500" /> Copied to clipboard!</>
              : <><Share2 className="h-4 w-4" /> Share your progress</>}
          </button>

          {analyticsLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 font-semibold text-slate-500 dark:text-stone-400">
              <BarChart3 className="h-5 w-5" />
              <span>Loading analytics…</span>
            </div>
          ) : null}

          {analyticsError ? (
            <div className="mt-6 mx-auto flex max-w-xl items-start gap-2 rounded-2xl border-2 border-cardinal-100 bg-cardinal-50 p-4 text-sm font-semibold text-cardinal-600 dark:border-cardinal-500/30 dark:bg-cardinal-500/15 dark:text-cardinal-400">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <div className="font-bold">Couldn’t load analytics</div>
                <div>{analyticsError}</div>
              </div>
            </div>
          ) : null}

          {analytics?.exercises?.length ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="mx-auto inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200"
              >
                {detailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                View details
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {detailsOpen && analytics?.exercises?.length ? (
        <div className="px-6 pb-8 sm:px-10 sm:pb-10">
          <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">Exercise breakdown</div>
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-white/[0.06] dark:bg-[#18181b] dark:ring-white/[0.08]">
            {analytics.exercises.map((ex) => {
              const completed = !!ex.completed;
              return (
                <button
                  key={ex.exercise_id}
                  type="button"
                  onClick={() => onOpenExercise?.(ex.exercise_id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-white">
                      #{ex.sort_order}. <span className="font-mono text-slate-500 dark:text-stone-400">{ex.kind}</span>
                    </div>
                    {ex.prompt ? (
                      <div className="mt-1 max-h-10 overflow-hidden text-sm text-slate-500 dark:text-stone-400">{ex.prompt}</div>
                    ) : null}
                    <div className="mt-2 text-xs font-semibold text-slate-400 dark:text-stone-500">
                      Attempts: {ex.attempts ?? 0} · Accuracy: {Math.round((ex.accuracy ?? 0) * 100)}% · XP: {ex.xp ?? 0}
                    </div>
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-xs font-bold " +
                      (completed ? "bg-grass-50 text-grass-700 dark:bg-grass-500/15 dark:text-grass-400" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-stone-400")
                    }
                  >
                    {completed ? "Done" : "Incomplete"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs font-semibold text-slate-400 dark:text-stone-500">
            Lesson completes at <span className="text-slate-600 dark:text-stone-300">70%</span> correct.
            {totalXp ? (
              <> · XP: <span className="text-slate-600 dark:text-stone-300">{earnedXp}</span> / {totalXp}</>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
