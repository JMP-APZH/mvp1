-- Migration: Keep user_profiles.total_contributions in sync with actual `prices` rows
--
-- Context: total_contributions was never written to by award_points() or any
-- other backend code, so it always read 0. Leaderboard.jsx worked around this
-- by deriving the count client-side (COUNT(prices) per user on every load).
-- This migration makes the column itself authoritative via a DB trigger, so
-- it can no longer drift out of sync with app-layer bugs (the same failure
-- class as the award_points regression fixed 2026-07-21).
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

-- 1. Backfill existing rows so historical activity is reflected immediately.
update user_profiles up
set total_contributions = (
  select count(*) from prices p where p.user_id = up.id
);

-- 2. Trigger function: recompute the affected user's count from prices,
--    rather than incrementing/decrementing counters, to avoid drift.
create or replace function sync_total_contributions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.user_id is not null then
    update user_profiles
    set total_contributions = (select count(*) from prices where user_id = new.user_id)
    where id = new.user_id;
  end if;

  if (tg_op = 'DELETE' or tg_op = 'UPDATE') and old.user_id is not null
     and (tg_op = 'DELETE' or old.user_id is distinct from new.user_id) then
    update user_profiles
    set total_contributions = (select count(*) from prices where user_id = old.user_id)
    where id = old.user_id;
  end if;

  return coalesce(new, old);
end;
$$;

-- 3. Wire the trigger to the prices table.
drop trigger if exists on_price_change_sync_contributions on prices;
create trigger on_price_change_sync_contributions
after insert or update or delete on prices
for each row execute function sync_total_contributions();
