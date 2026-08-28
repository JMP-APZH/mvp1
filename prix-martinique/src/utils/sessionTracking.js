import { supabase } from '../supabaseClient';
import { detectDevicePlatform, detectDisplayMode } from './deviceDetection';

const SESSION_LOGGED_KEY = 'app_session_logged';

// Fire-and-forget, once per browser-tab session (not per component mount/
// re-render -- StrictMode double-invokes effects in dev) -- feeds the admin
// dashboard's iOS-vs-Android and installed-app-vs-browser breakdowns.
// Never throws into the caller; a failed log shouldn't affect the app.
export async function logAppSessionOnce(userId) {
    if (sessionStorage.getItem(SESSION_LOGGED_KEY)) return;
    sessionStorage.setItem(SESSION_LOGGED_KEY, '1');

    try {
        const { error } = await supabase.from('app_sessions').insert([{
            user_id: userId || null,
            device_platform: detectDevicePlatform(),
            display_mode: detectDisplayMode(),
        }]);
        if (error) throw error;
    } catch (err) {
        console.error('Failed to log app session:', err);
    }
}
