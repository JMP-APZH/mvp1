import posthog from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST

if (posthogKey && !posthog.__loaded) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: 'always', // anon_to_signup_converted needs a profile before identify() merges it
    capture_exceptions: true, // autocapture unhandled errors/rejections; catch blocks still need manual captureException
  })
}

export { posthog }
