// src/i18n/index.js — i18next bootstrap + small routing helpers shared by
// every translated page. English is the implicit default and stays
// unprefixed at its current URLs (preserves existing SEO equity); every
// other supported locale gets an explicit path prefix (/ru, /fr, /es, /ar,
// /fa, /ka — literal segments, not a generic :locale param, so real path
// segments like /about never get mistaken for a locale).
//
// PERFORMANCE: only English's translation JSON (~75KB) is imported
// statically/eagerly here. The other 6 languages together are ~670KB of
// JSON — importing all of it eagerly meant every visitor, regardless of
// language, downloaded and parsed translations for six languages they
// almost certainly weren't using, directly hurting first-load time on the
// public marketing site. loadLocaleResources() below dynamically imports
// (and registers with i18next) one locale's files the first time that
// locale is actually visited — see LocaleLayout.jsx, the only caller.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { useParams } from "react-router-dom";

import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enSeoPages from "./locales/en/seo-pages.json";
import enSitePages from "./locales/en/site-pages.json";
import enDiasporaPages from "./locales/en/diaspora-pages.json";

export const SUPPORTED_LOCALES = ["ru", "fr", "es", "ar", "fa", "ka"];
export const DEFAULT_LOCALE = "en";
export const ALL_LOCALES = [DEFAULT_LOCALE, ...SUPPORTED_LOCALES];

// Right-to-left locales — everything else (including the default) is LTR.
// LocaleLayout.jsx sets document.documentElement.dir off this list.
export const RTL_LOCALES = ["ar", "fa"];

export const LOCALE_LABELS = {
  en: "English",
  ru: "Русский",
  fr: "Français",
  es: "Español",
  ar: "العربية",
  fa: "فارسی",
  ka: "ქართული",
};

// Emoji flags for the language switcher — no image assets needed. English
// uses the US flag (matches the en-US date/number formatting already used
// elsewhere in the app); Arabic uses Saudi Arabia as a neutral MSA choice.
export const LOCALE_FLAGS = {
  en: "🇺🇸",
  ru: "🇷🇺",
  fr: "🇫🇷",
  es: "🇪🇸",
  ar: "🇸🇦",
  fa: "🇮🇷",
  ka: "🇬🇪",
};

const NAMESPACES = ["common", "landing", "seoPages", "sitePages", "diasporaPages"];

i18next.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, landing: enLanding, seoPages: enSeoPages, sitePages: enSitePages, diasporaPages: enDiasporaPages },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  ns: NAMESPACES,
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18next;

// One dynamic-import() call per locale's 5 files — Vite code-splits each of
// these into its own small chunk automatically, so `import("./locales/ru/
// common.json")` etc. only hits the network the first time a /ru/* route
// actually mounts, not on every page load. Written as an explicit map
// (rather than a template-string path) because Vite's static analysis for
// splitting dynamic imports needs the literal path to be visible per call.
const LOCALE_LOADERS = {
  ru: () => Promise.all([
    import("./locales/ru/common.json"),
    import("./locales/ru/landing.json"),
    import("./locales/ru/seo-pages.json"),
    import("./locales/ru/site-pages.json"),
    import("./locales/ru/diaspora-pages.json"),
  ]),
  fr: () => Promise.all([
    import("./locales/fr/common.json"),
    import("./locales/fr/landing.json"),
    import("./locales/fr/seo-pages.json"),
    import("./locales/fr/site-pages.json"),
    import("./locales/fr/diaspora-pages.json"),
  ]),
  es: () => Promise.all([
    import("./locales/es/common.json"),
    import("./locales/es/landing.json"),
    import("./locales/es/seo-pages.json"),
    import("./locales/es/site-pages.json"),
    import("./locales/es/diaspora-pages.json"),
  ]),
  ar: () => Promise.all([
    import("./locales/ar/common.json"),
    import("./locales/ar/landing.json"),
    import("./locales/ar/seo-pages.json"),
    import("./locales/ar/site-pages.json"),
    import("./locales/ar/diaspora-pages.json"),
  ]),
  fa: () => Promise.all([
    import("./locales/fa/common.json"),
    import("./locales/fa/landing.json"),
    import("./locales/fa/seo-pages.json"),
    import("./locales/fa/site-pages.json"),
    import("./locales/fa/diaspora-pages.json"),
  ]),
  ka: () => Promise.all([
    import("./locales/ka/common.json"),
    import("./locales/ka/landing.json"),
    import("./locales/ka/seo-pages.json"),
    import("./locales/ka/site-pages.json"),
    import("./locales/ka/diaspora-pages.json"),
  ]),
};

const loadedLocales = new Set([DEFAULT_LOCALE]);
const loadingPromises = new Map();

// Fetches + registers one locale's translation bundles with i18next, exactly
// once (memoized — a second call for an already-loaded or in-flight locale
// reuses the same promise/result instead of re-fetching). Resolves
// immediately for English (already loaded at init) or an unrecognized code.
export function loadLocaleResources(locale) {
  if (loadedLocales.has(locale)) return Promise.resolve();
  if (loadingPromises.has(locale)) return loadingPromises.get(locale);
  const loader = LOCALE_LOADERS[locale];
  if (!loader) return Promise.resolve();
  const promise = loader().then((modules) => {
    const data = modules.map((m) => m.default);
    NAMESPACES.forEach((ns, i) => {
      i18next.addResourceBundle(locale, ns, data[i], true, true);
    });
    loadedLocales.add(locale);
  });
  loadingPromises.set(locale, promise);
  return promise;
}

// Reads the current locale from the URL (only present on routes nested
// under /ru, /fr, /es, /ar, /fa, /ka — see LocaleLayout.jsx); "" (falsy)
// means the unprefixed default-English routes.
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
