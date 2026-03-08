import { createClient } from '@supabase/supabase-js'

// PASSWORD_RECOVERY detection — must run BEFORE createClient() which starts _initialize()
// and will consume (delete) the code verifier from localStorage during the PKCE exchange.

// --- Diagnostic (temporary) ---
// Store URL details in sessionStorage so the UI can surface them if recovery fails.
sessionStorage.setItem('_dbg_url_search', window.location.search);
sessionStorage.setItem('_dbg_url_hash', window.location.hash.slice(0, 60));
const _dbgVerifiers = [];
for (let i = 0; i < localStorage.length; i++) {
  const k = localStorage.key(i);
  if (k?.endsWith('-code-verifier')) _dbgVerifiers.push(`${k}=${localStorage.getItem(k)?.slice(-20)}`);
}
sessionStorage.setItem('_dbg_verifiers', JSON.stringify(_dbgVerifiers));
// --- End diagnostic ---

// PKCE flow (project-enforced): when the user clicks the reset link (?code=XXX),
// the verifier stored by resetPasswordForEmail has the format "<verifier>/PASSWORD_RECOVERY".
// We read it here before _initialize() removes it, then bridge via sessionStorage.
if (new URLSearchParams(window.location.search).has('code')) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.endsWith('-code-verifier') &&
        localStorage.getItem(key)?.includes('/PASSWORD_RECOVERY')) {
      sessionStorage.setItem('supabase_recovery_pending', '1');
      break;
    }
  }
}
// Implicit flow fallback: hash-based tokens include type=recovery directly.
if (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
  sessionStorage.setItem('supabase_recovery_pending', '1');
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// flowType: 'pkce' must match the Supabase project's server-side auth setting.
// Without this, resetPasswordForEmail() does not store a code verifier, so the
// server's PKCE-format reset link (?code=XXX) cannot be exchanged and is silently ignored.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
})