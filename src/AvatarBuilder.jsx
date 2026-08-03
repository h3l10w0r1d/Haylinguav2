// src/AvatarBuilder.jsx — a Duolingo-style cartoon avatar creator.
// Renders DiceBear's "avataaars" style entirely client-side (no network
// calls), lets the user page through each trait category, then rasterizes
// the final SVG to a PNG and hands it to the caller — which uploads it
// through the exact same /me/avatar pipeline as a normal photo, so every
// screen that already renders `avatar_url` (header, leaderboard, friends,
// public profile, CMS) needs zero changes to show it.
import { useEffect, useMemo, useState } from "react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { X, Shuffle, Check, Loader2, Lock, Gem, Scissors, SmilePlus, User, Shirt, Glasses, Palette } from "lucide-react";
import { RARITY_COLORS } from "./lib/avatarFrame";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || localStorage.getItem("token") || "";
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

const SKIN_COLORS = ["614335", "d08b5b", "ae5d29", "edb98a", "ffdbb4", "fd9841", "f8d25c"];
const HAIR_COLORS = ["2c1b18", "4a312c", "724133", "a55728", "b58143", "d6b370", "ecdcbf", "c93305", "f59797", "e8e1e1"];
const CLOTHES_COLORS = ["262e33", "3c4f5c", "5199e4", "65c9ff", "b1e2ff", "929598", "e6e6e6", "ffffff", "a7ffc4", "ffafb9", "ff488e", "ff5c5c", "ffffff", "25557c"];
const BG_COLORS = ["b6e3f4", "ffd5dc", "ffdfbf", "c0f0c8", "d1d4f9", "f4d9b6", "e0e0e0", "ffe0f0"];

// Free, built-in hairstyles/eyebrows. PREMIUM_TOP_VALUES/PREMIUM_EYEBROW_VALUES
// (below) list the marketplace-gated additions to these same trait
// dimensions — DiceBear treats them identically, only ownership differs.
const TOP_OPTIONS = [
  "shortFlat", "shortRound", "shortWaved", "shortCurly", "theCaesar", "sides", "shaggy", "shaggyMullet",
  "curly", "curvy", "straight01", "straight02", "straightAndStrand", "dreads01", "dreads02", "frizzle",
  "bob", "bun", "fro", "froBand", "bigHair", "miaWallace", "longButNotTooLong",
  "hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04",
  "dreads", "frida", "shavedSides", "theCaesarAndSidePart",
];
const EYES_OPTIONS = ["default", "happy", "side", "squint", "wink", "winkWacky", "surprised", "hearts", "closed", "cry", "eyeRoll", "xDizzy"];
const EYEBROW_OPTIONS = [
  "defaultNatural", "angryNatural", "flatNatural", "raisedExcitedNatural", "sadConcernedNatural", "unibrowNatural", "upDownNatural",
  "angry", "default", "raisedExcited", "sadConcerned", "upDown",
];
const MOUTH_OPTIONS = ["smile", "default", "twinkle", "serious", "concerned", "disbelief", "sad", "tongue", "eating", "grimace", "screamOpen"];
const FACIAL_HAIR_OPTIONS = ["none", "beardLight", "beardMedium", "beardMajestic", "moustacheFancy", "moustacheMagnum"];
const CLOTHING_OPTIONS = ["hoodie", "shirtCrewNeck", "shirtVNeck", "shirtScoopNeck", "collarAndSweater", "overall", "blazerAndShirt", "blazerAndSweater", "graphicShirt"];
const ACCESSORY_OPTIONS = ["none", "round", "wayfarers", "prescription01", "prescription02", "sunglasses", "kurt", "eyepatch"];
// DiceBear's clothesGraphic trait — a whole dimension the app never wired up
// until this marketplace expansion; every non-"none" value here is a paid
// unlock (see backend/ensure_schema.py's avatar_clothing_graphic seed).
const CLOTHES_GRAPHIC_OPTIONS = ["none", "bat", "bear", "cumbia", "deer", "diamond", "hola", "pizza", "resist", "skull", "skullOutline"];

