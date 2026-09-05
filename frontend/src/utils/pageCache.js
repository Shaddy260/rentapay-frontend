// src/utils/pageCache.js
//
// FIX (direct request: "across the platform it uses skeletons and the
// white screen... should have actual data, no matter what, under no
// circumstances should it go blank - should auto-update in the
// background"): Dashboard.jsx, UnitDetail.jsx, AdminDashboard.jsx and
// a few others already solved this individually, each with their own
// copy-pasted sessionStorage read/write pair - same idea, duplicated
// four different ways, and several pages (Settings.jsx,
// SubscriptionManage.jsx, BaPortal.jsx's stats sections) never got
// the same treatment at all, so those still show a full skeleton on
// every single visit even though the same data was just fetched
// moments ago.
//
// This is that pattern pulled out once: read the last-known-good
// payload synchronously as a component's initial state (so there's
// real content on screen the instant it mounts, before any network
// request has even started), then silently refetch on top of it and
// overwrite the cache when the new data lands. A background poll/tab
// re-focus/route revisit never has to fall back to a spinner or a
// blank screen - worst case, it briefly shows slightly-stale data
// while the fresh copy is in flight.
//
// Deliberately sessionStorage, not localStorage: cleared on logout
// (see Login.jsx clearing session storage) and scoped to one tab, so
// it can never leak one account's cached data into another session on
// a shared device.

export function readPageCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writePageCache(key, partial) {
  try {
    const prev = readPageCache(key) || {};
    sessionStorage.setItem(key, JSON.stringify({ ...prev, ...partial }));
  } catch {
    // Non-fatal - this is a head-start convenience, not a hard
    // requirement. The next background fetch still works exactly the
    // same either way.
  }
}

export function clearPageCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}
