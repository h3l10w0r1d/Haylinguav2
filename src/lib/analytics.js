// src/lib/analytics.js — thin wrapper around the Umami tracker loaded in
// index.html. Every call site should go through track(), never touch
// window.umami directly: this is the one place that (a) no-ops safely if
// the script hasn't loaded yet (ad blockers, the dev-only gate in
// index.html, a slow network) and (b) is the single spot to swap/extend
// analytics providers later.
export function track(eventName, data) {
  try {
    window.umami?.track(eventName, data);
  } catch {
    // analytics must never break the feature it's attached to
  }
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
}
