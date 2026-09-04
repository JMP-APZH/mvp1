import { openDB } from 'idb';
import { posthog } from '../posthogClient';

const DB_NAME = 'prix-martinique-offline';
const DB_VERSION = 2;

const STORE_PENDING_PRICES = 'pending_price_submissions';
const STORE_PENDING_CART_OPS = 'pending_cart_ops';
const STORE_CACHED_STORES = 'cached_stores';
const STORE_CACHED_CATEGORIES = 'cached_categories';
const STORE_PENDING_AUTH_SUBMISSION = 'pending_auth_submission';

// iOS Safari tears the IndexedDB connection down on its own (PWA backgrounding,
// low-memory, Private Browsing) and then throws on the next transaction:
//   InvalidStateError: ... 'transaction' on 'IDBDatabase': the database
//   connection is closing.
//   UnknownError: An internal error was encountered in the Indexed Database server
// Seen in production (12 exceptions, 1 session, Mobile Safari). The old code
// cached the dead connection forever and every subsequent offline-cache read/
// write threw up to the caller. Now: a failed op drops the cached connection,
// reopens once, and — if it still can't — degrades gracefully (reads return an
// empty fallback; only genuinely data-losing writes rethrow).

const IDB_AVAILABLE = (() => {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
        // Some embedded webviews / locked-down Safari throw on merely touching it.
        return false;
    }
})();

let dbPromise = null;
let idbFailureReported = false;

function reportIdbFailure(err, op) {
    console.warn(`[offlineDb] ${op} failed — offline layer degraded (${err?.name || err})`);
    if (!idbFailureReported) {
        idbFailureReported = true; // one signal per session, not one per call
        try {
            posthog.captureException(err, { context: 'offline_db', op });
        } catch { /* posthog not ready — ignore */ }
    }
}

function openFresh() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_PENDING_PRICES)) {
                db.createObjectStore(STORE_PENDING_PRICES, { keyPath: 'localId' });
            }
            if (!db.objectStoreNames.contains(STORE_PENDING_CART_OPS)) {
                db.createObjectStore(STORE_PENDING_CART_OPS, { keyPath: 'localId' });
            }
            if (!db.objectStoreNames.contains(STORE_CACHED_STORES)) {
                db.createObjectStore(STORE_CACHED_STORES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_CACHED_CATEGORIES)) {
                db.createObjectStore(STORE_CACHED_CATEGORIES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PENDING_AUTH_SUBMISSION)) {
                db.createObjectStore(STORE_PENDING_AUTH_SUBMISSION, { keyPath: 'key' });
            }
        },
        terminated() {
            // Browser abnormally closed the connection — force a reopen next time.
            dbPromise = null;
        },
    });
}

function getDb() {
    if (!IDB_AVAILABLE) return Promise.reject(new Error('IndexedDB unavailable'));
    if (!dbPromise) {
        dbPromise = openFresh().catch((err) => {
            dbPromise = null;
            throw err;
        });
    }
    return dbPromise;
}

// Run one IndexedDB operation. On a connection-teardown error, drop the cached
// connection and retry once. If it still fails: report once, then rethrow when
// `critical` (a real price/photo would be lost) or return `fallback` otherwise.
async function runOp(op, fn, { fallback, critical = false } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            return await fn(await getDb());
        } catch (err) {
            if (attempt === 0) {
                dbPromise = null; // force a fresh connection on the retry
                continue;
            }
            reportIdbFailure(err, op);
            if (critical) throw err;
            return fallback;
        }
    }
    return fallback;
}

function makeLocalId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Pending price submissions ----

