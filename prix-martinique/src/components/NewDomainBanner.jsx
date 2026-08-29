import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const DISMISSED_KEY = 'pm_new_domain_notice_dismissed';
const NEW_DOMAIN = 'prix-martinique.org';

// Shown only on the temporary *.vercel.app origin -- once that domain is set
// to redirect to the custom domain in Vercel's project settings, ordinary
// browser visits get redirected server-side before this ever renders. This
// banner exists specifically for installed-PWA users: their home-screen icon
// keeps pointing at the old origin, and a cache-first service worker can
// serve the cached app shell straight from cache without ever hitting the
// network -- so without ever seeing that redirect either.
const NewDomainBanner = () => {
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1');

    const isOldOrigin = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

    if (dismissed || !isOldOrigin) return null;

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, '1');
        setDismissed(true);
    };

    return (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm flex-1">
                Prix Martinique a une nouvelle adresse officielle :{' '}
                <a href={`https://${NEW_DOMAIN}`} className="font-bold underline">
                    {NEW_DOMAIN}
                </a>
                . Réinstallez l'app depuis cette adresse pour une expérience à jour !
            </p>
            <button
                onClick={handleDismiss}
                aria-label="Fermer"
                className="p-1 flex-shrink-0 hover:bg-white/20 rounded-full transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default NewDomainBanner;
