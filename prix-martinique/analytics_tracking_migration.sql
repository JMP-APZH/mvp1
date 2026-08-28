-- Migration: Session/device + auth-method analytics for the admin dashboard
--
-- Context: three new admin-dashboard breakdowns requested -- (1) scans/usage
-- split iOS vs Android, (2) sign-ins split email+password vs Google, (3)
-- installed-PWA usage vs browser usage. There's no backend or read API key
-- to query PostHog server-side (see AdminDashboard.jsx's own comment on why
-- its "Analytics" tab links out to PostHog rather than embedding it), so
-- these are captured directly into Supabase instead, the same way every
-- other admin stat in this app is sourced.
--
-- app_sessions: one row per browser-tab session (deduped client-side via
-- sessionStorage, see utils/sessionTracking.js), logged on every app load
-- regardless of auth state -- this answers (1) and (3).
-- auth_events: one row per genuine sign-in, not a page-reload session
-- restore (see isFreshSignIn() in contexts/AuthContext.jsx) -- this answers (2).
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_platform text not null check (device_platform in ('ios', 'android', 'other')),
  display_mode text not null check (display_mode in ('standalone', 'browser')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_app_sessions_created_at on app_sessions(created_at);

alter table app_sessions enable row level security;

-- Anonymous, logged-out browsing must still be able to log a session.
drop policy if exists "Anyone can log an app session" on app_sessions;
create policy "Anyone can log an app session" on app_sessions
  for insert with check (true);

-- This is otherwise-private usage telemetry, unlike the public price data
-- the rest of the app reads -- only admins can read it back.
drop policy if exists "Admins can read app sessions" on app_sessions;
create policy "Admins can read app sessions" on app_sessions
  for select using (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );


create table if not exists auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('email', 'google')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_auth_events_created_at on auth_events(created_at);

alter table auth_events enable row level security;

drop policy if exists "Users can log their own sign-in" on auth_events;
create policy "Users can log their own sign-in" on auth_events
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Admins can read auth events" on auth_events;
create policy "Admins can read auth events" on auth_events
  for select using (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );
