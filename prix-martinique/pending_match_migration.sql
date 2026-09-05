-- Migration: Public "pending price match" queues, by chain + category
-- Status: APPLIED 2026-09-05. Verified live via anon-key REST calls:
-- public_pending_match_counts() -> {mtq_to_france: 40, france_to_mtq: 0};
-- suggested_chain correctly derived "E.Leclerc" for products priced at
-- "Leclerc C.C. Place d'Armes" and "Autre" for "Pli Bel Price ...".
--
-- Surfaces the same Martinique <-> France Hexagonale gap already tracked for
-- admins (mainland_match_pipeline_migration.sql, M4a/M4b) directly to end
-- users -- specifically diaspora members who want to know exactly which
-- products to scan at a French chain (Leclerc/Carrefour/Auchan/Système U),
-- and Martinique-based users who want to know which France-priced products
-- still need a local scan. Public, read-only, no admin gate -- same posture
-- as community_price_count() / community_mainland_gap()
-- (community_price_count_migration.sql / analytics_value_migration.sql).
--
-- Feeds a new "Défi Diaspora" modal opened from the header's "prix partagés"
-- pill, with category + chain filter chips mirroring the Comparer tab's
-- existing category/store picker pattern (App10.jsx).

-- 1. Martinique -> France Hexagonale: priced locally, no France match yet ---
-- suggested_chain is derived from the Martinique store's own chain (stores.chain),
-- not invented -- scanning the SAME enseigne in France gives the truest
-- apples-to-apples comparison. Falls back to 'Autre' for chains outside the
-- 4 tracked mainland_chain values (Euromarché, Pli Bel Price, etc).
create or replace function public.public_pending_mtq_to_france(
  p_category_id uuid default null,
  p_chain text default null,
  p_limit int default 60
)
returns table (
  product_id      uuid,
  product_name    text,
  photo_url       text,
  category_id     uuid,
  category_name   text,
  category_icon   text,
  mtq_price       numeric,
  suggested_chain text,
  store_name      text,
  scanned_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with rows_scoped as (
    select
      pr.product_id, pr.price, pr.store_id, pr.product_photo_url,
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
    select distinct on (product_id) product_id, price, store_id, product_photo_url, created_ts
    from rows_scoped where chan = 'martinique_scan'
    order by product_id, created_ts desc
  ),
  fr_products as (
    select distinct product_id from rows_scoped
    where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
  ),
  joined as (
    select
      m.product_id,
      p.name as product_name,
      m.product_photo_url as photo_url,
      p.category_id,
      c.name as category_name,
      c.icon as category_icon,
      m.price as mtq_price,
      (case
        when s.chain ilike 'Carrefour%' then 'Carrefour'
        when s.chain = 'E.Leclerc' then 'E.Leclerc'
        when s.chain = 'Auchan' then 'Auchan'
        when s.chain = 'U Express' then 'Système U'
        else 'Autre'
      end) as suggested_chain,
      s.name as store_name,
      m.created_ts as scanned_at
    from mtq_latest m
    join public.products p on p.id = m.product_id
    left join public.categories c on c.id = p.category_id
    left join public.stores s on s.id = m.store_id
    where not exists (select 1 from fr_products f where f.product_id = m.product_id)
  )
  select * from joined
  where (p_category_id is null or category_id = p_category_id)
    and (p_chain is null or suggested_chain = p_chain)
  order by scanned_at desc
  limit p_limit;
$$;

grant execute on function public.public_pending_mtq_to_france(uuid, text, int) to anon, authenticated;

-- 2. France Hexagonale -> Martinique: priced there, no MTQ match yet -------
-- chain here is the real mainland_chain captured on the France-side row
-- (already one of the 4 tracked chains + 'Autre'), no derivation needed.
create or replace function public.public_pending_france_to_mtq(
  p_category_id uuid default null,
  p_chain text default null,
  p_limit int default 60
)
returns table (
  product_id    uuid,
  product_name  text,
  photo_url     text,
  category_id   uuid,
  category_name text,
  category_icon text,
  france_price  numeric,
  chain         text,
  channel       text,
  captured_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with rows_scoped as (
    select
      pr.product_id, pr.price, pr.mainland_chain, pr.product_photo_url, pr.evidence_photo_url,
      (pr.created_at at time zone 'UTC') as created_ts,
      coalesce(pr.source_channel,
        case when pr.source_type = 'admin_reference' then 'online_capture'
             when pr.origin_region_code = 'Hexagone' then 'diaspora_scan'
             else 'martinique_scan' end) as chan
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false) and pr.price > 0
  ),
  fr_latest as (
    select distinct on (product_id)
      product_id, price, mainland_chain,
      coalesce(product_photo_url, evidence_photo_url) as photo_url,
      created_ts, chan
    from rows_scoped
    where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
    order by product_id, created_ts desc
  ),
  mtq_products as (
    select distinct product_id from rows_scoped where chan = 'martinique_scan'
  ),
  joined as (
    select
      f.product_id,
      p.name as product_name,
      f.photo_url,
      p.category_id,
      c.name as category_name,
      c.icon as category_icon,
      f.price as france_price,
      coalesce(f.mainland_chain, 'Autre') as chain,
      f.chan as channel,
      f.created_ts as captured_at
    from fr_latest f
    join public.products p on p.id = f.product_id
    left join public.categories c on c.id = p.category_id
    where not exists (select 1 from mtq_products m where m.product_id = f.product_id)
  )
  select * from joined
  where (p_category_id is null or category_id = p_category_id)
    and (p_chain is null or chain = p_chain)
  order by captured_at desc
  limit p_limit;
$$;

grant execute on function public.public_pending_france_to_mtq(uuid, text, int) to anon, authenticated;

-- 3. Lightweight counts for the header pill's "N à comparer" indicator ------
create or replace function public.public_pending_match_counts()
returns table (mtq_to_france bigint, france_to_mtq bigint)
language sql
security definer
set search_path = public
stable
as $$
  with rows_scoped as (
    select
      pr.product_id,
      coalesce(pr.source_channel,
        case when pr.source_type = 'admin_reference' then 'online_capture'
             when pr.origin_region_code = 'Hexagone' then 'diaspora_scan'
             else 'martinique_scan' end) as chan
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false) and pr.price > 0
  ),
  mtq_products as (select distinct product_id from rows_scoped where chan = 'martinique_scan'),
  fr_products  as (select distinct product_id from rows_scoped where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture'))
  select
    (select count(*) from mtq_products m where not exists (select 1 from fr_products f where f.product_id = m.product_id)),
    (select count(*) from fr_products f where not exists (select 1 from mtq_products m where m.product_id = f.product_id));
$$;

grant execute on function public.public_pending_match_counts() to anon, authenticated;

-- 4. Sanity checks ---------------------------------------------------------
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('public_pending_mtq_to_france', 'public_pending_france_to_mtq', 'public_pending_match_counts');

select * from public.public_pending_match_counts();
select * from public.public_pending_mtq_to_france(null, null, 10);
select * from public.public_pending_france_to_mtq(null, null, 10);
