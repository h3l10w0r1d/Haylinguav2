// src/Premium.jsx — Premium upsell + SIMULATED checkout (no real charge yet).
// Plans are CMS-managed (see /cms/premium) — nothing here is hardcoded pricing.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Heart, Check, Infinity as InfinityIcon, ShieldCheck, Loader2, Lock, Star } from "lucide-react";
import grandma from "./assets/character-grandma.png";
import { writeHearts } from "./lib/hearts";
import { track, newEventId } from "./lib/analytics";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

const FALLBACK_PERKS = [
  { icon: InfinityIcon, text: "Unlimited hearts — never wait to learn again" },
  { icon: Heart, text: "Mistakes don’t stop you mid-lesson" },
  { icon: ShieldCheck, text: "Support Haylingua and help us build more" },
];

const INTERVAL_LABEL = { month: "/ month", year: "/ year", lifetime: "one-time" };
const CURRENCY_PREFIX = { AMD: "֏", USD: "$", EUR: "€" };

function formatPrice(price, currency) {
  const prefix = CURRENCY_PREFIX[currency] || (currency ? `${currency} ` : "");
  return `${prefix}${Number(price || 0).toLocaleString()}`;
}

function CardField({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-extrabold text-slate-700 dark:text-stone-200">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-[#18181b] dark:placeholder:text-stone-500"
      />
    </label>
  );
}

