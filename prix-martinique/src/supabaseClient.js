import { createClient } from '@supabase/supabase-js'

// PASSWORD_RECOVERY race condition fix:
// Supabase's _initialize() fires the PASSWORD_RECOVERY event via setTimeout(0) during module
// load — before React's useEffect can register an onAuthStateChange listener. It also clears
// the URL hash immediately after. We capture the recovery type here, before createClient()
// runs, and bridge it to AuthContext via sessionStorage.
const _hashParams = new URLSearchParams(window.location.hash.slice(1));
if (_hashParams.get('type') === 'recovery') {
  sessionStorage.setItem('supabase_recovery_pending', '1');
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)