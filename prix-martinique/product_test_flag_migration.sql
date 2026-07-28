-- product_test_flag_migration.sql
--
-- Context: admin wants to flag test/demo products separately from real
-- end-user scans, without deleting them (prototype phase -- test data has
-- ongoing value for demos and shouldn't be destroyed). Adds a boolean flag
-- on `products`, auto-backfills it for everything already named with the
-- "TEST ..." convention already used organically throughout this project's
-- QA history, and indexes it for the Comparer feed's exclusion filter.
--
-- No RLS policy needed: `products` has no row level security enabled at
-- all today (confirmed -- no `enable row level security` or policy exists
-- for this table anywhere in the schema history), consistent with regular
-- end users being able to create new products directly while scanning.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: NOT YET APPLIED as of writing (2026-07-28).

alter table products add column if not exists is_test_data boolean not null default false;

-- Auto-flag: everything already following the "TEST ..." naming convention
-- used throughout this project's QA history so far.
update products set is_test_data = true where name ilike 'TEST %';

create index if not exists idx_products_is_test_data on products(is_test_data);
