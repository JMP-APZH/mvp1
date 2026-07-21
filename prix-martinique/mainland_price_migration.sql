-- Migration: France Hexagonale reference prices (admin-entered)
--
-- Context: the core diaspora comparison feature (PriceDuel.jsx, wired into
-- App10.jsx's barcode-scan flow) already reads any `prices` row with
-- origin_region_code = 'Hexagone' for the same product_id and shows a
-- side-by-side "Duel des Prix" comparison. That mechanism already supports
-- French community members submitting their own prices (Option 1) -- it's
-- just never been fed any data. This migration adds what's needed for
-- Option 2: an admin manually entering a mainland reference price found
-- online, since there's no French store in `stores` (it's a
-- Martinique-only table) to attach store_id to.
--
-- New columns on `prices` (all nullable, all Hexagone-specific):
--   mainland_chain -- which French chain the reference price came from
--   source_type    -- 'scan' (default, a real user submission) vs
--                     'admin_reference' (admin-entered from an online source)
--                     so the UI can honestly distinguish provenance
--   source_url     -- optional link to where the admin found the price
--
-- No RLS policy changes: `prices` already has an authenticated-write
-- policy (Feb 28, 2026 security audit) that every other admin tool in this
-- app relies on for its own write path (e.g. ProductCompletion.jsx editing
-- products.barcode/category_id) -- admin-only reach is enforced at the UI
-- layer only, consistently with that existing precedent, not at the DB
-- layer for this first version.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

alter table prices add column if not exists mainland_chain text
  check (mainland_chain is null or mainland_chain in ('Carrefour', 'E.Leclerc', 'Système U', 'Auchan', 'Autre'));

alter table prices add column if not exists source_type text not null default 'scan'
  check (source_type in ('scan', 'admin_reference'));

alter table prices add column if not exists source_url text;
