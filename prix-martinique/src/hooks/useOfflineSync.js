import { useState, useEffect, useRef, useCallback } from 'react';
import { syncPendingPriceSubmissions, syncPendingCartOps } from '../utils/syncQueue';
import { getPendingCounts } from '../utils/offlineDb';

const POLL_INTERVAL_MS = 4000;

// Orchestrates both offline queues (price submissions + cart ops): tracks pending
// count, and drains both on reconnect / app-foreground / manual trigger. Sync is
// entirely foreground-triggered (online event, visibilitychange, manual button) --
// deliberately NOT using the Background Sync API, which iOS Safari doesn't support
// and this app must work there.
//
// Takes `isOnline`/`checkNow` from a single shared useOnlineStatus() call in the
// caller (App10.jsx) rather than calling useOnlineStatus() itself -- this hook also
// needs useShoppingList's getOrCreatePrimaryList, and useShoppingList itself needs
// isOnline, so the shared instance is what breaks that circular dependency.
export function useOfflineSync({ isOnline, checkNow, supabase, awardPoints, user, userProfile, getOrCreatePrimaryList, onCartSynced }) {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    // Refs so syncNow always reads fresh values without needing to be recreated
    // every render (mirrors the userRef/listIdRef convention in useShoppingList.js).
    const awardPointsRef = useRef(awardPoints);
    const userRef = useRef(user);
    const userProfileRef = useRef(userProfile);
    const getOrCreatePrimaryListRef = useRef(getOrCreatePrimaryList);
    const onCartSyncedRef = useRef(onCartSynced);

    useEffect(() => { awardPointsRef.current = awardPoints; }, [awardPoints]);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);
    useEffect(() => { getOrCreatePrimaryListRef.current = getOrCreatePrimaryList; }, [getOrCreatePrimaryList]);
    useEffect(() => { onCartSyncedRef.current = onCartSynced; }, [onCartSynced]);

    const refreshPendingCount = useCallback(async () => {
        const counts = await getPendingCounts();
        setPendingCount(counts.total);
    }, []);

    const syncNow = useCallback(async () => {
        if (isSyncingRef.current) return;
        const reachable = await checkNow();
        if (!reachable) return;

        isSyncingRef.current = true;
        setIsSyncing(true);
        try {
            await syncPendingPriceSubmissions({
                supabase,
                awardPoints: awardPointsRef.current,
                user: userRef.current,
                userProfile: userProfileRef.current,
            });

            if (getOrCreatePrimaryListRef.current) {
                const cartSynced = await syncPendingCartOps({
                    supabase,
                    getOrCreatePrimaryList: getOrCreatePrimaryListRef.current,
                });
                if (cartSynced > 0 && onCartSyncedRef.current) {
                    onCartSyncedRef.current();
                }
            }
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
            refreshPendingCount();
        }
    }, [checkNow, supabase, refreshPendingCount]);

    useEffect(() => {
        refreshPendingCount();
    }, [refreshPendingCount]);

    useEffect(() => {
        if (isOnline) syncNow();
    }, [isOnline, syncNow]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') syncNow();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [syncNow]);

    useEffect(() => {
        const interval = setInterval(refreshPendingCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [refreshPendingCount]);

    return { isOnline, pendingCount, isSyncing, syncNow };
}
