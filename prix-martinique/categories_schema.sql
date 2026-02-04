-- Create the categories table
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  icon text not null, -- Emoji or icon name
  color text,         -- Hex code or Tailwind class
  display_order int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table categories enable row level security;

-- Policies
create policy "Categories are viewable by everyone"
  on categories for select
  using (true);

-- Insert initial categories (French)
insert into categories (name, icon, display_order, color) values
  ('Fruits & Légumes', '🍎', 10, 'bg-green-100 text-green-800'),
  ('Produits Laitiers', '🥛', 20, 'bg-blue-100 text-blue-800'),
  ('Viandes', '🥩', 30, 'bg-red-100 text-red-800'),
  ('Poissons et Fruits de Mer', '🐟', 40, 'bg-cyan-100 text-cyan-800'),
  ('Boulangerie', '🥖', 50, 'bg-yellow-100 text-yellow-800'),
  ('Boissons', '🥤', 60, 'bg-purple-100 text-purple-800'),
  ('Épicerie Salée', '🍝', 70, 'bg-orange-100 text-orange-800'),
  ('Épicerie Sucrée', '🍪', 80, 'bg-pink-100 text-pink-800'),
  ('Surgelés', '❄️', 90, 'bg-sky-100 text-sky-800'),
  ('Hygiène & Beauté', '🧼', 100, 'bg-teal-100 text-teal-800'),
  ('Bébé et Petite Enfance', '👶', 110, 'bg-indigo-100 text-indigo-800'),
  ('Animaux', '🐶', 120, 'bg-stone-100 text-stone-800')
on conflict (name) do nothing;

-- Update products table to reference categories
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'category_id') then
        alter table products 
        add column category_id uuid references categories(id);
    end if;
end $$;

-- Add index for performance
create index if not exists idx_products_category_id on products(category_id);
