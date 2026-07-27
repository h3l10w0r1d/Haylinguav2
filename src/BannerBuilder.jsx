// src/BannerBuilder.jsx — a procedural profile-banner generator, the
// banner equivalent of AvatarBuilder.jsx. Combines a 2-color gradient with
// an optional pattern overlay (soft blobs via the open-source `blobs`
// library, waves, dots, or diagonal stripes) — palette × pattern × seed
// adds up to far more than 10k distinct banners, all generated client-side
// with no image library or hosting needed. Saving rasterizes to a PNG and
// hands it to the caller, which uploads through the existing POST
// /me/banner pipeline exactly like an uploaded photo.
//
// Color pairs come from uiGradients (github.com/Ghosh/uiGradients, MIT) —
// ~190 hand-picked two-color combinations. Two independently-random single
// hues frequently clash (e.g. red+green reads muddy); a curated pair always
// looks intentional.
import { useMemo, useState } from "react";
import { svgPath } from "blobs/v2";
import { X, Shuffle, Check, Loader2 } from "lucide-react";
import uiGradientsData from "./lib/uiGradients.json";

const BANNER_W = 1200;
const BANNER_H = 300;

const GRADIENT_PAIRS = Object.entries(uiGradientsData).map(([key, v]) => ({
  key,
  label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  color1: v.start.replace("#", ""),
  color2: v.end.replace("#", ""),
}));

const PATTERNS = [
  { key: "none", label: "Plain" },
  { key: "blobs", label: "Blobs" },
  { key: "waves", label: "Waves" },
  { key: "dots", label: "Dots" },
  { key: "stripes", label: "Stripes" },
];

const DEFAULT_PAIR = GRADIENT_PAIRS.find((p) => p.key === "bora_bora") || GRADIENT_PAIRS[0];

