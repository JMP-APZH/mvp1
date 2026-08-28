import { openDB } from 'idb';

const DB_NAME = 'prix-martinique-offline';
const DB_VERSION = 2;

const STORE_PENDING_PRICES = 'pending_price_submissions';
const STORE_PENDING_CART_OPS = 'pending_cart_ops';
const STORE_CACHED_STORES = 'cached_stores';
const STORE_CACHED_CATEGORIES = 'cached_categories';
const STORE_PENDING_AUTH_SUBMISSION = 'pending_auth_submission';

let dbPromise = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
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
        });
    }
    return dbPromise;
}

function makeLocalId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Pending price submissions ----

export async function enqueuePriceSubmission(payload) {
    const db = await getDb();
    const entry = {
        localId: makeLocalId(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        lastError: null,
        payload,
    };
    await db.put(STORE_PENDING_PRICES, entry);
    return entry;
}

export async function listPendingPriceSubmissions() {
    const db = await getDb();
    const all = await db.getAll(STORE_PENDING_PRICES);
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updatePriceSubmission(localId, changes) {
    const db = await getDb();
    const existing = await db.get(STORE_PENDING_PRICES, localId);
    if (!existing) return;
    await db.put(STORE_PENDING_PRICES, { ...existing, ...changes });
}

export async function deletePriceSubmission(localId) {
    const db = await getDb();
    await db.delete(STORE_PENDING_PRICES, localId);
}

// ---- Pending cart ops ----
// op: { type: 'add' | 'remove' | 'update_quantity' | 'clear', productId, quantity, product }

export async function enqueueCartOp(op) {
    const db = await getDb();
    const entry = {
        localId: makeLocalId(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        lastError: null,
        op,
    };
    await db.put(STORE_PENDING_CART_OPS, entry);
    return entry;
}

export async function listPendingCartOps() {
    const db = await getDb();
    const all = await db.getAll(STORE_PENDING_CART_OPS);
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateCartOp(localId, changes) {
    const db = await getDb();
    const existing = await db.get(STORE_PENDING_CART_OPS, localId);
    if (!existing) return;
    await db.put(STORE_PENDING_CART_OPS, { ...existing, ...changes });
}

export async function deleteCartOp(localId) {
    const db = await getDb();
    await db.delete(STORE_PENDING_CART_OPS, localId);
}

// ---- Read-side caches (stores / categories) ----
// Wholesale-replaced on every successful online load -- small tables, no incremental diffing needed.

export async function cacheStores(stores) {
    const db = await getDb();
    const tx = db.transaction(STORE_CACHED_STORES, 'readwrite');
    await tx.store.clear();
    await Promise.all((stores || []).map((s) => tx.store.put(s)));
    await tx.done;
}

export async function getCachedStores() {
    const db = await getDb();
    return db.getAll(STORE_CACHED_STORES);
}

export async function cacheCategories(categories) {
    const db = await getDb();
    const tx = db.transaction(STORE_CACHED_CATEGORIES, 'readwrite');
    await tx.store.clear();
    await Promise.all((categories || []).map((c) => tx.store.put(c)));
    await tx.done;
}

export async function getCachedCategories() {
    const db = await getDb();
    return db.getAll(STORE_CACHED_CATEGORIES);
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
    const db = await getDb();
    await db.put(STORE_PENDING_AUTH_SUBMISSION, { key: PENDING_AUTH_SUBMISSION_KEY, manualEntry });
}

export async function getPendingAuthSubmission() {
    const db = await getDb();
    const entry = await db.get(STORE_PENDING_AUTH_SUBMISSION, PENDING_AUTH_SUBMISSION_KEY);
    return entry?.manualEntry || null;
}

export async function clearPendingAuthSubmission() {
    const db = await getDb();
    await db.delete(STORE_PENDING_AUTH_SUBMISSION, PENDING_AUTH_SUBMISSION_KEY);
}

export async function getPendingCounts() {
    const [prices, cartOps] = await Promise.all([
        listPendingPriceSubmissions(),
        listPendingCartOps(),
    ]);
    return { prices: prices.length, cartOps: cartOps.length, total: prices.length + cartOps.length };
}
