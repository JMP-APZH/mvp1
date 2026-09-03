-- Migration: server-side, correctly-scoped Admin Dashboard analytics (M1)
-- Status: NOT YET APPLIED (2026-09-03). Apply via Supabase Dashboard -> SQL Editor -> Run.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 1.
--
-- Why: AdminDashboard.jsx's fetchAdminStats() reports raw count(*) with no
-- scoping. "Total Scans" mixes real user submissions + test data
-- (products.is_test_data) + admin-entered France Hexagonale reference prices
-- (source_type='admin_reference') + legacy null-user rows. It also counts
-- prices.user_id (client-set, spoofable, null for legacy) instead of the
-- server-stamped submitted_by, and 6 derived stats .select() whole tables
-- client-side -> silent 1000-row cap.
--
-- This migration moves every headline number into admin-gated SECURITY DEFINER
-- functions that scope correctly, and adds an internal-account flag so founder /
-- test / family accounts can be excluded from adoption metrics.

-- 1. Internal-account flag --------------------------------------------------
alter table public.user_profiles
  add column if not exists is_internal_account boolean not null default false;

comment on column public.user_profiles.is_internal_account is
  'Founder / test / family accounts. Excluded from adoption metrics when the admin "exclure les comptes internes" toggle is on. See ANALYTICS_MONITORING_PLAN.md appendix.';

-- Backfill known internal accounts (confirm / extend this list before running).
update public.user_profiles up
   set is_internal_account = true
 where up.id in (
         select id from auth.users where lower(email) = 'jm.philocles@gmail.com'
       )
    or up.display_name ilike any (array[
         'Tony', 'JMP2_972', 'Jean-Marie Philocles', 'Maëlys 2', 'Maelys Philocles'
       ]);

-- 2. Admin-only analytics view -------------------------------------------------
-- Runs as the view owner (postgres) so it can see every row for aggregation;
-- direct client access is revoked, and it is only ever read from the
-- SECURITY DEFINER functions below (which do their own admin-role check).
create or replace view public.v_admin_prices as
select
  pr.id,
  pr.created_at,
  pr.price,
  pr.store_id,
  pr.product_id,
  pr.origin_region_code,
  pr.source_type,
  pr.mainland_chain,
  coalesce(pr.submitted_by, pr.user_id)              as contributor_id,
  coalesce(p.is_test_data, false)                    as is_test,
  case
    when pr.source_type = 'admin_reference'          then 'admin_reference'
    when pr.origin_region_code = 'Hexagone'          then 'diaspora_scan'
    else                                                 'martinique_scan'
  end                                                as channel,
  coalesce(up.is_internal_account, false)            as is_internal
from public.prices pr
left join public.products      p  on p.id  = pr.product_id
left join public.user_profiles up on up.id = coalesce(pr.submitted_by, pr.user_id);

revoke all on public.v_admin_prices from anon, authenticated;

-- 3. Headline KPIs (one row) ------------------------------------------------
create or replace function public.admin_kpi_overview(
  p_since             timestamptz default null,   -- null = all-time for the *_in_window columns
  p_exclude_internal  boolean     default true
)
returns table (
  real_submissions           bigint,  -- non-test martinique_scan + diaspora_scan rows
  real_products_priced       bigint,  -- distinct products with >= 1 real submission
  distinct_contributors      bigint,  -- distinct coalesce(submitted_by, user_id)
  submissions_in_window      bigint,
  contributors_in_window     bigint,
  mdd_priced_products        bigint,  -- distinct MDD products among real_products_priced
  diaspora_scan_submissions  bigint,  -- real diaspora_scan rows only (NOT admin_reference)
  diaspora_contributors      bigint,
  reference_prices           bigint,  -- admin_reference rows (found online, not scanned)
  test_submissions           bigint,
  test_products              bigint,
  signups_in_window          bigint,
  sessions_in_window         bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  with base as (
    select * from public.v_admin_prices
     where (not p_exclude_internal or not is_internal)
  ),
  real_rows as (
    select * from base
     where not is_test and channel in ('martinique_scan', 'diaspora_scan')
  )
  select
    (select count(*)                             from real_rows),
    (select count(distinct product_id)           from real_rows),
    (select count(distinct contributor_id)       from real_rows where contributor_id is not null),
    (select count(*)                             from real_rows where p_since is null or created_at >= p_since),
    (select count(distinct contributor_id)       from real_rows where contributor_id is not null and (p_since is null or created_at >= p_since)),
    (select count(distinct rr.product_id)        from real_rows rr join public.products p on p.id = rr.product_id where coalesce(p.is_mdd, false)),
    (select count(*)                             from real_rows where channel = 'diaspora_scan'),
    (select count(distinct contributor_id)       from real_rows where channel = 'diaspora_scan' and contributor_id is not null),
    (select count(*)                             from base where channel = 'admin_reference'),
    (select count(*)                             from base where is_test),
    (select count(*)                             from public.products where coalesce(is_test_data, false)),
    (select count(*)                             from public.user_profiles up
        where (p_since is null or up.created_at >= p_since)
          and (not p_exclude_internal or not coalesce(up.is_internal_account, false))),
    (select count(*)                             from public.app_sessions s
        where (p_since is null or s.created_at >= p_since));
end;
$$;

-- 4. Daily / weekly / monthly submission trend ---------------------------------
create or replace function public.admin_price_timeseries(
  p_bucket            text        default 'day',
  p_since             timestamptz default (now() - interval '30 days'),
  p_exclude_internal  boolean     default true
)
returns table (bucket timestamptz, submissions bigint, contributors bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if p_bucket not in ('day', 'week', 'month') then
    p_bucket := 'day';
  end if;

  return query
  select
    date_trunc(p_bucket, v.created_at)   as bucket,
    count(*)::bigint                     as submissions,
    count(distinct v.contributor_id)::bigint as contributors
  from public.v_admin_prices v
  where not v.is_test
    and v.channel in ('martinique_scan', 'diaspora_scan')
    and (not p_exclude_internal or not v.is_internal)
    and v.created_at >= p_since
  group by 1
  order by 1;
end;
$$;

grant execute on function public.admin_kpi_overview(timestamptz, boolean)          to authenticated;
grant execute on function public.admin_price_timeseries(text, timestamptz, boolean) to authenticated;

-- 5. Sanity checks -----------------------------------------------------------
-- (a) functions exist and are SECURITY DEFINER:
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_kpi_overview', 'admin_price_timeseries');

-- (b) what the old "Total Scans" number actually is (runs as postgres here, so
--     it bypasses the admin guard -- eyeball the breakdown):
select
  count(*) filter (where not coalesce(p.is_test_data, false)
                     and pr.source_type <> 'admin_reference'
                     and coalesce(pr.origin_region_code, '') <> 'Hexagone')  as real_martinique_submissions,
  count(*) filter (where not coalesce(p.is_test_data, false)
                     and pr.origin_region_code = 'Hexagone'
                     and pr.source_type <> 'admin_reference')                as real_diaspora_scans,
  count(*) filter (where pr.source_type = 'admin_reference')                 as admin_reference_prices,
  count(*) filter (where coalesce(p.is_test_data, false))                    as test_submissions,
  count(*)                                                                  as grand_total_prices_rows
from public.prices pr
left join public.products p on p.id = pr.product_id;

-- (c) internal accounts flagged:
select display_name, is_internal_account
  from public.user_profiles
 where is_internal_account
 order by display_name;
