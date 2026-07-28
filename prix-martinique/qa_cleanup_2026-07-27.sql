-- qa_cleanup_2026-07-27.sql
--
-- Removes the 6 "TEST QA Celebration Overlay ..." products (and their
-- associated prices, points-transaction history, and the one BQP
-- association) created while live-testing the submission-flow fixes on
-- 2026-07-27, logged in as jm.philocles@gmail.com. Not app code -- one-off
-- cleanup, safe to delete this file after running.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED and verified live 2026-07-28 (zero rows remaining across
-- products/prices/product_bqp_associations; no orphaned shopping_list_items).

delete from product_bqp_associations
where product_id in (select id from products where name ilike 'TEST QA Celebration Overlay%');

delete from prices
where product_id in (select id from products where name ilike 'TEST QA Celebration Overlay%');

delete from products
where name ilike 'TEST QA Celebration Overlay%';

-- Note: the +10 points awarded per test submission (60 pts total across the
-- 6 tests) were NOT reversed by this script -- award_points() only adds, it
-- has no corresponding "revoke" path. If you want jm.philocles@gmail.com's
-- points/level back to their pre-testing value, that needs a manual
-- `update user_profiles set points = points - 60 where id = '<user_id>'`
-- (and re-deriving level = points/100 + 1), run separately if wanted.
