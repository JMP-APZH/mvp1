import posthog from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST

// If VITE_POSTHOG_KEY isn't inlined at build time, init() is skipped and the
// whole SDK silently no-ops. That's how deployed builds captured nothing for
// months (the vars were only in vercel.json's runtime `env`, not `build.env`).
// Warn loudly so a missing/misplaced env var is obvious in the console.
if (!posthogKey && import.meta.env.PROD) {
  console.warn('[posthog] VITE_POSTHOG_KEY is not set — analytics disabled for this build.')
}

if (posthogKey && !posthog.__loaded) {
  posthog.init(posthogKey, {
    api_host: posthogHost,

    // Cookieless, consent-exempt analytics.
    //
    // `cookieless_mode: 'always'` => posthog-js NEVER writes a cookie or touches
    // local/session storage. Visitors are counted server-side via an irreversible
    // rotating hash (team + daily salt + IP + user-agent + host); the salt is
    // discarded after processing and the IP is never stored on the event
    // (`anonymize_ips` is also enabled project-side). No persistent identifier
    // is set on the device, so under GDPR/ePrivacy this is aggregate audience
    // measurement that does not require a prior-consent banner. Disclosed in the
    // privacy policy (LegalModal.jsx, sections 2d + 6) instead.
    //
    // Requires "Cookieless server hash mode" = Stateful on the PostHog project
    // (Project Settings -> Web analytics). Changing it there without this flag,
    // or vice-versa, breaks ingestion.
    cookieless_mode: 'always',

    // No identify() / no person profiles: a stable distinct_id would itself be
    // personal data and cannot be stored cookielessly anyway. Every event is
    // anonymous and aggregate. AuthContext no longer calls posthog.identify().
    person_profiles: 'never',

    // Aggregate, anonymous error monitoring. Keep captureException payloads
    // PII-free (we only attach a `context` string + component stack).
    capture_exceptions: true,
  })
}

export { posthog }
