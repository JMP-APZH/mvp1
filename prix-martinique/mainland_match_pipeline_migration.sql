-- Migration: Martinique ↔ France Hexagonale matching pipeline (M4a)
-- Status: NOT YET APPLIED (2026-09-03). Apply after the M1–M3 analytics migrations.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 4.
--
-- The flagship "vie chère" comparison (PriceDuel) only works with real matched
-- MTQ↔Hexagone pairs. Today a France price arrives via one of three paths, all
-- collapsed onto `origin_region_code = 'Hexagone'` + `source_type`:
--   1. diaspora user scans in France      (source_type='scan')
--   2. admin captures a chain website     (source_type='admin_reference' + source_url)
--   3. admin uploads a chain-app screenshot (M4b — a distinct capture path)
-- M4a adds an explicit `source_channel`, a verification flag, and the coverage
-- + gap analytics. M4b adds the screenshot-upload flow + the verification queue.

-- 1. Explicit provenance channel -----------------------------------------
alter table public.prices
  add column if not exists source_channel text
  check (source_channel is null or source_channel in
    ('martinique_scan', 'diaspora_scan', 'chain_app_screenshot', 'online_capture'));

comment on column public.prices.source_channel is
  'Explicit capture path. martinique_scan = local user scan; diaspora_scan = user scan in France; chain_app_screenshot = admin screenshot from an enseigne''s own app (M4b); online_capture = admin found it on a chain website. Backfilled from source_type + origin_region_code.';

update public.prices
   set source_channel = case
         when source_type = 'admin_reference'      then 'online_capture'
         when origin_region_code = 'Hexagone'      then 'diaspora_scan'
         else                                           'martinique_scan'
       end
 where source_channel is null;

create index if not exists idx_prices_source_channel on public.prices(source_channel);

-- 2. Match verification (for the M4b review queue) ----------------------
alter table public.prices add column if not exists match_verified boolean not null default false;
alter table public.prices add column if not exists match_verified_by uuid references auth.users(id);
alter table public.prices add column if not exists match_verified_at timestamptz;

-- 3. Coverage + gap snapshot (one row) --------------------------------
-- "real MTQ price" = non-test martinique_scan row.
-- "France price"   = any diaspora_scan / chain_app_screenshot / online_capture row
--                    for a non-test product.
create or replace function public.admin_mainland_match_coverage()
returns table (
  mtq_priced_products        bigint,   -- non-test products with >=1 real MTQ price
  mtq_with_france_price      bigint,   -- ...that also have >=1 France price
  match_rate_pct             numeric,
  france_priced_products     bigint,   -- non-test products with >=1 France price
  france_without_mtq         bigint,   -- France-priced but no real MTQ price (inverse gap)
  cov_diaspora_scan          bigint,   -- distinct France-priced products, by channel
  cov_chain_app_screenshot   bigint,
  cov_online_capture         bigint,
  median_gap_pct             numeric,  -- over matched products: (mtq_latest - fr_latest)/fr_latest*100 (+ = MTQ dearer)
  avg_gap_pct                numeric,
  products_mtq_dearer        bigint,
  products_mtq_cheaper       bigint,
  unverified_france_entries  bigint    -- France rows with match_verified = false
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
  with rows_scoped as (
    select
      pr.product_id,
      pr.price,
      (pr.created_at at time zone 'UTC') as created_ts,
      coalesce(pr.source_channel,
        case when pr.source_type = 'admin_reference' then 'online_capture'
             when pr.origin_region_code = 'Hexagone' then 'diaspora_scan'
             else 'martinique_scan' end) as chan,
      coalesce(pr.match_verified, false) as verified
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false)
      and pr.price > 0
  ),
  mtq_latest as (
    select distinct on (product_id) product_id, price
    from rows_scoped
    where chan = 'martinique_scan'
    order by product_id, created_ts desc
  ),
  fr_rows as (
    select * from rows_scoped
    where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
  ),
  fr_latest as (
    select distinct on (product_id) product_id, price
    from fr_rows
    order by product_id, created_ts desc
  ),
  matched as (
    select m.product_id,
           round(((m.price - f.price) / nullif(f.price, 0) * 100.0)::numeric, 1) as gap_pct
    from mtq_latest m
    join fr_latest f on f.product_id = m.product_id
  )
  select
    (select count(*) from mtq_latest),
    (select count(*) from matched),
    round(100.0 * (select count(*) from matched) / nullif((select count(*) from mtq_latest), 0), 1),
    (select count(*) from fr_latest),
    (select count(*) from fr_latest f where not exists (select 1 from mtq_latest m where m.product_id = f.product_id)),
    (select count(distinct product_id) from fr_rows where chan = 'diaspora_scan'),
    (select count(distinct product_id) from fr_rows where chan = 'chain_app_screenshot'),
    (select count(distinct product_id) from fr_rows where chan = 'online_capture'),
    (select round(percentile_cont(0.5) within group (order by gap_pct)::numeric, 1) from matched),
    (select round(avg(gap_pct)::numeric, 1) from matched),
    (select count(*) from matched where gap_pct > 0),
    (select count(*) from matched where gap_pct < 0),
    (select count(*) from fr_rows where not verified);
