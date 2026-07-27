-- recipes_schema.sql
--
-- Phase 1 of the "Idées recettes" feature: admin-curated recipes shown inside
-- the Panier tab (ShoppingList.jsx), with ingredient lists priced against the
-- existing `prices` table and a "J'ai cuisiné cette recette" gamification hook.
--
-- recipes.created_by / recipes.is_community_submitted are unused in phase 1
-- (always null / false) -- they exist now so phase 2 (open community
-- submission) doesn't require a schema change later.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED and verified live 2026-07-27.

-- 1. Recipes
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  servings integer default 4,
  prep_time_minutes integer,
  category text, -- free text, e.g. 'Plat principal' -- not FK'd to `categories` (that table models product categories, not meal types)
  difficulty text check (difficulty in ('facile', 'moyen', 'difficile')),
  is_active boolean not null default true, -- hide-without-delete, same convention as other soft-disable flags in this schema
  created_by uuid references auth.users(id) on delete set null, -- phase 2 fwd-compat only; always null in phase 1
  is_community_submitted boolean not null default false, -- phase 2 fwd-compat only; always false in phase 1
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_recipes_is_active on recipes(is_active);

-- 2. Recipe ingredients
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  ingredient_name text not null, -- always present regardless of product match, e.g. "Sel", "Poudre de colombo"
  product_id uuid references products(id) on delete set null, -- nullable: not every ingredient has a price-tracked product match
  quantity numeric, -- e.g. 1, 0.5, 500 -- display only in phase 1 (see RecipeDetailModal.jsx notes on why it isn't converted into a shopping-list unit count)
  unit text, -- free text, e.g. 'kg', 'g', 'pièce(s)', 'L', 'cL', 'botte', 'au goût'
  display_order integer not null default 0,
  notes text, -- e.g. "ou piment végétarien"
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_recipe_ingredients_recipe_id on recipe_ingredients(recipe_id);
create index if not exists idx_recipe_ingredients_product_id on recipe_ingredients(product_id);

-- 3. Cooked log (gamification hook)
-- unique(user_id, recipe_id, cooked_on) caps points to once per calendar day
-- per recipe, while still letting a recurring weekly cook re-earn points on a
-- later day -- not a once-ever cap.
create table if not exists recipe_cooked_log (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  cooked_on date not null default (timezone('utc'::text, now()))::date,
  points_awarded integer not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique(user_id, recipe_id, cooked_on)
);

create index if not exists idx_recipe_cooked_log_user_id on recipe_cooked_log(user_id);
create index if not exists idx_recipe_cooked_log_recipe_id on recipe_cooked_log(recipe_id);

-- 4. RLS
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_cooked_log enable row level security;

-- recipes: public read (including is_active = false rows -- filtering inactive
-- recipes out of the public UI is done client-side, same convention as every
-- other soft-disable flag in this schema); admin-only write.
drop policy if exists "Recipes are publicly readable" on recipes;
create policy "Recipes are publicly readable" on recipes for select using (true);

drop policy if exists "Admins can add recipes" on recipes;
create policy "Admins can add recipes" on recipes
  for insert with check (
    exists (select 1 from user_roles where user_id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "Admins can update recipes" on recipes;
create policy "Admins can update recipes" on recipes
  for update using (
    exists (select 1 from user_roles where user_id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "Admins can delete recipes" on recipes;
create policy "Admins can delete recipes" on recipes
  for delete using (
    exists (select 1 from user_roles where user_id = (select auth.uid()) and role = 'admin')
  );

-- recipe_ingredients: public read, admin-only write
drop policy if exists "Recipe ingredients are publicly readable" on recipe_ingredients;
create policy "Recipe ingredients are publicly readable" on recipe_ingredients for select using (true);

drop policy if exists "Admins can add recipe ingredients" on recipe_ingredients;
create policy "Admins can add recipe ingredients" on recipe_ingredients
  for insert with check (
    exists (select 1 from user_roles where user_id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "Admins can update recipe ingredients" on recipe_ingredients;
create policy "Admins can update recipe ingredients" on recipe_ingredients
  for update using (
    exists (select 1 from user_roles where user_id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "Admins can delete recipe ingredients" on recipe_ingredients;
create policy "Admins can delete recipe ingredients" on recipe_ingredients
  for delete using (
    exists (select 1 from user_roles where user_id = (select auth.uid()) and role = 'admin')
  );

-- recipe_cooked_log: public read (same convention as product_comments),
-- authenticated-own-row insert only. No update/delete in phase 1 --
-- append-only, same as barcode_flags.
drop policy if exists "Cooked log is publicly readable" on recipe_cooked_log;
create policy "Cooked log is publicly readable" on recipe_cooked_log for select using (true);

drop policy if exists "Users can log their own cooked recipes" on recipe_cooked_log;
create policy "Users can log their own cooked recipes" on recipe_cooked_log
  for insert with check ((select auth.uid()) = user_id);