export async function enqueuePriceSubmission(payload) {
    const entry = {
        localId: makeLocalId(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        lastError: null,
        payload,
    };
    // critical: dropping this loses a user's price + photos. Let the caller
    // handle a hard failure (it can surface "sauvegarde impossible" to the user).
    return runOp('enqueuePriceSubmission', async (db) => {
        await db.put(STORE_PENDING_PRICES, entry);
        return entry;
    }, { critical: true });
}

export async function listPendingPriceSubmissions() {
    return runOp('listPendingPriceSubmissions', async (db) => {
        const all = await db.getAll(STORE_PENDING_PRICES);
        return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, { fallback: [] });
}

export async function updatePriceSubmission(localId, changes) {
    return runOp('updatePriceSubmission', async (db) => {
        const existing = await db.get(STORE_PENDING_PRICES, localId);
        if (!existing) return;
        await db.put(STORE_PENDING_PRICES, { ...existing, ...changes });
    }, { fallback: undefined });
}

export async function deletePriceSubmission(localId) {
    return runOp('deletePriceSubmission', (db) => db.delete(STORE_PENDING_PRICES, localId), { fallback: undefined });
}

// ---- Pending cart ops ----
// op: { type: 'add' | 'remove' | 'update_quantity' | 'clear', productId, quantity, product }

export async function enqueueCartOp(op) {
    const entry = {
        localId: makeLocalId(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        lastError: null,
        op,
    };
    return runOp('enqueueCartOp', async (db) => {
        await db.put(STORE_PENDING_CART_OPS, entry);
        return entry;
    }, { fallback: null });
}

export async function listPendingCartOps() {
    return runOp('listPendingCartOps', async (db) => {
        const all = await db.getAll(STORE_PENDING_CART_OPS);
        return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, { fallback: [] });
}

export async function updateCartOp(localId, changes) {
    return runOp('updateCartOp', async (db) => {
        const existing = await db.get(STORE_PENDING_CART_OPS, localId);
        if (!existing) return;
        await db.put(STORE_PENDING_CART_OPS, { ...existing, ...changes });
    }, { fallback: undefined });
}

export async function deleteCartOp(localId) {
    return runOp('deleteCartOp', (db) => db.delete(STORE_PENDING_CART_OPS, localId), { fallback: undefined });
}

// ---- Read-side caches (stores / categories) ----
// Wholesale-replaced on every successful online load -- small tables, no incremental diffing needed.

export async function cacheStores(stores) {
    return runOp('cacheStores', async (db) => {
        const tx = db.transaction(STORE_CACHED_STORES, 'readwrite');
        await tx.store.clear();
        await Promise.all((stores || []).map((s) => tx.store.put(s)));
        await tx.done;
    }, { fallback: undefined });
}

export async function getCachedStores() {
    return runOp('getCachedStores', (db) => db.getAll(STORE_CACHED_STORES), { fallback: [] });
}

export async function cacheCategories(categories) {
    return runOp('cacheCategories', async (db) => {
        const tx = db.transaction(STORE_CACHED_CATEGORIES, 'readwrite');
        await tx.store.clear();
        await Promise.all((categories || []).map((c) => tx.store.put(c)));
        await tx.done;
    }, { fallback: undefined });
}

export async function getCachedCategories() {
    return runOp('getCachedCategories', (db) => db.getAll(STORE_CACHED_CATEGORIES), { fallback: [] });
}

// ---- Pending submission waiting on sign-in ----
// Distinct from the offline price-submission queue above: this is for "the
// user isn't logged in yet", not "there's no network" -- kept in its own store
// so the offline-sync drainer (which only knows how to retry actual queued
// *submissions*, not raw form state) never touches it. Uses IndexedDB rather
// than sessionStorage specifically because a full-size camera photo as base64
// can exceed sessionStorage's much smaller per-origin quota -- confirmed live,
// Aug 28, 2026: a real submission on iOS Safari silently lost both its photos
// this way (sessionStorage.setItem hit its quota, the fallback dropped the
// photos rather than losing the whole submission, and nothing told the user).
// IndexedDB has no such practical limit for a single price submission's worth
// of photos.

const PENDING_AUTH_SUBMISSION_KEY = 'current';

export async function savePendingAuthSubmission(manualEntry) {
    // critical: this is the user's in-flight submission held across a sign-in
    // redirect. If it can't be saved the caller should keep the form state.
    return runOp('savePendingAuthSubmission', (db) =>
        db.put(STORE_PENDING_AUTH_SUBMISSION, { key: PENDING_AUTH_SUBMISSION_KEY, manualEntry }),
        { critical: true });
}

export async function getPendingAuthSubmission() {
    return runOp('getPendingAuthSubmission', async (db) => {
        const entry = await db.get(STORE_PENDING_AUTH_SUBMISSION, PENDING_AUTH_SUBMISSION_KEY);
        return entry?.manualEntry || null;
    }, { fallback: null });
}

export async function clearPendingAuthSubmission() {
    return runOp('clearPendingAuthSubmission', (db) =>
        db.delete(STORE_PENDING_AUTH_SUBMISSION, PENDING_AUTH_SUBMISSION_KEY), { fallback: undefined });
}

export async function getPendingCounts() {
    const [prices, cartOps] = await Promise.all([
        listPendingPriceSubmissions(),
        listPendingCartOps(),
    ]);
    return { prices: prices.length, cartOps: cartOps.length, total: prices.length + cartOps.length };
}
