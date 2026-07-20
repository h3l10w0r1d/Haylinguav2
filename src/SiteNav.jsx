// src/SiteNav.jsx — the ONE header for every public marketing page (landing,
// About, Contact, legal pages). Previously each page rolled its own nav,
// which let them drift out of sync — this is the single source of truth.
//
// On the landing page itself, pass `inPage` + `onLogin`/`onSignup`: the
// "How it works"/"Features" links become same-page anchor jumps (no route
// change) and the auth buttons open the landing page's own modal instead of
// navigating. Everywhere else, the same links/buttons route to "/" — the
// landing page is the only place with a login/signup modal.
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Sun, Moon, Menu, X } from "lucide-react";
import { getTheme, toggleTheme } from "./lib/theme";

export default function SiteNav({ inPage = false, onLogin, onSignup }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const onChange = (e) => e?.detail?.theme && setTheme(e.detail.theme);
    window.addEventListener("hay_theme_changed", onChange);
    return () => window.removeEventListener("hay_theme_changed", onChange);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const linkCls = "text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white";
  const activeLinkCls = "text-sm font-bold text-brand-600 dark:text-brand-400";
  const navLinkCls = ({ isActive }) => (isActive ? activeLinkCls : linkCls);

  const mobileLinkCls = "rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]";
  const activeMobileLinkCls = "rounded-xl px-3 py-2.5 text-sm font-bold text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10";
  const mobileNavLinkCls = ({ isActive }) => (isActive ? activeMobileLinkCls : mobileLinkCls);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur dark:border-white/[0.06] dark:bg-[#151517]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-btn-brand">Հ</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">Haylingua</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <NavLink to="/about" className={navLinkCls}>About us</NavLink>
          <NavLink to="/careers" className={navLinkCls}>Careers</NavLink>
          <NavLink to="/pricing" className={navLinkCls}>Pricing</NavLink>
          <NavLink to="/contact" className={navLinkCls}>Contact</NavLink>
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
          {inPage && (
            <button onClick={() => onLogin?.()} className="hidden rounded-xl px-4 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.06] sm:block">
              Log in
            </button>
          )}
          {inPage ? (
            <button onClick={() => onSignup?.()} className="btn3d btn3d-brand !py-2.5 text-sm">
              Get started
            </button>
          ) : (
            <Link to="/" className="btn3d btn3d-brand hidden !py-2.5 text-sm sm:inline-flex">
              Start learning <ArrowRight className="h-4 w-4" />
            </Link>
          )}
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
            <NavLink to="/about" onClick={closeMenu} className={mobileNavLinkCls}>About us</NavLink>
            <NavLink to="/careers" onClick={closeMenu} className={mobileNavLinkCls}>Careers</NavLink>
            <NavLink to="/pricing" onClick={closeMenu} className={mobileNavLinkCls}>Pricing</NavLink>
            <NavLink to="/contact" onClick={closeMenu} className={mobileNavLinkCls}>Contact</NavLink>
            {inPage ? (
              <div className="mt-1 flex gap-2">
                <button onClick={() => { closeMenu(); onLogin?.(); }} className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-700 dark:bg-white/[0.06] dark:text-stone-200">Log in</button>
                <button onClick={() => { closeMenu(); onSignup?.(); }} className="flex-1 btn3d btn3d-brand !py-2.5 text-sm">Sign up free</button>
              </div>
            ) : (
              <Link to="/" onClick={closeMenu} className="mt-1 btn3d btn3d-brand !py-2.5 text-sm justify-center">Start learning</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
