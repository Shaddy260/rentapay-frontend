// src/utils/appVersion.js
//
// Shared by ForceUpdateGate.jsx. Plain major.minor.patch comparison -
// RentaPay's version numbers (see frontend/package.json "version")
// have never used anything else, so no need for a full semver parser.

export function compareVersions(a, b) {
  const pa = String(a || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// Same "installed as a standalone app" detection already used by
// utils/push.js and utils/useInstallPrompt.js (display-mode media
// query, with iOS Safari's separate navigator.standalone fallback).
// Duplicated here rather than imported to avoid coupling this
// force-update-specific check to those unrelated modules.
export function isRunningStandaloneApp() {
  if (typeof window === 'undefined') return false;
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator?.standalone === true
  );
}
