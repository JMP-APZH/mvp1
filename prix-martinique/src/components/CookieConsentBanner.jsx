import React, { useState } from 'react';
import { Cookie } from 'lucide-react';
import { posthog } from '../posthogClient';

const CONSENT_CHOICE_KEY = 'pm_cookie_consent_choice'; // 'accepted' | 'declined'

// GDPR consent gate for PostHog: posthog.init() (see posthogClient.js) sets
// opt_out_capturing_by_default, so nothing is captured -- autocapture,
// identify(), exception tracking -- until the user opts in here.
//
// posthog-js's has_opted_out_capturing() can't be used to detect "has this
// user been asked yet": it returns true both for an explicit decline AND for
// the opt_out_capturing_by_default state itself, so it reads true from the
// very first page load before anyone has made a choice -- which would hide
// this banner permanently. Track whether a choice was actually made
// ourselves instead. Read as a lazy initializer (not an effect) since it's a
// synchronous localStorage read, not an external subscription.
const CookieConsentBanner = () => {
    const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_CHOICE_KEY));

    if (!visible) return null;

    const accept = () => {
        posthog.opt_in_capturing();
        localStorage.setItem(CONSENT_CHOICE_KEY, 'accepted');
        setVisible(false);
    };

    const decline = () => {
        posthog.opt_out_capturing();
        localStorage.setItem(CONSENT_CHOICE_KEY, 'declined');
        setVisible(false);
    };

    return (
        <div className="fixed bottom-0 inset-x-0 z-[520] bg-gray-900 text-white p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Cookie className="w-6 h-6 flex-shrink-0 text-orange-400" />
                <p className="text-sm text-gray-200 flex-1">
                    Nous utilisons des statistiques de mesure d'audience (anonymisées, hébergées
                    dans l'UE) pour améliorer l'application. Vous pouvez accepter ou refuser.
                </p>
                <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                        onClick={decline}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                        Refuser
                    </button>
                    <button
                        onClick={accept}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold bg-orange-500 hover:bg-orange-600 transition-colors"
                    >
                        Accepter
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsentBanner;
