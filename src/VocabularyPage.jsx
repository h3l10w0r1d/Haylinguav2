// src/VocabularyPage.jsx — SR word bank
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Search, BookOpen, Star, Zap, RotateCcw } from "lucide-react";
import { apiFetch } from "./lib/apiFetch";

const STATUS_META = {
  mastered: { label: "Mastered",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500" },
  learning: { label: "Learning",  color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",     dot: "bg-amber-500"   },
  new:      { label: "New",       color: "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-stone-300",     dot: "bg-slate-400"   },
};

const FILTERS = ["all", "mastered", "learning", "new"];

function CardRow({ card }) {
  const meta = STATUS_META[card.status] || STATUS_META.new;
  const config = (() => { try { return JSON.parse(card.config || "{}"); } catch { return {}; } })();
  const front = config.front || card.prompt || "—";
  const back  = config.back  || card.expected_answer || "—";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-slate-800 leading-tight truncate dark:text-white">{front}</p>
            <p className="text-sm text-slate-500 truncate dark:text-stone-400">{back}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
              {meta.label}
            </span>
            {card.interval_days > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-stone-500">
                {card.interval_days}d interval
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-stone-500">{card.lesson_title}</p>
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${color}`}>
        <Icon size={15} />
      </div>
      <div>
        <p className="text-lg font-black text-slate-800 leading-none dark:text-white">{value}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-stone-400">{label}</p>
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery]   = useState("");

  useEffect(() => {
    apiFetch("/me/vocabulary")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let cards = filter === "all" ? data.cards : data.cards.filter(c => c.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      cards = cards.filter(c =>
        (c.prompt || "").toLowerCase().includes(q) ||
        (c.expected_answer || "").toLowerCase().includes(q) ||
        (c.lesson_title || "").toLowerCase().includes(q)
      );
    }
    return cards;
  }, [data, filter, query]);

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
          <h1 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">Vocabulary</h1>
          {data && <p className="text-xs text-slate-500 dark:text-stone-400">{data.total} cards tracked</p>}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pb-20 sm:px-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
          </div>
        ) : !data || data.total === 0 ? (
          <div className="rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
            <BookOpen className="mx-auto mb-3 text-slate-300 dark:text-stone-600" size={48} strokeWidth={1.5} />
            <h2 className="font-display text-lg font-extrabold text-slate-700 dark:text-stone-200">No vocabulary yet</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">Complete some lessons — words will appear here as you learn them.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-5 rounded-2xl bg-brand-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_3px_0_0_#c2410c] transition active:translate-y-0.5"
            >
              Start learning
            </button>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <StatChip icon={Star}     label="Mastered" value={data.mastered}  color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
              <StatChip icon={Zap}      label="Learning" value={data.learning}  color="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"    />
              <StatChip icon={RotateCcw} label="New"     value={data.new_cards} color="bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-stone-400"    />
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
              <input
                type="search"
                placeholder="Search words…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-2xl bg-white py-2.5 pl-9 pr-4 text-sm ring-1 ring-slate-200 shadow-sm outline-none focus:ring-brand-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:placeholder:text-stone-500"
              />
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={
                    "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition " +
                    (filter === f
                      ? "bg-brand-500 text-white shadow-sm"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.08] dark:hover:bg-white/[0.04]")
                  }
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== "all" && data && (
                    <span className="ml-1 opacity-70">
                      ({f === "mastered" ? data.mastered : f === "learning" ? data.learning : data.new_cards})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Card list */}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400 dark:text-stone-500">No cards match your search.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(c => <CardRow key={c.exercise_id} card={c} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
