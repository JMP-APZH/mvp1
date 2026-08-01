import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

// Persistent bar, not a toast -- unlike a toast this must stay visible for as
// long as the condition holds, since disappearing on its own would hide the
// one visible sign that a submission is only queued, not actually sent yet.
const OfflineBanner = ({ isOnline, pendingCount, isSyncing, onSyncNow }) => {
    if (isOnline && pendingCount === 0) return null;

    return (
        <div
            className={`sticky top-0 z-[250] flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white ${
                isOnline ? 'bg-orange-500' : 'bg-gray-700'
            }`}
        >
            {!isOnline ? (
                <>
                    <WifiOff className="w-4 h-4 shrink-0" />
                    <span>
                        Hors ligne — vos scans et modifications du panier sont enregistrés et seront envoyés automatiquement
                        {pendingCount > 0 ? ` (${pendingCount} en attente)` : ''}.
                    </span>
                </>
            ) : (
                <>
                    <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{pendingCount} élément(s) en attente d'envoi.</span>
                    <button
                        onClick={onSyncNow}
                        disabled={isSyncing}
                        className="ml-2 underline underline-offset-2 disabled:opacity-60"
                    >
                        {isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
                    </button>
                </>
            )}
        </div>
    );
};

export default OfflineBanner;
