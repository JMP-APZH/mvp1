-- Migration: Wire up the badges system (P2 design review item)
--
-- Context: `badges` already has 7 real, well-designed rows (Débutant,
-- Contributeur, Chasseur de prix, Expert, Légende, Photographe, Scanneur
-- Pro), each with a `points_required` threshold -- clearly the original
-- intended design was points-threshold badges. But nothing anywhere in the
-- codebase ever inserted into `user_badges` (confirmed live: 0 rows), and
-- `user_badges` has no INSERT policy at all (only "viewable by everyone"
-- SELECT) -- a client-side award attempt would fail with an RLS violation.
--
-- Rather than add a client-side award call + a new RLS policy, extend the
-- existing award_points() RPC (already SECURITY DEFINER, already the one
-- place points get written) to also award any newly-qualifying badges in
-- the same atomic call. This is the exact function fixed on 2026-07-21 for
-- the activity-type signature bug -- same body, plus the badge-awarding
-- insert, plus an explicit `set search_path = public` to preserve the
-- Feb 28, 2026 security-audit fix (mutable search_path) regardless of
-- whether CREATE OR REPLACE would otherwise carry it forward.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create or replace function award_points(
  p_user_id uuid,
  p_activity_type text,
  p_points integer,
  p_description text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  current_points integer;
  new_points integer;
  new_level integer;
  v_result json;
begin
  -- 1. Ensure profile exists
  insert into user_profiles (id, points)
  values (p_user_id, 0)
  on conflict (id) do nothing;

  -- 2. Update points
  update user_profiles
  set points = points + p_points
  where id = p_user_id
  returning points into new_points;

  -- 3. Calculate Level (Simple logic: 1 level per 100 points)
  new_level := (new_points / 100) + 1;

  update user_profiles
  set level = new_level
  where id = p_user_id;

  -- 4. Award any newly-qualifying badges (idempotent: unique(user_id, badge_id))
  insert into user_badges (user_id, badge_id)
  select p_user_id, b.id
  from badges b
  where b.points_required <= new_points
  on conflict (user_id, badge_id) do nothing;

  -- 5. Return result
  select json_build_object(
    'new_points', new_points,
    'new_level', new_level,
    'awarded', p_points
  ) into v_result;

  return v_result;
end;
$$;

-- One-time backfill: award every badge each user already qualifies for
-- based on their current points, so existing contributors (Tony, etc.)
-- aren't stuck at zero badges until their next point-earning action.
insert into user_badges (user_id, badge_id)
select up.id, b.id
from user_profiles up
join badges b on b.points_required <= up.points
on conflict (user_id, badge_id) do nothing;
