// Best-effort device/platform detection for admin analytics only -- this is
// NOT used for any functional branching (camera constraints, scanner choice,
// etc. already have their own detection in scannerInit.js / scannerOptimizations.js).

export function detectDevicePlatform() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) && !window.MSStream) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'other';
}

// iOS Safari exposes navigator.standalone; every other standalone-capable
// browser (Chrome/Edge/Android) supports the display-mode media query instead.
export function detectDisplayMode() {
    if (window.navigator.standalone === true) return 'standalone';
    if (window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
    return 'browser';
}
