import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const PROBE_TIMEOUT_MS = 5000;
const PERIODIC_PROBE_MS = 30000;

// navigator.onLine only reflects whether the network interface is up, not whether
// the internet is actually reachable (e.g. connected to a store's WiFi with no
// real route out). A real reachability probe against Supabase is what matters here.
async function probeReachability() {
    if (!navigator.onLine) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const { error } = await supabase
            .from('stores')
            .select('id', { head: true, count: 'exact' })
            .limit(1)
            .abortSignal(controller.signal);
        return !error;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const checkingRef = useRef(false);
    const isOnlineRef = useRef(navigator.onLine);

    useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

    const checkNow = useCallback(async () => {
        if (checkingRef.current) return isOnlineRef.current;
        checkingRef.current = true;
        try {
            const reachable = await probeReachability();
            setIsOnline(reachable);
            return reachable;
        } finally {
            checkingRef.current = false;
        }
    }, []);

    useEffect(() => {
        checkNow();

        const handleOnline = () => checkNow();
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') checkNow();
        }, PERIODIC_PROBE_MS);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') checkNow();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, [checkNow]);

    return { isOnline, checkNow };
}
