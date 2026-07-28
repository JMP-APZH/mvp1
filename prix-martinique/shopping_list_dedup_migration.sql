-- shopping_list_dedup_migration.sql
--
-- Context: reported that the Panier (shopping list) empties itself on
-- refresh. Root cause: getOrCreatePrimaryList() (src/hooks/useShoppingList.js)
-- used .maybeSingle() to find the user's one primary shopping_lists row --
-- but .maybeSingle() errors (returning null data, silently swallowed since
-- only `data` was destructured) whenever MORE than one row matches. On error
-- it fell through to creating a brand-new empty primary list every time,
-- which is itself another duplicate -- a self-reinforcing bug. The schema
-- file (shopping_list_schema.sql) even has the fix commented out under
-- "Ensure only one primary list per user (optional, but good practice)" --
-- it was optional in theory, load-bearing in practice.
--
-- One real account (the admin/test account used throughout dev) accumulated
-- 152 duplicate is_primary=true rows this way, 9 of which had real items
-- scattered across them -- explaining exactly the reported symptom: items
-- added under one list_id, then a fresh reload points at a different
-- (empty) list_id.
--
-- This migration is generic (fixes ANY user affected, not just the one
-- found) and idempotent (safe to re-run; safe even if items were already
-- merged manually before this runs -- the merge steps just no-op).
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED and verified live 2026-07-28 (affected account back to a
-- single primary list, all scattered items merged, confirmed via direct query).

-- Step 1: merge every item from duplicate primary lists into the oldest
-- (canonical) primary list per user, summing quantities on conflict.
with canonical as (
  select distinct on (user_id) id as canonical_id, user_id
  from shopping_lists
  where is_primary = true
  order by user_id, created_at asc
),
dup_items as (
  select sli.product_id, c.canonical_id, sum(sli.quantity) as total_qty
  from shopping_list_items sli
  join shopping_lists sl on sl.id = sli.list_id
  join canonical c on c.user_id = sl.user_id
  where sl.is_primary = true and sl.id <> c.canonical_id
  group by sli.product_id, c.canonical_id
)
insert into shopping_list_items (list_id, product_id, quantity)
select canonical_id, product_id, total_qty from dup_items
on conflict (list_id, product_id) do update
  set quantity = shopping_list_items.quantity + excluded.quantity;

-- Step 2: delete the now-redundant duplicate primary lists (cascades to
-- their shopping_list_items automatically -- already merged above).
with canonical as (
  select distinct on (user_id) id as canonical_id, user_id
  from shopping_lists
  where is_primary = true
  order by user_id, created_at asc
)
delete from shopping_lists sl
using canonical c
where sl.is_primary = true
  and sl.user_id = c.user_id
  and sl.id <> c.canonical_id;

-- Step 3: prevent recurrence at the DB level -- only safe to add now that
-- step 2 has removed all existing duplicates.
create unique index if not exists idx_shopping_lists_primary_user
on shopping_lists (user_id) where (is_primary = true);

-- Sanity check after running the above -- should return zero rows:
-- select user_id, count(*) from shopping_lists where is_primary = true group by user_id having count(*) > 1;
