-- Migration: Fix get_bqp_vote_stats() referencing a nonexistent column
--
-- Context: found while auditing components ahead of the RPPRAC presentation.
-- App10.jsx's fetchBqpVotes() calls this RPC every time a barcode with an
-- existing BQP association is scanned (src/App10.jsx ~line 438), expecting
-- { upvotes, downvotes, user_vote, quality_upvotes, quality_downvotes,
--   quality_user_vote }. It has been failing on every call with:
--   "column vote_type does not exist" (42703)
-- because bqp_quality_votes uses a column named `vote` (see
-- milestone2_schema.sql), not `vote_type` like bqp_votes (see
-- bqp_votes_schema.sql). Confirmed live: both bqp_votes and
-- bqp_quality_votes currently have 0 rows, consistent with community
-- voting having never successfully round-tripped through this RPC.
--
-- The call site already invokes this function successfully by name with
-- named params (p_association_id, p_user_id) -- it only errors inside the
-- function body -- so CREATE OR REPLACE with this exact signature replaces
-- the existing broken function in place rather than creating an overload.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create or replace function get_bqp_vote_stats(
  p_association_id uuid,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_upvotes integer;
  v_downvotes integer;
  v_user_vote integer;
  v_quality_upvotes integer;
  v_quality_downvotes integer;
  v_quality_user_vote integer;
  v_result json;
begin
  select product_id into v_product_id
  from product_bqp_associations
  where id = p_association_id;

  select
    count(*) filter (where vote_type = 1),
    count(*) filter (where vote_type = -1)
  into v_upvotes, v_downvotes
  from bqp_votes
  where association_id = p_association_id;

  select vote_type into v_user_vote
  from bqp_votes
  where association_id = p_association_id and user_id = p_user_id;

  if v_product_id is not null then
    select
      count(*) filter (where vote = 1),
      count(*) filter (where vote = -1)
    into v_quality_upvotes, v_quality_downvotes
    from bqp_quality_votes
    where product_id = v_product_id;

    select vote into v_quality_user_vote
    from bqp_quality_votes
    where product_id = v_product_id and user_id = p_user_id;
  end if;

  select json_build_object(
    'upvotes', coalesce(v_upvotes, 0),
    'downvotes', coalesce(v_downvotes, 0),
    'user_vote', coalesce(v_user_vote, 0),
    'quality_upvotes', coalesce(v_quality_upvotes, 0),
    'quality_downvotes', coalesce(v_quality_downvotes, 0),
    'quality_user_vote', coalesce(v_quality_user_vote, 0)
  ) into v_result;

  return v_result;
end;
$$;
