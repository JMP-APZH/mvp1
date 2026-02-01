-- Temporary Policy to Allow Data Import
-- Run this to allow the import script (using Anon key) to populate the table

create policy "Allow public insert for import" on bqp_categories
for insert with check (true);

create policy "Allow public update for import" on bqp_categories
for update using (true);
