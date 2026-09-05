// src/utils/clearStaleCaches.js
//
// BUG FIX (direct request: "when someone logs in, it sometimes gives
// a preview of another dashboard, then gives the error 'property not
// found'"). Root cause: several pages (Dashboard.jsx, TenantPortal.jsx,
// TenantSettings.jsx, ManagerAccountDashboard.jsx, AdminDashboard.jsx,
// SubscriptionManage.jsx, BaPortal.jsx, Settings.jsx) cache their last
// loaded data under a single GLOBAL storage key - e.g.
// 'rentapay_dashboard_cache' - purely so a hard refresh has something
// to show instantly instead of a blank screen while fresh data loads
// (see the "white screen on refresh" fix comments in each of those
// files). None of those keys were namespaced per-account.
//
// On a shared device (or just the same browser tab) where one person
// logs out and a DIFFERENT person logs in, that global cache still
// has the PREVIOUS person's dashboard/property/summary sitting in it.
// The new page mounts, synchronously seeds its state from that stale
// cache (so the previous person's dashboard flashes on screen for a
// moment), and then the real fetch for the NEW account runs - using
// the previous person's cached propertyId, which doesn't belong to
// the new account, and the backend correctly rejects it: "Property
// not found."
//
// Fix: wipe every one of these caches at the exact moment a NEW
// session is established (every successful login), before any page
// has a chance to read them. That guarantees a freshly logged-in
// account only ever renders its own data, never a leftover flash of
// whoever used this device/tab before them - regardless of whether
// the previous person's logout path happened to clean up after
// itself. Cleared from both storages, since not every one of these
// caches uses the same storage (most are sessionStorage, the tenant
// portal one is localStorage) - clearing both is harmless even where
// a given key was never used there.
const STALE_CACHE_KEYS = [
  'rentapay_dashboard_cache',
  'rentapay_tenant_portal_cache',
  'rentapay_tenant_settings_cache',
  'rentapay_gm_metrics_cache',
  'rentapay_subscription_cache',
  'rentapay_admin_metrics_cache',
  'rentapay_ba_stats_cache',
  'rentapay_settings_cache',
];

export function clearStaleAccountCaches() {
  for (const key of STALE_CACHE_KEYS) {
    try { sessionStorage.removeItem(key); } catch { /* unavailable - non-fatal */ }
    try { localStorage.removeItem(key); } catch { /* unavailable - non-fatal */ }
  }
}
