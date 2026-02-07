-- Milestone 1: Shopping List & Favorites Schema

-- 1. Create Shopping Lists Table
create table if not exists shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Mon Panier',
  is_primary boolean default false,
  status text default 'active', -- active, archived
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure only one primary list per user (optional, but good practice)
-- create unique index if not exists idx_shopping_lists_primary_user 
-- on shopping_lists (user_id) where (is_primary = true);


-- 2. Create Shopping List Items Table
create table if not exists shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid references shopping_lists(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  quantity integer default 1,
  is_checked boolean default false,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate product in same list
  unique(list_id, product_id)
);


-- 3. Create User Favorite Stores Table
create table if not exists user_favorite_stores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  store_id bigint references stores(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate store favorites
  unique(user_id, store_id)
);

-- 4. Enable Row Level Security (RLS)
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;
alter table user_favorite_stores enable row level security;


-- 5. RLS Policies

-- Shopping Lists
drop policy if exists "Users can view own lists" on shopping_lists;
create policy "Users can view own lists" on shopping_lists for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own lists" on shopping_lists;
create policy "Users can insert own lists" on shopping_lists for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own lists" on shopping_lists;
create policy "Users can update own lists" on shopping_lists for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own lists" on shopping_lists;
create policy "Users can delete own lists" on shopping_lists for delete using (auth.uid() = user_id);

-- Shopping List Items
drop policy if exists "Users can view items in own lists" on shopping_list_items;
create policy "Users can view items in own lists" on shopping_list_items for select using (
  exists (select 1 from shopping_lists where id = list_id and user_id = auth.uid())
);

drop policy if exists "Users can insert items in own lists" on shopping_list_items;
create policy "Users can insert items in own lists" on shopping_list_items for insert with check (
  exists (select 1 from shopping_lists where id = list_id and user_id = auth.uid())
);

drop policy if exists "Users can update items in own lists" on shopping_list_items;
create policy "Users can update items in own lists" on shopping_list_items for update using (
  exists (select 1 from shopping_lists where id = list_id and user_id = auth.uid())
);

drop policy if exists "Users can delete items in own lists" on shopping_list_items;
create policy "Users can delete items in own lists" on shopping_list_items for delete using (
  exists (select 1 from shopping_lists where id = list_id and user_id = auth.uid())
);

-- User Favorite Stores
drop policy if exists "Users can view own favorite stores" on user_favorite_stores;
create policy "Users can view own favorite stores" on user_favorite_stores for select using (auth.uid() = user_id);

drop policy if exists "Users can add favorite stores" on user_favorite_stores;
create policy "Users can add favorite stores" on user_favorite_stores for insert with check (auth.uid() = user_id);

drop policy if exists "Users can remove favorite stores" on user_favorite_stores;
create policy "Users can remove favorite stores" on user_favorite_stores for delete using (auth.uid() = user_id);


-- 6. Indexes for Performance
create index if not exists idx_shopping_list_items_list_id on shopping_list_items(list_id);
create index if not exists idx_shopping_list_items_product_id on shopping_list_items(product_id);
create index if not exists idx_user_favorite_stores_user_id on user_favorite_stores(user_id);
