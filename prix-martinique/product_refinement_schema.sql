-- Product Refinement Schema
-- 1. Add "Is Labeled BQP" checkbox to products table
-- This allows tracking products that are CLAIMED to be BQP, even if not linked to an official category
alter table products 
add column if not exists is_declared_bqp boolean default false;

-- 2. Create User Favorites Table
-- Allows users to mark products as favorites for quick access
create table if not exists user_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate favorites
  unique(user_id, product_id)
);

-- 3. RLS Policies for Favorites
alter table user_favorites enable row level security;

-- Users can see their own favorites
create policy "Users can view own favorites" on user_favorites
  for select using (auth.uid() = user_id);

-- Users can can add favorites
create policy "Users can add favorites" on user_favorites
  for insert with check (auth.uid() = user_id);

-- Users can remove favorites
create policy "Users can remove own favorites" on user_favorites
  for delete using (auth.uid() = user_id);

-- 4. Index for performance
create index if not exists idx_favorites_user_id on user_favorites(user_id);