end;
$$;

-- 4. Gap by category ---------------------------------------------------
create or replace function public.admin_mainland_gap_by_category()
returns table (
  category_id     uuid,
  category_name   text,
  icon            text,
  matched_products bigint,
  median_gap_pct  numeric
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
  with rows_scoped as (
    select
      pr.product_id,
      pr.price,
      (pr.created_at at time zone 'UTC') as created_ts,
      coalesce(pr.source_channel,
        case when pr.source_type = 'admin_reference' then 'online_capture'
             when pr.origin_region_code = 'Hexagone' then 'diaspora_scan'
             else 'martinique_scan' end) as chan
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false) and pr.price > 0
  ),
  mtq_latest as (
    select distinct on (product_id) product_id, price
    from rows_scoped where chan = 'martinique_scan'
    order by product_id, created_ts desc
  ),
  fr_latest as (
    select distinct on (product_id) product_id, price
    from rows_scoped where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
    order by product_id, created_ts desc
  ),
  matched as (
    select m.product_id,
           ((m.price - f.price) / nullif(f.price, 0) * 100.0) as gap_pct
    from mtq_latest m join fr_latest f on f.product_id = m.product_id
  )
  select
    c.id, c.name, c.icon,
    count(matched.product_id)::bigint,
    round(percentile_cont(0.5) within group (order by matched.gap_pct)::numeric, 1)
  from matched
  join public.products p on p.id = matched.product_id
  left join public.categories c on c.id = p.category_id
  group by c.id, c.name, c.icon
  having count(matched.product_id) > 0
  order by 4 desc;
end;
$$;

grant execute on function public.admin_mainland_match_coverage()   to authenticated;
grant execute on function public.admin_mainland_gap_by_category()   to authenticated;

-- 5. Sanity checks ---------------------------------------------------
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_mainland_match_coverage', 'admin_mainland_gap_by_category');

-- source_channel backfill distribution
select source_channel, count(*) from public.prices group by source_channel order by 2 desc;

-- raw coverage (guard bypassed)
with rows_scoped as (
  select pr.product_id, pr.price, (pr.created_at at time zone 'UTC') as created_ts,
    coalesce(pr.source_channel,
      case when pr.source_type = 'admin_reference' then 'online_capture'
           when pr.origin_region_code = 'Hexagone' then 'diaspora_scan'
           else 'martinique_scan' end) as chan
  from public.prices pr join public.products p on p.id = pr.product_id
  where not coalesce(p.is_test_data, false) and pr.price > 0
),
mtq_latest as (select distinct on (product_id) product_id, price from rows_scoped where chan = 'martinique_scan' order by product_id, created_ts desc),
fr_latest as (select distinct on (product_id) product_id, price from rows_scoped where chan in ('diaspora_scan','chain_app_screenshot','online_capture') order by product_id, created_ts desc)
select
  (select count(*) from mtq_latest) as mtq_priced,
  (select count(*) from mtq_latest m join fr_latest f on f.product_id = m.product_id) as matched,
  (select count(*) from fr_latest) as france_priced,
  (select count(*) from fr_latest f where not exists (select 1 from mtq_latest m where m.product_id = f.product_id)) as france_without_mtq;
