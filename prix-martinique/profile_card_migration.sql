-- Migration: User profile card (first slice)
--
-- Adds the editable identity fields behind the new "Mon profil" modal
-- (ProfileEditModal.jsx) and the public-facing profile card (HunterDetailModal.jsx,
-- reachable via ?user=<id>):
--   * avatar_url        -- already SELECTed by HunterDetailModal.jsx / UserMenu.jsx
--                          but never had a write path or a guaranteed column;
--                          `add column if not exists` is a no-op if it was added
--                          ad hoc via the dashboard earlier (like total_contributions).
--   * bio               -- short public free-text (<= 200 chars, enforced here AND
--                          in the UI). Public UGC on a now-public app -> paired with
--                          the profile_reports table below + an admin review queue.
--   * status_text       -- shorter "what I'm tracking this week" line (<= 80 chars).
--   * status_updated_at -- so the card can show "il y a 3 j" on the status.
--   * is_profile_public -- lets a user keep contributing (name still on the
--                          leaderboard) while hiding bio/avatar/status from the card.
--
-- Also:
--   * an `avatars` public storage bucket (5 MB, jpeg/png/webp) + per-user-folder
--     RLS on storage.objects, mirroring the price-tag-photos / product-photos setup.
--   * `profile_reports` -- append-only abuse reports on a profile, admin-reviewed
--     (same shape/RLS convention as deletion_requests / barcode_flags).
--
-- user_profiles already has public-read RLS (`select using (true)`, see
-- gamification_schema.sql) and owner-only update, so no new policy is needed for
-- the columns themselves -- updateProfile() in AuthContext.jsx already writes them.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

-- 1. Profile columns -------------------------------------------------------------

alter table public.user_profiles
  add column if not exists avatar_url        text,
  add column if not exists bio               text,
  add column if not exists status_text       text,
  add column if not exists status_updated_at timestamp with time zone,
  add column if not exists is_profile_public boolean not null default true;

-- Length caps as a backstop to the UI's maxLength (a direct API write bypasses it).
-- Guarded so re-running the migration doesn't error on the existing constraint.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_bio_len') then
    alter table public.user_profiles
      add constraint user_profiles_bio_len check (bio is null or char_length(bio) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_status_len') then
    alter table public.user_profiles
      add constraint user_profiles_status_len check (status_text is null or char_length(status_text) <= 80);
  end if;
end $$;

comment on column public.user_profiles.bio is
  'Public free-text shown on the profile card. Max 200 chars. Blank it here to moderate.';
comment on column public.user_profiles.is_profile_public is
  'false -> hide bio/avatar/status on the public card; the contributor still appears on the leaderboard.';

-- 2. Avatars storage bucket ----------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- App uploads to `<user_id>/avatar_<ts>.jpg`, so the first path segment is the
-- owner's uid. Public read; write scoped to your own folder.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users manage their own avatar (insert)" on storage.objects;
create policy "Users manage their own avatar (insert)" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users manage their own avatar (update)" on storage.objects;
create policy "Users manage their own avatar (update)" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users manage their own avatar (delete)" on storage.objects;
create policy "Users manage their own avatar (delete)" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 3. Profile abuse reports ----------------------------------------------------

create table if not exists public.profile_reports (
  id               uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_id      uuid references auth.users(id) on delete set null,
  reason           text not null check (reason in ('impersonation', 'offensive', 'spam', 'other')),
  details          text check (details is null or char_length(details) <= 500),
  status           text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at       timestamp with time zone default timezone('utc'::text, now()) not null,
  reviewed_at      timestamp with time zone,
  reviewed_by      uuid references auth.users(id) on delete set null
);

create index if not exists idx_profile_reports_status on public.profile_reports(status);
create index if not exists idx_profile_reports_reported on public.profile_reports(reported_user_id);

alter table public.profile_reports enable row level security;

-- Any signed-in user can file a report as themselves (append-only, no read-back --
-- same fire-and-forget shape as barcode_flags / feature_request_comments inserts).
-- Scoped `to authenticated` with a bare `auth.uid()` (matching user_favorites,
-- which is confirmed working) rather than the `(select auth.uid())` subquery form --
-- a re-run of this migration where that form was used left the INSERT blocked
-- with 42501 for a legitimate own-row insert (2026-09-04 QA).
drop policy if exists "Users can file a profile report" on public.profile_reports;
create policy "Users can file a profile report" on public.profile_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Admins can view profile reports" on public.profile_reports;
create policy "Admins can view profile reports" on public.profile_reports
  for select using (
    exists (select 1 from public.user_roles
            where user_id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "Admins can update profile reports" on public.profile_reports;
create policy "Admins can update profile reports" on public.profile_reports
  for update using (
    exists (select 1 from public.user_roles
            where user_id = (select auth.uid()) and role = 'admin')
  );

-- Moderation action: user_profiles' own RLS only lets a user edit their OWN row,
-- so an admin can't blank someone else's bio/avatar directly. This SECURITY
-- DEFINER RPC is scoped to exactly the three moderatable fields (never points,
-- level, roles, is_internal_account) -- tighter than a blanket admin UPDATE
-- policy on user_profiles. Same pattern as the analytics_admin_* RPCs.
create or replace function public.admin_moderate_profile(
  p_user_id       uuid,
  p_clear_bio     boolean default false,
  p_clear_status  boolean default false,
  p_clear_avatar  boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;

  update public.user_profiles
     set bio         = case when p_clear_bio    then null else bio         end,
         status_text = case when p_clear_status then null else status_text end,
         avatar_url  = case when p_clear_avatar then null else avatar_url  end
   where id = p_user_id;
end;
$$;

revoke all on function public.admin_moderate_profile(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_moderate_profile(uuid, boolean, boolean, boolean) to authenticated;

-- 4. Sanity checks (should both run without error) ---------------------------

select id, display_name, avatar_url, bio, status_text, is_profile_public
  from public.user_profiles
 limit 1;

select id from storage.buckets where id = 'avatars';
