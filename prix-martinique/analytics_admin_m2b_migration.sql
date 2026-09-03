-- Migration: Admin Dashboard drill-downs + moderation queue (M2b)
-- Status: NOT YET APPLIED (2026-09-03). Apply AFTER:
--   analytics_admin_functions_migration.sql (+ fix1)
--   analytics_admin_export_migration.sql
--   analytics_admin_functions_fix2_migration.sql
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 2b.
--
-- Adds two admin-gated SECURITY DEFINER functions, both reading from the
-- already-admin-only v_admin_prices view so scoping (test / channel / internal)
-- stays identical to admin_kpi_overview:
--
--   1. admin_submissions_browse(...)  -- paginated, channel-filterable,
--      "à revoir"-filterable submission list. Powers the "Contributions de prix"
--      tile drill-down, the "Activité Récente > Voir tout" list, AND the
--      "Modérer Prix" queue (same function, p_review_only := true).
--
--   2. admin_contributors(...)        -- one row per contributor: first / last
--      contribution, totals, channel mix, test count. Powers the "Contributeurs"
--      tile drill-down.
--
-- Note: prices.created_at is `timestamp without time zone`; every returned
-- timestamp column is wrapped `(... at time zone 'UTC')` -> timestamptz, matching
-- the fix2 convention (a bare timestamp column trips PostgREST 400 / 42804).

-- 1. Paginated / filterable submission browse + moderation queue ---------------
create or replace function public.admin_submissions_browse(
  p_since             timestamptz default null,
  p_exclude_internal  boolean     default true,
  p_channel           text        default null,   -- null = all; else martinique_scan | diaspora_scan | admin_reference
  p_review_only       boolean     default false,  -- only rows carrying a review flag
  p_limit             integer     default 25,
  p_offset            integer     default 0
)
returns table (
  price_id            uuid,
  created_at          timestamptz,
  product_id          uuid,
  product_name        text,
  price               numeric,
  store_id            bigint,   -- prices.store_id / stores.id are bigint (fix2)
  store_name          text,
  contributor_id      uuid,
  contributor_name    text,
  contributor_is_new  boolean,      -- account < 7 days old at submission time
  channel             text,
  is_test             boolean,
  review_reason       text,         -- null when clean; else FR comma-list
  total_count         bigint        -- full window size (identical on every row) for pagination
)
language plpgsql
security definer
set search_path = public
as $$
-- OUT params (product_id, channel, is_test, price, review_reason, ...) share
-- names with columns used bare inside the body -> resolve ambiguity to the
-- column (see analytics_admin_m2b_fix1_migration.sql).
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if p_limit is null or p_limit <= 0 or p_limit > 200 then
    p_limit := 25;
  end if;
  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
  with priced as (
    select
      v.id                                      as price_id,
      (v.created_at at time zone 'UTC')         as created_ts,
      v.product_id                              as product_id,
      v.price                                   as price,
      v.store_id                                as store_id,
      v.contributor_id                          as contributor_id,
      v.channel                                 as channel,
      v.is_test                                 as is_test,
      coalesce(pr.name, '(produit supprimé)')   as product_name,
      coalesce(
        st.name,
        case
          when v.channel = 'admin_reference' then 'Réf. en ligne'
          when v.channel = 'diaspora_scan'   then coalesce(v.mainland_chain, 'France Hexagonale')
          else '(magasin inconnu)'
        end
      )                                         as store_name,
      coalesce(up.display_name, 'Anonyme')      as contributor_name,
      up.created_at                             as contributor_created_at
    from public.v_admin_prices v
    left join public.products      pr on pr.id = v.product_id
    left join public.stores        st on st.id = v.store_id
    left join public.user_profiles up on up.id = v.contributor_id
    where (not p_exclude_internal or not v.is_internal)
  ),
  medians as (
    select
      pp.product_id                                          as product_id,
      percentile_cont(0.5) within group (order by pp.price)  as med,
      count(*)                                               as n
    from priced pp
    where not pp.is_test
      and pp.channel in ('martinique_scan', 'diaspora_scan')
      and pp.price > 0
    group by pp.product_id
  ),
  flagged as (
    select
      p.*,
      (
        p.contributor_created_at is not null
        and p.created_ts - p.contributor_created_at < interval '7 days'
      )                                                  as is_new_account,
      nullif(concat_ws(', ',
        case
          when p.channel in ('martinique_scan', 'diaspora_scan') and p.store_id is null
          then 'magasin manquant'
        end,
        case
          when m.n >= 3 and m.med > 0 and (p.price > m.med * 3 or p.price < m.med * 0.34)
          then 'prix aberrant'
        end,
        case
          when p.contributor_created_at is not null
           and p.created_ts - p.contributor_created_at < interval '7 days'
          then 'compte récent'
        end
      ), '')                                             as review_reason
    from priced p
    left join medians m on m.product_id = p.product_id
  ),
  filtered as (
    select *
    from flagged f
    where (p_since is null or f.created_ts >= p_since)
      and (p_channel is null or f.channel = p_channel)
      and (not p_review_only or f.review_reason is not null)
  )
  select
    f.price_id,
    f.created_ts,
    f.product_id,
    f.product_name,
    f.price,
    f.store_id,
    f.store_name,
    f.contributor_id,
    f.contributor_name,
    f.is_new_account,
    f.channel,
    f.is_test,
    f.review_reason,
    (count(*) over ())::bigint as total_count
  from filtered f
  order by f.created_ts desc
  limit p_limit offset p_offset;
end;
$$;

