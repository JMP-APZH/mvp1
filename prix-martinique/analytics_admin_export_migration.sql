-- Migration: admin submission-detail RPC for CSV export + rich "Activité Récente" (M2a)
-- Status: NOT YET APPLIED (2026-09-03). Apply after analytics_admin_functions_migration.sql
-- (and its fix1). Plan: ANALYTICS_MONITORING_PLAN.md, Milestone 2a.
--
-- One admin-gated function that returns joined, human-readable submission rows.
-- Used by AdminDashboard for both:
--   * "Exporter CSV" (p_since = the selected date range, no limit)
--   * "Activité Récente" (p_since = null, p_limit = 8)
-- Reads from v_admin_prices (already admin-only), so scoping (test / channel /
-- internal) stays consistent with admin_kpi_overview.

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
    v.created_at,
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

-- Sanity: function exists + SECURITY DEFINER
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'admin_submissions_detail';
