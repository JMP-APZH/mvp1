-- Migration: Account-deletion request tracking (GDPR Article 17)
--
-- Context: self-service instant deletion isn't possible from the client --
-- deleting the actual auth.users row requires supabase.auth.admin.deleteUser(),
-- which needs the service-role key, and that key can never ship to the
-- browser. Instead: the user requests deletion in-app (this table), an admin
-- reviews it in AdminDashboard.jsx and triggers the delete-user-account Edge
-- Function (supabase/functions/delete-user-account), which runs server-side
-- with the service-role key. GDPR only requires acting "without undue delay"
-- (max one month, extendable), not instant automation, so this is compliant.
--
-- user_id is ON DELETE SET NULL (not CASCADE) so this row -- the audit trail
-- of who requested what and when it was completed -- survives the actual
-- account deletion instead of disappearing with it. user_email is snapshotted
-- at request time for the same reason (auth.users.email won't exist anymore
-- once the account is gone).
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  completed_by uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists idx_deletion_requests_status on deletion_requests(status);

alter table deletion_requests enable row level security;

drop policy if exists "Users can request their own deletion" on deletion_requests;
create policy "Users can request their own deletion" on deletion_requests
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own deletion request" on deletion_requests;
create policy "Users can view their own deletion request" on deletion_requests
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view all deletion requests" on deletion_requests;
create policy "Admins can view all deletion requests" on deletion_requests
  for select using (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

-- Admins can cancel a request from the dashboard (status -> 'cancelled'); the
-- 'completed' transition itself is only ever written by the Edge Function
-- using the service-role key (which bypasses RLS entirely), not by an admin
-- update through this policy.
drop policy if exists "Admins can cancel deletion requests" on deletion_requests;
create policy "Admins can cancel deletion requests" on deletion_requests
  for update using (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );
