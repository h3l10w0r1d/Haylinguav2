// src/lib/nameTag.jsx — wraps a username in the equipped "name_tag_effect"
// item's CSS class (see .nametag-* in src/index.css), plus the same rarity
// glow treatment AvatarFrame uses. Mirrors AvatarFrame's prop shape
// (renderKey/rarity in, styled element out) so the pattern is copy-pasteable
// for future cosmetic categories.
import { RARITY_COLORS } from "./avatarFrame";

const RARITY_GLOW_CLASS = { rare: "rarity-glow-rare", epic: "rarity-glow-epic", legendary: "rarity-glow-legendary" };

export default function NameTag({ renderKey, rarity, className = "", style, children }) {
  if (!renderKey) return <span className={className}>{children}</span>;

  const glowClass = RARITY_GLOW_CLASS[rarity];
  const glowColor = RARITY_COLORS[rarity];

  return (
    <span
      className={[className, renderKey, glowClass].filter(Boolean).join(" ")}
      style={{
        ...(glowColor ? { "--rarity-color": glowColor } : null),
        ...(glowClass ? { borderRadius: "4px", padding: "0 2px" } : null),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