// Marketplace-gated values within the free trait arrays above — everything
// else in TOP_OPTIONS/EYEBROW_OPTIONS is free/built-in. clothesGraphic has
// no free tier at all (every value but "none" is gated), so it doesn't need
// an equivalent set here.
const PREMIUM_TOP_VALUES = new Set(["dreads", "frida", "shavedSides", "theCaesarAndSidePart"]);
const PREMIUM_EYEBROW_VALUES = new Set(["angry", "default", "raisedExcited", "sadConcerned", "upDown"]);

const RARITY_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY_TEXT_CLS = {
  common: "text-slate-500", uncommon: "text-grass-600", rare: "text-feather-600",
  epic: "text-purple-600", legendary: "text-gold-600",
};

const DEFAULT_TRAITS = {
  top: "shortFlat",
  hairColor: HAIR_COLORS[1],
  skinColor: SKIN_COLORS[3],
  eyes: "default",
  eyebrows: "defaultNatural",
  mouth: "smile",
  facialHair: "none",
  clothing: "hoodie",
  clothesColor: CLOTHES_COLORS[3],
  clothesGraphic: "none",
  accessories: "none",
  backgroundColor: BG_COLORS[0],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Randomize never previews a locked look the user hasn't paid for — pools
// for the marketplace-gated dimensions (top/eyebrows/clothesGraphic) are
// filtered down to free + owned values. Callers with no ownership context
// (e.g. generateRandomAvatarFile) implicitly get free-tier-only results.
function randomTraits(owned = { top: new Set(), eyebrows: new Set(), clothesGraphic: new Set() }) {
  const topPool = TOP_OPTIONS.filter((v) => !PREMIUM_TOP_VALUES.has(v) || owned.top.has(v));
  const eyebrowPool = EYEBROW_OPTIONS.filter((v) => !PREMIUM_EYEBROW_VALUES.has(v) || owned.eyebrows.has(v));
  const ownedGraphics = CLOTHES_GRAPHIC_OPTIONS.filter((v) => v !== "none" && owned.clothesGraphic.has(v));
  return {
    top: pick(topPool),
    hairColor: pick(HAIR_COLORS),
    skinColor: pick(SKIN_COLORS),
    eyes: pick(EYES_OPTIONS),
    eyebrows: pick(eyebrowPool),
    mouth: pick(MOUTH_OPTIONS),
    facialHair: Math.random() < 0.3 ? pick(FACIAL_HAIR_OPTIONS.slice(1)) : "none",
    clothing: pick(CLOTHING_OPTIONS),
    clothesColor: pick(CLOTHES_COLORS),
    clothesGraphic: ownedGraphics.length > 0 && Math.random() < 0.3 ? pick(ownedGraphics) : "none",
    accessories: Math.random() < 0.35 ? pick(ACCESSORY_OPTIONS.slice(1)) : "none",
    backgroundColor: pick(BG_COLORS),
  };
}

// Rasterizes any SVG data URI to a same-size PNG File — used both here and
// by callers that need a one-shot generated image (e.g. a random default
// avatar on first profile visit) without opening the builder modal.
export function rasterizeToPngFile(svgDataUri, size, filename) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((b) => {
        if (!b) return reject(new Error("toBlob failed"));
        resolve(new File([b], filename, { type: "image/png" }));
      }, "image/png");
    };
    img.onerror = reject;
    img.src = svgDataUri;
  });
}

export async function generateRandomAvatarFile() {
  const uri = buildSvg(randomTraits(), 320);
  return rasterizeToPngFile(uri, 320, "avatar.png");
}

function buildSvg(traits, size = 200) {
  const avatar = createAvatar(avataaars, {
    seed: "haylingua",
    size,
    top: [traits.top],
    hairColor: [traits.hairColor],
    skinColor: [traits.skinColor],
    eyes: [traits.eyes],
    eyebrows: [traits.eyebrows],
    mouth: [traits.mouth],
    facialHair: traits.facialHair === "none" ? [] : [traits.facialHair],
    facialHairProbability: traits.facialHair === "none" ? 0 : 100,
    clothing: [traits.clothing],
    clothesColor: [traits.clothesColor],
    clothesGraphic: !traits.clothesGraphic || traits.clothesGraphic === "none" ? [] : [traits.clothesGraphic],
    accessories: traits.accessories === "none" ? [] : [traits.accessories],
    accessoriesProbability: traits.accessories === "none" ? 0 : 100,
    backgroundColor: [traits.backgroundColor],
  });
  return avatar.toDataUri();
}

