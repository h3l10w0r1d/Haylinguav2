// src/lib/theme.js — light/dark theme, class-based (Tailwind darkMode: "class").
// The initial class is applied by an inline script in index.html to avoid a
// flash of the wrong theme; this module is the runtime source of truth used by
// the toggle and any component that wants to react to changes.
//
// Default is always light — deliberately NOT following the OS/browser
// `prefers-color-scheme`, so a first-time visitor always lands on the brand's
// intended light look regardless of their system setting. Once someone picks
// a theme via the toggle, that choice is remembered and wins from then on.
const KEY = "hay_theme";

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return "light";
}

export function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch {}
  // Let listeners (e.g. the header toggle in another mount) stay in sync.
  window.dispatchEvent(new CustomEvent("hay_theme_changed", { detail: { theme: dark ? "dark" : "light" } }));
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
