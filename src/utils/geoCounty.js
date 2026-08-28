// src/utils/geoCounty.js
//
// DIRECT REQUEST: vacancy alerts (toast + real push subscription)
// should default to "around them" - this silently attempts browser
// geolocation, reverse-geocodes the coordinates to a Kenyan county via
// OpenStreetMap's free Nominatim API, and matches that against our own
// KENYA_COUNTIES list. Every step degrades quietly: geolocation denied,
// unsupported, slow, or the reverse-geocode failing/timing out all just
// resolve to `null` (caller falls back to a featured/random county or
// generic content) - this must NEVER show a browser permission prompt
// itself or block page rendering.
//
// Deliberately uses the Geolocation API's own permission prompt only
// when the browser already knows the answer (i.e. does NOT force a
// prompt) - see getCountySilently below.

import { KENYA_COUNTIES } from '../constants/kenyaCounties.js';

const CACHE_KEY = 'rentapay_detected_county';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h - county doesn't change mid-session, no need to re-lookup constantly

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.at > CACHE_TTL_MS) return undefined;
    return parsed.county; // may be null (we tried and found nothing) - still a valid cached answer
  } catch {
    return undefined;
  }
}

function writeCache(county) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ county, at: Date.now() }));
  } catch {
    // localStorage unavailable - just skip caching, not fatal
  }
}

function matchKenyaCounty(rawName) {
  if (!rawName) return null;
  const needle = rawName.toLowerCase().replace(/\s*county$/, '').trim();
  return KENYA_COUNTIES.find((c) => c.toLowerCase().replace(/\s*county$/, '').trim() === needle) || null;
}

function getPosition(timeoutMs) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve(pos);
      },
      () => {
        clearTimeout(timer);
        resolve(null); // denied/unavailable - not an error, just no answer
      },
      { maximumAge: CACHE_TTL_MS, timeout: timeoutMs, enableHighAccuracy: false }
    );
  });
}

async function reverseGeocodeCounty(lat, lon) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=8&addressdetails=1`,
      { signal: controller.signal, headers: { Accept: 'application/json' } }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const candidate = data?.address?.county || data?.address?.state || data?.address?.region;
    return matchKenyaCounty(candidate);
  } catch {
    return null; // network hiccup, CORS, abort, malformed JSON - all just "we don't know"
  }
}

/**
 * Resolves the visitor's county WITHOUT ever forcing a permission
 * prompt of its own - if the browser hasn't already decided the
 * geolocation permission, this simply returns null rather than
 * interrupting them. Use this for the passive toast widget.
 */
export async function getCountySilently() {
  const cached = readCache();
  if (cached !== undefined) return cached;

  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state !== 'granted') return null; // don't prompt - just skip
  } catch {
    return null;
  }

  const pos = await getPosition(4000);
  if (!pos) return null;
  const county = await reverseGeocodeCounty(pos.coords.latitude, pos.coords.longitude);
  writeCache(county);
  return county;
}

/**
 * Resolves the visitor's county and IS allowed to trigger the
 * browser's native "Allow location?" prompt. Use this only from an
 * explicit, intentional action (e.g. tapping "Enable" on the vacancy
 * push opt-in), never automatically.
 */
export async function getCountyWithPrompt() {
  const cached = readCache();
  if (cached !== undefined) return cached;

  const pos = await getPosition(8000);
  if (!pos) {
    writeCache(null);
    return null;
  }
  const county = await reverseGeocodeCounty(pos.coords.latitude, pos.coords.longitude);
  writeCache(county);
  return county;
}