// label stays on every entry — it's still used for the tooltip/aria-label
// on the now icon-only tab buttons, just not rendered as visible text.
const TABS = [
  { key: "hair", label: "Hair", icon: Scissors },
  { key: "face", label: "Face", icon: SmilePlus },
  { key: "facialHair", label: "Facial hair", icon: User },
  { key: "outfit", label: "Outfit", icon: Shirt },
  { key: "extras", label: "Extras", icon: Glasses },
  { key: "background", label: "Background", icon: Palette },
];

function Swatch({ active, onClick, title, locked, rarity, children }) {
  const rarityColor = locked ? RARITY_COLORS[rarity] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl ring-2 transition " +
        (active
          ? "ring-brand-500 ring-offset-2 dark:ring-offset-[#151517]"
          : locked
          ? "opacity-60 grayscale hover:opacity-90 hover:grayscale-0"
          : "ring-slate-200 hover:ring-brand-300 dark:ring-white/10")
      }
      style={locked ? { boxShadow: `0 0 0 2px ${rarityColor}` } : undefined}
    >
      {children}
      {locked && (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/60 py-0.5">
          <Lock className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </button>
  );
}

function ColorDot({ hex, active, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={"h-9 w-9 shrink-0 rounded-full ring-2 transition " + (active ? "ring-brand-500 ring-offset-2 dark:ring-offset-[#151517]" : "ring-slate-200 hover:ring-brand-300 dark:ring-white/10")}
      style={{ backgroundColor: "#" + hex }}
    />
  );
}

// Small live preview thumbnail for one trait option, holding every other
// trait fixed to the current selection so the user sees the real result.
// `locked` items (marketplace items not yet owned) render dimmed with a
// rarity-colored ring + lock badge; onClick still fires — the caller
// branches to a buy-confirm flow instead of selecting the trait directly.
function OptionThumb({ traits, field, value, active, onClick, locked, rarity }) {
  const uri = useMemo(() => buildSvg({ ...traits, [field]: value }, 96), [traits, field, value]);
  const label = value === "none" ? "None" : value.replace(/([A-Z0-9]+)/g, " $1").trim();
  return (
    <Swatch active={active} onClick={onClick} title={label} locked={locked} rarity={rarity}>
      {value === "none" ? (
        <span className="text-[10px] font-extrabold uppercase text-slate-400">None</span>
      ) : (
        <img src={uri} alt={label} className="h-full w-full object-cover" />
      )}
    </Swatch>
  );
}

// Idle life for the live preview — no third-party animation lib, no API
// calls, and no moving/bouncing the whole character (that read as a
// distracting wobble, not a living portrait). Just two independent timers
// that occasionally swap in a second DiceBear render of the exact same
// traits with the eyes closed or the mouth open, the same way a still
// photo "blinks" in a cinemagraph. DiceBear already renders fully
// client-side, so this is only ever choosing which locally-generated frame
// to show. Once "Use this avatar" rasterizes to a flat PNG for the upload
// pipeline, the character is static again — this only brings it to life
// while building.

// Eyes/mouths that read naturally as "neutral open" and can believably
// flicker to a blink/talk frame. Traits already fixed to something
// emotionally loaded (cry, sad, vomit, etc.) skip the effect rather than
// doing nothing or looking wrong.
const BLINKABLE_EYES = new Set(["default", "happy", "side", "squint", "wink", "winkWacky", "surprised"]);
const TALKABLE_MOUTHS = new Set(["default", "smile", "twinkle", "serious"]);