-- 2. Contributor roster ------------------------------------------------------
create or replace function public.admin_contributors(
  p_exclude_internal  boolean default true,
  p_limit             integer default 200
)
returns table (
  contributor_id      uuid,
  contributor_name    text,
  is_internal         boolean,
  first_contribution  timestamptz,
  last_contribution   timestamptz,
  total_submissions   bigint,
  martinique_scans    bigint,
  diaspora_scans      bigint,
  reference_prices    bigint,
  test_submissions    bigint
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

  if p_limit is null or p_limit <= 0 or p_limit > 1000 then
    p_limit := 200;
  end if;

  return query
  select
    v.contributor_id,
    coalesce(up.display_name, 'Anonyme')                                        as contributor_name,
    bool_or(v.is_internal)                                                      as is_internal,
    min(v.created_at at time zone 'UTC')                                        as first_contribution,
    max(v.created_at at time zone 'UTC')                                        as last_contribution,
    count(*)::bigint                                                            as total_submissions,
    count(*) filter (where v.channel = 'martinique_scan' and not v.is_test)::bigint  as martinique_scans,
    count(*) filter (where v.channel = 'diaspora_scan'   and not v.is_test)::bigint  as diaspora_scans,
    count(*) filter (where v.channel = 'admin_reference')::bigint                    as reference_prices,
    count(*) filter (where v.is_test)::bigint                                        as test_submissions
  from public.v_admin_prices v
  left join public.user_profiles up on up.id = v.contributor_id
  where v.contributor_id is not null
    and (not p_exclude_internal or not v.is_internal)
  group by v.contributor_id, coalesce(up.display_name, 'Anonyme')
  order by count(*) desc, max(v.created_at) desc
  limit p_limit;
end;
$$;

-- 3. Add product_id to admin_submissions_detail so "Activité Récente" rows are
--    click-through to the ProductDetailModal (M2a shipped it without the id).
--    Return type changes -> must DROP first (create-or-replace can't widen it).
drop function if exists public.admin_submissions_detail(timestamptz, boolean, integer);

create or replace function public.admin_submissions_detail(
  p_since             timestamptz default null,
  p_exclude_internal  boolean     default true,
  p_limit             integer     default null
)
returns table (
  created_at        timestamptz,
  product_id        uuid,
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
    v.product_id,
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

grant execute on function public.admin_submissions_browse(timestamptz, boolean, text, boolean, integer, integer) to authenticated;
grant execute on function public.admin_contributors(boolean, integer)                                            to authenticated;
grant execute on function public.admin_submissions_detail(timestamptz, boolean, integer)                         to authenticated;

-- 3. Sanity checks ---------------------------------------------------------
-- NOTE: the functions carry an `auth.uid()` admin guard, so calling them from
-- the Supabase SQL Editor (no auth context) raises "admin only" (42501) -- that
-- is expected and does NOT mean the migration failed. Verify with raw queries
-- against v_admin_prices instead (the editor runs as the view owner).

-- (a) all three functions exist + are SECURITY DEFINER
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_submissions_browse', 'admin_contributors', 'admin_submissions_detail');

-- (b) raw preview of the moderation queue -- same logic as admin_submissions_browse,
--     without the guard. Rows here are what "Modérer Prix" will surface.
with priced as (
  select
    v.id, (v.created_at at time zone 'UTC') as created_ts, v.product_id, v.price,
    v.store_id, v.channel, v.is_test,
    coalesce(pr.name, '(produit supprimé)') as product_name,
    up.created_at as contributor_created_at
  from public.v_admin_prices v
  left join public.products      pr on pr.id = v.product_id
  left join public.user_profiles up on up.id = v.contributor_id
  where not v.is_internal
),
medians as (
  select product_id, percentile_cont(0.5) within group (order by price) as med, count(*) as n
  from priced
  where not is_test and channel in ('martinique_scan', 'diaspora_scan') and price > 0
  group by product_id
)
select
  p.created_ts, p.product_name, p.price,
  nullif(concat_ws(', ',
    case when p.channel in ('martinique_scan','diaspora_scan') and p.store_id is null then 'magasin manquant' end,
    case when m.n >= 3 and m.med > 0 and (p.price > m.med * 3 or p.price < m.med * 0.34) then 'prix aberrant' end,
    case when p.contributor_created_at is not null and p.created_ts - p.contributor_created_at < interval '7 days' then 'compte récent' end
  ), '') as review_reason
from priced p
left join medians m on m.product_id = p.product_id
where nullif(concat_ws(', ',
    case when p.channel in ('martinique_scan','diaspora_scan') and p.store_id is null then 'x' end,
    case when m.n >= 3 and m.med > 0 and (p.price > m.med * 3 or p.price < m.med * 0.34) then 'x' end,
    case when p.contributor_created_at is not null and p.created_ts - p.contributor_created_at < interval '7 days' then 'x' end
  ), '') is not null
order by p.created_ts desc
limit 25;

-- (c) raw contributor roster
select
  coalesce(up.display_name, 'Anonyme')                              as contributor_name,
  count(*)                                                          as total_submissions,
  count(*) filter (where v.channel = 'martinique_scan' and not v.is_test) as martinique_scans,
  count(*) filter (where v.channel = 'diaspora_scan'   and not v.is_test) as diaspora_scans,
  min(v.created_at)                                                 as first_contribution,
  max(v.created_at)                                                 as last_contribution
from public.v_admin_prices v
left join public.user_profiles up on up.id = v.contributor_id
where v.contributor_id is not null and not v.is_internal
group by 1
order by 2 desc
limit 50;
