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
import { useTranslation } from "react-i18next";
import { ArrowRight, Sun, Moon, Menu, X, Volume2, VolumeX } from "lucide-react";
import { getTheme, toggleTheme } from "./lib/theme";
import { isMuted, toggleMuted } from "./lib/muteAudio";
import { useLocale, localizedPath } from "./i18n";
import LanguageSwitcher from "./lib/LanguageSwitcher";

export default function SiteNav({ inPage = false, onLogin, onSignup }) {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme);
  const [muted, setMutedState] = useState(isMuted);

  useEffect(() => {
    const onChange = (e) => e?.detail?.theme && setTheme(e.detail.theme);
    window.addEventListener("hay_theme_changed", onChange);
    return () => window.removeEventListener("hay_theme_changed", onChange);
  }, []);

  useEffect(() => {
    const onChange = (e) => setMutedState(!!e?.detail?.muted);
    window.addEventListener("hay_muted_changed", onChange);
    return () => window.removeEventListener("hay_muted_changed", onChange);
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
        <Link to={lp("/")} className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-btn-brand">Հ</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">Haylingua</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <NavLink to={lp("/about")} className={navLinkCls}>{t("nav.about")}</NavLink>
          <NavLink to={lp("/careers")} className={navLinkCls}>{t("nav.careers")}</NavLink>
          <NavLink to={lp("/pricing")} className={navLinkCls}>{t("nav.pricing")}</NavLink>
          <NavLink to={lp("/contact")} className={navLinkCls}>{t("nav.contact")}</NavLink>
        </div>

        <div className="flex items-center gap-2">
          {/* Language + mute move into the mobile menu below sm — with the
              logo, theme toggle, CTA, and hamburger all fighting for the
              same row, a phone-width screen doesn't have room for two more
              icon buttons here (see the mobile-menu copies further down). */}
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          {/* Mute only matters where sound actually plays — the landing
              page's hero demo (sfx + VoiceChip TTS). About/Careers/Pricing/
              Contact have no audio, so the icon was pure clutter there. */}
          {inPage && (
            <button
              type="button"
              onClick={() => toggleMuted()}
              title={t("nav.toggleSound")}
              aria-label={t("nav.toggleSound")}
              className="hidden h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.08] sm:grid"
            >
              {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleTheme()}
            title={theme === "dark" ? t("nav.switchToLight") : t("nav.switchToDark")}
            aria-label={theme === "dark" ? t("nav.switchToLight") : t("nav.switchToDark")}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.08]"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          {inPage && (
            <button onClick={() => onLogin?.()} className="hidden rounded-xl px-4 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.06] sm:block">
              {t("nav.login")}
            </button>
          )}
          {inPage ? (
            <button onClick={() => onSignup?.()} className="btn3d btn3d-brand !py-2.5 text-sm">
              {t("nav.getStarted")}
            </button>
          ) : (
            <Link to={lp("/")} className="btn3d btn3d-brand hidden !py-2.5 text-sm sm:inline-flex">
              {t("nav.startLearning")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.06] md:hidden"
            aria-label={t("nav.toggleMenu")}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-5 pb-4 pt-2 dark:border-white/[0.06] dark:bg-[#18181b] md:hidden">
          <div className="flex flex-col gap-1">
            {/* Language + mute live here (not the top bar) below sm — see
                the comment by their hidden top-bar counterparts. */}
            <div className="mb-1 flex items-center gap-2 sm:hidden">
              <LanguageSwitcher />
              {inPage && (
                <button
                  type="button"
                  onClick={() => toggleMuted()}
                  className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:text-stone-300 dark:hover:bg-white/[0.04]"
                >
                  {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
                  {t("nav.toggleSound")}
                </button>
              )}
            </div>
            <NavLink to={lp("/about")} onClick={closeMenu} className={mobileNavLinkCls}>{t("nav.about")}</NavLink>
            <NavLink to={lp("/careers")} onClick={closeMenu} className={mobileNavLinkCls}>{t("nav.careers")}</NavLink>
            <NavLink to={lp("/pricing")} onClick={closeMenu} className={mobileNavLinkCls}>{t("nav.pricing")}</NavLink>
            <NavLink to={lp("/contact")} onClick={closeMenu} className={mobileNavLinkCls}>{t("nav.contact")}</NavLink>
            {inPage ? (
              <div className="mt-1 flex gap-2">
                <button onClick={() => { closeMenu(); onLogin?.(); }} className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-700 dark:bg-white/[0.06] dark:text-stone-200">{t("nav.login")}</button>
                <button onClick={() => { closeMenu(); onSignup?.(); }} className="flex-1 btn3d btn3d-brand !py-2.5 text-sm">{t("nav.signUpFree")}</button>
              </div>
            ) : (
              <Link to={lp("/")} onClick={closeMenu} className="mt-1 btn3d btn3d-brand !py-2.5 text-sm justify-center">{t("nav.startLearning")}</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
