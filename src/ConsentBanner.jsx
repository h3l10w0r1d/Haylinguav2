// src/ConsentBanner.jsx — cookie/tracking consent gate for GTM (Meta Pixel +
// server-side CAPI). Hard gate: GTM's base script (see index.html) is never
// injected until the visitor explicitly accepts here — no ping-then-adjust
// Consent Mode behavior. Persisted as localStorage["hay_consent"], matching
// the app's existing flat hay_* key convention (hay_token, hay_theme,
// hay_onboarding_completed).
//
// Also mounted from src/CookiePolicyPage.jsx as a "change my preferences"
// entry point (via the exported CONSENT_KEY + a custom event) so a visitor
// can revisit their choice after the first prompt.
import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

export const CONSENT_KEY = "hay_consent";
const REOPEN_EVENT = "hay_consent_reopen";

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(() => readConsent() == null);

  useEffect(() => {
    const reopen = () => setVisible(true);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  function set(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // if storage is unavailable, the banner just re-prompts every visit —
      // acceptable degradation, never block the app on it
    }
    if (value === "accepted") window.__loadGTMIfConsented?.();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4 duration-300 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md">
      <div className="flex items-start gap-3 border-t border-slate-200 bg-white p-4 shadow-xl dark:border-white/[0.08] dark:bg-[#18181b] sm:rounded-2xl sm:border">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Cookie size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 dark:text-white">We use cookies</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-stone-400">
            We'd like to use analytics and advertising cookies to understand how Haylingua is
            used and measure our campaigns. See our{" "}
            <a href="/cookie-policy" className="underline hover:text-brand-600 dark:hover:text-brand-400">
              Cookie Policy
            </a>{" "}
            for details.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => set("accepted")}
              className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_3px_0_0_#c2410c] transition active:translate-y-0.5"
            >
              Accept
            </button>
            <button
              onClick={() => set("rejected")}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/10"
            >
              Reject
            </button>
          </div>
        </div>
        <button
          onClick={() => set("rejected")}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// Called from CookiePolicyPage.jsx's "change my cookie preferences" link.
export function reopenConsentBanner() {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}
