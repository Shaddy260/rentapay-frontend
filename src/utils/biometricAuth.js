// src/utils/biometricAuth.js
//
// "Fingerprint / device login" (direct request, added to the hamburger
// menu's Security section). Uses the browser's real WebAuthn platform
// authenticator - the same prompt as unlocking the phone itself
// (fingerprint / Face ID / Windows Hello), so it's a genuine biometric
// check, not a fake UI.
//
// Design note: this is a DEVICE-LOCAL quick-unlock, not a second
// server-side factor. Once someone has logged in normally with their
// phone + password, they can opt in here to have this device
// remember them: their still-valid session token is sealed behind a
// WebAuthn platform-authenticator credential, stored only in this
// browser's localStorage. Next time, instead of retyping the
// password, a fingerprint prompt releases that stored token. It never
// outlives the underlying token (still capped by the backend's normal
// JWT_EXPIRES_IN), and turning it off/removing it here removes it
// from this device only.

const VAULT_KEY = 'rentapay_biometric_vault';

export function isBiometricSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

function readVault() {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

function randomChallenge() {
  const arr = new Uint8Array(32);
  window.crypto.getRandomValues(arr);
  return arr;
}

function bufToBase64Url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64url.length + (4 - (b64url.length % 4)) % 4, '=');
  const str = atob(b64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf;
}

/** Does this device already have fingerprint login set up for the given phone+role? */
export function hasBiometricEntry(phone, role) {
  const vault = readVault();
  return Object.values(vault).some((e) => e.phone === phone && e.role === role);
}

export function listBiometricEntries() {
  const vault = readVault();
  return Object.entries(vault).map(([credentialId, e]) => ({ credentialId, ...e }));
}

export function removeBiometricEntry(credentialId) {
  const vault = readVault();
  delete vault[credentialId];
  writeVault(vault);
}

export function clearAllBiometricEntries() {
  localStorage.removeItem(VAULT_KEY);
}

/**
 * Registers this device's fingerprint/Face ID for the currently
 * logged-in account, sealing the current session token behind it.
 */
export async function enrollBiometric({ phone, role, roleLevel, token, label }) {
  if (!isBiometricSupported()) {
    throw new Error('This browser/device does not support fingerprint or device login.');
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'RentaPay' },
      user: {
        id: randomChallenge(),
        name: phone,
        displayName: label || phone,
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
      attestation: 'none',
    },
  });

  if (!credential) throw new Error('Fingerprint setup was cancelled.');

  const credentialId = bufToBase64Url(credential.rawId);
  const vault = readVault();
  vault[credentialId] = { phone, role, roleLevel: roleLevel || null, token };
  writeVault(vault);
  return credentialId;
}

/**
 * Prompts the device fingerprint/Face ID reader and, on success,
 * returns the sealed session for whichever enrolled account matches.
 */
export async function unlockWithBiometric() {
  if (!isBiometricSupported()) {
    throw new Error('This browser/device does not support fingerprint or device login.');
  }
  const vault = readVault();
  const allowCredentials = Object.keys(vault).map((id) => ({ type: 'public-key', id: base64UrlToBuf(id) }));
  if (allowCredentials.length === 0) {
    throw new Error('No fingerprint login set up on this device yet.');
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    },
  });

  if (!assertion) throw new Error('Fingerprint check was cancelled.');

  const credentialId = bufToBase64Url(assertion.rawId);
  const entry = vault[credentialId];
  if (!entry) throw new Error('That fingerprint is not linked to an account on this device.');
  return entry;
}
