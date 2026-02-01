-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create BQP Categories Table
-- Stores the official list items (e.g., H-01, M-02)
create table if not exists bqp_categories (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) not null, -- e.g., "H-01", "M-02"
  section varchar(100),      -- e.g., "FRAIS", "BOULANGERIE"
  label text not null,       -- e.g., "Lait écrémé/demi-écrémé UHT"
  unit_standard varchar(50), -- e.g., "1L", "1kg"
  is_local boolean default false,
  list_type varchar(20) not null, -- 'hypermarket', 'supermarket', 'superette'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Constraint to ensure unique code per list type (though codes seem globally unique like H-xx, M-xx)
  unique(code)
);

-- 2. Create Junction Table for Products <-> BQP Categories
-- Allows one product (EAN) to map to multiple BQP items (e.g. H-01 and M-02)
create table if not exists product_bqp_associations (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  bqp_category_id uuid references bqp_categories(id) on delete cascade,
  is_verified boolean default false, -- Community verification flag
  votes_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(product_id, bqp_category_id)
);

-- 3. Add Indexes for Performance
create index if not exists idx_bqp_code on bqp_categories(code);
create index if not exists idx_product_bqp_product_id on product_bqp_associations(product_id);
create index if not exists idx_product_bqp_category_id on product_bqp_associations(bqp_category_id);

-- 4. Update Products Table for "Shadow BQP" strategy stats
-- Adding fields to normalize quantities for price comparison (e.g., Price per Kg)
alter table products 
add column if not exists volume_amount decimal,
add column if not exists volume_unit varchar(10), -- "kg", "g", "L", "ml"
add column if not exists is_local_production boolean default false;

-- 5. RLS Policies (Security)
alter table bqp_categories enable row level security;
alter table product_bqp_associations enable row level security;

-- Everyone can read BQP data
create policy "BQP Categories are public" on bqp_categories
  for select using (true);
  
create policy "Product BQP Associations are public" on product_bqp_associations
  for select using (true);

-- Authenticated users can suggest associations (insert)
create policy "Users can suggest BQP associations" on product_bqp_associations
  for insert with check (auth.role() = 'authenticated');
