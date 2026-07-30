// src/BonusesPage.jsx — mobile-only hub for the "extra" features that live
// in Dashboard's desktop sidebar (QuickLinks + the mistakes card). Desktop
// keeps those inline in the sidebar; on mobile they're hidden there (see
// Dashboard.jsx's `hidden md:block` wrappers) and surfaced here instead,
// reachable from the mobile bottom nav's new "Bonuses" tab.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Dumbbell, Map, BookOpen, BarChart2, Store, Star } from "lucide-react";
import { apiFetch } from "./lib/apiFetch";

const CARD =
  "rounded-2xl bg-white shadow-[0_2px_10px_-2px_rgba(28,25,23,0.08)] ring-1 ring-black/[0.03] " +
  "dark:bg-[#18181b] dark:shadow-none dark:ring-white/[0.07]";

const ACCENT = {
  brand:    { chip: "bg-brand-50 dark:bg-brand-500/15",       icon: "text-brand-500 dark:text-brand-400" },
  grass:    { chip: "bg-grass-50 dark:bg-grass-500/15",       icon: "text-grass-600 dark:text-grass-400" },
  amber:    { chip: "bg-amber-50 dark:bg-amber-500/15",       icon: "text-amber-500 dark:text-amber-400" },
  feather:  { chip: "bg-feather-50 dark:bg-feather-500/15",   icon: "text-feather-500 dark:text-feather-400" },
  pom:      { chip: "bg-pom-50 dark:bg-pom-500/15",           icon: "text-pom-500 dark:text-pom-400" },
};

function Chip({ chip, icon: Icon }) {
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${chip.chip}`}>
      <Icon className={`h-5 w-5 ${chip.icon}`} />
    </span>
  );
}

const TILES = [
  { icon: Dumbbell, label: "Practice", desc: "Drill lessons you've already unlocked", to: "/practice", accent: ACCENT.brand },
  { icon: Map, label: "Adventures", desc: "Walk through a scene, Duolingo-style", to: "/adventures", accent: ACCENT.grass },
  { icon: BookOpen, label: "Words", desc: "Browse everything you've learned", to: "/vocabulary", accent: ACCENT.feather },
  { icon: BarChart2, label: "Progress", desc: "XP, streaks, and mastery over time", to: "/progress", accent: ACCENT.feather },
  { icon: Store, label: "Shop", desc: "Spend gems on frames, freezes, and more", to: "/shop", accent: ACCENT.pom },
  { icon: Star, label: "Achievements", desc: "Badges you've earned along the way", to: "/achievements", accent: ACCENT.amber },
];

export default function BonusesPage() {
  const navigate = useNavigate();
  const [mistakeCount, setMistakeCount] = useState(0);

  useEffect(() => {
    apiFetch("/me/mistakes/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMistakeCount(Number(d.count) || 0); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/30 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <header className="flex items-center gap-3 px-4 py-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:text-stone-500 dark:hover:bg-white/[0.06] dark:hover:text-stone-300"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">Bonuses</h1>
          <p className="text-xs text-slate-500 dark:text-stone-400">Practice, adventures, and everything else</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-3 px-4 pb-20 sm:px-6">
        {mistakeCount > 0 && (
          <div className={"p-5 " + CARD}>
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-extrabold text-stone-800 dark:text-stone-100">Your mistakes</div>
              <span className="rounded-full bg-cardinal-50 px-2 py-0.5 text-xs font-bold text-cardinal-500 dark:bg-cardinal-500/15 dark:text-cardinal-400">
                Fix them
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-cardinal-500 dark:text-cardinal-400">{mistakeCount}</span>
              <span className="text-sm text-stone-500 dark:text-stone-400">to re-master</span>
            </div>
            <button
              onClick={() => navigate("/mistakes")}
              className="mt-4 w-full rounded-xl bg-cardinal-500 py-2.5 text-sm font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(255,75,75,0.6)] transition hover:bg-cardinal-600 active:scale-[0.99]"
            >
              Review mistakes
            </button>
          </div>
        )}

        <div className={"divide-y divide-stone-100 dark:divide-white/[0.06] " + CARD}>
          {TILES.map((t) => (
            <button
              key={t.to}
              type="button"
              onClick={() => navigate(t.to)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-stone-50 active:scale-[0.99] dark:hover:bg-white/[0.04]"
            >
              <Chip chip={t.accent} icon={t.icon} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-stone-800 dark:text-stone-100">{t.label}</span>
                <span className="block truncate text-xs text-stone-500 dark:text-stone-400">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
