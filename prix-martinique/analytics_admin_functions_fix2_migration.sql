-- Migration: fix2 — timestamp vs timestamptz in the M1/M2a RPC return types.
-- Status: NOT YET APPLIED (2026-09-03). Apply after the M1 + M2a migrations.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestones 1 + 2a.
--
-- Bug: prices.created_at (and therefore v_admin_prices.created_at) is
-- `timestamp without time zone`, but admin_price_timeseries and
-- admin_submissions_detail declared their first column as timestamptz.
-- PostgREST -> 400: "structure of query does not match function result type"
-- (42804). admin_price_timeseries was never live-tested in M1 (the client
-- didn't call it until M2a); admin_kpi_overview is unaffected -- it only
-- *compares* created_at, never returns it.
--
-- Fix: interpret the naked timestamp as UTC (`AT TIME ZONE 'UTC'` -> timestamptz)
-- so PostgREST serializes it with an offset and JS `new Date()` parses it as
-- UTC regardless of the viewer's timezone. Keeps the API type as timestamptz.

-- 1. admin_price_timeseries -------------------------------------------------
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
    (date_trunc(p_bucket, v.created_at) at time zone 'UTC')  as bucket,
    count(*)::bigint                                         as submissions,
    count(distinct v.contributor_id)::bigint                 as contributors
  from public.v_admin_prices v
  where not v.is_test
    and v.channel in ('martinique_scan', 'diaspora_scan')
    and (not p_exclude_internal or not v.is_internal)
    and v.created_at >= p_since
  group by 1
  order by 1;
end;
$$;

grant execute on function public.admin_price_timeseries(text, timestamptz, boolean) to authenticated;

-- 2. admin_submissions_detail --------------------------------------------------
create or replace function public.admin_submissions_detail(
  p_since             timestamptz default null,
  p_exclude_internal  boolean     default true,
  p_limit             integer     default null
)
returns table (
  created_at        timestamptz,
  product_name      text,
  price             numeric,
  store_name        text,
  contributor_name  text,
  channel           text,
  is_test           boolean
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
  select
    (v.created_at at time zone 'UTC')                                          as created_at,
    coalesce(pr.name, '(produit supprimé)')                                    as product_name,
    v.price,
    coalesce(
      st.name,
      case
        when v.channel = 'admin_reference' then 'Réf. en ligne'
        when v.channel = 'diaspora_scan'   then coalesce(v.mainland_chain, 'France Hexagonale')
        else '(magasin inconnu)'
      end
    )                                                                          as store_name,
    coalesce(up.display_name, 'Anonyme')                                       as contributor_name,
    v.channel,
    v.is_test
  from public.v_admin_prices v
  left join public.products      pr on pr.id = v.product_id
  left join public.stores        st on st.id = v.store_id
  left join public.user_profiles up on up.id = v.contributor_id
  where (not p_exclude_internal or not v.is_internal)
    and (p_since is null or v.created_at >= p_since)
  order by v.created_at desc
  limit coalesce(p_limit, 100000);
end;
$$;

grant execute on function public.admin_submissions_detail(timestamptz, boolean, integer) to authenticated;

-- 3. Sanity: exercise both from the SQL editor (runs as postgres, so the admin
--    guard fires -- expected 'admin only'. The point is the DDL compiles.)
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_price_timeseries', 'admin_submissions_detail');