const DEFAULT_CONFIG = {
  color1: DEFAULT_PAIR.color1,
  color2: DEFAULT_PAIR.color2,
  angle: 120,
  pattern: "blobs",
  seed: "haylingua-banner",
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomConfig() {
  const p = pick(GRADIENT_PAIRS);
  return {
    color1: p.color1,
    color2: p.color2,
    angle: pick([45, 90, 120, 135, 160]),
    pattern: pick(PATTERNS.map((p) => p.key)),
    seed: Math.random().toString(36).slice(2),
  };
}

function patternMarkup(config) {
  const { pattern, seed } = config;
  if (pattern === "none") return "";

  if (pattern === "blobs") {
    const specs = [
      { cx: 220, cy: 90, size: 260, opacity: 0.16 },
      { cx: 980, cy: 210, size: 300, opacity: 0.14 },
      { cx: 640, cy: 60, size: 180, opacity: 0.12 },
    ];
    return specs
      .map((s, i) => {
        const d = svgPath({ seed: seed + i, extraPoints: 7, randomness: 4, size: s.size });
        return `<g transform="translate(${s.cx - s.size / 2}, ${s.cy - s.size / 2})"><path d="${d}" fill="#ffffff" opacity="${s.opacity}" /></g>`;
      })
      .join("");
  }

  if (pattern === "waves") {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const amp = 24 + (hash % 20);
    const rows = [0.55, 0.72, 0.9];
    return rows
      .map((yFrac, i) => {
        const y = BANNER_H * yFrac;
        const a = amp * (1 - i * 0.2);
        return `<path d="M0,${y} C ${BANNER_W * 0.25},${y - a} ${BANNER_W * 0.25},${y + a} ${BANNER_W * 0.5},${y} S ${BANNER_W * 0.75},${y + a} ${BANNER_W},${y} L${BANNER_W},${BANNER_H} L0,${BANNER_H} Z" fill="#ffffff" opacity="${0.1 + i * 0.04}" />`;
      })
      .join("");
  }

  if (pattern === "dots") {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const spacing = 34 + (hash % 3) * 8;
    const r = 2.5 + (hash % 3);
    const dots = [];
    for (let y = spacing / 2; y < BANNER_H; y += spacing) {
      for (let x = spacing / 2; x < BANNER_W; x += spacing) {
        dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.16" />`);
      }
    }
    return dots.join("");
  }

  if (pattern === "stripes") {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const width = 26 + (hash % 3) * 10;
    const gap = width * 2;
    const stripes = [];
    for (let x = -BANNER_H; x < BANNER_W + BANNER_H; x += gap) {
      stripes.push(
        `<polygon points="${x},0 ${x + width},0 ${x + width - BANNER_H},${BANNER_H} ${x - BANNER_H},${BANNER_H}" fill="#ffffff" opacity="0.1" />`
      );
    }
    return stripes.join("");
  }

  return "";
}

function buildSvgMarkup(config) {
  const gradId = "bg";
  const rad = (config.angle * Math.PI) / 180;
  const x2 = 50 + 50 * Math.cos(rad);
  const y2 = 50 + 50 * Math.sin(rad);
  const x1 = 50 - 50 * Math.cos(rad);
  const y1 = 50 - 50 * Math.sin(rad);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${BANNER_W}" height="${BANNER_H}">
    <defs>
      <linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
        <stop offset="0%" stop-color="#${config.color1}" />
        <stop offset="100%" stop-color="#${config.color2}" />
      </linearGradient>
    </defs>
    <rect width="${BANNER_W}" height="${BANNER_H}" fill="url(#${gradId})" />
    ${patternMarkup(config)}
  </svg>`;
}

function toDataUri(config) {
  const svg = buildSvgMarkup(config);
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export function rasterizeBannerToPngFile(config, filename = "banner.png") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = BANNER_W;
      canvas.height = BANNER_H;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, BANNER_W, BANNER_H);
      canvas.toBlob((b) => {
        if (!b) return reject(new Error("toBlob failed"));
        resolve(new File([b], filename, { type: "image/png" }));
      }, "image/png");
    };
    img.onerror = reject;
    img.src = toDataUri(config);
  });
}

export async function generateRandomBannerFile() {
  return rasterizeBannerToPngFile(randomConfig());
}

function PaletteSwatch({ pair, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={pair.label}
      className={
        "h-11 w-11 shrink-0 rounded-2xl ring-2 transition " +
        (active ? "ring-brand-500 ring-offset-2 dark:ring-offset-[#151517]" : "ring-slate-200 hover:ring-brand-300 dark:ring-white/10")
      }
      style={{ background: `linear-gradient(135deg, #${pair.color1}, #${pair.color2})` }}
    />
  );
}

export default function BannerBuilder({ open, onClose, onSave }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  const previewUri = useMemo(() => toDataUri(config), [config]);

  if (!open) return null;

  function set(field, value) {
    setConfig((c) => ({ ...c, [field]: value }));
  }

  function randomize() {
    setConfig(randomConfig());
  }

  function reshuffleSeed() {
    setConfig((c) => ({ ...c, seed: Math.random().toString(36).slice(2) }));
  }

  async function handleUse() {
    setSaving(true);
    try {
      const file = await rasterizeBannerToPngFile(config);
      onSave(file);
    } catch {
      // Rasterizing failed — just close; upload remains available.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#18181b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/[0.08]">
          <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Build your banner</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="overflow-hidden rounded-2xl ring-4 ring-slate-100 dark:ring-white/10" style={{ aspectRatio: `${BANNER_W} / ${BANNER_H}` }}>
            <img src={previewUri} alt="Banner preview" className="h-full w-full object-cover" />
          </div>

          <button type="button" onClick={randomize} className="btn3d btn3d-neutral mt-3 w-full text-xs">
            <Shuffle className="h-3.5 w-3.5" /> Surprise me
          </button>

          <div className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
            Palette <span className="font-semibold normal-case text-slate-400 dark:text-stone-500">— hand-picked pairs from uiGradients</span>
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto sm:grid-cols-8">
            {GRADIENT_PAIRS.map((pair) => (
              <PaletteSwatch
                key={pair.key}
                pair={pair}
                active={config.color1 === pair.color1 && config.color2 === pair.color2}
                onClick={() => setConfig((c) => ({ ...c, color1: pair.color1, color2: pair.color2 }))}
              />
            ))}
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Pattern</div>
            {config.pattern !== "none" && (
              <button type="button" onClick={reshuffleSeed} className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-400">
                Shuffle pattern
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {PATTERNS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => set("pattern", p.key)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-extrabold transition " +
                  (config.pattern === p.key
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/[0.1]")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/[0.08]">
          <button type="button" onClick={onClose} className="btn3d btn3d-neutral text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleUse} disabled={saving} className="btn3d btn3d-brand text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Use this banner
          </button>
        </div>
      </div>
    </div>
  );
}
