-- Migration: M3 fix1 — admin_coverage_gaps derived-table columns unnamed (42703)
-- Status: NOT YET APPLIED (2026-09-03). Apply after analytics_data_health_migration.sql.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 3.
--
-- Live-verify: admin_data_health() and admin_category_coverage() return 200,
-- but admin_coverage_gaps() → 400 `42703: column g.weight does not exist`.
-- The subquery `( <union of selects with literal first columns> ) g` has no
-- column names, so `order by g.weight` can't resolve.
--
-- Fix: name the derived table's columns explicitly with the
-- `g(kind, ref_id, label, sublabel, weight)` alias-list. Signature + return
-- type unchanged -> plain create-or-replace.

create or replace function public.admin_coverage_gaps(p_limit integer default 60)
returns table (
  kind      text,
  ref_id    text,
  label     text,
  sublabel  text,
  weight    numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if p_limit is null or p_limit <= 0 or p_limit > 500 then
    p_limit := 60;
  end if;

  return query
  with real_prices as (
    select pr.product_id, pr.store_id, (pr.created_at at time zone 'UTC') as created_ts
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false)
      and coalesce(pr.source_type, 'scan') <> 'admin_reference'
  ),
  store_latest as (
    select s.id, s.name,
           (select max(rp.created_ts) from real_prices rp where rp.store_id = s.id) as latest_ts
    from public.stores s
  ),
  fav as (
    select product_id, count(*) as favorite_count
    from public.user_favorites
    group by product_id
  )
  select g.kind, g.ref_id, g.label, g.sublabel, g.weight
  from (
    -- stores with stale / no coverage
    select
      'store_stale'::text,
      sl.id::text,
      sl.name,
      case when sl.latest_ts is null then 'jamais de prix réel'
           else 'dernier prix il y a ' || floor(extract(epoch from (now() - sl.latest_ts)) / 86400.0)::int || ' j'
      end,
      coalesce(extract(epoch from (now() - sl.latest_ts)) / 86400.0, 100000)::numeric
    from store_latest sl
    where sl.latest_ts is null or sl.latest_ts < now() - interval '30 days'

    union all

    -- favorited products with no real price at all
    select
      'demanded_unpriced'::text,
      p.id::text,
      p.name,
      f.favorite_count || ' personne' || case when f.favorite_count > 1 then 's' else '' end || ' le veulent',
      (1000 + f.favorite_count)::numeric
    from fav f
    join public.products p on p.id = f.product_id
    where not coalesce(p.is_test_data, false)
      and not exists (select 1 from real_prices rp where rp.product_id = p.id)

    union all

    -- real-priced products with no category
    select
      'uncategorized'::text,
      p.id::text,
      p.name,
      (select count(*) from real_prices rp where rp.product_id = p.id) || ' prix · non catégorisé',
      (select count(*) from real_prices rp where rp.product_id = p.id)::numeric
    from public.products p
    where p.category_id is null
      and not coalesce(p.is_test_data, false)
      and exists (select 1 from real_prices rp where rp.product_id = p.id)
  ) g(kind, ref_id, label, sublabel, weight)
  order by g.weight desc
  limit p_limit;
end;
$$;

grant execute on function public.admin_coverage_gaps(integer) to authenticated;

-- Sanity: raw run of the gap list (no guard)
with real_prices as (
  select pr.product_id, pr.store_id, (pr.created_at at time zone 'UTC') as created_ts
  from public.prices pr
  join public.products p on p.id = pr.product_id
  where not coalesce(p.is_test_data, false) and coalesce(pr.source_type, 'scan') <> 'admin_reference'
),
store_latest as (
  select s.id, s.name, (select max(rp.created_ts) from real_prices rp where rp.store_id = s.id) as latest_ts
  from public.stores s
),
fav as (select product_id, count(*) as favorite_count from public.user_favorites group by product_id)
select g.kind, g.label, g.sublabel, g.weight from (
  select 'store_stale'::text, sl.id::text, sl.name,
    case when sl.latest_ts is null then 'jamais' else 'il y a ' || floor(extract(epoch from (now()-sl.latest_ts))/86400.0)::int || ' j' end,
    coalesce(extract(epoch from (now()-sl.latest_ts))/86400.0, 100000)::numeric
  from store_latest sl where sl.latest_ts is null or sl.latest_ts < now() - interval '30 days'
  union all
  select 'demanded_unpriced'::text, p.id::text, p.name, f.favorite_count || ' veulent', (1000 + f.favorite_count)::numeric
  from fav f join public.products p on p.id = f.product_id
  where not coalesce(p.is_test_data, false) and not exists (select 1 from real_prices rp where rp.product_id = p.id)
  union all
  select 'uncategorized'::text, p.id::text, p.name,
    (select count(*) from real_prices rp where rp.product_id = p.id) || ' prix', (select count(*) from real_prices rp where rp.product_id = p.id)::numeric
  from public.products p
  where p.category_id is null and not coalesce(p.is_test_data, false) and exists (select 1 from real_prices rp where rp.product_id = p.id)
) g(kind, ref_id, label, sublabel, weight)
order by g.weight desc
limit 20;
