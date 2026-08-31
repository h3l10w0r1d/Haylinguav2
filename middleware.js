// middleware.js — Vercel Edge Middleware. Runs before every request to the
// paths listed in `config.matcher` below. Redirects a visitor's very first,
// cookie-less hit on an unprefixed (English) URL to their locale-prefixed
// equivalent based on IP geolocation, using the `x-vercel-ip-country`
// header Vercel injects automatically at the edge (no external API call,
// no extra dependency, no user IP ever leaves Vercel's own network).
//
// This intentionally only fires ONCE per visitor: after the first request,
// a `hay_lang` cookie is always set (either to the detected locale, or to
// "en" when no match/no header — e.g. local dev, or a bot), so every
// subsequent request short-circuits immediately. This preserves the
// existing design rule (see src/lib/LanguageSwitcher.jsx): the URL is
// always the source of truth for the CURRENT page's language — this
// middleware never rewrites in place, it only redirects a bare first visit,
// and a manual language switch (which also sets this same cookie
// client-side) is respected forever after, including on future visits.

const COOKIE_NAME = "hay_lang";

// Same set as src/i18n/index.js's SUPPORTED_LOCALES — kept in sync manually
// (this file runs on Vercel's edge runtime, outside the Vite build, so it
// can't import from src/).
const SUPPORTED_LOCALES = ["ru", "fr", "es", "ar", "fa", "ka"];

// ISO 3166-1 alpha-2 country -> locale. Deliberately conservative: only
// countries where one of our supported languages is clearly the dominant
// or official language. Countries not listed here fall back to English.
const COUNTRY_TO_LOCALE = {
  // Russian
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru", TJ: "ru",
  // French
  FR: "fr", BE: "fr", CH: "fr", LU: "fr", MC: "fr", SN: "fr", CI: "fr",
  // Spanish
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", GQ: "es",
  // Arabic
  SA: "ar", AE: "ar", EG: "ar", IQ: "ar", JO: "ar", KW: "ar", QA: "ar",
  BH: "ar", OM: "ar", LB: "ar", LY: "ar", TN: "ar", DZ: "ar", MA: "ar",
  SY: "ar", YE: "ar", SD: "ar",
  // Persian
  IR: "fa", AF: "fa",
  // Georgian
  GE: "ka",
};

// Only match the unprefixed (English) marketing/SEO/blog surface that
// actually has translations — everything else (assets, /cms/*, the
// authenticated app, already-prefixed /ru/* etc.) is left alone.
export const config = {
  matcher: [
    "/",
    "/about",
    "/pricing",
    "/careers",
    "/affiliates",
    "/contact",
    "/armenian-alphabet",
    "/learn-armenian-online",
    "/armenian-pronunciation",
    "/armenian-vocabulary",
    "/eastern-armenian",
    "/blog",
    "/blog/:slug*",
  ],
};

function localizedPath(pathname, locale) {
  if (!locale || locale === "en") return pathname;
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}

// Search engine crawlers must NEVER be geo-redirected — a crawler's IP can
// geolocate anywhere depending on which datacenter made the request, so
// redirecting them would make Google/Bing see the canonical English URL as
// "a page that redirects" (unindexable) instead of stable, directly
// crawlable content. Every SEO page already exposes its own hreflang
// alternates in <head> (see usePageMeta.js) — that's the correct, stable
// mechanism for crawlers to discover the /ru, /fr, /es, /ar, /fa, /ka
// variants, not a redirect that could vary run to run.
const BOT_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|linkedinbot|pinterest|embedly|quora|outbrain|preview|prerender|lighthouse|pagespeed|validator/i;

export default function middleware(request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_UA_RE.test(userAgent)) {
    return;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  if (new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=`).test(cookieHeader)) {
    // Already decided once (either auto-detected or a manual switch) —
    // never re-evaluate, so a deliberate switch back to English sticks.
    return;
  }

  const country = request.headers.get("x-vercel-ip-country");
  const locale = country ? COUNTRY_TO_LOCALE[country] : null;
  const setCookie = `${COOKIE_NAME}=${locale || "en"}; Path=/; Max-Age=31536000; SameSite=Lax`;

  if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
    // No match (or no geo header at all, e.g. local dev) — let the request
    // continue to English as normal, just remember we checked.
    const res = new Response(null, { status: 200, headers: { "x-middleware-next": "1" } });
    res.headers.append("Set-Cookie", setCookie);
    return res;
  }

  const url = new URL(request.url);
  url.pathname = localizedPath(url.pathname, locale);
  // NOT Response.redirect(url, 307): the Fetch spec marks a Response built
  // that way as having immutable headers, so appending Set-Cookie to it
  // throws at runtime (MIDDLEWARE_INVOCATION_FAILED) — every visitor whose
  // geolocated country actually matched a locale hit this, while requests
  // from unmapped countries (e.g. Armenia) never took this branch at all,
  // which is why it looked fine locally. Building the Response directly
  // keeps normal, mutable headers.
  return new Response(null, {
    status: 307,
    headers: { Location: url.toString(), "Set-Cookie": setCookie },
  });
}
