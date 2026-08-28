// FIX (direct request: "the system should remember the last apartment
// a user was at and during the next login should take them there even
// if the apartment's subscription has expired"): Dashboard.jsx already
// remembers the active property WITHIN a single session (sessionStorage
// 'rentapay_active_property_id'), and already re-opens that property
// even if it has since expired - see load()'s propertyId handling.
// The gap was that Login.jsx explicitly cleared that key on every
// fresh login, so the memory never survived logging out and back in.
//
// This mirrors the same value into localStorage, namespaced to the
// account (phone or email) rather than the device, so a shared device
// with multiple accounts logging in and out doesn't leak one person's
// last-viewed apartment into another's session.
const PREFIX = 'rentapay_last_property_';

function keyFor(identifier) {
  return identifier ? `${PREFIX}${identifier}` : null;
}

export function rememberActiveProperty(identifier, propertyId) {
  const key = keyFor(identifier);
  if (!key) return;
  try {
    if (propertyId) localStorage.setItem(key, propertyId);
    else localStorage.removeItem(key);
  } catch {
    // localStorage unavailable (private browsing etc.) - this is a
    // convenience, not a hard requirement, so fail silently.
  }
}

export function getRememberedActiveProperty(identifier) {
  const key = keyFor(identifier);
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
