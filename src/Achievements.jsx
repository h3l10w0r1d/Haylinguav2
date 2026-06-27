// src/Achievements.jsx — milestone badges (computed server-side from stats).
import React, { useEffect, useState } from "react";
import { Target, Zap, Crown, Star, Flame, Check, Loader2 } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}
const ICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

export default function Achievements() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    fetch(`${API_BASE}/me/achievements`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800">Achievements</h1>
          <p className="mt-1 font-semibold text-slate-500">
            {data ? `${data.earned} of ${data.total} unlocked` : "Earn badges as you learn Armenian."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Loading…</span>
          </div>
        ) : !data?.achievements?.length ? (
          <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200">
            <img src={grandma} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
            <p className="mt-3 font-semibold text-slate-500">Start a lesson to earn your first badge!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.achievements.map((a) => {
              const Icon = ICON[a.icon] || Star;
              const pct = a.target ? Math.round((a.progress / a.target) * 100) : 0;
              return (
                <div
                  key={a.id}
                  className={"rounded-3xl p-5 shadow-sm ring-1 " + (a.earned ? "bg-white ring-gold-200" : "bg-slate-50 ring-slate-200")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        "grid h-12 w-12 shrink-0 place-items-center rounded-2xl " +
                        (a.earned ? "bg-gold-500 text-white shadow-[0_4px_0_0_#B45309]" : "bg-slate-200 text-slate-400")
                      }
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-display text-base font-extrabold text-slate-800">
                        {a.title}
                        {a.earned ? <Check className="h-4 w-4 text-grass-500" /> : null}
                      </div>
                      <div className="text-sm font-semibold text-slate-500">{a.desc}</div>
                    </div>
                  </div>

                  {!a.earned ? (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">{a.progress}/{a.target}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
