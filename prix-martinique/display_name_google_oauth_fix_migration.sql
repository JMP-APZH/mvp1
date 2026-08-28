-- Fixes handle_new_user() to populate display_name from Google OAuth's actual
-- metadata keys (full_name / name), not just the app's own 'display_name' key
-- (only ever set by the email/password signUp() call, which explicitly passes
-- options.data.display_name -- Google OAuth never does).
--
-- Every Google sign-up to date has had display_name permanently NULL because
-- of this -- confirmed live against a real test account (Aug 28, 2026, iOS
-- test session): their price submission correctly had user_id set to their
-- real authenticated UUID, but user_name was saved as the literal fallback
-- "Anonyme" despite being signed in, and the "Votre nom" field in the app
-- never disabled/prefilled for them either, since that logic also keys off
-- userProfile.display_name being truthy.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- One-time backfill for every existing account whose display_name is still
-- NULL (every Google sign-up to date), using the same coalesce chain against
-- their real auth.users metadata.
update public.user_profiles up
set display_name = coalesce(
  au.raw_user_meta_data->>'display_name',
  au.raw_user_meta_data->>'full_name',
  au.raw_user_meta_data->>'name',
  split_part(au.email, '@', 1)
)
from auth.users au
where au.id = up.id
  and up.display_name is null;

-- Sanity check -- should return zero rows once applied.
select id, display_name from public.user_profiles where display_name is null;
