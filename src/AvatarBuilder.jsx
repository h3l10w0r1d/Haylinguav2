// src/AvatarBuilder.jsx — a Duolingo-style cartoon avatar creator.
// Renders DiceBear's "avataaars" style entirely client-side (no network
// calls), lets the user page through each trait category, then rasterizes
// the final SVG to a PNG and hands it to the caller — which uploads it
// through the exact same /me/avatar pipeline as a normal photo, so every
// screen that already renders `avatar_url` (header, leaderboard, friends,
// public profile, CMS) needs zero changes to show it.
import { useMemo, useState } from "react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { X, Shuffle, Check, Loader2 } from "lucide-react";

const SKIN_COLORS = ["614335", "d08b5b", "ae5d29", "edb98a", "ffdbb4", "fd9841", "f8d25c"];
const HAIR_COLORS = ["2c1b18", "4a312c", "724133", "a55728", "b58143", "d6b370", "ecdcbf", "c93305", "f59797", "e8e1e1"];
const CLOTHES_COLORS = ["262e33", "3c4f5c", "5199e4", "65c9ff", "b1e2ff", "929598", "e6e6e6", "ffffff", "a7ffc4", "ffafb9", "ff488e", "ff5c5c", "ffffff", "25557c"];
const BG_COLORS = ["b6e3f4", "ffd5dc", "ffdfbf", "c0f0c8", "d1d4f9", "f4d9b6", "e0e0e0", "ffe0f0"];

const TOP_OPTIONS = [
  "shortFlat", "shortRound", "shortWaved", "shortCurly", "theCaesar", "sides", "shaggy", "shaggyMullet",
  "curly", "curvy", "straight01", "straight02", "straightAndStrand", "dreads01", "dreads02", "frizzle",
  "bob", "bun", "fro", "froBand", "bigHair", "miaWallace", "longButNotTooLong",
  "hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04",
];
const EYES_OPTIONS = ["default", "happy", "side", "squint", "wink", "winkWacky", "surprised", "hearts", "closed", "cry", "eyeRoll", "xDizzy"];
const EYEBROW_OPTIONS = ["defaultNatural", "angryNatural", "flatNatural", "raisedExcitedNatural", "sadConcernedNatural", "unibrowNatural", "upDownNatural"];
const MOUTH_OPTIONS = ["smile", "default", "twinkle", "serious", "concerned", "disbelief", "sad", "tongue", "eating", "grimace", "screamOpen"];
const FACIAL_HAIR_OPTIONS = ["none", "beardLight", "beardMedium", "beardMajestic", "moustacheFancy", "moustacheMagnum"];
const CLOTHING_OPTIONS = ["hoodie", "shirtCrewNeck", "shirtVNeck", "shirtScoopNeck", "collarAndSweater", "overall", "blazerAndShirt", "blazerAndSweater", "graphicShirt"];
const ACCESSORY_OPTIONS = ["none", "round", "wayfarers", "prescription01", "prescription02", "sunglasses", "kurt", "eyepatch"];

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
  accessories: "none",
  backgroundColor: BG_COLORS[0],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
    accessories: traits.accessories === "none" ? [] : [traits.accessories],
    accessoriesProbability: traits.accessories === "none" ? 0 : 100,
    backgroundColor: [traits.backgroundColor],
  });
  return avatar.toDataUri();
}

const TABS = [
  { key: "hair", label: "Hair" },
  { key: "face", label: "Face" },
  { key: "facialHair", label: "Facial hair" },
  { key: "outfit", label: "Outfit" },
  { key: "extras", label: "Extras" },
  { key: "background", label: "Background" },
];

function Swatch({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl ring-2 transition " +
        (active ? "ring-brand-500 ring-offset-2 dark:ring-offset-[#151517]" : "ring-slate-200 hover:ring-brand-300 dark:ring-white/10")
      }
    >
      {children}
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
function OptionThumb({ traits, field, value, active, onClick }) {
  const uri = useMemo(() => buildSvg({ ...traits, [field]: value }, 96), [traits, field, value]);
  const label = value === "none" ? "None" : value.replace(/([A-Z0-9]+)/g, " $1").trim();
  return (
    <Swatch active={active} onClick={onClick} title={label}>
      {value === "none" ? (
        <span className="text-[10px] font-extrabold uppercase text-slate-400">None</span>
      ) : (
        <img src={uri} alt={label} className="h-full w-full object-cover" />
      )}
    </Swatch>
  );
}

export default function AvatarBuilder({ open, onClose, onSave }) {
  const [traits, setTraits] = useState(DEFAULT_TRAITS);
  const [tab, setTab] = useState("hair");
  const [saving, setSaving] = useState(false);

  const previewUri = useMemo(() => buildSvg(traits, 320), [traits]);

  if (!open) return null;

  function set(field, value) {
    setTraits((t) => ({ ...t, [field]: value }));
  }

  function randomize() {
    setTraits({
      top: pick(TOP_OPTIONS),
      hairColor: pick(HAIR_COLORS),
      skinColor: pick(SKIN_COLORS),
      eyes: pick(EYES_OPTIONS),
      eyebrows: pick(EYEBROW_OPTIONS),
      mouth: pick(MOUTH_OPTIONS),
      facialHair: Math.random() < 0.3 ? pick(FACIAL_HAIR_OPTIONS.slice(1)) : "none",
      clothing: pick(CLOTHING_OPTIONS),
      clothesColor: pick(CLOTHES_COLORS),
      accessories: Math.random() < 0.35 ? pick(ACCESSORY_OPTIONS.slice(1)) : "none",
      backgroundColor: pick(BG_COLORS),
    });
  }

  async function handleUse() {
    setSaving(true);
    try {
      const finalUri = buildSvg(traits, 320);
      const img = new Image();
      const blob = await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 320;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 320, 320);
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
        };
        img.onerror = reject;
        img.src = finalUri;
      });
      const file = new File([blob], "avatar.png", { type: "image/png" });
      onSave(file);
    } catch {
      // If rasterizing ever fails, just close — the existing upload/preset
      // pickers remain available as a fallback.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#18181b]"
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
              <img src={previewUri} alt="Avatar preview" className="h-full w-full object-cover" />
            </div>
            <button type="button" onClick={randomize} className="btn3d btn3d-neutral w-full text-xs">
              <Shuffle className="h-3.5 w-3.5" /> Surprise me
            </button>
          </div>

          {/* Trait tabs + options */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 dark:border-white/[0.08]">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition " +
                    (tab === t.key
                      ? "bg-brand-500 text-white"
                      : "text-slate-500 hover:bg-slate-100 dark:text-stone-400 dark:hover:bg-white/[0.08]")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "hair" && (
                <>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Style</div>
                  <div className="flex flex-wrap gap-2">
                    {TOP_OPTIONS.map((v) => (
                      <OptionThumb key={v} traits={traits} field="top" value={v} active={traits.top === v} onClick={() => set("top", v)} />
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
                      <OptionThumb key={v} traits={traits} field="eyebrows" value={v} active={traits.eyebrows === v} onClick={() => set("eyebrows", v)} />
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
    </div>
  );
}
