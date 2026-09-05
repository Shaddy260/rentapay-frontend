// src/utils/deviceFingerprint.js
//
// Produces a stable, non-reversible identifier for "this browser
// install" that the backend's risk engine (riskEngine.service.js) uses
// to answer "have we seen this device before for this account" at
// login, and to detect a device swap mid-session (a strong signal of
// session hijacking - see evaluateRequestRisk on the backend).
//
// Deliberately built from coarse, already-exposed browser properties
// (no canvas/audio fingerprinting, no cross-site tracking techniques)
// - this only needs to be stable for the SAME browser across visits,
// not unique across the entire internet. It is hashed again on the
// backend before storage, so the raw components never end up in the
// database as-is.
const STORAGE_KEY = 'rentapay_device_id';

function randomId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// A random, locally-generated, persisted id is the strongest part of
// this fingerprint - it survives across sessions on the SAME device
// (localStorage) without depending on any single browser property that
// might change (e.g. a browser update changing the UA string), while
// still being device-specific rather than account-specific.
function getOrCreatePersistedId() {
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Private/incognito mode or storage disabled - fall back to an
    // in-memory id for this tab's lifetime only. This device will
    // simply look "unrecognized" every visit, which is the safe
    // default (more step-up prompts, never fewer).
    return randomId();
  }
}

let cachedFingerprint = null;

export function getDeviceFingerprint() {
  if (cachedFingerprint) return cachedFingerprint;
  try {
    const persistedId = getOrCreatePersistedId();
    const parts = [
      persistedId,
      navigator.userAgent || '',
      navigator.platform || '',
      String(navigator.language || ''),
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
    ];
    cachedFingerprint = parts.join('|');
  } catch {
    cachedFingerprint = getOrCreatePersistedId();
  }
  return cachedFingerprint;
}
