-- QA cleanup: live end-to-end test of mandatory 3-photo submissions,
-- product-only registration, "Produits à compléter", and the admin -> user
-- inbox (Sept 5, 2026 (2) entry in CLAUDE.md).
--
-- Test data created on production, driven live via the dev server against
-- the real Supabase project:
--   - "TEST QA Photo Requirement - Produit Only": product-only registration
--     (front+back photos, no price), then completed with a price at
--     Leclerc C.C. Le Rond Point via "Produits à compléter" (+5 then +10 pts
--     to Maëlys 2 / a774f544-cbfb-4ec0-867e-75980b347f4c).
--   - "TEST QA Photo Requirement - Full Submission": one-shot full submission
--     (3 photos + price + store together, +10 pts to the same account).
--   - "TEST QA Negative No Photo": attempted with no photos to confirm the
--     new validation blocks it -- correctly rejected client-side, no row
--     was ever created for this one (nothing to clean up).
--   - One user_messages row (JMP2_972 -> Maëlys 2, "Signaler à l'auteur"
--     quick-fill: "Photo à reprendre : code-barres"), sent from
--     ProductCompletion.jsx's admin composer to verify the inbox round-trip.
--
-- Does not reverse the +25 points awarded to a774f544-... (Maëlys 2) during
-- testing, matching every prior qa_cleanup_*.sql's convention for test
-- accounts.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: NOT YET APPLIED.

delete from user_messages
  where related_product_id in (
    select id from products where name ilike 'TEST QA Photo Requirement%'
  );

delete from prices
  where product_id in (
    select id from products where name ilike 'TEST QA Photo Requirement%'
  );

delete from products
  where name ilike 'TEST QA Photo Requirement%';
