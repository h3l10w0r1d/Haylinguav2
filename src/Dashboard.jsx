// src/Dashboard.jsx — "The Journey to Ararat": a roadmap timeline, Armenian-branded.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Lock, MapPin, Loader2, Trophy, Users, ChevronRight, ArrowRight, RotateCcw } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// Warm Armenian palette rotation for unit bands (no Duolingo green).
const UNIT_THEMES = [
  { band: "from-brand-500 to-brand-600", shadow: "shadow-btn-brand", dot: "bg-gold-400" },
  { band: "from-pom-500 to-pom-600", shadow: "shadow-[0_4px_0_0_#8F1033]", dot: "bg-gold-400" },
  { band: "from-gold-500 to-gold-600", shadow: "shadow-[0_4px_0_0_#B45309]", dot: "bg-pom-400" },
];

// An 8-pointed Armenian star — used to mark mastered lessons.
function StarMotif({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 1.5l2.2 5.1 5.1-2.2-2.2 5.1 2.2 5.1-5.1-2.2L12 22.5l-2.2-5.1-5.1 2.2 2.2-5.1-2.2-5.1 5.1 2.2z" />
    </svg>
  );
}

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
      <div className="grid h-14 w-14 place-items-center rounded-full bg-gold-500 text-white shadow-[0_4px_0_0_#B45309]">
        <StarMotif className="h-7 w-7" />
      </div>
    );
  }
  if (status === "current") {
    return (
      <div className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-white shadow-node-brand">
        <span className="absolute inset-0 animate-ringPulse rounded-full ring-4 ring-brand-300" />
        <MapPin className="h-7 w-7" />
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
            (isCompleted ? "bg-brand-400" : "bg-slate-200")
          }
        />
      )}
      {/* Node on the spine + short connector to the card */}
      <div className="absolute left-7 top-0 z-10 -translate-x-1/2">
        <Medallion status={status} />
      </div>
      <div className="absolute left-[3.4rem] top-7 h-1.5 w-6 rounded-full bg-slate-200" />

      {/* "You are here" tag for the current lesson */}
      {isCurrent && (
        <div className="absolute left-7 -top-5 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
          You are here
        </div>
      )}

      {/* Milestone card */}
      <div
        className={
          "rounded-2xl p-4 transition " +
          (isCurrent
            ? "bg-brand-50 ring-2 ring-brand-300 shadow-sm"
            : isCompleted
            ? "bg-white ring-1 ring-slate-200"
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
              {isCompleted ? "Mastered" : isCurrent ? "In progress" : "Locked"}
            </div>
          </div>
          {isCompleted && <StarMotif className="h-5 w-5 shrink-0 text-gold-500" />}
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

        {/* Completed: review link */}
        {isCompleted && (
          <button
            onClick={() => onStart(lesson)}
            className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" /> Review
          </button>
        )}
      </div>
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
      const key = Number(l.level ?? l.unit ?? 1);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([level, items]) => ({ level, items }));
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
              return (
                <section key={unit.level} className="mb-8">
                  {/* Ornamental unit band */}
                  <div className={`mb-7 overflow-hidden rounded-2xl bg-gradient-to-r ${theme.band} ${theme.shadow}`}>
                    <div className="flex items-center justify-between px-5 py-3 text-white">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                          Unit {unit.level}
                        </div>
                        <div className="font-display text-lg font-extrabold">
                          {unit.items[0]?.unit_title || `Chapter ${unit.level}`}
                        </div>
                      </div>
                      <span className={`grid h-8 w-8 place-items-center rounded-full ${theme.dot} text-white`}>
                        <StarMotif className="h-5 w-5" />
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
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50">
                  <Flame className="h-6 w-6 fill-brand-500 text-brand-500" />
                </div>
                <div>
                  <div className="font-display text-2xl font-extrabold leading-none text-slate-800">{stats.streak}</div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">day streak</div>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {stats.streak > 0 ? "Practice today to keep it going!" : "Finish a lesson to start your streak."}
              </p>
            </div>

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
