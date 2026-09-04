// Shared helpers for transient network failures.
//
// Real production funnel data (Sept 2026): a single `load_stores`
// "TypeError: Load failed" on Mobile Safari left one user staring at an empty
// store picker with no way forward -- the first step of the contribution flow,
// dead on a transient hiccup. A network error is not a bug worth an exception
// report either; it just needs a retry and, failing that, a visible "réessayer".

// supabase-js / the browser surface a dropped or refused request as a bare
// TypeError ("Load failed" on Safari, "Failed to fetch" on Chrome/Firefox),
// never a structured PostgREST error.
export function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('timeout')
  );
}

// Run `fn`, retrying on a thrown error up to `retries` times with exponential
// backoff (default 400ms, 800ms). `shouldRetry` gates which errors are worth a
// retry -- defaults to network-class only, so a real 4xx fails fast.
export async function retryAsync(fn, { retries = 2, baseDelayMs = 400, shouldRetry = isNetworkError } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
