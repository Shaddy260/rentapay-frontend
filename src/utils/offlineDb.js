// src/utils/offlineDb.js
//
// Offline resilience for patchy connections (outside Nairobi's core,
// a lot of RentaPay's actual usage is on 3G/edge or spotty wifi).
// Two IndexedDB object stores:
//
//   apiCache    - last-known-good response for each GET endpoint, so a
//                 landlord/tenant who opens the app with no signal still
//                 sees their balances, units, messages, etc. (stale,
//                 clearly labeled) instead of a blank error screen.
//   actionQueue - mutating requests (payment confirmations, chat
//                 messages, maintenance requests, etc.) that failed
//                 because the network was down. They're persisted here
//                 and replayed automatically the moment connectivity
//                 returns, in the order they were made.
//
// Deliberately NOT caching app code/JS/HTML here - see sw.js and
// main.jsx for why deploys must always be instant. This module only
// ever touches API request/response data.

const DB_NAME = 'rentapay-offline';
const DB_VERSION = 1;
const CACHE_STORE = 'apiCache';
const QUEUE_STORE = 'actionQueue';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    // SSR / very old browser - degrade to "no offline support" rather than crash.
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE); // keyed by cache key (string)
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    // If IndexedDB is blocked/unavailable (private browsing on some
    // browsers, quota errors, etc.) just run without offline support
    // rather than breaking the whole app.
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

// ---------------------------------------------------------------------------
// Response cache (GET requests)
// ---------------------------------------------------------------------------

/** Build a stable cache key for a request. Token is included so two
 *  different logged-in users on the same device never see each
 *  other's cached data. */
export function cacheKeyFor(path, token) {
  return `${token ? token.slice(-12) : 'anon'}::${path}`;
}

export async function setCached(key, data) {
  const db = await openDb();
  if (!db) return;
  try {
    tx(db, CACHE_STORE, 'readwrite').put({ data, cachedAt: Date.now() }, key);
  } catch {
    // Best-effort only - never let caching break a successful request.
  }
}

export async function getCached(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = tx(db, CACHE_STORE, 'readonly').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Action queue (mutating requests made while offline)
// ---------------------------------------------------------------------------

const queueListeners = new Set();

/** Subscribe to queue-size changes (for the pending-sync badge). Returns an unsubscribe fn. */
export function onQueueChange(listener) {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

async function notifyQueueChange() {
  const items = await listQueuedActions();
  for (const listener of queueListeners) {
    try { listener(items); } catch { /* ignore listener errors */ }
  }
}

/**
 * Save a failed mutating request so it can be retried later.
 * `description` is a short human-readable label shown in the "pending sync" UI,
 * e.g. "Confirm KES 4,500 payment - Unit 3B".
 */
export async function enqueueAction({ path, method, body, token, description }) {
  const db = await openDb();
  if (!db) return null;
  const entry = { path, method, body: body ?? null, token, description: description || `${method} ${path}`, createdAt: Date.now() };
  const id = await new Promise((resolve) => {
    try {
      const req = tx(db, QUEUE_STORE, 'readwrite').add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  notifyQueueChange();
  return id;
}

export async function listQueuedActions() {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = tx(db, QUEUE_STORE, 'readonly').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function removeQueuedAction(id) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const req = tx(db, QUEUE_STORE, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  notifyQueueChange();
}

let flushing = false;

/**
 * Replay queued actions in the order they were created, stopping (not
 * discarding) at the first one that still fails - so a genuinely-still-
 * offline moment doesn't drop everything out of order, and a real
 * server-side rejection (e.g. someone else already confirmed that
 * payment) doesn't get silently retried forever.
 *
 * `sendFn` is injected by client.js to avoid a circular import - it's
 * the same low-level fetch used for normal requests.
 */
export async function flushQueuedActions(sendFn) {
  if (flushing) return;
  flushing = true;
  try {
    const items = await listQueuedActions();
    items.sort((a, b) => a.createdAt - b.createdAt);
    for (const item of items) {
      try {
        await sendFn(item);
        await removeQueuedAction(item.id);
      } catch (err) {
        // Network still down, or the server rejected it outright.
        // Either way, stop here - leave this and everything after it
        // queued rather than replaying out of order.
        if (err && err.kind === 'http') {
          // Server actively rejected it (not just unreachable) - this
          // one will never succeed as-is, so drop it and keep going
          // rather than blocking every action behind it forever.
          await removeQueuedAction(item.id);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

export async function queuedActionCount() {
  const items = await listQueuedActions();
  return items.length;
}
