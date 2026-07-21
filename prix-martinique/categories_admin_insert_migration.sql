-- Migration: Allow admins to add new categories
--
-- Context: categories_schema.sql only defined a public SELECT policy on
-- `categories` -- there was no way for anyone, including admins, to insert
-- a new category from the app. Confirmed live: an insert attempt fails with
-- 42501 (RLS violation). This adds an admin-gated insert policy, following
-- the same user_roles admin check used for barcode_flags.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

drop policy if exists "Admins can add categories" on categories;
create policy "Admins can add categories" on categories
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );
