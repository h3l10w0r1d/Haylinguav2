// src/lib/LanguageSwitcher.jsx — small nav dropdown for switching the
// current page's language. The URL prefix is always the source of truth
// for what language is being viewed (never a silent redirect based on
// stored preference alone — that would break direct links and confuse
// crawlers); localStorage only remembers the choice as a *default* for the
// next fresh visit to "/", mirroring the existing hay_theme/hay_consent
// localStorage convention.
import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Globe, Check } from "lucide-react";
import { ALL_LOCALES, LOCALE_LABELS, LOCALE_FLAGS, useLocale } from "../i18n";

const LANG_KEY = "hay_lang";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Strip the current locale prefix (if any) off the pathname so we have
  // the "bare" path to re-prefix for each target locale.
  const currentLocalePrefix = locale ? `/${locale}` : "";
  const barePath = currentLocalePrefix && location.pathname.startsWith(currentLocalePrefix)
    ? location.pathname.slice(currentLocalePrefix.length) || "/"
    : location.pathname;

  function go(target) {
    setOpen(false);
    try {
      localStorage.setItem(LANG_KEY, target);
    } catch {}
    // Also written as a cookie (not just localStorage) so the Vercel edge
    // middleware that does IP-based geo redirection on a visitor's very
    // first hit sees this explicit choice and never overrides it again —
    // see /middleware.js. The URL itself still wins for the CURRENT page;
    // this only affects future cookie-less-check redirects.
    try {
      document.cookie = `${LANG_KEY}=${target}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
    const targetPath = target === "en" ? barePath : `/${target}${barePath === "/" ? "" : barePath}`;
    navigate(targetPath + location.search);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Language"
        aria-label="Language"
        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.08]"
      >
        <Globe className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 min-w-[9rem] rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
          {ALL_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => go(code)}
              dir="ltr"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{LOCALE_FLAGS[code]}</span>
                {LOCALE_LABELS[code]}
              </span>
              {(code === locale || (code === "en" && !locale)) && <Check className="h-3.5 w-3.5 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
