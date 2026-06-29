// src/Shop.jsx — gem marketplace. Spend gems earned from chests.
import React, { useEffect, useState } from "react";
import { Gem, Snowflake, Heart, Zap, Loader2, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}
const ICON = { snowflake: Snowflake, heart: Heart, zap: Zap, gem: Gem };
const TONE = {
  snowflake: "bg-feather-50 text-feather-500",
  heart: "bg-cardinal-50 text-cardinal-500",
  zap: "bg-gold-100 text-gold-600",
};

export default function Shop() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  const load = () => {
    const t = getToken();
    return fetch(`${API_BASE}/me/shop`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function buy(item) {
    setBusy(item.id);
    setMsg(null);
    try {
      const t = getToken();
      const r = await fetch(`${API_BASE}/me/shop/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ item: item.id }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setMsg({ kind: "err", text: (d && d.detail) || "Purchase failed" });
      } else {
        setMsg({ kind: "ok", text: `Bought ${item.title}!` });
        window.dispatchEvent(new CustomEvent("hay_wallet", { detail: { gems: d.gems } }));
        if (item.id === "hearts_refill") window.dispatchEvent(new CustomEvent("hay_hearts"));
        await load();
      }
    } catch {
      setMsg({ kind: "err", text: "Network error" });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800">Shop</h1>
            <p className="mt-1 font-semibold text-slate-500">Spend gems you earn from chests.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-feather-50 px-4 py-2.5 ring-1 ring-feather-100">
            <Gem className="h-5 w-5 text-feather-500" />
            <span className="font-display text-lg font-extrabold text-feather-600 tabular-nums">{data?.gems ?? "–"}</span>
          </div>
        </div>

        {msg ? (
          <div className={"mb-4 rounded-2xl px-4 py-2.5 text-sm font-bold ring-1 " + (msg.kind === "err" ? "bg-cardinal-50 text-cardinal-600 ring-cardinal-100" : "bg-grass-50 text-grass-700 ring-grass-200")}>
            {msg.text}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Loading shop…</span>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(data?.items || []).map((item) => {
              const Icon = ICON[item.icon] || Gem;
              const can = item.affordable && busy !== item.id;
              return (
                <div key={item.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <div className={"grid h-12 w-12 shrink-0 place-items-center rounded-2xl " + (TONE[item.icon] || "bg-slate-100 text-slate-500")}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base font-extrabold text-slate-800">{item.title}</div>
                      <div className="text-sm font-semibold text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => buy(item)}
                    disabled={!can}
                    className={
                      "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 font-display text-sm font-extrabold uppercase transition " +
                      (item.affordable
                        ? "bg-feather-500 text-white shadow-btn-feather active:translate-y-0.5"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed")
                    }
                  >
                    {busy === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Gem className="h-4 w-4" /> {item.price}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
