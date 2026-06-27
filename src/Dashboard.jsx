// src/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Star, Lock, Crown, Loader2, Trophy, Users, ChevronRight } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// Gentle horizontal zig-zag (px) that gives the path its winding shape.
const WIND = [0, 44, 64, 44, 0, -44, -64, -44];

function PathNode({ lesson, index, onStart }) {
  const status = lesson.status || "locked";
  const isCompleted = status === "completed";
  const isCurrent = status === "current";
  const isLocked = status === "locked";
  const offset = WIND[index % WIND.length];

  const look = isCompleted
    ? "bg-grass-500 text-white shadow-node-grass"
    : isCurrent
    ? "bg-brand-500 text-white shadow-node-brand"
    : "bg-slate-200 text-slate-400 shadow-node";

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      {isCurrent && (
        <div className="absolute -top-12 z-20 animate-bouncey rounded-2xl bg-white px-3 py-1.5 font-display text-sm font-extrabold uppercase text-brand-500 shadow-md ring-1 ring-brand-100">
          Start
          <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white ring-1 ring-brand-100" />
        </div>
      )}

      <button
        type="button"
        onClick={() => (!isLocked ? onStart(lesson) : null)}
        disabled={isLocked}
        aria-label={lesson.title}
        className={`relative grid h-[78px] w-[78px] place-items-center rounded-full transition-all duration-100 active:translate-y-1 ${look} ${
          isLocked ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {isCurrent && (
          <span className="absolute inset-0 animate-ringPulse rounded-full ring-4 ring-brand-300" />
        )}
        {isCompleted ? (
          <Star className="h-8 w-8 fill-white" />
        ) : isCurrent ? (
          <Crown className="h-8 w-8" />
        ) : (
          <Lock className="h-7 w-7" />
        )}
      </button>

      <div
        className={`mt-3 max-w-[170px] text-center font-display text-sm font-extrabold leading-tight ${
          isLocked ? "text-slate-400" : "text-slate-700"
        }`}
      >
        {lesson.title}
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
        <button
          onClick={onClick}
          className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-brand-500 hover:text-brand-600"
        >
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

  // Group lessons into units by level (fallback: one unit).
  const units = useMemo(() => {
    const groups = new Map();
    lessons.forEach((l) => {
      const key = Number(l.level ?? l.unit ?? 1);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([level, items]) => ({ level, items }));
  }, [lessons]);

  let nodeCounter = 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
        {/* ── Path column ── */}
        <main className="mx-auto w-full max-w-xl lg:mx-0 lg:flex-1">
          {/* Greeting */}
          <div className="mb-8 flex items-center gap-4 rounded-3xl bg-white p-4 ring-1 ring-brand-100 shadow-sm">
            <img
              src={grandma}
              alt="Tatik, your Haylingua guide"
              className="h-16 w-16 shrink-0 animate-floaty rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-extrabold text-slate-800">
                Բարև{firstName ? `, ${firstName}` : ""}! 👋
              </div>
              <div className="text-sm font-semibold text-slate-500">
                {stats.lessons_completed > 0
                  ? `${stats.lessons_completed} lessons done — keep your ${stats.streak}-day streak alive!`
                  : "Let’s learn some Armenian today."}
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
              <span className="font-semibold">Loading your path…</span>
            </div>
          ) : units.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center font-semibold text-slate-600 ring-1 ring-slate-200">
              No lessons available yet. Check back soon!
            </div>
          ) : (
            units.map((unit) => (
              <section key={unit.level} className="mb-2">
                {/* Unit header banner */}
                <div className="mb-10 flex items-center justify-between rounded-2xl bg-grass-600 px-5 py-3 text-white shadow-btn-grass">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/80">
                      Unit {unit.level}
                    </div>
                    <div className="font-display text-lg font-extrabold">
                      {unit.items[0]?.unit_title || `Level ${unit.level}`}
                    </div>
                  </div>
                  <Crown className="h-7 w-7" />
                </div>

                {/* Winding path of nodes */}
                <div className="flex flex-col items-center gap-y-14 pb-12">
                  {unit.items.map((lesson) => {
                    const node = (
                      <PathNode
                        key={lesson.id ?? lesson.slug}
                        lesson={lesson}
                        index={nodeCounter}
                        onStart={handleStart}
                      />
                    );
                    nodeCounter += 1;
                    return node;
                  })}
                </div>
              </section>
            ))
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
                  <div className="font-display text-2xl font-extrabold leading-none text-slate-800">
                    {stats.streak}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    day streak
                  </div>
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
