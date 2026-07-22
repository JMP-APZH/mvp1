-- Migration: Evidence photo for admin-entered France Hexagonale reference prices
--
-- Context: MainlandPriceAdmin.jsx is being redesigned to work like
-- ProductCompletion.jsx -- browse a list of products (with photos) instead
-- of requiring a search first -- and to let the admin attach a screenshot
-- of the French chain's website as evidence for the price entered, rather
-- than (or alongside) a plain source_url link.
--
-- Reuses the existing public `price-tag-photos` storage bucket (already
-- used by the scan flow in App10.jsx) rather than creating a new bucket,
-- to avoid depending on storage-level permissions this migration can't
-- fully verify from the SQL editor alone.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

alter table prices add column if not exists evidence_photo_url text;
