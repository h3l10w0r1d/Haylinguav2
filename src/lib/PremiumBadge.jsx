// src/lib/PremiumBadge.jsx — shared "premium feel" primitives: a small crown
// badge to overlay on an avatar corner, plus the gold ring/glow class
// strings used consistently everywhere a premium user's avatar renders
// (HeaderLayout, ProfilePage, PublicUserPage, Leaderboard, Friends).
import { Crown } from "lucide-react";

// Applied on top of whatever ring the avatar already has (e.g. `ring-4
// ring-white`) — swap the color in, keep the width so layout doesn't shift.
export const PREMIUM_AVATAR_GLOW = "shadow-[0_0_0_3px_rgba(255,200,0,0.35)]";

export function CrownBadge({ size = "h-5 w-5", iconSize = "h-3 w-3", className = "" }) {
  return (
    <span
      title="Premium"
      className={`absolute -bottom-1 -right-1 grid shrink-0 place-items-center rounded-full bg-gold-500 text-white shadow-[0_2px_0_0_#B45309] ring-2 ring-white dark:ring-[#18181b] ${size} ${className}`}
    >
      <Crown className={iconSize} />
    </span>
  );
}
