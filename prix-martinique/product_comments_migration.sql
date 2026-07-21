-- Migration: Product comments + likes
--
-- Context: product detail cards (ProductDetailModal.jsx) need a comment
-- section. Logged-in users can post; anyone (including anonymous visitors)
-- can read. Comments show author + a "Top Chasseur" badge if the author is
-- currently in the top 3 of the global leaderboard. Comments are ordered
-- by like count (most-liked first) on the client, using the counts these
-- tables expose.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create table if not exists product_comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_product_comments_product_id on product_comments(product_id);

alter table product_comments enable row level security;

drop policy if exists "Comments are publicly readable" on product_comments;
create policy "Comments are publicly readable" on product_comments
  for select using (true);

drop policy if exists "Logged-in users can post comments" on product_comments;
create policy "Logged-in users can post comments" on product_comments
  for insert with check ((select auth.uid()) = user_id);


create table if not exists product_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references product_comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(comment_id, user_id)
);

create index if not exists idx_product_comment_likes_comment_id on product_comment_likes(comment_id);

alter table product_comment_likes enable row level security;

drop policy if exists "Comment likes are publicly readable" on product_comment_likes;
create policy "Comment likes are publicly readable" on product_comment_likes
  for select using (true);

drop policy if exists "Logged-in users can like comments" on product_comment_likes;
create policy "Logged-in users can like comments" on product_comment_likes
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own like" on product_comment_likes;
create policy "Users can remove their own like" on product_comment_likes
  for delete using ((select auth.uid()) = user_id);
