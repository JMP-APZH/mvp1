-- Migration: MTQ↔Hexagone verification queue (M4b)
-- Status: NOT YET APPLIED (2026-09-03). Apply after mainland_match_pipeline_migration.sql.
-- Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 4b.
--
-- M4a shipped the coverage + gap analytics and the match_verified* columns.
-- M4b adds the review queue: list the unverified France price rows next to the
-- MTQ price they'll be compared against, and let an admin confirm (mark
-- verified) or reject (delete the row) each one.

-- 1. Unverified France entries, with the MTQ price they pair against --------
create or replace function public.admin_mainland_match_queue(p_limit integer default 50)
returns table (
  price_id            uuid,
  created_at          timestamptz,
  product_id          uuid,
  product_name        text,
  france_price        numeric,
  mainland_chain      text,
  source_channel      text,
  evidence_photo_url  text,
  source_url          text,
  mtq_price           numeric,   -- latest real MTQ price for this product (null if none)
  gap_pct             numeric    -- (mtq - france)/france*100 (+ = MTQ dearer; null if no MTQ price)
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
    p_limit := 50;
  end if;

  return query
  with mtq_latest as (
    select distinct on (pr.product_id) pr.product_id, pr.price
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where not coalesce(p.is_test_data, false)
      and pr.price > 0
      and coalesce(pr.source_channel,
            case when pr.source_type = 'admin_reference' then 'online_capture'
                 when pr.origin_region_code = 'Hexagone' then 'diaspora_scan'
                 else 'martinique_scan' end) = 'martinique_scan'
    order by pr.product_id, pr.created_at desc
  )
  select
    fr.id,
    (fr.created_at at time zone 'UTC'),
    fr.product_id,
    coalesce(p.name, '(produit supprimé)'),
    fr.price,
    fr.mainland_chain,
    coalesce(fr.source_channel,
      case when fr.source_type = 'admin_reference' then 'online_capture'
           else 'diaspora_scan' end),
    fr.evidence_photo_url,
    fr.source_url,
    m.price,
    round(((m.price - fr.price) / nullif(fr.price, 0) * 100.0)::numeric, 1)
  from public.prices fr
  join public.products p on p.id = fr.product_id
  left join mtq_latest m on m.product_id = fr.product_id
  where not coalesce(p.is_test_data, false)
    and not coalesce(fr.match_verified, false)
    and coalesce(fr.source_channel,
          case when fr.source_type = 'admin_reference' then 'online_capture'
               when fr.origin_region_code = 'Hexagone' then 'diaspora_scan'
               else 'martinique_scan' end)
        in ('diaspora_scan', 'chain_app_screenshot', 'online_capture')
  order by fr.created_at desc
  limit p_limit;
end;
$$;

-- 2. Verify (confirm) or reject (delete) a France entry ------------------
create or replace function public.admin_verify_mainland_match(
  p_price_id uuid,
  p_ok       boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = v_uid and role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if p_ok then
    update public.prices
       set match_verified = true,
           match_verified_by = v_uid,
           match_verified_at = now()
     where id = p_price_id;
    return 'verified';
  else
    delete from public.prices where id = p_price_id;
    return 'rejected';
  end if;
end;
$$;

grant execute on function public.admin_mainland_match_queue(integer)          to authenticated;
grant execute on function public.admin_verify_mainland_match(uuid, boolean)   to authenticated;

-- 3. Sanity checks ---------------------------------------------------
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_mainland_match_queue', 'admin_verify_mainland_match');

-- raw queue preview (guard bypassed)
with mtq_latest as (
  select distinct on (pr.product_id) pr.product_id, pr.price
  from public.prices pr join public.products p on p.id = pr.product_id
  where not coalesce(p.is_test_data, false) and pr.price > 0
    and coalesce(pr.source_channel, case when pr.source_type='admin_reference' then 'online_capture' when pr.origin_region_code='Hexagone' then 'diaspora_scan' else 'martinique_scan' end) = 'martinique_scan'
  order by pr.product_id, pr.created_at desc
)
select p.name, fr.price as france_price, fr.mainland_chain,
  coalesce(fr.source_channel, 'online_capture') as chan,
  m.price as mtq_price,
  round(((m.price - fr.price) / nullif(fr.price,0) * 100.0)::numeric, 1) as gap_pct
from public.prices fr
join public.products p on p.id = fr.product_id
left join mtq_latest m on m.product_id = fr.product_id
where not coalesce(p.is_test_data, false)
  and not coalesce(fr.match_verified, false)
  and coalesce(fr.source_channel, case when fr.source_type='admin_reference' then 'online_capture' when fr.origin_region_code='Hexagone' then 'diaspora_scan' else 'martinique_scan' end)
      in ('diaspora_scan','chain_app_screenshot','online_capture')
order by fr.created_at desc
limit 20;
