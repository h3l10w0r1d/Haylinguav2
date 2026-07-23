// src/LessonCompletionScreen.jsx
import { useMemo, useState, useEffect } from "react";
import {
  Zap,
  Target,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Share2,
  Check,
  Flame,
  Gift,
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

const CONFETTI_COLORS = ["#FF7A1A", "#58CC02", "#1CB0F6", "#FFC800", "#E11D48"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
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

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms) || 0) / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Duolingo-style two-tone stat card: a colored label band over a white body
 * with an icon + big value. (Reference: "TOTAL XP ⚡15" / "AMAZING 🎯100%".)
 */
function DuoStatCard({ label, icon: Icon, value, tone }) {
  const tones = {
    gold: {
      ring: "ring-gold-400 dark:ring-gold-500/40",
      band: "bg-gold-400",
      text: "text-gold-500 dark:text-gold-400",
    },
    grass: {
      ring: "ring-grass-500 dark:ring-grass-500/40",
      band: "bg-grass-500",
      text: "text-grass-600 dark:text-grass-400",
    },
    feather: {
      ring: "ring-feather-500 dark:ring-feather-500/40",
      band: "bg-feather-500",
      text: "text-feather-600 dark:text-feather-400",
    },
  };
  const t = tones[tone] || tones.gold;
  return (
    <div className={"overflow-hidden rounded-2xl ring-2 " + t.ring}>
      <div className={"py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white " + t.band}>
        {label}
      </div>
      <div className="flex items-center justify-center gap-1.5 bg-white py-3 dark:bg-[#18181b]">
        <Icon className={"h-5 w-5 " + t.text} />
        <span className={"font-display text-2xl font-extrabold leading-none " + t.text}>{value}</span>
      </div>
    </div>
  );
}