function PlanCard({ plan, selected, onSelect }) {
  const perks = Array.isArray(plan.perks) && plan.perks.length ? plan.perks : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "relative flex w-full flex-col rounded-3xl p-5 text-left ring-2 transition " +
        (selected ? "bg-brand-50 ring-brand-400 shadow-sm dark:bg-brand-500/15" : "bg-white ring-slate-200 hover:ring-slate-300 dark:bg-[#18181b] dark:ring-white/[0.08] dark:hover:ring-white/10")
      }
    >
      {plan.badge_label ? (
        <div className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-extrabold text-white shadow-[0_2px_0_0_#B45309]">
          <Star className="h-3 w-3 fill-white" /> {plan.badge_label}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{plan.title}</div>
          {plan.subtitle ? <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">{plan.subtitle}</div> : null}
        </div>
        <div
          className={
            "grid h-5 w-5 shrink-0 place-items-center rounded-full ring-2 " +
            (selected ? "bg-brand-500 ring-brand-500" : "ring-slate-300 dark:ring-white/10")
          }
        >
          {selected ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
        </div>
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold text-slate-800 dark:text-white">
        {formatPrice(plan.price, plan.currency)}
        <span className="ml-1 text-sm font-bold text-slate-400 dark:text-stone-500">{INTERVAL_LABEL[plan.interval] || ""}</span>
      </div>
      {perks ? (
        <ul className="mt-3 space-y-1.5">
          {perks.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs font-semibold text-slate-600 dark:text-stone-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-grass-500" /> {p}
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}

export default function Premium() {
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState(false);
  const [premiumInfo, setPremiumInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/premium/plans`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.plans || [];
        setPlans(list);
        // Default to the badged ("best value") plan if there is one, else the first.
        const featured = list.find((p) => p.badge_label) || list[0];
        if (featured) setSelectedPlanId(featured.id);
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/me/premium`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.is_premium) { setIsPremium(true); setPremiumInfo(d); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  async function pay(e) {
    e?.preventDefault?.();
    setPaying(true);
    // Shared between this browser-side track() call (Pixel, via GTM's
    // dataLayer) and the backend's server-side CAPI forward for the same
    // Purchase event, so Meta deduplicates instead of double-counting —
    // see src/lib/analytics.js's newEventId() and
    // backend/integrations/gtm_server.py.
    const eventId = newEventId();
    try {
      // SIMULATED payment — pretend to process the card, then activate premium.
      await new Promise((res) => setTimeout(res, 1200));
      const token = getToken();
      const r = await fetch(`${API_BASE}/me/premium/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan_id: selectedPlan?.id ?? null, event_id: eventId }),
      });
      if (!r.ok) throw new Error("checkout failed");
      const d = await r.json();
      writeHearts(d); // ∞ hearts everywhere
      setIsPremium(true);
      track("premium_purchase_completed", {
        plan_id: selectedPlan?.id ?? null,
        value: selectedPlan?.price ?? null,
        currency: selectedPlan?.currency ?? null,
        event_id: eventId,
      });
      setPremiumInfo({ is_premium: true, is_trial: false, premium_since: new Date().toISOString(), premium_until: null });
    } catch {
      track("checkout_failed", { plan_id: selectedPlan?.id ?? null });
      alert("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500 dark:text-brand-400" />
      </div>
    );
  }

  if (isPremium) {
    const isTrial = !!premiumInfo?.is_trial;
    const trialDaysLeft = premiumInfo?.trial_days_left;
    const sinceDate = premiumInfo?.premium_since
      ? new Date(premiumInfo.premium_since).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
      : null;

    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gold-500 text-white shadow-[0_6px_0_0_#B45309]">
            <Crown className="h-10 w-10" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold text-slate-800 dark:text-white">You're Premium! ✨</h1>
          <p className="mt-2 font-semibold text-slate-500 dark:text-stone-400">
            You have <span className="font-extrabold text-brand-600 dark:text-brand-400">unlimited hearts</span>. Mistakes won't stop you anymore.
          </p>

          {isTrial ? (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-gold-50 px-4 py-3 text-sm font-bold text-gold-700 ring-1 ring-gold-200 dark:bg-gold-500/10 dark:text-gold-300 dark:ring-gold-500/25">
              {typeof trialDaysLeft === "number"
                ? `Trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
                : "You're on a free trial"}
            </div>
          ) : sinceDate ? (
            <div className="mx-auto mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 dark:bg-white/[0.06] dark:text-stone-400">
              Member since {sinceDate}
            </div>
          ) : null}

          <button onClick={() => navigate("/dashboard")} className="btn3d btn3d-brand mt-4 uppercase">
            Back to learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <div className="mx-auto grid max-w-5xl items-start gap-8 px-4 py-12 lg:grid-cols-2">
        {/* Pitch */}
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_0_#B45309]">
            <Crown className="h-4 w-4" /> Haylingua Premium
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-800 sm:text-5xl dark:text-white">
            Never run out of <span className="text-brand-500 dark:text-brand-400">hearts</span>.
          </h1>
          <p className="mt-3 max-w-md text-lg font-semibold text-slate-500 dark:text-stone-400">
            Keep learning Armenian without interruptions. Make all the mistakes you need.
          </p>

          <ul className="mt-6 space-y-3">
            {FALLBACK_PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 font-bold text-slate-700 dark:text-stone-200">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                  <p.icon className="h-5 w-5" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <img src={grandma} alt="" className="mt-8 hidden h-28 w-28 rounded-3xl object-cover lg:block" />
        </div>

        {/* Plans + checkout */}
        <div>
          {plansLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500 dark:text-brand-400" />
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08]">
              No plans are available right now — please check back soon.
            </div>
          ) : (
            <>
              <div className={"grid gap-3 " + (plans.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
                {plans.map((p) => (
                  <PlanCard key={p.id} plan={p} selected={p.id === selectedPlanId} onSelect={() => setSelectedPlanId(p.id)} />
                ))}
              </div>

              <div className="mt-5 rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="flex items-baseline justify-between">
                  <div className="font-display text-xl font-extrabold text-slate-800 dark:text-white">
                    {selectedPlan?.title || "Premium"}
                  </div>
                  {selectedPlan ? (
                    <div className="font-display text-2xl font-extrabold text-slate-800 dark:text-white">
                      {formatPrice(selectedPlan.price, selectedPlan.currency)}
                      <span className="text-base font-bold text-slate-400 dark:text-stone-500"> {INTERVAL_LABEL[selectedPlan.interval] || ""}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-grass-600 dark:text-grass-400">
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

                  <button type="submit" disabled={paying || !selectedPlan} className="btn3d btn3d-brand w-full uppercase">
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

                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-stone-500">
                    <Lock className="h-3.5 w-3.5" />
                    Simulated payment — no card is charged yet.
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
