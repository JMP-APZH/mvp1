-- Migration: M2b fix2 — admin_submissions_browse store_id is bigint, not uuid
-- Status: NOT YET APPLIED (2026-09-03). Apply after analytics_admin_m2b_fix1_migration.sql.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 2b.
--
-- After fix1 cleared the 42702 ambiguity, admin_submissions_browse hit:
--   42804: Returned type bigint does not match expected type uuid in column 6
--          (structure of query does not match function result type)
-- Column 6 is `store_id`. prices.store_id / stores.id are `bigint` (unlike
-- prices.id and products.id, which are uuid) — the RETURNS TABLE guessed wrong.
--
-- Fix: `store_id bigint`. The client (AdminDrillPanel) never reads store_id
-- (only store_name + product_id), so no app change. Signature unchanged, but
-- the return type changes -> DROP + recreate.

drop function if exists public.admin_submissions_browse(timestamptz, boolean, text, boolean, integer, integer);

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
  store_id            bigint,
  store_name          text,
  contributor_id      uuid,
  contributor_name    text,
  contributor_is_new  boolean,
  channel             text,
  is_test             boolean,
  review_reason       text,
  total_count         bigint
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

grant execute on function public.admin_submissions_browse(timestamptz, boolean, text, boolean, integer, integer) to authenticated;

-- Sanity: first page of the moderation queue (guard bypassed here as postgres?
-- no -- the guard checks auth.uid(); from the SQL Editor it raises 42501, which
-- is expected. Use the raw preview below instead.)
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
where nullif(concat_ws(' ',
    case when p.channel in ('martinique_scan','diaspora_scan') and p.store_id is null then 'x' end,
    case when m.n >= 3 and m.med > 0 and (p.price > m.med * 3 or p.price < m.med * 0.34) then 'x' end,
    case when p.contributor_created_at is not null and p.created_ts - p.contributor_created_at < interval '7 days' then 'x' end
  ), '') is not null
order by p.created_ts desc
limit 15;
