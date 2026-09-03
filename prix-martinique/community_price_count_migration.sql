-- Migration: honest community-contribution count for the app header pill
-- Status: NOT YET APPLIED (2026-09-03). Apply via Supabase Dashboard -> SQL Editor.
--
-- Bug the app owner flagged: the header pill "{recentPrices.length} prix
-- partagés" (App10.jsx, code comment "community contribution count (everyone)")
-- is meant to be a community *total*, but `recentPrices` is the Comparer *feed*:
--   1. only the 50 most-recent `prices` rows are fetched (`.limit(50)`)
--   2. minus origin_region_code = 'Hexagone' rows
--   3. minus test-flagged products
-- So it shows ~35 and barely moves however much the community contributes --
-- new scans just push older ones out of the 50-row window. It also never lines
-- up with Console Admin's "Contributions de prix" (61).
--
-- Fix: a lightweight public count RPC with the same scoping as
-- admin_kpi_overview.real_submissions *without* the internal-account filter
-- (the public total legitimately counts every contributor, team included):
-- real user scans (Martinique + diaspora), excluding admin-entered France
-- reference prices and test/demo products. Returns a single number -- no
-- row-level data, safe for `anon`.

create or replace function public.community_price_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint
  from public.prices pr
  left join public.products p on p.id = pr.product_id
  where not coalesce(p.is_test_data, false)
    and coalesce(pr.source_type, 'scan') <> 'admin_reference';
$$;

grant execute on function public.community_price_count() to anon, authenticated;

-- Sanity: should equal Console Admin -> "Contributions de prix" with the
-- "Exclure les comptes internes" toggle OFF.
select public.community_price_count() as prix_partages_communaute;
