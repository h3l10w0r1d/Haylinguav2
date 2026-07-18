// src/SiteNav.jsx — shared header for public static pages (Contact, Terms,
// Privacy, etc). Mirrors the landing page's nav so these feel like the same
// site, not a bolted-on legal template. Light/dark aware.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sun, Moon, Menu, X } from "lucide-react";
import { getTheme, toggleTheme } from "./lib/theme";

export default function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const onChange = (e) => e?.detail?.theme && setTheme(e.detail.theme);
    window.addEventListener("hay_theme_changed", onChange);
    return () => window.removeEventListener("hay_theme_changed", onChange);
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur dark:border-white/[0.06] dark:bg-[#151517]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-btn-brand">Հ</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">Haylingua</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <Link to="/#how" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white">How it works</Link>
          <Link to="/#features" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white">Features</Link>
          <Link to="/about" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white">About us</Link>
          <Link to="/contact" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white">Contact</Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleTheme()}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.08]"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <Link to="/" className="btn3d btn3d-brand hidden !py-2.5 text-sm sm:inline-flex">
            Start learning <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.06] md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-5 pb-4 pt-2 dark:border-white/[0.06] dark:bg-[#18181b] md:hidden">
          <div className="flex flex-col gap-1">
            <Link to="/#how" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]">How it works</Link>
            <Link to="/#features" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]">Features</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]">About us</Link>
            <Link to="/contact" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]">Contact</Link>
            <Link to="/" onClick={() => setMenuOpen(false)} className="mt-1 btn3d btn3d-brand !py-2.5 text-sm justify-center">Start learning</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
