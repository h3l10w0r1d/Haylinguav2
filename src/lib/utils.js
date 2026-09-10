// src/lib/utils.js — shadcn/ui's `cn` helper: clsx for conditional classes,
// tailwind-merge so a later Tailwind class overrides an earlier conflicting
// one (e.g. cn("px-4", "px-2") → "px-2"). Replaces the per-file `cx()` copies
// under src/cms/.
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
