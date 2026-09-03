-- Migration: "Santé des données" — data-health + coverage-gap RPCs (M3)
-- Status: NOT YET APPLIED (2026-09-03). Apply after the M1/M2 analytics migrations.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 3.
--
-- M1/M2 answered "how much is there and is it growing?". M3 answers "is it
-- becoming *useful*?" — price freshness, store / category / photo / barcode /
-- BQP coverage, open integrity flags — plus the concrete gap lists an admin
-- can act on.
--
-- Scoping matches admin_kpi_overview's "real" definition: a price row counts
-- when the product is not test data (products.is_test_data) and the row is not
-- an admin-entered France reference (prices.source_type <> 'admin_reference').
-- All three functions are admin-gated SECURITY DEFINER, set search_path = public.

-- 1. Health snapshot (one row) ---------------------------------------------
create or replace function public.admin_data_health()
returns table (
  catalog_products              bigint,   -- non-test products
  real_priced_products          bigint,   -- non-test products with >=1 real price
  fresh_priced_products         bigint,   -- ...whose most recent real price is < 30 days old
  pct_fresh                     numeric,  -- fresh / real_priced * 100
  median_latest_price_age_days  numeric,  -- median, over real-priced products, of days since newest price
  categorized_products          bigint,   -- non-test products with category_id
  pct_categorized               numeric,
  categories_with_products      bigint,   -- distinct categories used by >=1 non-test product
  total_categories              bigint,
  products_with_barcode         bigint,
  pct_barcode                   numeric,
  real_price_rows               bigint,   -- non-test, non-reference price rows
  real_price_rows_with_photo    bigint,
  pct_photo                     numeric,
  open_barcode_flags            bigint,   -- status in ('flagged','recapture_requested')
  stores_priced_30d             bigint,   -- distinct stores with a real price in the last 30 days
  stores_total                  bigint,
  bqp_categories_covered        bigint,   -- distinct bqp_categories with >=1 associated product
  bqp_categories_total          bigint
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

  return query
  with real_prices as (
    select
      pr.id,
      pr.product_id,
      pr.store_id,
      (pr.created_at at time zone 'UTC') as created_ts,
      pr.product_photo_url
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false)
      and coalesce(pr.source_type, 'scan') <> 'admin_reference'
  ),
  latest_per_product as (
    select product_id, max(created_ts) as latest_ts
    from real_prices
    group by product_id
  ),
  ages as (
    select extract(epoch from (now() - latest_ts)) / 86400.0 as age_days
    from latest_per_product
  ),
  cat_products as (
    select * from public.products where not coalesce(is_test_data, false)
  )
  select
    (select count(*) from cat_products),
    (select count(*) from latest_per_product),
    (select count(*) from latest_per_product where latest_ts >= now() - interval '30 days'),
    round(
      100.0 * (select count(*) from latest_per_product where latest_ts >= now() - interval '30 days')
      / nullif((select count(*) from latest_per_product), 0), 1),
    round((select percentile_cont(0.5) within group (order by age_days) from ages)::numeric, 1),
    (select count(*) from cat_products where category_id is not null),
    round(100.0 * (select count(*) from cat_products where category_id is not null)
      / nullif((select count(*) from cat_products), 0), 1),
    (select count(distinct category_id) from cat_products where category_id is not null),
    (select count(*) from public.categories),
    (select count(*) from cat_products where nullif(trim(coalesce(barcode, '')), '') is not null),
    round(100.0 * (select count(*) from cat_products where nullif(trim(coalesce(barcode, '')), '') is not null)
      / nullif((select count(*) from cat_products), 0), 1),
    (select count(*) from real_prices),
    (select count(*) from real_prices where product_photo_url is not null),
    round(100.0 * (select count(*) from real_prices where product_photo_url is not null)
      / nullif((select count(*) from real_prices), 0), 1),
    (select count(*) from public.barcode_flags where status in ('flagged', 'recapture_requested')),
    (select count(distinct store_id) from real_prices
       where store_id is not null and created_ts >= now() - interval '30 days'),
    (select count(*) from public.stores),
    (select count(distinct bqp_category_id) from public.product_bqp_associations),
    (select count(*) from public.bqp_categories);
