-- Migration: Update handle_new_user trigger
-- Purpose: Extract geographical metadata during signup

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_profiles (
    id, 
    display_name, 
    region_code, 
    city, 
    is_diaspora
  )
  values (
    new.id, 
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'region_code',
    new.raw_user_meta_data->>'city',
    (new.raw_user_meta_data->>'region_code' = 'Hexagone')
  );
  return new;
end;
$$ language plpgsql security definer;
