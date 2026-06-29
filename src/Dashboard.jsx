// src/Dashboard.jsx — "The Journey to Ararat": a roadmap timeline, Armenian-branded.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, Play, Loader2, Trophy, Users, ChevronRight, ArrowRight, RotateCcw, Target, Zap, Crown, Star, Check } from "lucide-react";
import grandma from "./assets/character-grandma.png";
import { StarMotif } from "./lib/motifs";
import StreakFlame from "./lib/StreakFlame";

const QICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

function DailyQuestsCard({ token }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState("");

  const load = () =>
    fetch(`${API_BASE_URL}/me/quests`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});

  useEffect(() => { load(); }, [token]);

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

function StreakCard({ token, streak }) {
  const [days, setDays] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}/me/activity/last7days`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.days && setDays(d.days))
      .catch(() => {});
  }, [token]);

  const n = Number(streak) || 0;
  const lit = n > 0;
  const week = Array.isArray(days) ? days.slice(-7) : [];

  return (
    <div className={"overflow-hidden rounded-3xl p-5 shadow-sm ring-1 " + (lit ? "bg-gradient-to-br from-brand-50 to-white ring-brand-100" : "bg-white ring-slate-200")}>
      <div className="flex items-center gap-3">
        <StreakFlame size={60} lit={lit} />
        <div>
          <div className="font-display text-3xl font-extrabold leading-none text-slate-800 tabular-nums">{n}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">day streak</div>
        </div>
      </div>

      {week.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          {week.map((d, i) => {
            const on = Number(d?.value ?? 0) > 0;
            const label = (String(d?.label ?? "").trim()[0] || "·").toUpperCase();
            return (
              <div
                key={i}
                title={`${d?.label ?? ""}: ${Number(d?.value ?? 0)}`}
                className={
                  "grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold " +
                  (on ? "bg-brand-500 text-white shadow-[0_2px_0_0_#C2410C]" : "bg-slate-100 text-slate-400")
                }
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-sm font-semibold text-slate-500">
        {lit ? "Practice today to keep your flame alive!" : "Finish a lesson to light your streak."}
      </p>
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

function Medallion({ status }) {
  if (status === "completed") {
    return (
      <div className="grid h-14 w-14 place-items-center rounded-full bg-grass-500 text-white shadow-[0_4px_0_0_#3F8F2E]">
        <Check className="h-7 w-7" strokeWidth={3.5} />
      </div>
    );
  }
  if (status === "current") {
    return (
      <div className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-white shadow-node-brand">
        <span className="absolute inset-0 animate-ringPulse rounded-full ring-4 ring-brand-300" />
        <Play className="h-6 w-6 fill-white" />
      </div>
    );
  }
  return (
    <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-200 text-slate-400 shadow-node">
      <Lock className="h-6 w-6" />
    </div>
  );
}

function Milestone({ lesson, isLast, onStart }) {
  const status = lesson.status || "locked";
  const isCompleted = status === "completed";
  const isCurrent = status === "current";
  const isLocked = status === "locked";
  const pct = Math.max(0, Math.min(100, Number(lesson.completion_pct || (isCompleted ? 100 : 0))));

  return (
    <div className="relative pl-[5.5rem]">
      {/* Spine segment (filled up to & including completed lessons) */}
      {!isLast && (
        <div
          className={
            "absolute left-7 top-7 -bottom-2 w-1.5 -translate-x-1/2 rounded-full " +
            (isCompleted ? "bg-grass-400" : "bg-slate-200")
          }
        />
      )}
      {/* Node on the spine + short connector to the card */}
      <div className="absolute left-7 top-0 z-10 -translate-x-1/2">
        <Medallion status={status} />
      </div>
      <div className={"absolute left-[3.4rem] top-7 h-1.5 w-6 rounded-full " + (isCompleted ? "bg-grass-400" : "bg-slate-200")} />

      {/* "You are here" tag for the current lesson */}
      {isCurrent && (
        <div className="absolute left-7 -top-5 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
          You are here
        </div>
      )}

      {/* Milestone card — completed cards are fully clickable (review) */}
      {isCompleted ? (
        <button
          type="button"
          onClick={() => onStart(lesson)}
          className="block w-full rounded-2xl p-4 text-left bg-grass-50 ring-1 ring-grass-200 shadow-sm transition hover:bg-grass-100 hover:ring-grass-300 active:translate-y-0.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-base font-extrabold leading-tight text-slate-800">
                {lesson.title}
              </div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-grass-600">
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Completed
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-grass-700 ring-1 ring-grass-200">
              <RotateCcw className="h-3.5 w-3.5" /> Review
            </span>
          </div>
        </button>
      ) : (
        <div
          className={
            "rounded-2xl p-4 transition " +
            (isCurrent
              ? "bg-brand-50 ring-2 ring-brand-300 shadow-sm"
              : "bg-slate-50 ring-1 ring-slate-200")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={
                  "font-display text-base font-extrabold leading-tight " +
                  (isLocked ? "text-slate-400" : "text-slate-800")
                }
              >
                {lesson.title}
              </div>
              <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                {isCurrent ? "In progress" : "Locked"}
              </div>
            </div>
          </div>

          {/* Current: progress + continue */}
          {isCurrent && (
            <>
              {pct > 0 && (
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 6)}%` }} />
                </div>
              )}
              <button onClick={() => onStart(lesson)} className="btn3d btn3d-brand mt-3 w-full text-sm uppercase">
                {pct > 0 ? "Continue" : "Start lesson"} <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarCard({ icon: Icon, tone, title, text, cta, onClick }) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-display text-base font-extrabold text-slate-800">{title}</div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{text}</p>
      {cta && (
        <button onClick={onClick} className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-brand-500 hover:text-brand-600">
          {cta} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total_xp: 0, lessons_completed: 0, streak: 0 });
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(
    () => localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "",
    []
  );
  const firstName = (user?.display_name || user?.first_name || user?.email || "").split(/[@ ]/)[0];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
        {/* ── Roadmap column ── */}
        <main className="mx-auto w-full max-w-xl lg:mx-0 lg:flex-1">
          {/* Journey hero with Ararat goal */}
          <div className="mb-8 overflow-hidden rounded-3xl bg-brand-50 ring-1 ring-brand-100">
            <div className="flex items-center gap-4 p-5">
              <img src={grandma} alt="" className="h-16 w-16 shrink-0 animate-floaty rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-extrabold text-slate-800">
                  Բարև{firstName ? `, ${firstName}` : ""}! 👋
                </div>
                <div className="text-sm font-semibold text-slate-500">
                  Your journey to <span className="font-extrabold text-brand-600">conversational Armenian</span>.
                </div>
              </div>
              <Ararat className="hidden h-16 w-24 shrink-0 sm:block" />
            </div>
            <div className="bg-white/60 px-5 py-3">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-slate-500">
                <span>{doneLessons} of {totalLessons || "…"} lessons climbed</span>
                <span className="text-brand-600">{journeyPct}%</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-brand-100">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${journeyPct}%` }} />
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border-2 border-cardinal-100 bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-600">
              {error}
            </div>
          )}

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
            units.map((unit, ui) => {
              const theme = UNIT_THEMES[ui % UNIT_THEMES.length];
              const uDone = unit.items.filter((l) => l.status === "completed").length;
              const uTotal = unit.items.length;
              return (
                <section key={unit.key} className="mb-8">
                  {/* Ornamental unit band */}
                  <div className={`mb-7 overflow-hidden rounded-2xl bg-gradient-to-r ${theme.band} ${theme.shadow}`}>
                    <div className="flex items-center justify-between px-5 py-3 text-white">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                          Unit {ui + 1}
                        </div>
                        <div className="font-display text-lg font-extrabold">
                          {unit.title}
                        </div>
                      </div>
                      <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-extrabold tabular-nums">
                        {uDone}/{uTotal}
                      </span>
                    </div>
                    {/* Armenian carpet-style zig-zag border */}
                    <div
                      className="h-2"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, rgba(255,255,255,.5) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,.5) 25%, transparent 25%)",
                        backgroundSize: "12px 8px",
                        backgroundPosition: "0 0",
                      }}
                    />
                  </div>

                  {/* Roadmap timeline */}
                  <div className="space-y-4">
                    {unit.items.map((lesson, i) => (
                      <Milestone
                        key={lesson.id ?? lesson.slug}
                        lesson={lesson}
                        isLast={i === unit.items.length - 1}
                        onStart={handleStart}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </main>

        {/* ── Sidebar (desktop only) ── */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-24 space-y-4">
            <DailyQuestsCard token={token} />

            <StreakCard token={token} streak={stats.streak} />

            <AchievementsCard token={token} onOpen={() => navigate("/achievements")} />

            <SidebarCard
              icon={Trophy}
              tone="bg-amber-50 text-gold-600"
              title="Leaderboard"
              text="See how you stack up against other learners this week."
              cta="View leaderboard"
              onClick={() => navigate("/leaderboard")}
            />
            <SidebarCard
              icon={Users}
              tone="bg-feather-50 text-feather-600"
              title="Learn with friends"
              text="Add friends and keep each other motivated."
              cta="Find friends"
              onClick={() => navigate("/friends")}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
