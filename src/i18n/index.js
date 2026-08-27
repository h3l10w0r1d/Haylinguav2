// src/i18n/index.js — i18next bootstrap + small routing helpers shared by
// every translated page. English is the implicit default and stays
// unprefixed at its current URLs (preserves existing SEO equity); every
// other supported locale gets an explicit path prefix (/ru, /fr, /es —
// literal segments, not a generic :locale param, so real path segments like
// /about never get mistaken for a locale). Arabic/Persian/Georgian are
// deliberately not in this array yet — phase 2/3 per the rollout plan; they
// need RTL support and new fonts first.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { useParams } from "react-router-dom";

import enCommon from "./locales/en/common.json";
import ruCommon from "./locales/ru/common.json";
import frCommon from "./locales/fr/common.json";
import esCommon from "./locales/es/common.json";

import enLanding from "./locales/en/landing.json";
import ruLanding from "./locales/ru/landing.json";
import frLanding from "./locales/fr/landing.json";
import esLanding from "./locales/es/landing.json";

import enSeoPages from "./locales/en/seo-pages.json";
import ruSeoPages from "./locales/ru/seo-pages.json";
import frSeoPages from "./locales/fr/seo-pages.json";
import esSeoPages from "./locales/es/seo-pages.json";

export const SUPPORTED_LOCALES = ["ru", "fr", "es"];
export const DEFAULT_LOCALE = "en";
export const ALL_LOCALES = [DEFAULT_LOCALE, ...SUPPORTED_LOCALES];

export const LOCALE_LABELS = {
  en: "English",
  ru: "Русский",
  fr: "Français",
  es: "Español",
};

i18next.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, landing: enLanding, seoPages: enSeoPages },
    ru: { common: ruCommon, landing: ruLanding, seoPages: ruSeoPages },
    fr: { common: frCommon, landing: frLanding, seoPages: frSeoPages },
    es: { common: esCommon, landing: esLanding, seoPages: esSeoPages },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  ns: ["common", "landing", "seoPages"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18next;

// Reads the current locale from the URL (only present on routes nested
// under /ru, /fr, /es — see LocaleLayout.jsx); "" (falsy) means the
// unprefixed default-English routes.
export function useLocale() {
  const { locale } = useParams();
  return SUPPORTED_LOCALES.includes(locale) ? locale : "";
}

// Prefixes `path` (must start with "/") with the given locale, or returns it
// unprefixed for the default locale — the single place that encodes "how a
// locale turns into a URL" so nav/footer links and hreflang alternates can't
// drift apart from the actual route registration in App.jsx.
export function localizedPath(path, locale) {
  if (!locale || locale === DEFAULT_LOCALE) return path;
  return `/${locale}${path === "/" ? "" : path}`;
}

// Simple {{token}} interpolation for the demo's "AI tutor" sentence
// templates — stored as plain strings in the locale JSON (functions can't
// survive JSON), rendered here instead of as JS template literals.
export function renderTemplate(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? ""));
}
