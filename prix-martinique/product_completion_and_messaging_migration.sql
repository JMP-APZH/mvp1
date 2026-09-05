-- Migration: Mandatory front/back/price-tag photos, pending-product queue,
-- and a one-way admin -> user inbox
--
-- Status: NOT YET APPLIED. Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
--
-- Context: audited why Charbonnier Laurent could save a product with zero
-- photos -- there was never a required-photo check anywhere (client, server,
-- or DB). Decided (2026-09-05) to make photos genuinely required going
-- forward, split into three shots: front (brand/name), back (barcode, for
-- cross-checking against products.barcode -- see ProductCompletion.jsx),
-- and the price tag. But requiring all three in one sitting doesn't fit a
-- real scenario: someone photographs a product at home (no price tag, no
-- store), and the price should be completable later by them or by anyone
-- else who visits that store. So front+back photos now live on `products`
-- (survive independently of any price submission) rather than only on
-- `prices`, and a product can exist "pending a price" with no `prices` row
-- at all until someone completes it.
--
-- Also adds `user_messages`: a one-way admin -> user inbox so an admin
-- reviewing incomplete submissions (ProductCompletion.jsx) can tell the
-- submitter what's missing, instead of silently correcting or ignoring it.

-- 1. Product-level identification photos + pending-price flag ---------------
alter table public.products add column if not exists photo_front_url text;
alter table public.products add column if not exists photo_back_url text;
alter table public.products add column if not exists photo_registered_by uuid references auth.users(id) on delete set null;
alter table public.products add column if not exists photo_registered_at timestamp with time zone;
alter table public.products add column if not exists has_price boolean not null default false;

comment on column public.products.photo_front_url is 'Brand/name side, set at product registration or a full price submission.';
comment on column public.products.photo_back_url is 'Barcode side -- used by ProductCompletion.jsx to cross-check products.barcode.';
comment on column public.products.has_price is 'Trigger-maintained (see sync_product_has_price below): true once any prices row exists for this product. false = pending, surfaced in the "Produits a completer" list.';

-- Backfill: a product with existing prices rows is not pending.
update public.products p
set has_price = true
where exists (select 1 from public.prices pr where pr.product_id = p.id);

-- Fast lookup for the pending-product list (small table today, but the point
-- of a partial index is it only ever indexes the rows that query cares about).
create index if not exists idx_products_pending_price on public.products (created_at desc) where has_price = false;

-- 2. has_price trigger -- same "recompute from source, don't increment"
--    approach as sync_total_contributions() (total_contributions_migration.sql),
--    to avoid the same drift class that column already had to be fixed for.
create or replace function public.sync_product_has_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    update public.products
    set has_price = true
    where id = new.product_id and has_price = false;
  end if;
  return new;
end;
$$;

drop trigger if exists on_price_insert_sync_has_price on public.prices;
create trigger on_price_insert_sync_has_price
after insert on public.prices
for each row execute function public.sync_product_has_price();

-- 3. One-way admin -> user inbox ---------------------------------------------
create table if not exists public.user_messages (
  id                  uuid primary key default gen_random_uuid(),
  recipient_id        uuid not null references auth.users(id) on delete cascade,
  sender_admin_id     uuid references auth.users(id) on delete set null,
  subject             text not null,
  body                text not null check (char_length(body) <= 2000),
  related_product_id  uuid references public.products(id) on delete set null,
  related_price_id    uuid references public.prices(id) on delete set null,
  is_read             boolean not null default false,
  created_at          timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_user_messages_recipient on public.user_messages(recipient_id, is_read);

alter table public.user_messages enable row level security;

-- Admin sends, as themselves, to any recipient. Scoped `to authenticated`
-- with a bare `auth.uid()` in the ownership check -- the `(select auth.uid())`
-- subquery form left a structurally similar own-identity INSERT policy
-- broken on profile_reports (2026-09-04 QA finding, profile_card_migration.sql);
-- using the proven-working form here from the start.
drop policy if exists "Admins can send messages" on public.user_messages;
create policy "Admins can send messages" on public.user_messages
  for insert to authenticated
  with check (
    sender_admin_id = auth.uid()
    and exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Recipient reads their own inbox.
drop policy if exists "Recipients can read their own messages" on public.user_messages;
create policy "Recipients can read their own messages" on public.user_messages
  for select to authenticated
  using (auth.uid() = recipient_id);

-- Recipient can mark their own messages read (client only ever sends
-- { is_read: true }, but RLS itself doesn't need column-level restriction
-- for a single-owner row like this).
drop policy if exists "Recipients can mark their own messages read" on public.user_messages;
create policy "Recipients can mark their own messages read" on public.user_messages
  for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Admins can also see messages they've sent (so ProductCompletion.jsx can
-- show "already messaged" per entry instead of re-asking every time).
drop policy if exists "Admins can view all messages" on public.user_messages;
create policy "Admins can view all messages" on public.user_messages
  for select using (
    exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin')
  );
