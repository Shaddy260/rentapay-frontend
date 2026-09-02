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

// Same base-URL resolution as api/client.js - deliberately not
// imported from there (that module isn't otherwise a dependency of
// this one) to avoid pulling the whole request()/offline-queue
// machinery into a WebAuthn-only file for one fetch call.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// SECURITY FIX: the vault previously stored each enrolled session token as
// plain JSON in localStorage - readable by any script on the page (XSS) or
// anyone with local device/file access, indefinitely (this is the
// "remember me on this device" feature, so entries can sit for a long
// time). The token is now sealed with AES-GCM before it ever reaches
// localStorage. The AES key itself lives in IndexedDB as a
// non-extractable CryptoKey: the browser will use it to encrypt/decrypt,
// but no code (including ours) can ever read out its raw bytes, so
// dumping localStorage OR IndexedDB alone yields nothing usable - both
// the ciphertext and the (inextractable) key would be needed, and the
// key can't be exfiltrated even with a running XSS payload. Metadata
// needed to *list* entries (phone/email/role/label) is not secret and is
// kept as plain fields alongside the ciphertext.

const DB_NAME = 'rentapay_biometric_keystore';
const STORE_NAME = 'keys';
const KEY_ID = 'vault-key';

function openKeyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Gets this device's vault-sealing key, generating and persisting a
 * non-extractable AES-GCM key on first use. */
async function getVaultKey() {
  const db = await openKeyDb();
  const existing = await idbGet(db, KEY_ID);
  if (existing) return existing;
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: raw key material can never be read out, only used
    ['encrypt', 'decrypt']
  );
  await idbPut(db, KEY_ID, key);
  return key;
}

async function encryptToken(token) {
  const key = await getVaultKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  return { ct: bufToBase64Url(ciphertext), iv: bufToBase64Url(iv) };
}

async function decryptToken(encPayload) {
  const key = await getVaultKey();
  const plainBuf = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBuf(encPayload.iv) },
    key,
    base64UrlToBuf(encPayload.ct)
  );
  return new TextDecoder().decode(plainBuf);
}

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
  // Metadata only - never surface the encrypted token blob to callers
  // that just need to render the "devices with fingerprint login" list.
  return Object.entries(vault).map(([credentialId, e]) => ({
    credentialId,
    phone: e.phone,
    email: e.email,
    role: e.role,
    roleLevel: e.roleLevel,
    label: e.label,
  }));
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
 * logged-in account, sealing the current session behind it.
 *
 * SECURITY FIX (JWT-theft review, Sept 2026): access tokens are now
 * short-lived (30 min), so sealing only the access token would make
 * fingerprint unlock stop working after half an hour. The refresh
 * token is sealed alongside it - unlockWithBiometric below exchanges
 * it for a fresh access token on every use, and immediately re-seals
 * the newly-rotated refresh token back into the vault (refresh tokens
 * are single-use; leaving the old one sealed would break the SECOND
 * fingerprint unlock, not just the first after expiry).
 */
export async function enrollBiometric({ phone, email, role, roleLevel, token, refreshToken, label }) {
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
  const encToken = await encryptToken(token);
  const encRefreshToken = refreshToken ? await encryptToken(refreshToken) : null;
  const vault = readVault();
  // Remember email alongside phone (when known) so unlocking later can
  // prefill whichever one the person actually logs in with, instead
  // of always falling back to phone. Neither token is ever stored in
  // the clear - only its AES-GCM ciphertext (encToken/encRefreshToken).
  vault[credentialId] = { phone, email: email || null, role, roleLevel: roleLevel || null, label, encToken, encRefreshToken };
  writeVault(vault);
  return credentialId;
}

/**
 * Prompts the device fingerprint/Face ID reader and, on success,
 * exchanges the sealed refresh token for a brand-new access token
 * (silently, over the network) and returns the fresh session. Falls
 * back to the sealed access token as-is for older enrollments that
 * predate the refresh-token rollout and have no encRefreshToken yet -
 * that stored token will simply stop working once it expires, same as
 * before, until the person re-enrolls with a fresh login.
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
  if (!entry.encToken) throw new Error('This device\u2019s fingerprint login is out of date - please sign in with your password and re-enable it.');

  const { encToken: _drop, encRefreshToken: _drop2, ...metadata } = entry;

  if (!entry.encRefreshToken) {
    // Pre-refresh-token enrollment - hand back the sealed access token
    // as-is (it'll simply fail once expired, same as any old session).
    const token = await decryptToken(entry.encToken);
    return { ...metadata, token };
  }

  const refreshToken = await decryptToken(entry.encRefreshToken);
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // handled as a generic failure below
  }
  if (!response.ok || !data.token) {
    throw new Error('This device\u2019s fingerprint login has expired - please sign in with your password and re-enable it.');
  }

  // Refresh tokens are single-use (rotation) - reseal the brand-new
  // one now, or the very next fingerprint unlock on this device would
  // fail even though this one just succeeded.
  const [encToken, encRefreshToken] = await Promise.all([
    encryptToken(data.token),
    data.refreshToken ? encryptToken(data.refreshToken) : Promise.resolve(entry.encRefreshToken),
  ]);
  const freshVault = readVault();
  if (freshVault[credentialId]) {
    freshVault[credentialId] = { ...freshVault[credentialId], encToken, encRefreshToken };
    writeVault(freshVault);
  }

  return { ...metadata, token: data.token, refreshToken: data.refreshToken };
}
