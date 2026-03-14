import { createClient } from '@supabase/supabase-js'

// PASSWORD_RECOVERY detection — must run BEFORE createClient() which starts _initialize().
// The SDK fires PASSWORD_RECOVERY via setTimeout(fn, 0), before React mounts and registers
// its onAuthStateChange listener. We bridge this by setting a sessionStorage flag here,
// which AuthContext reads synchronously on mount.
//
// Password reset emails are sent using implicit flow (see AuthContext.resetPasswordForEmail),
// so the reset link carries #access_token=...&type=recovery in the hash — no PKCE verifier
// required. This makes the link work regardless of which browser the user opens it in.
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