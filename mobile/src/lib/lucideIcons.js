// src/lib/lucideIcons.js — renders any of lucide's ~1,544 icons by kebab-case
// name (e.g. "shirt", "map-pin") from a static JSON manifest (src/assets/
// lucide-icons.json — the exact same file the web app's CMS icon picker
// uses, see src/lib/lucideIcons.jsx there for how/why it's generated) rather
// than importing lucide-react-native's icon components directly. A native
// app bundle isn't repeatedly downloaded per page view the way a web SPA's
// JS is, so the ~300KB manifest bundled locally is a non-issue here (no lazy
// fetch needed, unlike the web version).
import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import iconManifest from '../assets/lucide-icons.json';

const TAG_COMPONENTS = { circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon, polyline: Polyline, rect: Rect };

export const ICON_NAMES = Object.keys(iconManifest).sort();

export function getIconNodes(name) {
  return (name && iconManifest[name]) || null;
}

// `size`/`color` mirror lucide-react-native's own icon component props so
// this drops in wherever a lucide-react-native icon would've gone.
export function LucideGlyph({ name, size = 24, color = 'currentColor', style }) {
  const nodes = getIconNodes(name);
  if (!nodes) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {nodes.map(([tag, attrs], i) => {
        const Tag = TAG_COMPONENTS[tag];
        if (!Tag) return null;
        return <Tag key={i} {...attrs} />;
      })}
    </Svg>
  );
}