end;
$$;

-- 2. Per-category coverage -------------------------------------------------
create or replace function public.admin_category_coverage()
returns table (
  category_id      uuid,
  category_name    text,
  icon             text,
  total_products   bigint,   -- non-test products in this category
  priced_products  bigint,   -- ...with >= 1 real price
  pct              numeric
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

  return query
  with real_priced as (
    select distinct pr.product_id
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false)
      and coalesce(pr.source_type, 'scan') <> 'admin_reference'
  ),
  prod as (
    select p.id, p.category_id
    from public.products p
    where not coalesce(p.is_test_data, false)
  )
  select
    c.id,
    c.name,
    c.icon,
    count(prod.id)::bigint,
    count(prod.id) filter (where prod.id in (select product_id from real_priced))::bigint,
    round(100.0 * count(prod.id) filter (where prod.id in (select product_id from real_priced))
      / nullif(count(prod.id), 0), 1)
  from public.categories c
  left join prod on prod.category_id = c.id
  group by c.id, c.name, c.icon, c.display_order

  union all

  select
    null::uuid,
    'Sans catégorie',
    '❓',
    count(*)::bigint,
    count(*) filter (where prod.id in (select product_id from real_priced))::bigint,
    round(100.0 * count(*) filter (where prod.id in (select product_id from real_priced))
      / nullif(count(*), 0), 1)
  from prod
  where prod.category_id is null
  having count(*) > 0

  order by 4 desc;
end;
$$;

-- 3. Actionable coverage gaps -------------------------------------------
-- One flat list the dashboard can group by `kind`:
--   store_stale        -- a store with no real price in 30 days (or ever)
--   demanded_unpriced  -- a favorited product with no real price anywhere
--   uncategorized      -- a real-priced product with no category
create or replace function public.admin_coverage_gaps(p_limit integer default 60)
returns table (
  kind      text,
  ref_id    text,
  label     text,
  sublabel  text,
  weight    numeric   -- sort key, higher = more urgent
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
  select * from (
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
  ) g
  order by g.weight desc
  limit p_limit;
end;
$$;

grant execute on function public.admin_data_health()                to authenticated;
grant execute on function public.admin_category_coverage()          to authenticated;
grant execute on function public.admin_coverage_gaps(integer)       to authenticated;

-- 4. Sanity checks -------------------------------------------------------
-- (functions are auth.uid()-guarded, so calling them from the SQL Editor raises
--  42501 — expected. Verify existence + run the raw equivalents.)
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_data_health', 'admin_category_coverage', 'admin_coverage_gaps');

-- raw health snapshot
with real_prices as (
  select pr.id, pr.product_id, pr.store_id, (pr.created_at at time zone 'UTC') as created_ts, pr.product_photo_url
  from public.prices pr
  join public.products p on p.id = pr.product_id
  where not coalesce(p.is_test_data, false) and coalesce(pr.source_type, 'scan') <> 'admin_reference'
),
latest_per_product as (select product_id, max(created_ts) as latest_ts from real_prices group by product_id)
select
  (select count(*) from public.products where not coalesce(is_test_data, false))            as catalog_products,
  (select count(*) from latest_per_product)                                                 as real_priced_products,
  (select count(*) from latest_per_product where latest_ts >= now() - interval '30 days')    as fresh_priced_products,
  (select count(*) from public.products where not coalesce(is_test_data, false) and category_id is not null) as categorized,
  (select count(*) from public.categories)                                                  as total_categories,
  (select count(*) from public.barcode_flags where status in ('flagged','recapture_requested')) as open_flags,
  (select count(distinct store_id) from real_prices where store_id is not null and created_ts >= now() - interval '30 days') as stores_priced_30d,
  (select count(*) from public.stores)                                                      as stores_total;
