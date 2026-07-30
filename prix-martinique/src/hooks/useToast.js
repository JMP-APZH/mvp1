import { useState, useCallback, useMemo } from 'react';

let nextId = 0;

export function useToast() {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++nextId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }, []);

    // Memoized so callers can safely list `toast` in a useCallback/useEffect
    // dependency array without it changing identity every render -- an
    // unmemoized object literal here previously caused an infinite
    // fetch loop in App10.jsx (loadStores/loadRecentPrices depended on
    // `toast`, which was a new object every render).
    const toast = useMemo(() => ({
        success: (msg) => addToast(msg, 'success'),
        error:   (msg) => addToast(msg, 'error', 5000),
        info:    (msg) => addToast(msg, 'info'),
    }), [addToast]);

    return { toasts, toast };
}
