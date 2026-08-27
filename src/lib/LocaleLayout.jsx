// src/lib/LocaleLayout.jsx — wraps every locale-prefixed route (/ru/*, /fr/*,
// /es/*). On mount/locale change: switches i18next's active language and
// updates <html lang> (index.html hardcodes lang="en" and nothing else in
// the app ever changed it before this). Renders an <Outlet /> so the exact
// same child <Route> elements used for the unprefixed English routes can be
// reused here verbatim (see App.jsx) instead of duplicating them by hand.
import { useEffect } from "react";
import { Outlet, useParams, Navigate } from "react-router-dom";
import i18next, { SUPPORTED_LOCALES } from "../i18n";

export default function LocaleLayout() {
  const { locale } = useParams();

  useEffect(() => {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    i18next.changeLanguage(locale);
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = "en";
    };
  }, [locale]);

  // An unsupported segment (typo, old bookmark, crawler probing) falls back
  // to the unprefixed English site rather than a dead end.
  if (!SUPPORTED_LOCALES.includes(locale)) return <Navigate to="/" replace />;

  return <Outlet />;
}
