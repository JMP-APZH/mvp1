import React from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const STYLES = {
    success: { bar: 'border-l-4 border-green-500', icon: <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /> },
    error:   { bar: 'border-l-4 border-red-500',   icon: <XCircle   className="w-5 h-5 text-red-500   flex-shrink-0 mt-0.5" /> },
    info:    { bar: 'border-l-4 border-blue-500',  icon: <Info      className="w-5 h-5 text-blue-500  flex-shrink-0 mt-0.5" /> },
};

export const ToastContainer = ({ toasts }) => {
    if (!toasts.length) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
        >
            {toasts.map(t => {
                const s = STYLES[t.type] || STYLES.info;
                return (
                    <div
                        key={t.id}
                        className={`flex items-start gap-3 bg-white ${s.bar} rounded-lg shadow-xl p-3`}
                    >
                        {s.icon}
                        <p className="text-sm text-gray-800 leading-snug">{t.message}</p>
                    </div>
                );
            })}
        </div>
    );
};
