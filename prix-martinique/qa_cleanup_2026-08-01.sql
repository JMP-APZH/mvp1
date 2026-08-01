-- qa_cleanup_2026-08-01.sql
--
-- Removes the "Test Offline Auth Round Trip QA" product (and its one price
-- row) created while live-verifying the offline-mode feature's authenticated
-- sync path on 2026-08-01 -- submitted offline, synced automatically on
-- reconnect, logged in as jm.philocles@gmail.com. Not app code -- one-off
-- cleanup, safe to delete this file after running.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: NOT YET APPLIED.

delete from product_bqp_associations
where product_id in (select id from products where name ilike 'Test Offline Auth Round Trip QA%');

delete from prices
where product_id in (select id from products where name ilike 'Test Offline Auth Round Trip QA%');

delete from products
where name ilike 'Test Offline Auth Round Trip QA%';

-- total_contributions needs no manual fix -- sync_total_contributions() (the
-- trigger added in the Jul 21, 2026 leaderboard fix) recomputes it from
-- COUNT(*) on prices automatically when the delete above removes this row.

-- Reverses the +10 points award_points() gave for this one test submission.
-- Unlike the Jul 27 cleanup (60 pts across 6 tests, left as a manual "if you
-- want" note), this is a single known +10 delta for a known user, so it's
-- applied directly rather than deferred. Doesn't cross any level/badge
-- threshold (70 -> 80, both well within Niveau 1), so no further adjustment
-- needed there.
update user_profiles
set points = points - 10
where id = (select id from auth.users where email = 'jm.philocles@gmail.com');
