// src/lib/lucideIcons.js — renders any of the ~10,273 icons in the shared
// manifest by name (e.g. "shirt", "tabler:shirt", "bi:bag", "ri:t-shirt")
// from the same public/icons/lucide-icons.json the web app's CMS icon
// picker uses (see src/lib/lucideIcons.jsx there for how/why it's built),
// fetched lazily from the deployed web app and cached in memory — NOT
// bundled locally. At ~3.9MB (10x larger than the original lucide-only
// version), statically importing this as a local asset would meaningfully
// bloat every install of the app for a picker mobile doesn't even have a
// wired-up entry point for yet (see UnitBanner.js's icon prop, currently
// unused pending a concurrent DashboardScreen.js refactor landing); a
// cached fetch costs nothing until a screen actually renders an icon.
import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

const MANIFEST_URL = 'https://haylingua.am/icons/lucide-icons.json';
const TAG_COMPONENTS = { circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon, polyline: Polyline, rect: Rect };

let manifestPromise = null;
let manifestData = null;

function loadManifest() {
  if (manifestData) return Promise.resolve(manifestData);
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((r) => r.json())
      .then((data) => {
        manifestData = data;
        return data;
      })
      .catch(() => {
        manifestPromise = null; // allow a retry on the next call
        return {};
      });
  }
  return manifestPromise;
}

function svgPropsFor(entry, size, color) {
  const base = { width: size, height: size, viewBox: entry.v };
  if (entry.m === 'fill') return { ...base, fill: color };
  return { ...base, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
}

// `size`/`color` mirror lucide-react-native's own icon component props so
// this drops in wherever a lucide-react-native icon would've gone. Renders
// nothing until the (cached-after-first-fetch) manifest resolves and the
// name is found in it.
export function LucideGlyph({ name, size = 24, color = '#000', style }) {
  const [entry, setEntry] = React.useState(name && manifestData ? manifestData[name] : undefined);

  React.useEffect(() => {
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

  if (!entry) return null;
  return (
    <Svg {...svgPropsFor(entry, size, color)} style={style}>
      {entry.n.map(([tag, attrs], i) => {
        const Tag = TAG_COMPONENTS[tag];
        if (!Tag) return null;
        return <Tag key={i} {...attrs} />;
      })}
    </Svg>
  );
}