/** Compact reward extras Duolingo shows on completion: streak + any chest. */
function RewardExtras({ onOpenChest }) {
  const [streak, setStreak] = useState(null);
  const [chests, setChests] = useState(0);

  useEffect(() => {
    const h = { Authorization: `Bearer ${rsToken()}` };
    const get = (p) => fetch(`${RS_API_BASE}${p}`, { headers: h }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("/me/streak"), get("/me/wallet")]).then(([s, w]) => {
      setStreak(Number(s?.streak ?? 0));
      setChests(Number(w?.chests ?? 0));
    });
  }, []);

  const hasStreak = streak != null && streak > 0;
  if (!hasStreak && chests <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {hasStreak ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Flame className="h-4 w-4 fill-brand-400" /> {streak} day{streak === 1 ? "" : "s"}
        </span>
      ) : null}
      {chests > 0 ? (
        <button
          type="button"
          onClick={onOpenChest}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1.5 text-sm font-extrabold text-gold-700 transition active:scale-95 dark:bg-gold-500/20 dark:text-gold-400"
        >
          <Gift className="h-4 w-4" /> Open chest
        </button>
      ) : null}
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [chestReward, setChestReward] = useState(null);
  const [openingChest, setOpeningChest] = useState(false);

  const ratio = useMemo(() => clamp01(analytics?.completion_ratio), [analytics]);
  const percent = Math.round(ratio * 100);

  const earnedXp = Number(analytics?.earned_xp ?? 0) || 0;
  const totalXp = Number(analytics?.lesson_total_xp ?? 0) || 0;
  const correct = Number(analytics?.correct_exercises ?? analytics?.completed_exercises ?? 0) || 0;
  const total = Number(analytics?.total_exercises ?? 0) || 0;

  const xp = Number(sessionXpEarned ?? earnedXp) || 0;
  const xpCount = useCountUp(xp);

  const accuracy = useMemo(() => {
    const attempts = Number(analytics?.total_attempts ?? 0) || 0;
    const correctAttempts = Number(analytics?.correct_attempts ?? 0) || 0;
    if (!attempts) return total > 0 ? Math.round((correct / total) * 100) : percent;
    return Math.round((correctAttempts / attempts) * 100);
  }, [analytics, correct, total, percent]);

  // Duolingo rates the run with a word based on accuracy.
  const ratingWord = accuracy >= 90 ? "Amazing" : accuracy >= 70 ? "Great" : "Good";

  async function openChest() {
    if (openingChest) return;
    setOpeningChest(true);
    try {
      const r = await fetch(`${RS_API_BASE}/me/chests/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${rsToken()}` },
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data) {
        window.dispatchEvent(new CustomEvent("hay_wallet", { detail: { gems: data.gems } }));
        setChestReward({
          type: data.reward_type || "gems",
          gems: Number(data.reward_gems || 0),
          rarity: data.rarity || "wooden",
          xpBoost: !!data.xp_boost_granted,
        });
      }
    } catch {
      /* ignore — chest stays available */
    } finally {
      setOpeningChest(false);
    }
  }

  // Fanfare on mount for a passing lesson — the confetti's silent partner.
  useEffect(() => {
    if (percent >= 70) sfx.complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white dark:bg-[#0f0f10]">
      {percent >= 70 ? <Confetti /> : null}

      {/* Hero — centered, fits the screen; only opens to scroll if the learner
          taps "View details". */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-6 text-center">
        <Illustration
          name="mascot-cheer"
          alt="Tatik celebrating"
          className="h-24 w-24 rounded-3xl object-cover"
        />

        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-gold-500 sm:text-4xl dark:text-gold-400">
            {perfect ? "Perfect Lesson!" : "Lesson Complete!"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">
            {perfect
              ? "Կեցցե՛ս! Flawless — not a single mistake. 🎉"
              : `${mistakes} mistake${Number(mistakes) === 1 ? "" : "s"} — tap Retry to master it.`}
          </p>
        </div>

        {/* Two Duolingo stat cards: TOTAL XP + rating/accuracy. */}
        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <DuoStatCard label="Total XP" icon={Zap} value={`+${xpCount}`} tone="gold" />
          <DuoStatCard label={ratingWord} icon={Target} value={`${accuracy}%`} tone="grass" />
        </div>

        {/* Optional third line: correct count + time, compact. */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-bold text-slate-400 dark:text-stone-500">
          {total ? <span>{correct}/{total} correct</span> : null}
          {Number.isFinite(timeMs) ? (
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {formatDuration(timeMs)}</span>
          ) : null}
          {comboBonusXp > 0 ? <span className="text-brand-500 dark:text-brand-400">+{comboBonusXp} combo</span> : null}
        </div>

        <RewardExtras onOpenChest={openChest} />

        {analyticsError ? (
          <div className="text-xs font-semibold text-cardinal-500">Couldn’t load full analytics.</div>
        ) : null}

        {/* Opt-in breakdown — only expands (and scrolls) when asked, so the
            default view stays a single screen. */}
        {analytics?.exercises?.length ? (
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="mx-auto inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200"
            >
              {detailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              View details
            </button>
            {detailsOpen ? (
              <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl text-left ring-1 ring-slate-200 dark:divide-white/[0.06] dark:ring-white/[0.08]">
                {analytics.exercises.map((ex) => {
                  const completed = !!ex.completed;
                  return (
                    <button
                      key={ex.exercise_id}
                      type="button"
                      onClick={() => onOpenExercise?.(ex.exercise_id)}
                      className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-white">
                          #{ex.sort_order}. <span className="font-mono text-slate-500 dark:text-stone-400">{ex.kind}</span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-400 dark:text-stone-500">
                          Attempts: {ex.attempts ?? 0} · {Math.round((ex.accuracy ?? 0) * 100)}% · XP: {ex.xp ?? 0}
                        </div>
                      </div>
                      <span
                        className={
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold " +
                          (completed ? "bg-grass-50 text-grass-700 dark:bg-grass-500/15 dark:text-grass-400" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-stone-400")
                        }
                      >
                        {completed ? "Done" : "Missed"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Fixed bottom bar — always reachable, never scrolled past. */}
      <div className="safe-b relative shrink-0 border-t-2 border-slate-100 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#0f0f10]">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <button
            type="button"
            onClick={onDone}
            disabled={isSaving}
            className="btn3d btn3d-brand w-full uppercase"
          >
            Continue <span aria-hidden>→</span>
          </button>
          <div className="flex items-center justify-center gap-4 text-sm font-bold text-slate-400 dark:text-stone-500">
            <button
              type="button"
              onClick={onRetry}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 hover:text-slate-600 dark:hover:text-stone-300"
            >
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
            <button
              type="button"
              onClick={async () => {
                const result = await shareLesson({
                  lessonTitle: lesson?.title || "a lesson",
                  xp,
                  accuracy,
                });
                if (result === "copied") {
                  setShareDone(true);
                  setTimeout(() => setShareDone(false), 2500);
                }
              }}
              className="inline-flex items-center gap-1.5 hover:text-slate-600 dark:hover:text-stone-300"
            >
              {shareDone
                ? <><Check className="h-4 w-4 text-grass-500" /> Copied</>
                : <><Share2 className="h-4 w-4" /> Share</>}
            </button>
          </div>
        </div>
      </div>

      {chestReward != null && (
        <ChestOpening reward={chestReward} onClose={() => setChestReward(null)} />
      )}
    </div>
  );
}
