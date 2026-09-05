// src/components/UpdateChecker.jsx
//
// FIX (direct request: "an update is made in the code and uploaded and
// deployed... all accounts regarding the date they joined should all
// reflect the changes"): nothing in this app gates features by account
// or join date - every account runs the same code. What actually
// caused a landlord/tenant to "miss" a newly shipped feature is a
// browser tab (or installed PWA) that's still running the JS bundle
// from before the last deploy, sitting open or reopened from a home
// screen icon without a hard refresh in between.
//
// This polls a small, always-fresh version.json (written fresh on
// every `vite build` - see vite.config.js) and compares its buildId
// against the one baked into the bundle currently running. If they
// differ, a newer deploy exists, and this shows a small "Update
// available" banner rather than silently doing nothing - matches how
// most production web apps handle this, without needing anything
// account-side to change.
import React, { useEffect, useState } from 'react';

// Injected at build time via .env.production (written by
// scripts/write-build-id.js, loaded automatically by Vite - no
// vite.config.js changes needed, which is exactly what broke the
// Cloudflare Pages deploy last time this was wired up differently).
const CURRENT_BUILD_ID = import.meta.env.VITE_BUILD_ID || 'dev';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes while the tab is open

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Dev server builds never get a real VITE_BUILD_ID stamped in
    // (that only happens as part of `vite build` - see
    // scripts/write-build-id.js), so CURRENT_BUILD_ID is always the
    // literal string 'dev' here. That can never match version.json's
    // real build id, so the check would report a "new version" every
    // single time, forever - including immediately after the person
    // hits Refresh. Only run this check against a real production
    // build.
    if (import.meta.env.DEV) return;

    let cancelled = false;

    async function check() {
      try {
        // cache: 'no-store' is the important part - this must never
        // be served from the browser's HTTP cache, or the whole check
        // is defeated by the exact problem it exists to catch.
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.buildId && data.buildId !== CURRENT_BUILD_ID) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline, or version.json briefly unavailable - not worth
        // surfacing as an error, just try again next interval.
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    // Also check whenever the tab/app regains focus - the moment
    // someone is most likely to actually notice and act on a prompt,
    // and the exact moment a PWA reopened from a home screen icon
    // would otherwise silently keep running yesterday's build.
    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!updateAvailable) return null;

  function reload() {
    // location.reload() always re-requests index.html from the
    // network (browsers don't cache navigations the way they cache
    // sub-resources), which then pulls in the new, differently-hashed
    // JS/CSS bundle filenames the new deploy produced.
    window.location.reload();
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 999,
        background: '#1f2937',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        fontSize: 14,
      }}
    >
      <span>A new version of RentaPay is available.</span>
      <button
        type="button"
        onClick={reload}
        style={{ background: '#fff', color: '#1f2937', border: 'none', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
      >
        Refresh
      </button>
    </div>
  );
}
