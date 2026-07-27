// src/lib/sentry.js — crash/error reporting for the mobile app, mirroring
// the web (src/main.jsx) and backend (backend/main.py) setups: same Sentry
// org, its own project since RN crash reports (native stack traces, JS
// bundle symbolication) are a different shape than browser/server events.
//
// There's no build-time env var system in this bare RN app (see
// src/lib/api.js's hardcoded API_BASE_URL for the existing convention), and
// a Sentry DSN is meant to be embedded client-side (write-only, not a
// secret) — so it's a plain constant here rather than pulling in a whole
// .env toolchain just for this one value.
import * as Sentry from '@sentry/react-native';

// TODO: paste the DSN from a new "Haylingua Mobile" project at sentry.io —
// leaving this empty just no-ops Sentry.init below instead of crashing.
const SENTRY_DSN = '';

export function initSentry() {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
    // Crash reports from every developer's simulator would drown out real
    // production signal — only report once a release build actually ships.
    enabled: !__DEV__,
  });
}

export { Sentry };
