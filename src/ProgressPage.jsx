// src/ProgressPage.jsx — learning stats & XP heatmap
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Flame, BookOpen, Star, RotateCcw, Zap, Trophy } from "lucide-react";
import { apiFetch } from "./lib/apiFetch";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// ── XP bar chart (last N days) ────────────────────────────────────────────────
function XPChart({ data, days }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center text-sm text-slate-400">
        No activity in the last {days} days yet.
      </div>
    );
  }

  // Build a full calendar of the last `days` days
  const today = new Date();
  const dayMap = {};
  data.forEach(d => { dayMap[d.date] = d.xp; });

  const slots = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    slots.push({ date: key, xp: dayMap[key] || 0 });
  }

  const maxXp = Math.max(...slots.map(s => s.xp), 1);

  return (
    <div className="flex h-28 items-end gap-0.5 overflow-hidden">
      {slots.map((s, i) => {
        const h = Math.max(4, Math.round((s.xp / maxXp) * 96));
        const isToday = i === slots.length - 1;
        return (
          <div
            key={s.date}
            className="group relative flex-1 flex flex-col items-center justify-end"
          >
            <div
              className={
                "w-full min-w-[2px] rounded-t transition-all " +
                (s.xp > 0
                  ? isToday ? "bg-brand-500" : "bg-brand-300"
                  : "bg-slate-100")
              }
              style={{ height: `${h}px` }}
            />
            {s.xp > 0 && (
              <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-white group-hover:block whitespace-nowrap z-10">
                {s.xp} XP · {s.date}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
      <div className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${color}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Streak display ────────────────────────────────────────────────────────────
function StreakBlock({ lessonStreak, reviewStreak, bestStreak }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
      <h3 className="font-display text-base font-extrabold text-slate-800 mb-3">Streaks</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-black text-brand-500">{lessonStreak}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Lesson streak</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-emerald-500">{reviewStreak}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Review streak</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-amber-500">{bestStreak}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Best ever</p>
        </div>
      </div>
    </div>
  );
}

// ── SR progress bar ───────────────────────────────────────────────────────────
function SRBar({ mastered, learning, newCards, total }) {
  if (total === 0) return null;
  const mPct = Math.round((mastered / total) * 100);
  const lPct = Math.round((learning / total) * 100);
  const nPct = 100 - mPct - lPct;
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base font-extrabold text-slate-800">Word mastery</h3>
        <span className="text-xs font-bold text-slate-500">{total} cards total</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100 gap-0.5">
        {mPct > 0 && <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${mPct}%` }} />}
        {lPct > 0 && <div className="h-full bg-amber-400 rounded-full transition-all"   style={{ width: `${lPct}%` }} />}
        {nPct > 0 && <div className="h-full bg-slate-200 rounded-full transition-all"   style={{ width: `${nPct}%` }} />}
      </div>
      <div className="mt-2 flex gap-4">
        {[
          { color: "bg-emerald-500", label: "Mastered", count: mastered },
          { color: "bg-amber-400",   label: "Learning",  count: learning },
          { color: "bg-slate-300",   label: "New",        count: newCards },
        ].map(({ color, label, count }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="font-semibold">{label}</span>
            <span className="font-bold text-slate-800">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [days, setDays]     = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/me/stats/progress?days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/30 to-white">
      <header className="flex items-center gap-3 px-4 py-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-extrabold text-slate-800">Progress</h1>
          <p className="text-xs text-slate-500">Your learning stats</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pb-20 sm:px-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
          </div>
        ) : !data ? (
          <p className="text-center text-sm text-slate-500 py-12">Could not load stats.</p>
        ) : (
          <>
            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Zap}      label="Total XP"       value={data.total_xp.toLocaleString()} color="bg-amber-100 text-amber-600" />
              <StatCard icon={BookOpen} label="Lessons done"   value={data.total_lessons}             color="bg-brand-100 text-brand-600" />
              <StatCard icon={Star}     label="Words mastered" value={data.sr_mastered}               color="bg-emerald-100 text-emerald-600" />
              <StatCard icon={Trophy}   label="Best streak"    value={`${data.best_streak}d`}         color="bg-purple-100 text-purple-600" />
            </div>

            {/* Streaks */}
            <StreakBlock
              lessonStreak={data.lesson_streak}
              reviewStreak={data.review_streak}
              bestStreak={data.best_streak}
            />

            {/* Word mastery bar */}
            <SRBar
              mastered={data.sr_mastered}
              learning={data.sr_learning}
              newCards={data.sr_new}
              total={data.sr_total}
            />

            {/* XP chart */}
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-extrabold text-slate-800">XP history</h3>
                <div className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5">
                  {[7, 30, 60].map(d => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={
                        "rounded-lg px-2.5 py-1 text-xs font-bold transition " +
                        (days === d ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")
                      }
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <XPChart data={data.xp_by_day} days={days} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
