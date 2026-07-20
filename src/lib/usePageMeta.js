// src/lib/usePageMeta.js — per-page <title>/meta description for the public
// marketing pages. index.html ships one static title+description sized for
// "/"; every other page (About, Careers, Pricing, Contact, Community...)
// was silently reusing it, so they all looked identical in browser tabs,
// search results, and link previews. This sets the real ones on mount and
// puts index.html's defaults back on unmount, so leaving a page (including
// via back-button) never leaves a stale title/description behind.
import { useEffect } from "react";

const DEFAULT_TITLE = "Haylingua — Learn Armenian with modern, gamified lessons";
const DEFAULT_DESCRIPTION = "Haylingua helps you learn Armenian with bite‑sized lessons, listening practice, and gamified progress tracking. Start free — log in or sign up in seconds.";

function setMetaTag(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export default function usePageMeta(title, description = DEFAULT_DESCRIPTION) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Haylingua` : DEFAULT_TITLE;
    document.title = fullTitle;
    setMetaTag("description", description);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag("description", DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
