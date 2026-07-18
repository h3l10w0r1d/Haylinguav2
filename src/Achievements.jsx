// src/Achievements.jsx — milestone badges (computed server-side from stats).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Zap, Crown, Star, Flame, Check, Loader2, ArrowLeft } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}
const ICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

export default function Achievements() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState("");

  const load = () => {
    const t = getToken();
    return fetch(`${API_BASE}/me/achievements`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function claim(id) {
    setClaiming(id);
    try {
      const t = getToken();
      await fetch(`${API_BASE}/me/rewards/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ kind: "achievement", id }),
      });
      await load();
      window.dispatchEvent(new CustomEvent("hay_xp_changed"));
    } catch {
    } finally {
      setClaiming("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-sm font-extrabold text-slate-600 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 hover:text-brand-600 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.08] dark:hover:bg-white/[0.04] dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Achievements</h1>
          <p className="mt-1 font-semibold text-slate-500 dark:text-stone-400">
            {data ? `${data.earned} of ${data.total} unlocked` : "Earn badges as you learn Armenian."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500 dark:text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Loading…</span>
          </div>
        ) : !data?.achievements?.length ? (
          <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <img src={grandma} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
            <p className="mt-3 font-semibold text-slate-500 dark:text-stone-400">Start a lesson to earn your first badge!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.achievements.map((a) => {
              const Icon = ICON[a.icon] || Star;
              const pct = a.target ? Math.round((a.progress / a.target) * 100) : 0;
              return (
                <div
                  key={a.id}
                  className={"rounded-3xl p-5 shadow-sm ring-1 " + (a.earned ? "bg-white ring-gold-200 dark:bg-[#18181b] dark:ring-gold-500/30" : "bg-slate-50 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
                      style={
                        a.earned
                          ? { background: a.color || "#F59E0B", boxShadow: "0 4px 0 0 rgba(0,0,0,0.22)" }
                          : { background: "#E2E8F0", color: "#94A3B8" }
                      }
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-display text-base font-extrabold text-slate-800 dark:text-white">
                        {a.title}
                        {a.earned ? <Check className="h-4 w-4 text-grass-500" /> : null}
                      </div>
                      <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">{a.desc}</div>
                    </div>
                  </div>

                  {!a.earned ? (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400 dark:text-stone-500">{a.progress}/{a.target}</div>
                    </div>
                  ) : a.claimable ? (
                    <button
                      onClick={() => claim(a.id)}
                      disabled={claiming === a.id}
                      className="mt-3 w-full rounded-xl bg-gold-500 py-2 text-sm font-extrabold uppercase text-white shadow-[0_4px_0_0_#B45309] transition active:translate-y-0.5 disabled:opacity-60"
                    >
                      {claiming === a.id ? "…" : `Claim +${a.reward_xp} XP`}
                    </button>
                  ) : (
                    <div className="mt-3 text-xs font-extrabold uppercase tracking-wide text-grass-600 dark:text-grass-400">+{a.reward_xp} XP claimed ✓</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
