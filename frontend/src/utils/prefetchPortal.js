// PERFORMANCE FIX (direct request: navigating through the dashboard,
// units, and menu items - not just Home/Messages - still shows the
// full-screen "Loading…" flash and briefly wipes the bottom nav/menu).
// Same root cause as the earlier Dashboard<->Messages fix, just for
// every other route: each page is its own lazy chunk (see App.jsx),
// so the FIRST time you ever visit a given route in a session, React
// has to download it and shows App.jsx's Suspense fallback in the
// meantime, unmounting the current screen (nav bar included) while it
// waits. Once a chunk has been downloaded once, the browser/Vite
// caches it, so revisits are instant.
//
// This warms up every portal-adjacent route right after the very
// first page (Dashboard or TenantPortal) mounts, spread out via
// requestIdleCallback so it never competes with the current page's
// own data loading for bandwidth/CPU. By the time someone actually
// opens the hamburger menu or taps a unit, the chunk is very likely
// already sitting in cache and the transition is instant.
function idle(fn) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 300);
  }
}

const LANDLORD_ROUTES = [
  () => import('../pages/Messages.jsx'),
  () => import('../pages/Settings.jsx'),
  () => import('../pages/UnitDetail.jsx'),
  () => import('../pages/AddUnit.jsx'),
  () => import('../pages/AddTenant.jsx'),
  () => import('../pages/UnitsStatusPage.jsx'),
  () => import('../pages/SubscriptionManage.jsx'),
];

const TENANT_ROUTES = [
  () => import('../pages/Messages.jsx'),
];

function prefetchAll(loaders) {
  // One chunk per idle slot rather than all at once, so a slow device
  // never stutters trying to fetch/parse several bundles in one go.
  loaders.forEach((loader, i) => {
    idle(() => setTimeout(loader, i * 150));
  });
}

export function prefetchLandlordPortal() {
  prefetchAll(LANDLORD_ROUTES);
}

export function prefetchTenantPortal() {
  prefetchAll(TENANT_ROUTES);
}
