// src/lib/avatarFrame.jsx — renders the cosmetic ring a purchased/equipped
// "avatar_frame" shop item is supposed to grant. Previously `active_frame`
// was tracked in the DB and pickable in the Appearance tab but never
// actually drawn anywhere — this closes that gap. Keyed by a small fixed
// palette (see backend FRAME_STYLES) rather than a free-form color so every
// frame reads as deliberately designed.
export const FRAME_STYLES = {
  gold: "linear-gradient(135deg, #FFE79A, #E8A317, #FFE79A)",
  silver: "linear-gradient(135deg, #F1F5F9, #94A3B8, #F1F5F9)",
  bronze: "linear-gradient(135deg, #E8B98A, #92542B, #E8B98A)",
  ruby: "linear-gradient(135deg, #FF8FA3, #C81E4A, #FF8FA3)",
  sapphire: "linear-gradient(135deg, #8FC7FF, #1D4ED8, #8FC7FF)",
  emerald: "linear-gradient(135deg, #8CE6B0, #0F8A5F, #8CE6B0)",
  rainbow: "conic-gradient(from 180deg, #FF5A5A, #FFB25A, #FFE45A, #7DDE6A, #5AA7FF, #A65AFF, #FF5A5A)",
};

// Tailwind spacing scale (1 unit = 0.25rem = 4px) for the handful of
// avatar sizes actually used across the app — lets callers keep passing
// their existing "h-12 w-12"-style className instead of a separate pixel
// prop. Falls back to 40px for anything not in this list.
const TAILWIND_PX = { "h-7 w-7": 28, "h-9 w-9": 36, "h-10 w-10": 40, "h-12 w-12": 48, "h-16 w-16": 64, "h-24 w-24": 96 };

// Wraps an avatar image/initials element in the equipped frame's gradient
// ring. Always renders a fixed `size`×`size` box — even with no frame, so
// a percentage-sized child ("h-full w-full", the usual pattern for the
// avatar image/initials inside) has a consistent, definite box to resolve
// against whether or not a frame is equipped, rather than sizing behavior
// silently changing based on frame state.
export default function AvatarFrame({ frameStyle, size, sizeClass, radius = "9999px", thickness = 3, className = "", style, children }) {
  const gradient = FRAME_STYLES[frameStyle];
  const px = size || TAILWIND_PX[sizeClass] || 40;
  const pad = gradient ? thickness : 0;
  return (
    <div
      className={className}
      style={{
        background: gradient || "transparent",
        borderRadius: radius,
        width: px,
        height: px,
        boxSizing: "border-box",
        padding: pad,
        display: "grid",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: gradient ? `calc(${radius} - ${thickness}px)` : radius,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
