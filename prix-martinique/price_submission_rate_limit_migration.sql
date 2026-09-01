-- Migration: per-user rate limiting on price submissions
-- Status: NOT YET APPLIED (written 2026-09-01, launch-hardening pass)
--
-- Why: anonymous inserts into `prices` are already RLS-blocked (Aug 28, 2026),
-- but a single authenticated account could still script thousands of junk
-- submissions -- a real risk once the app is publicly announced (RPPRAC
-- audience). This adds a BEFORE INSERT trigger that caps how many `prices`
-- rows one caller can create in a rolling window.
--
-- Thresholds (tune the two `>=` constants in the function if needed):
--   * 100 inserts / rolling 10 minutes   -> blocks scripted flooding; still
--     covers a large in-store scan session AND an offline-queue backlog
--     draining on reconnect (syncQueue.js is FIFO, one-at-a-time, and re-queues
--     a rejected item up to MAX_RETRIES=5, so a brief cap won't lose data).
--   * 500 inserts / rolling 24 hours      -> generous for any genuine daily use
--     across multiple store trips; stops a slow-drip script.
-- Admins (user_roles.role = 'admin') are exempt -- MainlandPriceAdmin /
-- ProductCompletion write to `prices`/`products` and can legitimately be
-- higher-volume.
--
-- The rejection message is French and user-facing: performPriceSubmission()
-- does `throw priceError`, submitPrice() catches it and shows a toast.
--
-- Known minor edge: performPriceSubmission() creates the product row *before*
-- the price insert, so a rate-limited submission can leave an orphan product
-- (no prices). These don't appear in the feed (feed is per-price-row) and can
-- be flagged/excluded via TestDataAdmin. Not worth pre-empting for launch.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

-- 1. Unspoofable submitter identity ------------------------------------------
-- `prices.user_id` is client-set and NOT guaranteed to equal auth.uid() (the
-- authenticated-write RLS policy doesn't pin it, per the Jul 21 2026 note in
-- CLAUDE.md). `submitted_by` is stamped server-side by the trigger below, so
-- the rate-limit count can't be dodged by spoofing user_id.
alter table public.prices add column if not exists submitted_by uuid;
comment on column public.prices.submitted_by is
  'Server-set by the BEFORE INSERT rate-limit trigger (= auth.uid()). Unspoofable submitter identity for rate-limiting / abuse tracing. NULL for rows predating this migration and for service-role / SQL-editor inserts.';

-- Backfill historical rows with the best available signal.
update public.prices
   set submitted_by = user_id
 where submitted_by is null
   and user_id is not null;

create index if not exists idx_prices_submitted_by_created_at
  on public.prices (submitted_by, created_at desc);

-- 2. Rate-limit trigger ------------------------------------------------------
create or replace function public.enforce_price_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_recent integer;
begin
  -- Always stamp the real caller, ignoring whatever the client sent.
  new.submitted_by := v_uid;

  -- Service-role / SQL-editor / Edge-Function inserts (no auth.uid) are not limited.
  if v_uid is null then
    return new;
  end if;

  -- Admins exempt.
  if exists (
    select 1 from public.user_roles
     where user_id = v_uid and role = 'admin'
  ) then
    return new;
  end if;

  -- Burst cap: 100 per rolling 10 minutes.
  select count(*) into v_recent
    from public.prices
   where submitted_by = v_uid
     and created_at > now() - interval '10 minutes';
  if v_recent >= 100 then
    raise exception 'Trop de prix soumis en peu de temps. Réessayez dans quelques minutes.'
      using errcode = 'check_violation';
  end if;

  -- Daily cap: 500 per rolling 24 hours.
  select count(*) into v_recent
    from public.prices
   where submitted_by = v_uid
     and created_at > now() - interval '24 hours';
  if v_recent >= 500 then
    raise exception 'Limite quotidienne de contributions atteinte. Merci, et revenez demain !'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_price_submission_rate_limit on public.prices;
create trigger trg_price_submission_rate_limit
  before insert on public.prices
  for each row
  execute function public.enforce_price_submission_rate_limit();

-- 3. Sanity check ----------------------------------------------------------
-- Should show the trigger attached to `prices`:
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.prices'::regclass
   and not tgisinternal;
