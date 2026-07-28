-- product_favorite_counts_migration.sql
--
-- Context: "Prix recherchés" feature -- for each of a user's favorite
-- stores, show products the community wants priced there (favorited by
-- someone, not yet priced at that store), with a "N personnes le veulent"
-- count. `user_favorites` RLS is intentionally locked to
-- (auth.uid() = user_id) -- individual favorite lists are private, and
-- this migration does not change that. Instead, this adds one narrow
-- SECURITY DEFINER function that returns ONLY aggregate counts per
-- product (never which user favorited what), so demand can be surfaced
-- without exposing anyone's personal favorites list.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED and verified live 2026-07-28 (get_product_favorite_counts()
-- called successfully; end-to-end "Prix recherchés" test confirmed real data).

create or replace function get_product_favorite_counts()
returns table(product_id uuid, favorite_count bigint)
language sql
security definer
set search_path = public
as $$
  select product_id, count(*) as favorite_count
  from user_favorites
  group by product_id;
$$;

grant execute on function get_product_favorite_counts() to authenticated;
