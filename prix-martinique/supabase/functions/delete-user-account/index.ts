import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Admin-only: anonymizes a user's price contributions, marks their
// deletion_requests row completed, then deletes their auth account.
// Called from DeletionRequestsAdmin.jsx via supabase.functions.invoke().
//
// Deploy via the Supabase Dashboard (Edge Functions -> Deploy a new function
// -> name it "delete-user-account" -> paste this file), or via the CLI:
//   supabase link --project-ref euqqxictzvyszjzeejsz
//   supabase functions deploy delete-user-account
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every Edge Function's environment by Supabase -- no manual secret setup.

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Scoped to the CALLER's own JWT -- used only to identify who is calling
    // and confirm they're an admin. The actual writes below use adminClient
    // (service-role, bypasses RLS) instead, since this is exactly the
    // privileged operation the client-side app can never be trusted with.
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    }

    const { user_id: targetUserId, deletion_request_id: requestId } = await req.json();
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400 });
    }

    // 1. Anonymize contribution data -- prices stay (they're collective
    // market data, the whole point of the app), only the identity attached
    // to them is stripped. Everything else that references auth.users(id)
    // with ON DELETE CASCADE (favorites, shopping lists, badges, recipe
    // ideas, etc.) is cleaned up automatically by step 3 below.
    const { error: anonymizeError } = await adminClient
      .from('prices')
      .update({ user_id: null, user_name: 'Utilisateur supprimé' })
      .eq('user_id', targetUserId);
    if (anonymizeError) throw anonymizeError;

    // 2. Mark the request completed by its own id (not by user_id) since
    // step 3 below will null out this row's user_id via ON DELETE SET NULL.
    if (requestId) {
      const { error: statusError } = await adminClient
        .from('deletion_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: caller.id })
        .eq('id', requestId);
      if (statusError) throw statusError;
    }

    // 3. Delete the actual auth account -- the one step that genuinely
    // requires the service-role key.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-user-account error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500 });
  }
});
