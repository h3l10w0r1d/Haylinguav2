// src/lib/motifs.jsx — small reusable Armenian visual motifs.
import React from "react";

/** An 8-pointed Armenian star (carpets, khachkars). Inherits text color. */
export function StarMotif({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 1.5l2.2 5.1 5.1-2.2-2.2 5.1 2.2 5.1-5.1-2.2L12 22.5l-2.2-5.1-5.1 2.2 2.2-5.1-2.2-5.1 5.1 2.2z" />
    </svg>
  );
}

/** A thin Armenian carpet-style zig-zag border strip. */
export function CarpetBorder({ className = "h-2", color = "rgba(255,255,255,0.5)" }) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%)`,
        backgroundSize: "12px 8px",
      }}
    />
  );
}