// Shared timer: randomly toggles a boolean on/off for `holdMs`, at random
// intervals in [minDelay, maxDelay], only while `enabled`.
function useFlicker(enabled, minDelay, maxDelay, holdMs) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    let offTimer;
    let onTimer;
    function schedule() {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      offTimer = setTimeout(() => {
        setActive(true);
        onTimer = setTimeout(() => {
          setActive(false);
          schedule();
        }, holdMs);
      }, delay);
    }
    schedule();
    return () => {
      clearTimeout(offTimer);
      clearTimeout(onTimer);
    };
  }, [enabled, minDelay, maxDelay, holdMs]);

  return active;
}

// Categories/fields for the marketplace-gated trait dimensions — used to
// build the owned-render-key sets and the catalog lookup (price/rarity/id)
// from /me/inventory and /me/shop respectively.
const PREMIUM_FIELD_CATEGORIES = {
  top: "avatar_hairstyle",
  eyebrows: "avatar_eyebrows",
  clothesGraphic: "avatar_clothing_graphic",
};

export default function AvatarBuilder({ open, onClose, onSave }) {
  const [traits, setTraits] = useState(DEFAULT_TRAITS);
  const [tab, setTab] = useState("hair");
  const [saving, setSaving] = useState(false);
  // { top: Set<renderKey>, eyebrows: Set<renderKey>, clothesGraphic: Set<renderKey> }
  const [owned, setOwned] = useState({ top: new Set(), eyebrows: new Set(), clothesGraphic: new Set() });
  // renderKey -> { id, price, rarity, category }
  const [catalog, setCatalog] = useState({});
  const [pendingBuy, setPendingBuy] = useState(null); // { field, value, id, price, rarity }
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [shopRes, invRes] = await Promise.all([
          apiFetch("/me/shop", { token }),
          apiFetch("/me/inventory", { token }),
        ]);
        const shopData = await shopRes.json().catch(() => null);
        const invData = await invRes.json().catch(() => null);
        if (cancelled) return;

        const premiumCategories = new Set(Object.values(PREMIUM_FIELD_CATEGORIES));
        const nextCatalog = {};
        for (const it of shopData?.items || []) {
          if (!premiumCategories.has(it.effect) || !it.render_key) continue;
          nextCatalog[it.render_key] = { id: it.id, price: it.price, rarity: it.rarity, category: it.effect };
        }
        setCatalog(nextCatalog);

        const nextOwned = { top: new Set(), eyebrows: new Set(), clothesGraphic: new Set() };
        const categoryToField = { avatar_hairstyle: "top", avatar_eyebrows: "eyebrows", avatar_clothing_graphic: "clothesGraphic" };
        for (const it of invData?.items || []) {
          const field = categoryToField[it.category];
          if (field && it.render_key) nextOwned[field].add(it.render_key);
        }
        setOwned(nextOwned);
      } catch {
        // Non-fatal — locked options just won't show as owned; user can
        // still use every free trait, and retrying reopens the builder.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const blinking = useFlicker(open && BLINKABLE_EYES.has(traits.eyes), 2200, 5400, 130);
  const talking = useFlicker(open && TALKABLE_MOUTHS.has(traits.mouth), 3000, 6500, 220);
  const displayUri = useMemo(
    () =>
      buildSvg(
        {
          ...traits,
          eyes: blinking ? "closed" : traits.eyes,
          mouth: talking ? "screamOpen" : traits.mouth,
        },
        320
      ),
    [traits, blinking, talking]
  );

  if (!open) return null;

  function set(field, value) {
    setTraits((t) => ({ ...t, [field]: value }));
  }

  // Locked = a marketplace-gated value the user doesn't yet own. Free
  // built-in values (everything not in the PREMIUM_*_VALUES sets, and
  // "none" for clothesGraphic) are never locked.
  function isLocked(field, value) {
    if (field === "top" && PREMIUM_TOP_VALUES.has(value)) return !owned.top.has(value);
    if (field === "eyebrows" && PREMIUM_EYEBROW_VALUES.has(value)) return !owned.eyebrows.has(value);
    if (field === "clothesGraphic" && value !== "none") return !owned.clothesGraphic.has(value);
    return false;
  }

  function handleOptionClick(field, value) {
    if (isLocked(field, value)) {
      const info = catalog[value];
      if (!info) {
        setError("This item isn't available to buy right now.");
        return;
      }
      setError("");
      setPendingBuy({ field, value, ...info });
      return;
    }
    set(field, value);
  }

  async function confirmBuy() {
    if (!pendingBuy) return;
    setBuying(true);
    setError("");
    try {
      const token = getToken();
      const res = await apiFetch("/me/shop/buy", { token, method: "POST", body: JSON.stringify({ item: pendingBuy.id }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || "Couldn't complete that purchase.");
        return;
      }
      const { field, value } = pendingBuy;
      setOwned((prev) => ({ ...prev, [field]: new Set(prev[field]).add(value) }));
      set(field, value);
      setPendingBuy(null);
      window.dispatchEvent(new CustomEvent("hay_wallet"));
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setBuying(false);
    }
  }

  function randomize() {
    setTraits(randomTraits(owned));
  }

  async function handleUse() {
    setSaving(true);
    try {
      const file = await rasterizeToPngFile(buildSvg(traits, 320), 320, "avatar.png");
      onSave(file);
    } catch {
      // If rasterizing ever fails, just close — the existing upload picker
      // remains available as a fallback.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 sm:p-4" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white dark:bg-[#18181b] sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/[0.08]">
          <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Build your avatar</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
          {/* Live preview */}
          <div className="flex shrink-0 flex-col items-center gap-3 border-b border-slate-100 p-5 dark:border-white/[0.08] sm:w-52 sm:border-b-0 sm:border-r">
            <div className="h-32 w-32 overflow-hidden rounded-3xl ring-4 ring-slate-100 dark:ring-white/10">
              <img src={displayUri} alt="Avatar preview" className="h-full w-full object-cover" />
            </div>
            <button type="button" onClick={randomize} className="btn3d btn3d-neutral w-full text-xs">
              <Shuffle className="h-3.5 w-3.5" /> Surprise me
            </button>
          </div>

          {/* Trait tabs + options */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 dark:border-white/[0.08]">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={tab === t.key}
                    className={
                      "grid h-10 w-10 shrink-0 place-items-center rounded-full transition " +
                      (tab === t.key
                        ? "bg-brand-500 text-white"
                        : "text-slate-500 hover:bg-slate-100 dark:text-stone-400 dark:hover:bg-white/[0.08]")
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "hair" && (
                <>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Style</div>
                  <div className="flex flex-wrap gap-2">
                    {TOP_OPTIONS.map((v) => (
                      <OptionThumb
                        key={v} traits={traits} field="top" value={v} active={traits.top === v}
                        onClick={() => handleOptionClick("top", v)}
                        locked={isLocked("top", v)} rarity={catalog[v]?.rarity}
                      />
                    ))}
                  </div>
                  <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Color</div>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_COLORS.map((hex) => (
                      <ColorDot key={hex} hex={hex} active={traits.hairColor === hex} onClick={() => set("hairColor", hex)} />
                    ))}
                  </div>
                </>
              )}

              {tab === "face" && (
                <>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Skin tone</div>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_COLORS.map((hex) => (
                      <ColorDot key={hex} hex={hex} active={traits.skinColor === hex} onClick={() => set("skinColor", hex)} />
                    ))}
                  </div>
                  <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Eyes</div>
                  <div className="flex flex-wrap gap-2">
                    {EYES_OPTIONS.map((v) => (
                      <OptionThumb key={v} traits={traits} field="eyes" value={v} active={traits.eyes === v} onClick={() => set("eyes", v)} />
                    ))}
                  </div>
                  <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Eyebrows</div>
                  <div className="flex flex-wrap gap-2">
                    {EYEBROW_OPTIONS.map((v) => (
                      <OptionThumb
                        key={v} traits={traits} field="eyebrows" value={v} active={traits.eyebrows === v}
                        onClick={() => handleOptionClick("eyebrows", v)}
                        locked={isLocked("eyebrows", v)} rarity={catalog[v]?.rarity}
                      />
                    ))}
                  </div>
                  <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Mouth</div>
                  <div className="flex flex-wrap gap-2">
                    {MOUTH_OPTIONS.map((v) => (
                      <OptionThumb key={v} traits={traits} field="mouth" value={v} active={traits.mouth === v} onClick={() => set("mouth", v)} />
                    ))}
                  </div>
                </>
              )}

              {tab === "facialHair" && (
                <div className="flex flex-wrap gap-2">
                  {FACIAL_HAIR_OPTIONS.map((v) => (
                    <OptionThumb key={v} traits={traits} field="facialHair" value={v} active={traits.facialHair === v} onClick={() => set("facialHair", v)} />
                  ))}
                </div>
              )}

              {tab === "outfit" && (
                <>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Clothing</div>
                  <div className="flex flex-wrap gap-2">
                    {CLOTHING_OPTIONS.map((v) => (
                      <OptionThumb key={v} traits={traits} field="clothing" value={v} active={traits.clothing === v} onClick={() => set("clothing", v)} />
                    ))}
                  </div>
                  <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Color</div>
                  <div className="flex flex-wrap gap-2">
                    {CLOTHES_COLORS.map((hex, i) => (
                      <ColorDot key={hex + i} hex={hex} active={traits.clothesColor === hex} onClick={() => set("clothesColor", hex)} />
                    ))}
                  </div>
                  <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Graphic</div>
                  <div className="flex flex-wrap gap-2">
                    {CLOTHES_GRAPHIC_OPTIONS.map((v) => (
                      <OptionThumb
                        key={v} traits={traits} field="clothesGraphic" value={v} active={(traits.clothesGraphic || "none") === v}
                        onClick={() => handleOptionClick("clothesGraphic", v)}
                        locked={isLocked("clothesGraphic", v)} rarity={catalog[v]?.rarity}
                      />
                    ))}
                  </div>
                </>
              )}

              {tab === "extras" && (
                <>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Glasses</div>
                  <div className="flex flex-wrap gap-2">
                    {ACCESSORY_OPTIONS.map((v) => (
                      <OptionThumb key={v} traits={traits} field="accessories" value={v} active={traits.accessories === v} onClick={() => set("accessories", v)} />
                    ))}
                  </div>
                </>
              )}

              {tab === "background" && (
                <div className="flex flex-wrap gap-2">
                  {BG_COLORS.map((hex) => (
                    <ColorDot key={hex} hex={hex} active={traits.backgroundColor === hex} onClick={() => set("backgroundColor", hex)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="border-t border-cardinal-100 bg-cardinal-50 px-5 py-2 text-xs font-bold text-cardinal-700 dark:border-cardinal-500/20 dark:bg-cardinal-500/10 dark:text-cardinal-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/[0.08]">
          <button type="button" onClick={onClose} className="btn3d btn3d-neutral text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleUse} disabled={saving} className="btn3d btn3d-brand text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Use this avatar
          </button>
        </div>
      </div>

      {pendingBuy && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={() => !buying && setPendingBuy(null)}>
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-2xl dark:bg-[#18181b]"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={buildSvg({ ...traits, [pendingBuy.field]: pendingBuy.value }, 96)} alt="Preview" className="mx-auto mb-3 h-20 w-20 rounded-2xl" />
            <div className="mb-1 font-display text-base font-extrabold text-slate-800 dark:text-white">Unlock this look?</div>
            {pendingBuy.rarity && (
              <div className={"mb-3 text-xs font-extrabold uppercase tracking-wide " + (RARITY_TEXT_CLS[pendingBuy.rarity] || "text-slate-500")}>
                {RARITY_LABEL[pendingBuy.rarity] || pendingBuy.rarity}
              </div>
            )}
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-feather-50 px-3 py-1 text-sm font-extrabold text-feather-600 dark:bg-feather-500/15 dark:text-feather-400">
              <Gem className="h-4 w-4" /> {pendingBuy.price ?? 0} gems
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPendingBuy(null)} disabled={buying} className="btn3d btn3d-neutral flex-1 !py-2 text-sm">
                Cancel
              </button>
              <button type="button" onClick={confirmBuy} disabled={buying} className="btn3d btn3d-brand flex-1 !py-2 text-sm">
                {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
