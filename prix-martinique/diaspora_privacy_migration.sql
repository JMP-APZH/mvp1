-- Migration: Diaspora & Privacy Support
-- Purpose: Track scan origins for diaspora analysis while protecting user privacy

-- 1. Update User Profiles
alter table user_profiles 
add column if not exists region_code text,
add column if not exists city text,
add column if not exists is_diaspora boolean default false;

-- 2. Update Products for MDD (Marque Distributeur) tracking
alter table products 
add column if not exists is_mdd boolean default false;

-- 3. Update Prices for Backend Origin Tracking (Strategic Monitoring)
alter table prices 
add column if not exists origin_region_code text,
add column if not exists origin_city text;

-- 4. Comment on columns for clarity
comment on column user_profiles.region_code is 'Postal code or department code (e.g., 972 for MQ, 75 for Paris)';
comment on column prices.origin_region_code is 'Hidden from public UI, used for admin analysis of scan veracity';
comment on column products.is_mdd is 'True if it is a store-brand product (Marque De Distributeur)';
