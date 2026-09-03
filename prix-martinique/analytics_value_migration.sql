-- Migration: "Valeur livrée" — mission metrics (M5)
-- Status: NOT YET APPLIED (2026-09-03). Apply after the M1–M4 analytics migrations.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 5.
--
-- M4 measures the MTQ↔Hexagone match *coverage*. M5 turns it into the mission
-- headline — how much dearer life is here, and how much the community has
-- already saved — and surfaces a public version of the gap in the app's
-- Community → Impact tab.
--
-- "Real MTQ price" = non-test martinique_scan row. "France price" = any
-- diaspora_scan / chain_app_screenshot / online_capture row. Gap % per product
-- = (latest MTQ − latest France) / latest France × 100 (+ = dearer in MTQ).

-- 1. Admin: value-delivered snapshot (one row) --------------------------
create or replace function public.admin_value_delivered(p_since timestamptz default null)
returns table (
  matched_products        bigint,   -- products with both a latest MTQ and a latest France price
  median_gap_pct          numeric,  -- median of the per-product gap %
  weighted_gap_pct        numeric,  -- Σ(mtq−fr) / Σ(fr) × 100 — a basket-level gap (weights costlier items)
  mtq_dearer              bigint,
  mtq_cheaper             bigint,
  bqp_matched_products    bigint,   -- matched products that are BQP-associated
  bqp_median_gap_pct      numeric,
  community_savings_eur   numeric,  -- Σ over real price rows (since p_since) of max(0, 365d-avg − price)
  savings_contributions   bigint    -- # rows that beat their 365-day product average
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
  with real_rows as (
    select
      pr.id,
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
    from real_rows where chan = 'martinique_scan'
    order by product_id, created_ts desc
  ),
  fr_latest as (
    select distinct on (product_id) product_id, price
    from real_rows where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
    order by product_id, created_ts desc
  ),
  matched as (
    select m.product_id, m.price as mtq, f.price as fr,
           ((m.price - f.price) / nullif(f.price, 0) * 100.0) as gap_pct
    from mtq_latest m join fr_latest f on f.product_id = m.product_id
  ),
  -- community savings: each MARTINIQUE real row vs its 365-day product average
  avg_365 as (
    select product_id, avg(price) as avg_price
    from real_rows
    where created_ts >= now() - interval '365 days'
    group by product_id
  ),
  savings as (
    select
      greatest(0, a.avg_price - r.price) as saved
    from real_rows r
    join avg_365 a on a.product_id = r.product_id
    where r.chan = 'martinique_scan'
      and (p_since is null or r.created_ts >= p_since)
  )
  select
    (select count(*) from matched),
    (select round(percentile_cont(0.5) within group (order by gap_pct)::numeric, 1) from matched),
    (select round((sum(mtq - fr) / nullif(sum(fr), 0) * 100.0)::numeric, 1) from matched),
    (select count(*) from matched where gap_pct > 0),
    (select count(*) from matched where gap_pct < 0),
    (select count(distinct mt.product_id) from matched mt
       where exists (select 1 from public.product_bqp_associations pba where pba.product_id = mt.product_id)),
    (select round(percentile_cont(0.5) within group (order by mt.gap_pct)::numeric, 1) from matched mt
       where exists (select 1 from public.product_bqp_associations pba where pba.product_id = mt.product_id)),
    (select round(coalesce(sum(saved), 0)::numeric, 2) from savings),
    (select count(*) from savings where saved > 0);
end;
$$;

grant execute on function public.admin_value_delivered(timestamptz) to authenticated;

-- 2. Public: the "vie chère" gap for the Community → Impact tab ----------
-- Aggregate only, no row-level data — safe for anon. Non-test products,
-- latest MTQ vs latest France price, same channel definition as above.
create or replace function public.community_mainland_gap()
returns table (
  matched_products  bigint,
  median_gap_pct    numeric,
  mtq_dearer        bigint,
  mtq_cheaper       bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with real_rows as (
    select
      pr.product_id, pr.price,
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
    select distinct on (product_id) product_id, price from real_rows
    where chan = 'martinique_scan' order by product_id, created_ts desc
  ),
  fr_latest as (
    select distinct on (product_id) product_id, price from real_rows
    where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
    order by product_id, created_ts desc
  ),
  matched as (
    select ((m.price - f.price) / nullif(f.price, 0) * 100.0) as gap_pct
    from mtq_latest m join fr_latest f on f.product_id = m.product_id
  )
  select
    count(*)::bigint,
    round(percentile_cont(0.5) within group (order by gap_pct)::numeric, 1),
    count(*) filter (where gap_pct > 0)::bigint,
    count(*) filter (where gap_pct < 0)::bigint
  from matched;
$$;

grant execute on function public.community_mainland_gap() to anon, authenticated;

-- 3. Sanity checks ---------------------------------------------------
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_value_delivered', 'community_mainland_gap');

select * from public.community_mainland_gap();
