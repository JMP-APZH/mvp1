-- Gamification Schema

-- 1. User Profiles (Extension of Auth)
create table if not exists user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  points integer default 0,
  level integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Badges System
create table if not exists badges (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  icon text, -- Lucide icon name or URL
  points_required integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. User Badges (Many-to-Many)
create table if not exists user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  badge_id uuid references badges(id) on delete cascade,
  earned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, badge_id)
);

-- 4. RLS Policies
alter table user_profiles enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;

-- Profiles: Public read, User update own
drop policy if exists "Profiles are viewable by everyone" on user_profiles;
create policy "Profiles are viewable by everyone" on user_profiles for select using (true);

drop policy if exists "Users can update own profile" on user_profiles;
create policy "Users can update own profile" on user_profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on user_profiles;
create policy "Users can insert own profile" on user_profiles for insert with check (auth.uid() = id);

-- Badges: Public read
drop policy if exists "Badges are viewable by everyone" on badges;
create policy "Badges are viewable by everyone" on badges for select using (true);

drop policy if exists "User badges are viewable by everyone" on user_badges;
create policy "User badges are viewable by everyone" on user_badges for select using (true);

-- 5. RPC Function: Award Points
-- This is the critical function called by the app
create or replace function award_points(
  p_user_id uuid, 
  p_activity_type text, 
  p_points integer, 
  p_description text
)
returns json
language plpgsql
security definer
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
  
  -- 4. Return result
  select json_build_object(
    'new_points', new_points,
    'new_level', new_level,
    'awarded', p_points
  ) into v_result;

  return v_result;
end;
$$;

-- 6. Trigger to auto-create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger logic (commented out to avoid errors if trigger already exists)
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
