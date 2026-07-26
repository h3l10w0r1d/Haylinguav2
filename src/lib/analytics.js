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
