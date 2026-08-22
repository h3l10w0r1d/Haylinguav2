// src/Shop.jsx — gem marketplace. Spend gems earned from chests.
import React, { useEffect, useMemo, useState } from "react";
import {
  Gem, Snowflake, Heart, Zap, Loader2, Check, Shield, ShieldCheck,
  TrendingUp, Award, Image as ImageIcon, Sparkles, X,
} from "lucide-react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import AvatarFrame from "./lib/avatarFrame";
import NameTag from "./lib/nameTag";

// Minimal fixed base avatar for previewing one marketplace-gated trait value
// at a time (clothing graphic, hairstyle, eyebrows) — same DiceBear call as
// src/AvatarBuilder.jsx's buildSvg, just fixed to defaults for every field
// except the one being previewed, since the shop doesn't know the buyer's
// other trait choices.
const TRAIT_PREVIEW_FIELD = {
  avatar_hairstyle: "top",
  avatar_eyebrows: "eyebrows",
  avatar_clothing_graphic: "clothesGraphic",
};
function buildTraitPreviewUri(field, value) {
  const avatar = createAvatar(avataaars, {
    seed: "haylingua",
    size: 96,
    top: [field === "top" ? value : "shortFlat"],
    hairColor: ["4a312c"],
    skinColor: ["edb98a"],
    eyes: ["default"],
    eyebrows: [field === "eyebrows" ? value : "defaultNatural"],
    mouth: ["smile"],
    clothing: ["hoodie"],
    clothesColor: ["65c9ff"],
    clothesGraphic: field === "clothesGraphic" ? [value] : [],
    backgroundColor: ["b6e3f4"],
  });
  return avatar.toDataUri();
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

const ICON = {
  snowflake: Snowflake,
  heart: Heart,
  zap: Zap,
  gem: Gem,
  shield: Shield,
  "shield-check": ShieldCheck,
  "trending-up": TrendingUp,
  award: Award,
  image: ImageIcon,
  sparkles: Sparkles,
};
const TONE = {
  snowflake: "bg-feather-50 text-feather-500 dark:bg-feather-500/15 dark:text-feather-400",
  heart: "bg-cardinal-50 text-cardinal-500 dark:bg-cardinal-500/15 dark:text-cardinal-400",
  zap: "bg-gold-100 text-gold-600 dark:bg-gold-500/20 dark:text-gold-400",
  shield: "bg-feather-50 text-feather-600 dark:bg-feather-500/15 dark:text-feather-400",
  "shield-check": "bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400",
  "trending-up": "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  award: "bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400",
  image: "bg-pom-50 text-pom-500 dark:bg-pom-500/15 dark:text-pom-400",
};

// Group items into sections by their effect.
const SECTIONS = [
  { key: "power", title: "Power-ups", effects: ["xp_boost", "xp_multiplier", "hearts_refill", "heart_shield"] },
  { key: "streak", title: "Streak protection", effects: ["streak_freeze", "streak_repair"] },
  { key: "cosmetic", title: "Cosmetics", effects: ["avatar_frame", "profile_theme", "name_tag_effect"] },
  { key: "avatar_unlocks", title: "Avatar builder unlocks", effects: ["avatar_clothing_graphic", "avatar_hairstyle", "avatar_eyebrows"] },
  { key: "emotes", title: "Emotes", effects: ["emote"] },
];

function emoteIconUrl(renderKey) {
  return `/emotes/kenney/emotes-pack/${renderKey}.png`;
}

// Non-buyable states → badge copy.
const STATUS_BADGE = {
  owned: { text: "Owned", cls: "bg-grass-50 text-grass-600 ring-grass-200 dark:bg-grass-500/15 dark:text-grass-400 dark:ring-grass-500/30" },
  active: { text: "Active", cls: "bg-feather-50 text-feather-600 ring-feather-100 dark:bg-feather-500/15 dark:text-feather-400 dark:ring-feather-500/30" },
  maxed: { text: "Max owned", cls: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-white/[0.06] dark:text-stone-400 dark:ring-white/[0.08]" },
  full: { text: "Hearts full", cls: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-white/[0.06] dark:text-stone-400 dark:ring-white/[0.08]" },
  not_needed: { text: "Premium ∞", cls: "bg-gold-50 text-gold-600 ring-gold-100 dark:bg-gold-500/15 dark:text-gold-400 dark:ring-gold-500/30" },
};

const RARITY_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY_TEXT_CLS = {
  common: "text-slate-400 dark:text-stone-500",
  uncommon: "text-grass-600 dark:text-grass-400",
  rare: "text-feather-600 dark:text-feather-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-gold-600 dark:text-gold-400",
};

function ItemCard({ item, onBuy }) {
  const Icon = ICON[item.icon] || Gem;
  const badge = STATUS_BADGE[item.status];
  const buyable = !badge;
  const traitField = TRAIT_PREVIEW_FIELD[item.effect];
  const traitPreviewUri = useMemo(
    () => (traitField && item.render_key ? buildTraitPreviewUri(traitField, item.render_key) : null),
    [traitField, item.render_key]
  );
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className="flex items-center gap-3">
        {item.effect === "avatar_frame" && item.frame_style ? (
          <AvatarFrame frameStyle={item.frame_style} rarity={item.rarity} size={48} radius="9999px" thickness={3} className="shrink-0">
            <div className="grid h-full w-full place-items-center rounded-full bg-slate-100 dark:bg-white/[0.08]">
              <Icon className="h-5 w-5 text-slate-400 dark:text-stone-400" />
            </div>
          </AvatarFrame>
        ) : item.effect === "name_tag_effect" && item.render_key ? (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
            <NameTag renderKey={item.render_key} rarity={item.rarity} className="font-display text-lg font-extrabold">Aa</NameTag>
          </div>
        ) : traitPreviewUri ? (
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
            <img src={traitPreviewUri} alt={item.title} className="h-full w-full object-cover" />
          </div>
        ) : item.effect === "emote" && item.render_key ? (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 p-2 dark:bg-white/[0.06]">
            <img src={emoteIconUrl(item.render_key)} alt={item.title} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className={"grid h-12 w-12 shrink-0 place-items-center rounded-2xl " + (TONE[item.icon] || "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-stone-400")}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{item.title}</div>
            {item.rarity && RARITY_LABEL[item.rarity] ? (
              <span className={"text-[10px] font-extrabold uppercase tracking-wide " + (RARITY_TEXT_CLS[item.rarity] || "")}>
                {RARITY_LABEL[item.rarity]}
              </span>
            ) : null}
          </div>
          <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">{item.desc}</div>
        </div>
      </div>
      {buyable ? (
        <button
          onClick={() => onBuy(item)}
          disabled={!item.affordable}
          className={
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 font-display text-sm font-extrabold uppercase transition " +
            (item.affordable
              ? "bg-feather-500 text-white shadow-btn-feather active:translate-y-0.5"
              : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-white/[0.06] dark:text-stone-500")
          }
        >
          <Gem className="h-4 w-4" /> {item.price}
        </button>
      ) : (
        <div className={"mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-extrabold ring-1 " + badge.cls}>
          {(item.status === "owned" || item.status === "active") && <Check className="h-4 w-4" />}
          {badge.text}
        </div>
      )}
    </div>
  );
}

// Bottom-sheet purchase confirmation: what, for how much, balance after.
function ConfirmSheet({ item, gems, busy, onConfirm, onCancel }) {
  if (!item) return null;
  const Icon = ICON[item.icon] || Gem;
  const after = gems - item.price;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50" onClick={busy ? undefined : onCancel} />
      <div className="animate-pop relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl dark:bg-[#18181b]">
        <button
          onClick={onCancel}
          disabled={busy}
          aria-label="Cancel"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-400 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          {item.effect === "emote" && item.render_key ? (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-100 p-2.5 dark:bg-white/[0.06]">
              <img src={emoteIconUrl(item.render_key)} alt={item.title} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className={"grid h-14 w-14 shrink-0 place-items-center rounded-2xl " + (TONE[item.icon] || "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-stone-400")}>
              <Icon className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{item.title}</div>
            <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">{item.desc}</div>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm font-bold ring-1 ring-slate-100 dark:bg-white/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center justify-between text-slate-500 dark:text-stone-400">
            <span>Price</span>
            <span className="inline-flex items-center gap-1 text-feather-600 dark:text-feather-400"><Gem className="h-4 w-4" />{item.price}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-stone-400">
            <span>Your balance</span>
            <span className="tabular-nums">{gems}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-slate-700 dark:border-white/[0.08] dark:text-stone-200">
            <span>Balance after</span>
            <span className="tabular-nums">{after}</span>
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={busy}
          className="btn3d btn3d-feather mt-5 w-full uppercase"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Buy for {item.price} <Gem className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}

// Short full-screen success moment: pop + self-drawing tick, auto-dismisses.
function SuccessBurst({ item, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" role="status">
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="animate-pop relative flex flex-col items-center rounded-3xl bg-white px-10 py-8 shadow-xl dark:bg-[#18181b]">
        <div className="relative grid place-items-center">
          <span className="quests-ring absolute h-16 w-16 rounded-full bg-grass-300/50" />
          <div className="quests-badge-pop relative grid h-16 w-16 place-items-center rounded-full bg-grass-500 text-white shadow-[0_6px_0_0_#3f8f34]">
            <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9">
              <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="quest-tick-path" />
            </svg>
          </div>
        </div>
        <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">{item.title}</div>
        <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">is yours!</div>
      </div>
    </div>
  );
}

export default function Shop() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null);
  const [successItem, setSuccessItem] = useState(null);
  const [err, setErr] = useState("");

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

  async function confirmBuy() {
    const item = confirmItem;
    if (!item) return;
    setBusy(true);
    setErr("");
    try {
      const t = getToken();
      const r = await fetch(`${API_BASE}/me/shop/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ item: item.id }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErr((d && d.detail) || "Purchase failed");
        setConfirmItem(null);
      } else {
        window.dispatchEvent(new CustomEvent("hay_wallet", { detail: { gems: d.gems } }));
        if (item.effect === "hearts_refill") window.dispatchEvent(new CustomEvent("hay_hearts"));
        setConfirmItem(null);
        setSuccessItem(item);
        await load();
      }
    } catch {
      setErr("Network error");
      setConfirmItem(null);
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items || [];
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: items.filter((it) => s.effects.includes(it.effect)),
  })).filter((s) => s.items.length > 0);
  // Anything with an unknown/new effect still shows up at the end.
  const known = new Set(SECTIONS.flatMap((s) => s.effects));
  const misc = items.filter((it) => !known.has(it.effect));

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Shop</h1>
            <p className="mt-1 font-semibold text-slate-500 dark:text-stone-400">Spend gems you earn from chests.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-feather-50 px-4 py-2.5 ring-1 ring-feather-100 dark:bg-feather-500/15 dark:ring-feather-500/30">
            <Gem className="h-5 w-5 text-feather-500 dark:text-feather-400" />
            <span className="font-display text-lg font-extrabold text-feather-600 tabular-nums dark:text-feather-400">{data?.gems ?? "–"}</span>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-2xl bg-cardinal-50 px-4 py-2.5 text-sm font-bold text-cardinal-600 ring-1 ring-cardinal-100 dark:bg-cardinal-500/15 dark:text-cardinal-400 dark:ring-cardinal-500/30">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500 dark:text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Loading shop…</span>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.key}>
                <h2 className="mb-3 font-display text-lg font-extrabold text-slate-700 dark:text-stone-200">{s.title}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {s.items.map((item) => (
                    <ItemCard key={item.id} item={item} onBuy={setConfirmItem} />
                  ))}
                </div>
              </section>
            ))}
            {misc.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-extrabold text-slate-700 dark:text-stone-200">More</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {misc.map((item) => (
                    <ItemCard key={item.id} item={item} onBuy={setConfirmItem} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <ConfirmSheet
        item={confirmItem}
        gems={data?.gems ?? 0}
        busy={busy}
        onConfirm={confirmBuy}
        onCancel={() => setConfirmItem(null)}
      />
      {successItem && <SuccessBurst item={successItem} onDone={() => setSuccessItem(null)} />}
    </div>
  );
}
