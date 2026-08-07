-- Migration: Community recipe ideas + likes + favorites
--
-- Context: the "Idées recettes" hub (RecipesHubModal.jsx) now lets any
-- logged-in user submit a lightweight recipe idea -- title, description,
-- and a meal-time category -- similar in shape to product_comments, not the
-- full admin-curated recipes/recipe_ingredients structure (RecipeAdmin.jsx).
-- Anyone (including anonymous visitors) can read ideas and their like counts.
-- Favorites are private to the favoriting user, same shape as user_favorites.
--
-- The most-liked ideas are intended to eventually be manually promoted into
-- the official `recipes` table (with product-matched ingredients) via
-- RecipeAdmin.jsx -- no automated promotion here, this is submission +
-- like + favorite only.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create table if not exists community_recipe_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  meal_category text not null check (meal_category in ('petit-dejeuner', 'snack-matin', 'dejeuner', 'gouter', 'diner')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_community_recipe_ideas_meal_category on community_recipe_ideas(meal_category);

alter table community_recipe_ideas enable row level security;

drop policy if exists "Community recipe ideas are publicly readable" on community_recipe_ideas;
create policy "Community recipe ideas are publicly readable" on community_recipe_ideas
  for select using (true);

drop policy if exists "Logged-in users can submit recipe ideas" on community_recipe_ideas;
create policy "Logged-in users can submit recipe ideas" on community_recipe_ideas
  for insert with check ((select auth.uid()) = user_id);


create table if not exists community_recipe_idea_likes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references community_recipe_ideas(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(idea_id, user_id)
);

create index if not exists idx_community_recipe_idea_likes_idea_id on community_recipe_idea_likes(idea_id);

alter table community_recipe_idea_likes enable row level security;

drop policy if exists "Recipe idea likes are publicly readable" on community_recipe_idea_likes;
create policy "Recipe idea likes are publicly readable" on community_recipe_idea_likes
  for select using (true);

drop policy if exists "Logged-in users can like recipe ideas" on community_recipe_idea_likes;
create policy "Logged-in users can like recipe ideas" on community_recipe_idea_likes
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own recipe idea like" on community_recipe_idea_likes;
create policy "Users can remove their own recipe idea like" on community_recipe_idea_likes
  for delete using ((select auth.uid()) = user_id);


create table if not exists community_recipe_idea_favorites (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references community_recipe_ideas(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(idea_id, user_id)
);

create index if not exists idx_community_recipe_idea_favorites_user_id on community_recipe_idea_favorites(user_id);

alter table community_recipe_idea_favorites enable row level security;

-- Private, unlike the likes above: mirrors user_favorites (own rows only),
-- not a public "who favorited what" signal.
drop policy if exists "Users can view their own recipe idea favorites" on community_recipe_idea_favorites;
create policy "Users can view their own recipe idea favorites" on community_recipe_idea_favorites
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Logged-in users can favorite recipe ideas" on community_recipe_idea_favorites;
create policy "Logged-in users can favorite recipe ideas" on community_recipe_idea_favorites
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own recipe idea favorite" on community_recipe_idea_favorites;
create policy "Users can remove their own recipe idea favorite" on community_recipe_idea_favorites
  for delete using ((select auth.uid()) = user_id);
