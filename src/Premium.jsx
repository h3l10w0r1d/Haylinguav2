// src/Premium.jsx — Premium upsell + SIMULATED checkout (no real charge yet).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Heart, Check, Infinity as InfinityIcon, ShieldCheck, Loader2, Lock } from "lucide-react";
import grandma from "./assets/character-grandma.png";
import { writeHearts } from "./lib/hearts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

const PERKS = [
  { icon: InfinityIcon, text: "Unlimited hearts — never wait to learn again" },
  { icon: Heart, text: "Mistakes don’t stop you mid-lesson" },
  { icon: ShieldCheck, text: "Support Haylingua and help us build more" },
];

function CardField({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-extrabold text-slate-700">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400"
      />
    </label>
  );
}

export default function Premium() {
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/me/premium`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.is_premium) setIsPremium(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function pay(e) {
    e?.preventDefault?.();
    setPaying(true);
    try {
      // SIMULATED payment — pretend to process the card, then activate premium.
      await new Promise((res) => setTimeout(res, 1200));
      const token = getToken();
      const r = await fetch(`${API_BASE}/me/premium/checkout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("checkout failed");
      const d = await r.json();
      writeHearts(d); // ∞ hearts everywhere
      setIsPremium(true);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/40 to-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gold-500 text-white shadow-[0_6px_0_0_#B45309]">
            <Crown className="h-10 w-10" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold text-slate-800">You’re Premium! ✨</h1>
          <p className="mt-2 font-semibold text-slate-500">
            You now have <span className="font-extrabold text-brand-600">unlimited hearts</span>. Mistakes won’t stop you anymore.
          </p>
          <button onClick={() => navigate("/dashboard")} className="btn3d btn3d-brand mt-7 uppercase">
            Back to learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 to-white">
      <div className="mx-auto grid max-w-5xl items-start gap-8 px-4 py-12 lg:grid-cols-2">
        {/* Pitch */}
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_0_#B45309]">
            <Crown className="h-4 w-4" /> Haylingua Premium
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-800 sm:text-5xl">
            Never run out of <span className="text-brand-500">hearts</span>.
          </h1>
          <p className="mt-3 max-w-md text-lg font-semibold text-slate-500">
            Keep learning Armenian without interruptions. Make all the mistakes you need.
          </p>

          <ul className="mt-6 space-y-3">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 font-bold text-slate-700">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                  <p.icon className="h-5 w-5" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <img src={grandma} alt="" className="mt-8 hidden h-28 w-28 rounded-3xl object-cover lg:block" />
        </div>

        {/* Checkout */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div className="font-display text-xl font-extrabold text-slate-800">Premium</div>
            <div className="font-display text-2xl font-extrabold text-slate-800">
              ֏1,490<span className="text-base font-bold text-slate-400"> / month</span>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs font-bold text-grass-600">
            <Check className="h-4 w-4" /> Cancel anytime
          </div>

          <form onSubmit={pay} className="mt-5 space-y-4">
            <CardField
              label="Name on card"
              value={card.name}
              onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
              placeholder="Armen Ghazaryan"
              autoComplete="cc-name"
            />
            <CardField
              label="Card number"
              value={card.number}
              onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
            />
            <div className="grid grid-cols-2 gap-4">
              <CardField
                label="Expiry"
                value={card.exp}
                onChange={(e) => setCard((c) => ({ ...c, exp: e.target.value }))}
                placeholder="MM / YY"
              />
              <CardField
                label="CVC"
                value={card.cvc}
                onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
                placeholder="123"
                inputMode="numeric"
              />
            </div>

            <button type="submit" disabled={paying} className="btn3d btn3d-brand w-full uppercase">
              {paying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Crown className="h-5 w-5" /> Start Premium
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Simulated payment — no card is charged yet.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
