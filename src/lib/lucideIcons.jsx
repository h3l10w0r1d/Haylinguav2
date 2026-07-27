// src/lib/lucideIcons.jsx — every icon lucide-react ships (~1,544), for the
// CMS chapter-icon picker (a T-shirt for "Clothes", a plane for "Travel",
// etc.) without hand-drawing custom art.
//
// This is NOT `import * as Icons from "lucide-react"` or lucide-react's own
// per-icon dynamic-import helper — both were tried and both ended up bundling
// all ~1,500 icons into the site's shared vendor chunk (measured: +730-880KB
// on every single page load, site-wide, just to support an admin-only
// picker), because Vite's manualChunks config funnels every node_modules
// module into one eager "vendor" bundle and Rollup didn't split the
// dynamic-import()-based icon files out of it. Instead, public/icons/
// lucide-icons.json (generated once from lucide-react's icon source, see
// note below) is a plain static asset — never touched by the JS bundler at
// all — fetched lazily and cached in memory the first time any icon is
// actually rendered.
//
// Regenerating the manifest (only needed if lucide-react is upgraded):
//   node -e "
//     const fs=require('fs'), path=require('path');
//     const names=Object.keys(require('lucide-react/dynamicIconImports').default);
//     const dir=path.join('node_modules/lucide-react/dist/esm/icons');
//     const out={};
//     for (const name of names) {
//       const src=fs.readFileSync(path.join(dir, name+'.js'),'utf8');
//       const m=src.match(/createLucideIcon\(\s*[\'\"][^\'\"]+[\'\"],\s*(\[[\s\S]*?\])\s*\);/);
//       const nodes=Function('return '+m[1])();
//       out[name]=nodes.map(([tag,attrs])=>{const {key,...rest}=attrs; return [tag,rest];});
//     }
//     fs.writeFileSync('public/icons/lucide-icons.json', JSON.stringify(out));
//   "
import { useEffect, useState } from "react";

const DEFAULT_SVG_ATTRS = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

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

// Names are kebab-case (e.g. "shirt", "map-pin") — store this exact string
// as chapter.icon. Resolves once the manifest has loaded at least once
// (components using this alongside <LucideGlyph> will already trigger that).
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

// Renders one icon by name; renders nothing until the (cached-after-first-
// fetch) manifest resolves. `fallback` shows while loading or if the name
// isn't found (e.g. no icon chosen yet).
export function LucideGlyph({ name, className, fallback = null }) {
  const [nodes, setNodes] = useState(name && manifestData ? manifestData[name] : undefined);

  useEffect(() => {
    if (!name) {
      setNodes(undefined);
      return;
    }
    if (manifestData) {
      setNodes(manifestData[name]);
      return;
    }
    let cancelled = false;
    loadManifest().then((data) => {
      if (!cancelled) setNodes(data[name]);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!nodes) return fallback;
  return (
    <svg {...DEFAULT_SVG_ATTRS} className={className}>
      {nodes.map(([Tag, attrs], i) => (
        <Tag key={i} {...attrs} />
      ))}
    </svg>
  );
}
