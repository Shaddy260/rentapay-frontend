// src/utils/sentry.js
//
// HARDENING (2D - error tracking, Sentry free tier). Mirrors the
// backend's src/services/sentry.service.js: a missing/invalid
// VITE_SENTRY_DSN, or @sentry/react not yet being installed, must
// never break the app - it just means errors aren't reported
// anywhere but the browser console, same as today. Requires
// `npm install` (see package.json's new "@sentry/react" dependency)
// and VITE_SENTRY_DSN set in frontend/.env before it actually does
// anything; until then this is a complete, harmless no-op.

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // disabled - normal in dev, nothing to log noisily about on every page load

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({ dsn, environment: import.meta.env.MODE });
  } catch (err) {
    // Covers "@sentry/react isn't installed yet" and any unexpected
    // init failure - log and continue, never block the app render.
    console.warn('[sentry] Failed to initialize (continuing without error tracking):', err);
  }
}
