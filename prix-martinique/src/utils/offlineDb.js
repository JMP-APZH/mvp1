import { openDB } from 'idb';

const DB_NAME = 'prix-martinique-offline';
const DB_VERSION = 1;

const STORE_PENDING_PRICES = 'pending_price_submissions';
const STORE_PENDING_CART_OPS = 'pending_cart_ops';
const STORE_CACHED_STORES = 'cached_stores';
const STORE_CACHED_CATEGORIES = 'cached_categories';

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

export async function getPendingCounts() {
    const [prices, cartOps] = await Promise.all([
        listPendingPriceSubmissions(),
        listPendingCartOps(),
    ]);
    return { prices: prices.length, cartOps: cartOps.length, total: prices.length + cartOps.length };
}
