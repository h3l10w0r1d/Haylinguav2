// src/lib/usePageMeta.js — per-page <title>/meta description/canonical/OG/
// Twitter/JSON-LD for the public marketing + content pages. index.html ships
// one static set of tags sized for "/"; every other page was silently
// reusing it, so they all looked identical in browser tabs, search results,
// and link previews, and every non-home URL claimed itself as canonical
// content of "/". This sets the real ones on mount and puts index.html's
// defaults back on unmount, so leaving a page (including via back-button)
// never leaves stale tags behind.
import { useEffect } from "react";
import { localizedPath } from "../i18n";

const SITE_ORIGIN = "https://www.haylingua.am";
const DEFAULT_TITLE = "Learn Armenian Online Free — Haylingua";
const DEFAULT_DESCRIPTION = "Learn Armenian online with free, interactive lessons, real native audio on every word, and a habit that actually sticks. Start speaking Armenian today — no credit card required.";
const DEFAULT_IMAGE = `${SITE_ORIGIN}/og.png`;
const DEFAULT_CANONICAL = `${SITE_ORIGIN}/`;

function setMetaTag(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// OG tags use property=, not name= — a separate attribute from setMetaTag's
// name= lookup, so querying by name= would never find these tags at all.
function setMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonicalLink(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// JSON-LD tags are additive (a page can carry both an Article block and a
// BreadcrumbList block), so they're tracked by the elements this call
// created rather than looked up/reused like the singleton meta/link tags
// above — each mount creates its own <script> elements, unmount removes
// exactly those.
function addJsonLdScripts(structuredData) {
  if (!structuredData) return [];
  const items = Array.isArray(structuredData) ? structuredData : [structuredData];
  return items.map((data) => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-page-meta-jsonld", "true");
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
    return el;
  });
}

function removeJsonLdScripts(els) {
  els.forEach((el) => el.remove());
}

// hreflang alternates — one <link rel="alternate"> per supported locale plus
// an x-default pointing at the unprefixed (English) URL, so search engines
// know these are the same page in different languages rather than duplicate
// content. Tracked-and-removed the same way as the JSON-LD scripts above,
// since a page can have zero, one, or several of these and they aren't
// singleton tags like canonical/meta.
function addAlternateLinks(alternates) {
  if (!alternates || alternates.length === 0) return [];
  const bcp47 = (locale) => (locale ? locale : "en");
  const els = alternates.map(({ locale, path }) => {
    const el = document.createElement("link");
    el.setAttribute("rel", "alternate");
    el.setAttribute("hreflang", bcp47(locale));
    el.setAttribute("href", `${SITE_ORIGIN}${localizedPath(path, locale)}`);
    document.head.appendChild(el);
    return el;
  });

  const defaultEntry = alternates.find((a) => !a.locale) || alternates[0];
  const defaultEl = document.createElement("link");
  defaultEl.setAttribute("rel", "alternate");
  defaultEl.setAttribute("hreflang", "x-default");
  defaultEl.setAttribute("href", `${SITE_ORIGIN}${localizedPath(defaultEntry.path, "")}`);
  document.head.appendChild(defaultEl);
  els.push(defaultEl);

  return els;
}

function removeAlternateLinks(els) {
  els.forEach((el) => el.remove());
}

/**
 * @param {string} title - page title (without the " — Haylingua" suffix); falsy uses DEFAULT_TITLE verbatim
 * @param {string} description
 * @param {object} [options]
 * @param {string} [options.path] - path for canonical/og:url, defaults to window.location.pathname
 * @param {string} [options.image] - absolute image URL for og:image/twitter:image, defaults to DEFAULT_IMAGE
 * @param {object|object[]} [options.structuredData] - one JSON-LD object, or an array of them
 * @param {{locale: string, path: string}[]} [options.alternates] - hreflang alternates; locale "" means English/default (unprefixed)
 */
export default function usePageMeta(title, description = DEFAULT_DESCRIPTION, options = {}) {
  const { path, image, structuredData, alternates } = options;

  useEffect(() => {
    const fullTitle = title ? `${title} — Haylingua` : DEFAULT_TITLE;
    const resolvedPath = path || window.location.pathname;
    const canonicalUrl = `${SITE_ORIGIN}${resolvedPath}`;
    const resolvedImage = image || DEFAULT_IMAGE;

    document.title = fullTitle;
    setMetaTag("description", description);
    setCanonicalLink(canonicalUrl);

    setMetaProperty("og:title", fullTitle);
    setMetaProperty("og:description", description);
    setMetaProperty("og:url", canonicalUrl);
    setMetaProperty("og:image", resolvedImage);

    setMetaTag("twitter:title", fullTitle);
    setMetaTag("twitter:description", description);
    setMetaTag("twitter:image", resolvedImage);

    const jsonLdEls = addJsonLdScripts(structuredData);
    const alternateEls = addAlternateLinks(alternates);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag("description", DEFAULT_DESCRIPTION);
      setCanonicalLink(DEFAULT_CANONICAL);

      setMetaProperty("og:title", DEFAULT_TITLE);
      setMetaProperty("og:description", DEFAULT_DESCRIPTION);
      setMetaProperty("og:url", DEFAULT_CANONICAL);
      setMetaProperty("og:image", DEFAULT_IMAGE);

      setMetaTag("twitter:title", DEFAULT_TITLE);
      setMetaTag("twitter:description", DEFAULT_DESCRIPTION);
      setMetaTag("twitter:image", DEFAULT_IMAGE);

      removeJsonLdScripts(jsonLdEls);
      removeAlternateLinks(alternateEls);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, structuredData, alternates]);
}
