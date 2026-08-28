// src/utils/deviceTrust.js
//
// "Remember this device" for optional/mandatory 2FA (direct request:
// avoid re-typing a TOTP code every login on the same phone that
// already proved it has the authenticator app). The backend issues a
// narrowly-scoped device-trust token (see signDeviceTrustToken in
// auth.middleware.js) after a successful TOTP verification IF the
// person checked "remember this device"; this file just stores/reads/
// clears that token per account type so login() can send it back and
// skip the code prompt when it's still valid.
//
// Deliberately keyed per accountType (not one shared key) since the
// same browser/phone can be used to log into more than one RentaPay
// role (e.g. a landlord who is also a tenant elsewhere).

function storageKey(accountType) {
  return `rentapay_device_trust_${accountType}`;
}

export function getDeviceTrustToken(accountType) {
  if (!accountType) return null;
  try {
    return localStorage.getItem(storageKey(accountType)) || null;
  } catch {
    return null;
  }
}

export function setDeviceTrustToken(accountType, token) {
  if (!accountType || !token) return;
  try {
    localStorage.setItem(storageKey(accountType), token);
  } catch {
    // localStorage unavailable (private browsing etc.) - remembering
    // the device is a convenience, not a hard requirement.
  }
}

// Every role that can have a stored device-trust token. Used when the
// frontend doesn't yet know which role it's logging in as (e.g. the
// account-picker flow / first login attempt) - it just sends whatever
// it's holding and lets the backend match the right one.
const KNOWN_ACCOUNT_TYPES = ['landlord', 'tenant', 'manager', 'brand_ambassador', 'admin', 'general_manager'];

export function getAllDeviceTrustTokens() {
  return KNOWN_ACCOUNT_TYPES.map(getDeviceTrustToken).filter(Boolean);
}

export function clearDeviceTrustToken(accountType) {
  if (!accountType) return;
  try {
    localStorage.removeItem(storageKey(accountType));
  } catch {
    // non-fatal
  }
}
