-- QA cleanup: live end-to-end test submission for the Sept 1 launch-prep pass
-- (rebrand, banner pill relocation, Essentiel/Optionnel form restructure),
-- run against production as JMP2_972 to verify the full price-submission
-- flow (barcode -> prix -> photos -> categorie order, is_local_production,
-- is_mdd, and BQP linking) actually persists correctly end to end.
--
-- Created one real row: "TEST QA Essentiel Optionnel Rebrand" in products
-- (id 96e0d254-15b6-45f4-afe7-daa8821d2990), its prices row (3.99 EUR at
-- Carrefour Express FDF-Etang Z'Abricot, store_id 39), and its
-- product_bqp_associations row (linked to H-01 - Lait ecreme/demi-ecreme UHT).
-- Confirmed all fields wrote correctly (is_local_production/is_mdd/
-- is_declared_bqp all true, category_id set to Produits Laitiers) before
-- writing this cleanup.
--
-- Does NOT reverse the +10 points awarded to JMP2_972 during testing --
-- manually adjust user_profiles.points for that account if wanted.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED 2026-09-01 (Jean-Marie, Supabase SQL Editor). Does not
-- reverse the +10 points awarded to JMP2_972 (test account, left as-is).

delete from product_bqp_associations
  where product_id in (select id from products where name ilike 'TEST QA Essentiel Optionnel Rebrand%');

delete from prices
  where product_id in (select id from products where name ilike 'TEST QA Essentiel Optionnel Rebrand%');

delete from products
  where name ilike 'TEST QA Essentiel Optionnel Rebrand%';
