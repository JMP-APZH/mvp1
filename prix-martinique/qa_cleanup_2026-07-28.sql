-- qa_cleanup_2026-07-28.sql
--
-- Removes the single "TEST QA Feature Comments" suggestion (+ its vote and
-- comment) created while live-testing the new feature-request comments +
-- admin-reply feature on 2026-07-28, logged in as jm.philocles@gmail.com.
-- None of feature_requests/feature_votes/feature_request_comments have a
-- DELETE policy (by design -- append-only, same as product_comments), so
-- this can't be cleaned up from the app itself; needs to run here.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: NOT YET APPLIED as of writing.

delete from feature_request_comments
where feature_id in (select id from feature_requests where title = 'TEST QA Feature Comments');

delete from feature_votes
where feature_id in (select id from feature_requests where title = 'TEST QA Feature Comments');

delete from feature_requests
where title = 'TEST QA Feature Comments';
