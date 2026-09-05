-- Migration: Pending-match fixes -- flag leaked test products, surface
-- existing admin/chain-app France reference prices as "confirmation" items
--
-- Status: NOT YET APPLIED.
--
-- Two follow-ups reported 2026-09-05 after using the new "Prix en attente de
-- comparaison" section (pending_match_migration.sql):
--
-- 1. Two products slipped through as "pending" even though they should be
--    hidden like every other test product. Root cause: product_test_flag_
--    migration.sql's one-time backfill only auto-flagged products already
--    named "TEST %" -- these two ("MilktestApi", "Milktest-Quagga") predate
--    that naming convention entirely (early scanner-API/Quagga dev artifacts,
--    one of them is the exact legacy null-store_id row already called out in
--    the Jul 21, 2026 ProductDetailModal CLAUDE.md entry). The RPC's own
--    is_test_data filter was already correct -- these just never got flagged
--    in the first place. Fixed at the data layer (flag them), not by adding
--    a second, drifting name-pattern heuristic alongside is_test_data.
--
-- 2. public_pending_mtq_to_france() only ever showed products with ZERO
--    France Hexagonale price of any kind -- so a product Jean-Marie had
--    already priced via MainlandPriceAdmin.jsx (source_channel =
--    'chain_app_screenshot' or 'online_capture') silently vanished from the
--    list the moment that admin reference was added, even though no real
--    diaspora scan had ever confirmed it. That's backwards for what this
--    list is for: those are exactly the highest-value items for a diaspora
--    scanner to visit (price + often a photo already known, gap already
--    computable, "confirm this" is a much easier ask than "find and price
--    this blind"). Redefined "pending" as "no diaspora_scan yet" instead of
--    "no France price of any kind", and now returns the existing reference
--    price/chain/channel/photo so the UI can show the gap and label it a
--    confirmation scan. Sorted: chain-app reference (usually has a photo)
--    first, then other admin reference, then no reference at all.

-- 1. Flag the two leaked test products -------------------------------------
update public.products
   set is_test_data = true
 where name in ('MilktestApi', 'Milktest-Quagga')
   and not coalesce(is_test_data, false);

-- 2. Rebuild public_pending_mtq_to_france with reference-price awareness ---
-- Return shape changed (new columns) -- must drop before recreate.
drop function if exists public.public_pending_mtq_to_france(uuid, text, int);

create or replace function public.public_pending_mtq_to_france(
  p_category_id uuid default null,
  p_chain text default null,
  p_limit int default 60
)
returns table (
  product_id        uuid,
  product_name      text,
  photo_url         text,
  category_id       uuid,
  category_name     text,
  category_icon     text,
  mtq_price         numeric,
  suggested_chain   text,
  store_name        text,
  scanned_at        timestamptz,
  reference_price   numeric,
  reference_chain   text,
  reference_channel text,
  reference_photo_url text
)
language sql
security definer
set search_path = public
stable
as $$
  with rows_scoped as (
    select
      pr.product_id, pr.price, pr.store_id, pr.product_photo_url,
      pr.mainland_chain, pr.evidence_photo_url,
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
  -- Only a genuine community scan in France counts as "done" -- an
  -- admin-entered reference (chain_app_screenshot / online_capture) still
  -- wants a real confirmation scan, so it stays in the pending list below.
  diaspora_products as (
    select distinct product_id from rows_scoped where chan = 'diaspora_scan'
  ),
  -- Best existing reference per product: chain_app_screenshot preferred
  -- (comes with an evidence photo) over online_capture, most recent within
  -- whichever channel wins.
  fr_reference as (
    select distinct on (product_id)
      product_id, price, mainland_chain, chan,
      coalesce(product_photo_url, evidence_photo_url) as photo_url
    from rows_scoped
    where chan in ('chain_app_screenshot', 'online_capture')
    order by product_id,
      (case when chan = 'chain_app_screenshot' then 0 else 1 end),
      created_ts desc
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
      m.created_ts as scanned_at,
      r.price as reference_price,
      r.mainland_chain as reference_chain,
      r.chan as reference_channel,
      r.photo_url as reference_photo_url
    from mtq_latest m
    join public.products p on p.id = m.product_id
    left join public.categories c on c.id = p.category_id
    left join public.stores s on s.id = m.store_id
    left join fr_reference r on r.product_id = m.product_id
    where not exists (select 1 from diaspora_products d where d.product_id = m.product_id)
  )
  select * from joined
  where (p_category_id is null or category_id = p_category_id)
    and (p_chain is null or suggested_chain = p_chain or reference_chain = p_chain)
  order by
    (case
      when reference_channel = 'chain_app_screenshot' then 0
      when reference_channel = 'online_capture' then 1
      else 2
    end),
    scanned_at desc
  limit p_limit;
$$;

grant execute on function public.public_pending_mtq_to_france(uuid, text, int) to anon, authenticated;

-- 3. public_pending_match_counts: mtq_to_france now counts "no diaspora
--    scan yet" (matching the redefinition above), not "no France price at
--    all" -- so this count includes chain_app_screenshot/online_capture-
--    only products, which previously (incorrectly) counted as already done.
drop function if exists public.public_pending_match_counts();

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
  mtq_products      as (select distinct product_id from rows_scoped where chan = 'martinique_scan'),
  diaspora_products as (select distinct product_id from rows_scoped where chan = 'diaspora_scan'),
  fr_products       as (select distinct product_id from rows_scoped where chan in ('diaspora_scan', 'chain_app_screenshot', 'online_capture'))
  select
    (select count(*) from mtq_products m where not exists (select 1 from diaspora_products d where d.product_id = m.product_id)),
    (select count(*) from fr_products f where not exists (select 1 from mtq_products m where m.product_id = f.product_id));
$$;

grant execute on function public.public_pending_match_counts() to anon, authenticated;

-- 4. Sanity checks ----------------------------------------------------------
select id, name, is_test_data from public.products where name in ('MilktestApi', 'Milktest-Quagga');
-- expect both true now

select * from public.public_pending_match_counts();

select product_id, product_name, mtq_price, reference_price, reference_chain, reference_channel
  from public.public_pending_mtq_to_france(null, null, 100)
 where reference_price is not null;
-- expect: products already given an admin/chain-app France reference, now
-- visible here (were previously invisible), with their existing price/chain.
