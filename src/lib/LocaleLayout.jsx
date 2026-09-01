// src/lib/LocaleLayout.jsx — wraps every locale-prefixed route (/ru/*, /fr/*,
// /es/*). On mount/locale change: loads that locale's translation JSON on
// demand (see loadLocaleResources in ../i18n — only English ships in the
// eager bundle), switches i18next's active language, and updates <html
// lang>/<dir> (index.html hardcodes lang="en" and nothing else in the app
// ever changed it before this). Renders an <Outlet /> so the exact same
// child <Route> elements used for the unprefixed English routes can be
// reused here verbatim (see App.jsx) instead of duplicating them by hand.
import { useEffect, useState } from "react";
import { Outlet, useParams, Navigate } from "react-router-dom";
import i18next, { SUPPORTED_LOCALES, RTL_LOCALES, loadLocaleResources } from "../i18n";
import LoadingScreen from "./LoadingScreen";

export default function LocaleLayout() {
  const { locale } = useParams();
  // Starts false on every locale change so a second locale's page render
  // never briefly shows the first locale's (or English's) fallback content
  // before its own translations are registered — same loading-gate pattern
  // App.jsx already uses for lazy-loaded route chunks (see RouteFallback).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    let cancelled = false;
    setReady(false);
    loadLocaleResources(locale).then(() => {
      if (cancelled) return;
      i18next.changeLanguage(locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
      setReady(true);
    });
    return () => {
      cancelled = true;
      // Navigating away to an unprefixed (English) route unmounts this
      // layout, but nothing else ever tells i18next to switch back — its
      // active language would otherwise stay stuck on the locale you just
      // left, so every useTranslation() hook in the app (SiteNav, SiteFooter,
      // etc.) keeps rendering that language's text even on the English URL.
      i18next.changeLanguage("en");
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
    };
  }, [locale]);

  // An unsupported segment (typo, old bookmark, crawler probing) falls back
  // to the unprefixed English site rather than a dead end.
  if (!SUPPORTED_LOCALES.includes(locale)) return <Navigate to="/" replace />;

  // English's resources are always already loaded, so this only actually
  // shows a spinner for the OTHER 6 locales, and only on their first visit
  // this session — loadLocaleResources() memoizes, so switching back and
  // forth between locales already visited resolves instantly.
  if (!ready) return <LoadingScreen />;

  return <Outlet />;
}
