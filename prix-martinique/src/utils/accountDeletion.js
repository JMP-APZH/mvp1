import { supabase } from '../supabaseClient';

// Records a deletion request only -- the actual anonymize-and-delete work
// happens server-side (see supabase/functions/delete-user-account), since
// deleting the auth.users row needs the service-role key. See
// deletion_requests_migration.sql for why this is still GDPR-compliant.
export async function requestAccountDeletion(user) {
    const { error } = await supabase.from('deletion_requests').insert([{
        user_id: user.id,
        user_email: user.email,
    }]);
    if (error) throw error;
}

// Most recent request only -- a user could in principle request again after
// a 'cancelled' one, so this isn't just "do they have any row at all".
export async function getMyDeletionRequest(userId) {
    const { data, error } = await supabase
        .from('deletion_requests')
        .select('status, requested_at')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('Failed to fetch deletion request status:', error);
        return null;
    }
    return data;
}
