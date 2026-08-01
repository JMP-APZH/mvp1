import { performPriceSubmission } from './priceSubmission';
import { applyCartOp } from './cartOps';
import { posthog } from '../posthogClient';
import {
    listPendingPriceSubmissions,
    updatePriceSubmission,
    deletePriceSubmission,
    listPendingCartOps,
    updateCartOp,
    deleteCartOp,
} from './offlineDb';

const MAX_RETRIES = 5;

// Drains one queue at a time, FIFO, one item at a time -- deliberately not
// parallel, to avoid hammering a connection that may have *just* recovered.
export async function syncPendingPriceSubmissions({ supabase, awardPoints, user, userProfile }) {
    const pending = await listPendingPriceSubmissions();
    let synced = 0;

    for (const item of pending) {
        try {
            await updatePriceSubmission(item.localId, { status: 'syncing' });
            await performPriceSubmission({
                supabase,
                awardPoints,
                user,
                userProfile,
                payload: { ...item.payload, queuedOffline: true },
            });
            await deletePriceSubmission(item.localId);
            synced++;
        } catch (err) {
            console.error('Offline price submission sync failed:', err);
            posthog.captureException(err, { context: 'sync_offline_price_submission' });
            const retryCount = (item.retryCount || 0) + 1;
            await updatePriceSubmission(item.localId, {
                status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
                retryCount,
                lastError: err.message || String(err),
            });
        }
    }

    return synced;
}

export async function syncPendingCartOps({ supabase, getOrCreatePrimaryList }) {
    const pending = await listPendingCartOps();
    if (pending.length === 0) return 0;

    let listId;
    try {
        listId = await getOrCreatePrimaryList();
    } catch (err) {
        // Can't resolve the target list without network -- leave everything
        // queued, try again on the next sync trigger.
        console.error('Could not resolve primary list for cart-op sync:', err);
        return 0;
    }

    let synced = 0;
    for (const item of pending) {
        try {
            await updateCartOp(item.localId, { status: 'syncing' });
            await applyCartOp(supabase, listId, item.op);
            await deleteCartOp(item.localId);
            synced++;
        } catch (err) {
            console.error('Offline cart op sync failed:', err);
            posthog.captureException(err, { context: 'sync_offline_cart_op' });
            const retryCount = (item.retryCount || 0) + 1;
            await updateCartOp(item.localId, {
                status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
                retryCount,
                lastError: err.message || String(err),
            });
        }
    }

    return synced;
}
