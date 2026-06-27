// src/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Zap, Heart, Star, Check, Lock, Crown, Loader2 } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// Horizontal zig-zag offsets (px) that give the path its winding shape.
const WIND = [0, 48, 78, 48, 0, -48, -78, -48];

function readHearts() {
  try {
    const v = JSON.parse(localStorage.getItem("hay_hearts") || "null");
    if (Number.isFinite(v?.current)) return Number(v.current);
  } catch {}
  return 5;
}

function StatPill({ icon: Icon, value, tone }) {
  const tones = {
    streak: "text-brand-500",
    xp: "text-gold-600",
    hearts: "text-cardinal-500",
  };
  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className={`h-6 w-6 ${tones[tone]} ${tone === "hearts" ? "fill-cardinal-500" : ""} ${
          tone === "streak" ? "fill-brand-500" : ""
        }`}
      />
      <span className="font-display text-lg font-extrabold text-slate-700">{value}</span>
    </div>
  );
}

function PathNode({ lesson, index, onStart }) {
  const status = lesson.status || "locked";
  const isCompleted = status === "completed";
  const isCurrent = status === "current";
  const isLocked = status === "locked";
  const offset = WIND[index % WIND.length];

  const base =
    "relative grid place-items-center h-[72px] w-[72px] rounded-full transition-all duration-100 active:translate-y-1";
  const look = isCompleted
    ? "bg-grass-500 text-white shadow-node-grass"
    : isCurrent
    ? "bg-brand-500 text-white shadow-node-brand"
    : "bg-slate-200 text-slate-400 shadow-node";

  return (
    <div className="relative flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      {isCurrent && (
        <div className="absolute -top-11 z-10 animate-bouncey rounded-2xl bg-white px-3 py-1.5 font-display text-sm font-extrabold uppercase text-brand-500 shadow-md ring-1 ring-brand-100">
          Start
          <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white ring-1 ring-brand-100" />
        </div>
      )}

      <button
        type="button"
        onClick={() => (!isLocked ? onStart(lesson) : null)}
        disabled={isLocked}
        aria-label={lesson.title}
        className={`${base} ${look} ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {/* Pulsing ring for the active lesson */}
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
        className={`mt-2 max-w-[150px] text-center font-display text-sm font-extrabold ${
          isLocked ? "text-slate-400" : "text-slate-700"
        }`}
      >
        {lesson.title}
      </div>
    </div>
  );
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total_xp: 0, lessons_completed: 0, streak: 0 });
  const [hearts, setHearts] = useState(readHearts);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(
    () => localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "",
    []
  );
  const firstName = (user?.display_name || user?.first_name || user?.email || "").split(/[@ ]/)[0];

  useEffect(() => {
    const onHearts = (e) => Number.isFinite(e?.detail?.current) && setHearts(e.detail.current);
    window.addEventListener("hay_hearts", onHearts);
    return () => window.removeEventListener("hay_hearts", onHearts);
  }, []);

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
        // Token-authenticated; the server resolves the user from the Bearer token.
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
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 to-white">
      {/* Stats bar */}
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <StatPill icon={Flame} value={stats.streak} tone="streak" />
          <StatPill icon={Zap} value={stats.total_xp} tone="xp" />
          <StatPill icon={Heart} value={hearts} tone="hearts" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        {/* Greeting + mascot */}
        <div className="mb-6 flex items-center gap-4 rounded-3xl bg-brand-500 p-5 text-white shadow-btn-brand">
          <img
            src={grandma}
            alt="Tatik, your Haylingua guide"
            className="h-20 w-20 shrink-0 animate-floaty rounded-2xl object-cover"
          />
          <div>
            <div className="font-display text-xl font-extrabold">
              Բարև{firstName ? `, ${firstName}` : ""}! 👋
            </div>
            <div className="text-sm font-semibold text-white/90">
              {stats.lessons_completed > 0
                ? `${stats.lessons_completed} lessons done — keep the streak alive!`
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
          units.map((unit, ui) => (
            <section key={unit.level} className="mb-4">
              {/* Unit header banner */}
              <div className="sticky top-[57px] z-[5] mb-8 mt-2">
                <div className="flex items-center justify-between rounded-2xl bg-grass-600 px-5 py-3 text-white shadow-btn-grass">
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
              </div>

              {/* Winding path of nodes */}
              <div className="flex flex-col items-center gap-9">
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
      </div>
    </div>
  );
}
