// src/lib/analytics.js — thin wrapper around the Umami tracker loaded in
// index.html, plus a dataLayer push for GTM (Meta Pixel in the web
// container, Meta CAPI in the server container — see src/ConsentBanner.jsx
// and backend/integrations/gtm_server.py). Every call site should go
// through track()/identify(), never touch window.umami or window.dataLayer
// directly: this is the one place that (a) no-ops safely if a script hasn't
// loaded yet (ad blockers, consent not granted, a slow network) and (b) is
// the single spot to swap/extend analytics providers later.
function pushToDataLayer(payload) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch {
    // analytics must never break the feature it's attached to
  }
}

export function track(eventName, data) {
  try {
    window.umami?.track(eventName, data);
  } catch {
    // analytics must never break the feature it's attached to
  }
  pushToDataLayer({ event: eventName, ...data });
}

// Attaches session-level properties (e.g. is_premium) to every subsequent
// event/pageview from this session, so the dashboard can be segmented by
// user type instead of only showing aggregate totals. Safe to call
// repeatedly — Umami just overwrites the previous identify payload.
export function identify(data) {
  try {
    window.umami?.identify(data);
  } catch {
    // analytics must never break the feature it's attached to
  }
  pushToDataLayer({ event: "identify", user_properties: data });
}

// Fires on every route change (see src/App.jsx) — the dataLayer event GTM's
// web container reacts to for Meta's PageView.
export function pageview(path) {
  pushToDataLayer({ event: "page_view", page_path: path });
}

// Shared between the browser Pixel fire (via this dataLayer push, read by a
// GTM variable) and the server CAPI fire (backend forwards the identical
// id — see backend/integrations/gtm_server.py) so Meta deduplicates the two
// instead of double-counting the same real-world event. Callers that need
// both sides (currently only Premium checkout — see src/Premium.jsx) must
// generate ONE id and pass it to both the API call and the track() call.
export function newEventId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
