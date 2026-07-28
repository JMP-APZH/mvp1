-- feature_request_comments_migration.sql
--
-- Context: adds public comments on feature requests/suggestions (open to
-- anyone logged in, on top of the existing up/down vote), and fixes a
-- pre-existing broken RLS policy that silently blocked admin status/reply
-- updates -- "Admins can update all feature requests" checked a `profiles`
-- table that doesn't exist in this project (same bug class fixed for
-- Leaderboard.jsx). Recreated using the same user_roles + (select auth.uid())
-- pattern used everywhere else in this codebase
-- (categories_admin_insert_migration.sql, barcode_audit_migration.sql).
--
-- feature_request_stats is recreated to also expose description/category/
-- created_at/admin_comment/comment_count -- Community.jsx already reads
-- description/category/created_at off rows from this view, but the view as
-- originally defined only had id/title/status/net_votes/upvotes/downvotes,
-- so those fields were rendering as undefined/Invalid Date before this fix.
-- No SECURITY DEFINER on the recreated view, per the earlier lint-fix noted
-- in CLAUDE.md.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED and verified live 2026-07-28 (comment post + admin reply
-- round-trip both confirmed via direct query).

create table if not exists feature_request_comments (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid references feature_requests(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_feature_request_comments_feature_id on feature_request_comments(feature_id);

alter table feature_request_comments enable row level security;

drop policy if exists "Feature comments are publicly readable" on feature_request_comments;
create policy "Feature comments are publicly readable" on feature_request_comments
  for select using (true);

drop policy if exists "Logged-in users can post feature comments" on feature_request_comments;
create policy "Logged-in users can post feature comments" on feature_request_comments
  for insert with check ((select auth.uid()) = user_id);


-- Fix: previous policy referenced a nonexistent `profiles` table, so it
-- never matched any admin and every admin status/reply update silently
-- failed RLS (42501), even for the real admin account.
drop policy if exists "Admins can update all feature requests" on feature_requests;
create policy "Admins can update all feature requests" on feature_requests
  for update using (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );


drop view if exists feature_request_stats;
create view feature_request_stats as
select
    f.id,
    f.title,
    f.description,
    f.category,
    f.status,
    f.admin_comment,
    f.created_at,
    coalesce(sum(v.vote_type), 0) as net_votes,
    count(v.id) filter (where v.vote_type = 1) as upvotes,
    count(v.id) filter (where v.vote_type = -1) as downvotes,
    (select count(*) from feature_request_comments c where c.feature_id = f.id) as comment_count
from feature_requests f
left join feature_votes v on f.id = v.feature_id
group by f.id;
