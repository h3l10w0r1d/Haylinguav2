// src/lib/lucideIcons.jsx — 10,000+ icons for the CMS chapter-icon picker (a
// T-shirt for "Clothes", a plane for "Travel", etc.) without hand-drawing
// custom art. Combines lucide-react (bare name, e.g. "shirt"), @tabler/icons
// outline set ("tabler:shirt"), bootstrap-icons ("bi:bag"), and remixicon
// line variants ("ri:t-shirt") — ~10,273 icons total, prefixed per source so
// names never collide.
//
// This is NOT `import * as Icons from "..."` or any per-icon dynamic-import
// helper — both were tried for the original lucide-only version and both
// ended up bundling every icon into the site's shared vendor chunk (measured:
// +730-880KB on every single page load, site-wide, just to support an
// admin-only picker), because Vite's manualChunks config funnels every
// node_modules module into one eager "vendor" bundle. Instead, public/icons/
// lucide-icons.json (generated once, see scripts note below) is a plain
// static asset — never touched by the JS bundler at all — fetched lazily
// and cached in memory the first time any icon is actually rendered.
//
// Manifest shape: { "<name>": { v: viewBox, m: "stroke"|"fill", n: [[tag,attrs],...] } }
// "stroke" icons (lucide, tabler) render like lucide's own icons (fill=none,
// stroke=currentColor); "fill" icons (bootstrap, remixicon) render as solid
// silhouettes (fill=currentColor, no stroke) — each icon's own SVG source
// dictates which, so both look correct instead of every icon being forced
// into one style.
//
// Regenerating the manifest (only needed after upgrading any of the 4
// underlying icon packages) — see the build script kept at
// /private/tmp/.../build-icon-manifest.js during development, or re-derive:
// walk each package's icon SVGs, extract child path/circle/rect/etc tags +
// attrs, record the source viewBox and whether the root <svg> sets fill or
// stroke, skip Tabler's invisible "M0 0h24v24H0z" bounding-box helper path.
import { useEffect, useState } from "react";

let manifestPromise = null;
let manifestData = null;

function loadManifest() {
  if (manifestData) return Promise.resolve(manifestData);
  if (!manifestPromise) {
    manifestPromise = fetch("/icons/lucide-icons.json")
      .then((r) => r.json())
      .then((data) => {
        manifestData = data;
        return data;
      });
  }
  return manifestPromise;
}

// Names are kebab-case, optionally prefixed ("shirt", "tabler:shirt",
// "bi:bag", "ri:t-shirt") — store this exact string as chapter.icon.
export function useIconNames() {
  const [names, setNames] = useState(manifestData ? Object.keys(manifestData) : []);
  useEffect(() => {
    let cancelled = false;
    loadManifest().then((data) => {
      if (!cancelled) setNames(Object.keys(data));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return names;
}

function svgAttrsFor(entry) {
  const base = { xmlns: "http://www.w3.org/2000/svg", viewBox: entry.v };
  if (entry.m === "fill") return { ...base, fill: "currentColor" };
  return { ...base, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
}

// Renders one icon by name; renders nothing until the (cached-after-first-
// fetch) manifest resolves. `fallback` shows while loading or if the name
// isn't found (e.g. no icon chosen yet).
export function LucideGlyph({ name, className, fallback = null }) {
  const [entry, setEntry] = useState(name && manifestData ? manifestData[name] : undefined);

  useEffect(() => {
    if (!name) {
      setEntry(undefined);
      return;
    }
    if (manifestData) {
      setEntry(manifestData[name]);
      return;
    }
    let cancelled = false;
    loadManifest().then((data) => {
      if (!cancelled) setEntry(data[name]);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!entry) return fallback;
  return (
    <svg {...svgAttrsFor(entry)} className={className}>
      {entry.n.map(([Tag, attrs], i) => (
        <Tag key={i} {...attrs} />
      ))}
    </svg>
  );
}
