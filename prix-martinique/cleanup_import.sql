-- Cleanup Temporary Import Policies
-- Run this to restore strict security on the table

drop policy if exists "Allow public insert for import" on bqp_categories;
drop policy if exists "Allow public update for import" on bqp_categories;
