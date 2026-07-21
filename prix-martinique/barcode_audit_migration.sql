-- Migration: Barcode integrity audit trail
--
-- Context: admin needs to compare the barcode captured during a scan
-- (products.barcode) against the barcode visible in the product photo
-- (prices.product_photo_url) for that scan, flag mismatches, and record
-- what happened next: an admin correction, or a request for the original
-- user to recapture the photo. This needs to be a durable, publicly
-- readable audit trail (RPPRAC / external integrity review), not just a
-- mutable status flag, so corrections never overwrite history.
--
-- Design: append-only `barcode_flags` table, one row per flag raised.
-- `products.barcode` is still the live/current value the rest of the app
-- reads; this table is the paper trail of who changed it and why.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

create table if not exists barcode_flags (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  price_id uuid references prices(id) on delete set null,
  flagged_by uuid references auth.users(id) not null,
  captured_barcode text,
  corrected_barcode text,
  status text not null default 'flagged'
    check (status in ('flagged', 'corrected_by_admin', 'recapture_requested', 'resolved')),
  resolution_type text
    check (resolution_type in ('admin_modification', 'user_recapture')),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone
);

create index if not exists idx_barcode_flags_product_id on barcode_flags(product_id);
create index if not exists idx_barcode_flags_status on barcode_flags(status);

alter table barcode_flags enable row level security;

-- Public read, for transparency / external data-integrity audit (RPPRAC etc.)
drop policy if exists "Barcode flags are publicly readable" on barcode_flags;
create policy "Barcode flags are publicly readable" on barcode_flags
  for select using (true);

-- Only admins (per user_roles) can raise or update flags
drop policy if exists "Admins can insert barcode flags" on barcode_flags;
create policy "Admins can insert barcode flags" on barcode_flags
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

drop policy if exists "Admins can update barcode flags" on barcode_flags;
create policy "Admins can update barcode flags" on barcode_flags
  for update using (
    exists (
      select 1 from user_roles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );
