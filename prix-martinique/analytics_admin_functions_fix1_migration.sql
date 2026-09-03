-- Migration: M1 follow-up fix — data-quality context counts should not be
-- filtered by the "exclude internal accounts" toggle.
-- Status: NOT YET APPLIED (2026-09-03). Apply after analytics_admin_functions_migration.sql.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 1.
--
-- Bug: reference_prices and test_submissions were computed from the `base` CTE,
-- which is already internal-account-filtered. So with the toggle on, the admin
-- saw "0 réf. en ligne" / "4 test" even though 10 reference prices and 5 test
-- submissions exist -- they were just entered by internal accounts. These are
-- "what's excluded from the headline for data-quality reasons" numbers, which is
-- orthogonal to whose account it was. Compute them from the full view.
--
-- signups_in_window stays internal-filtered (it IS an adoption metric).
-- Only admin_kpi_overview changes; everything else in M1 is unaffected.

create or replace function public.admin_kpi_overview(
  p_since             timestamptz default null,
  p_exclude_internal  boolean     default true
)
returns table (
  real_submissions           bigint,
  real_products_priced       bigint,
  distinct_contributors      bigint,
  submissions_in_window      bigint,
  contributors_in_window     bigint,
  mdd_priced_products        bigint,
  diaspora_scan_submissions  bigint,
  diaspora_contributors      bigint,
  reference_prices           bigint,
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
    -- data-quality context: NOT internal-filtered
    (select count(*)                             from public.v_admin_prices where channel = 'admin_reference'),
    (select count(*)                             from public.v_admin_prices where is_test),
    (select count(*)                             from public.products where coalesce(is_test_data, false)),
    (select count(*)                             from public.user_profiles up
        where (p_since is null or up.created_at >= p_since)
          and (not p_exclude_internal or not coalesce(up.is_internal_account, false))),
    (select count(*)                             from public.app_sessions s
        where (p_since is null or s.created_at >= p_since));
end;
$$;

-- Sanity: with the fix, reference_prices + test_submissions are the same in both
-- toggle states (only real_submissions / contributors / products change).
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'admin_kpi_overview';
