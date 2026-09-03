# Analytics & Monitoring Overhaul — Milestone Plan

**Status legend:** ⬜ not started · 🔄 in progress · 🧪 in review (PR open / migration pending) · ✅ done
**Last updated:** 2026-09-03 — M1 ✅. M2a 🧪 (fix2 migration pending — `timestamp` vs `timestamptz`).

---

## Goal

Make the **in-app Admin Dashboard** and **PostHog** a coherent pair that (a) report *accurate*
key metrics, (b) cross-check each other, and (c) support product + strategic decisions for
Prix Martinique — always oriented toward end-user value (fighting *la vie chère*).

## Guiding principle — division of responsibility

Because PostHog runs **cookieless / `person_profiles: 'never'`** (Sept 3), it has **no stable user
identity**. That fixes what each tool is authoritative for:

| Question | Authoritative source | Cross-check source |
| :--- | :--- | :--- |
| How many real prices / products / contributors? | **Supabase** (`prices`, `products`, `submitted_by`) | PostHog `price_submitted` volume (authed + consented only) |
| Contributor retention / cohorts / repeat rate | **Supabase** (`submitted_by` + `created_at`) — *PostHog cannot do this cookieless* | — |
| Data health: freshness, store/category/BQP coverage | **Supabase** | PostHog `store_wizard_completed` by store |
| Value delivered: MTQ↔Hexagone gap, savings, comparisons | **Supabase** | PostHog `product_detail_viewed` / `PriceDuel` events |
| Traffic, sessions, acquisition source, bounce | **PostHog** (web analytics) | Supabase `app_sessions` count (consent-independent floor) |
| Feature usage funnels *within a session* | **PostHog** | — |
| Error rate / exceptions | **PostHog** `$exception` | Supabase `captureException` call sites |
| Sessions by platform / PWA / auth method | **Supabase** `app_sessions` / `auth_events` (consent-independent) | PostHog `$device_type` / `$pageview` |

**Every admin KPI that has a PostHog counterpart must name it** (in the metric catalog, M6) so a
discrepancy is a signal, not a mystery.

## Cross-cutting fixes applied throughout

- **Scope every number.** `is_test_data = false`; separate `source_type = 'scan'` from
  `'admin_reference'`; count `coalesce(submitted_by, user_id)`, not `user_id`.
- **Server-side aggregation.** All distinct-counts / group-bys move to `SECURITY DEFINER`
  Postgres functions (admin-gated, `set search_path = public`). Kills the current 1000-row
  client-fetch ceiling in `fetchAdminStats`.
- **Exclude internal accounts** (toggle): Tony, `JMP2_972`, `jm.philocles`, family test accounts.
- **Time dimension.** Every metric gets a date-range scope; trends, not just snapshots.
- **Graceful degradation.** Client calls new RPCs inside `try/catch`; a not-yet-applied
  migration shows "—", never breaks the dashboard (established pattern in this codebase).

---

## Milestones

### M1 — Trustworthy numbers + internal-account exclusion (FOUNDATION) — ✅

**Why first:** every other milestone reads these aggregates; also directly fixes the reported
"the real amount of scanned products isn't displayed" problem (`Total Scans` = raw
`count(*) from prices`, mixing test data + admin reference prices + legacy null-user rows).

**Deliverables**
- 🧪 `analytics_admin_functions_migration.sql` (**written — NOT YET APPLIED**; run in Supabase SQL Editor)
  - ✅ `user_profiles.is_internal_account boolean not null default false` + backfill known accounts
  - ✅ `v_admin_prices` view: `prices` ⋈ `products` ⋈ `user_profiles` with computed `is_test`,
    `channel` (`martinique_scan` / `diaspora_scan` / `admin_reference`), `contributor_id`,
    `is_internal` — direct client access revoked; read only from the SECURITY DEFINER fns
  - ✅ `admin_kpi_overview(p_since, p_exclude_internal)` → one row (13 cols): real submissions,
    products priced, contributors, MDD, diaspora *scan* submissions + contributors, reference
    prices, test submissions/products, signups + sessions in window
  - ✅ `admin_price_timeseries(p_bucket, p_since, p_exclude_internal)` → bucket, submissions, contributors
  - ✅ all `security definer`, admin-role guard, `set search_path = public`, 3 sanity-check queries
- 🧪 `AdminDashboard.jsx` rework (PR open)
  - ✅ calls `admin_kpi_overview`; dropped the raw `.select('user_id')` / `.select('origin_region_code')` full-table fetches
  - ✅ relabelled: **"Contributions de prix"**, **"Contributeurs"**, **"Produits avec prix"**, **"Produits MDD avec prix"**
  - ✅ sub-lines: `exclus: N test · N réf. en ligne`, `{catalog} au catalogue · N test`
  - ✅ Diaspora widget → *scans communauté diaspora* + *contributeurs diaspora*; reference prices moved to a footnote
  - ✅ "Exclure les comptes internes" toggle, persisted via `localStorage` (`pm_admin_exclude_internal`)
  - ✅ amber banner + "—" fallback when the migration isn't applied yet
- ✅ CLAUDE.md entry (Sept 3 (3))
- ✅ **Applied + verified live 2026-09-03** (PR #29). Reconciles exactly: internal OFF → 61 real
  + 5 test + 10 réf. = 76 (old raw "Total Scans"); 57 priced + 5 test = 62 catalog. Internal ON
  → 29 real from 5 external contributors (the real adoption picture). No RPC errors.
- ✅ **fix1** (`analytics_admin_functions_fix1_migration.sql`): `reference_prices` / `test_submissions`
  are data-quality context, not adoption — no longer filtered by the internal-accounts toggle
  (were showing "0 réf." / "4 test" when the toggle was on).

**PostHog counterpart:** `price_submitted` count vs `admin_kpi_overview` submissions-in-window
(expect PostHog ≤ Supabase — PostHog misses pre-consent + any SDK gap).

**Done when:** ✅ migration applied; tiles show real, test-excluded, correctly-labelled numbers
that reconcile with the `Données test` tab; no client-side full-table fetch remains.

**Effort:** 1 session — done 2026-09-03 (+ fix1 follow-up).

---

### M2 — Time controls, trends, drill-downs, CSV export

#### M2a — date range + trends + CSV + rich Activité Récente — 🧪
- ✅ `analytics_admin_export_migration.sql` — `admin_submissions_detail(p_since, p_exclude_internal, p_limit)` — admin-gated joined rows (date, product, price, store, contributor, channel, is_test) from `v_admin_prices`. One fn for both CSV export + Activité Récente.
- 🧪 **fix2** (`analytics_admin_functions_fix2_migration.sql`, **NOT YET APPLIED**): `prices.created_at` is `timestamp` (no tz); `admin_price_timeseries` (never live-tested in M1) and `admin_submissions_detail` declared column 1 as `timestamptz` → PostgREST 400 (42804). Recreated both with `(... at time zone 'UTC')` so the API stays `timestamptz` and JS parses it as UTC. No client change.
- ✅ date-range segmented control (**7 j / 30 j / 90 j / Tout**), persisted (`pm_admin_range`), drives `admin_kpi_overview` `p_since` + the trend
- ✅ `Sparkline` (dependency-free inline SVG) on Contributions + Contributeurs tiles, gap-filled daily series from `admin_price_timeseries`
- ✅ badge → "+N · {range}" (hidden for "Tout")
- ✅ **"Exporter CSV"** wired — client-side Blob of the currently-scoped submissions (range + internal toggle), BOM for Excel, filename `prix-martinique-contributions-{range}-{date}.csv`
- ✅ "Activité Récente" upgraded — product · price · store · contributor · relative date · TEST/FR/RÉF badges (last 8, all-time)
- ✅ "Modérer Prix" button disabled with "Bientôt (M2b)"
- Diaspora Watch region-list already removed in M1 (was the confusing "972: 23" line) — nothing to fix.

#### M2b — drill-downs + moderation queue — ⬜
- ⬜ tile click-through: Contributions → filterable submission list; Contributeurs → contributor list (first/last contribution, count, channel mix); Produits → into `ProductCompletion` / `TestDataAdmin`
- ⬜ "Activité Récente" → full list, paginated 25/page, "à revoir" filter, row → `ProductDetailModal`
- ⬜ **"Modérer Prix"** → outlier queue (price far from product median, null `store_id`, submissions from accounts <7 days old)

**PostHog counterpart:** trend shapes should match PostHog `price_submitted` daily series.

**Effort:** M2a done 2026-09-03; M2b = 1 session.

---

### M3 — "Santé des données" section (flywheel health) — ⬜

**Why:** tells you whether the app is *becoming useful*, not just *growing*.

**Deliverables**
- ⬜ `analytics_data_health_migration.sql` (**not yet applied**)
  - ⬜ `admin_data_health()` → price freshness (% products w/ latest price <30d, median age d),
    store coverage (# priced <30d, # never priced), category coverage (% products categorized),
    photo coverage, open `barcode_flags` count, BQP coverage (# `bqp_categories` w/ ≥1 product)
  - ⬜ `admin_coverage_gaps()` → stores with no recent price, demanded products
    (`get_product_favorite_counts`) with no price, least-covered categories
- ⬜ dashboard section **"Santé des données"** — meters + top-gap lists, each drillable
- ⬜ surface the standing "category coverage" number (currently ~6/23, buried) as a tracked KPI

**PostHog counterpart:** `store_wizard_completed` breakdown by `store_id` vs store coverage.

**Effort:** 1 session.

---

### M4 — Martinique ↔ France Hexagonale matching pipeline — ⬜

**Why:** the flagship "vie chère" comparison only works with real matched pairs. Sources:
1. **Diaspora users' real scans** in France (`source_type='scan'` + `origin_region_code='Hexagone'`) — flow exists
2. **Screenshot uploads from chains' own shopping apps** (Carrefour, E.Leclerc, Auchan, Système U) — *new capture path*, distinct from "admin found it on the website"
3. Admin online capture (`source_type='admin_reference'` + `source_url`) — exists

**Deliverables**
- ⬜ `mainland_match_pipeline_migration.sql` (**not yet applied**)
  - ⬜ `prices.source_channel text` check-constrained to
    `('martinique_scan','diaspora_scan','chain_app_screenshot','online_capture')`; backfill from
    `source_type` + `origin_region_code` + `evidence_photo_url`
  - ⬜ `prices.match_verified boolean` + `match_verified_by uuid` + `match_verified_at timestamptz`
  - ⬜ `admin_mainland_match_coverage()` → # MTQ products with any France price (by channel),
    median/avg gap %, gap distribution buckets, # France-priced products lacking a MTQ price
    (inverse gap → prioritise MTQ scans)
  - ⬜ `admin_mainland_match_queue()` → unverified France entries needing review
- ⬜ **screenshot-upload capture** in `MainlandPriceAdmin.jsx`: "depuis l'app d'une enseigne"
  source option → upload screenshot (`evidence_photo_url`, `price-tag-photos` bucket) + chain +
  `source_channel='chain_app_screenshot'`
- ⬜ diaspora-scan attribution: ensure the France scan flow (`App10.jsx`) stamps
  `source_channel='diaspora_scan'`
- ⬜ dashboard section **"Comparaison France Hexagonale"** — match rate, gap by category,
  coverage by channel, verification-queue count
- ⬜ verification queue UI (extend `MainlandPriceAdmin` or new sub-tab)
- ⬜ (stretch) user-facing screenshot upload for diaspora users, not just admin

**PostHog counterpart:** `mainland_screenshot_uploaded`, `mainland_match_verified`,
France-scan `price_submitted` where `origin_region_code = 'Hexagone'`.

**Effort:** 2 sessions (M4a schema + coverage + attribution / M4b screenshot flow + queue).

---

### M5 — "Valeur livrée" section (mission metrics) — ⬜

**Deliverables**
- ⬜ `analytics_value_migration.sql` (**not yet applied**)
  - ⬜ `admin_value_delivered(p_since timestamptz)` → weighted MTQ↔Hexagone gap (overall + by
    category), # products where MTQ cheaper vs dearer, aggregate savings surfaced (server-side
    port of `userStats.calculateSavingsBreakdown`), BQP-concern count
- ⬜ dashboard section **"Valeur livrée"** — the *vie chère* headline gap number, front and centre
- ⬜ surface the real gap in-app: Community → Impact tab (replace/augment "Score de Souveraineté")

**PostHog counterpart:** `product_detail_viewed` / `recipe_viewed` / `panier_*` engagement.

**Effort:** 1 session.

---

### M6 — PostHog ↔ Admin cross-check layer — ⬜

**Deliverables**
- ⬜ close PostHog instrumentation gaps: activation funnel (`$pageview`/signup →
  `first_contribution_completed`), feature-adoption events for Comparer / BQP / Panier / Recettes
  / Prix-recherchés (audit which already fire), mainland-pipeline events
- ⬜ **`METRIC_CATALOG.md`** (repo): every metric → definition · Supabase source (authoritative) ·
  PostHog event (cross-check) · owner · target/threshold
- ⬜ curate PostHog dashboards **928161** (Launch Monitoring) + **862895** (Product Analytics) so
  each admin KPI has a PostHog counterpart tile
- ⬜ document the retention constraint: cohort/retention analysis is **Supabase-only** (cookieless
  PostHog has no stable identity)
- ⬜ (stretch) `posthog_metrics_daily` Supabase table fed by a scheduled PostHog export →
  admin dashboard shows both numbers + variance flag (needs a GitHub Action or PostHog batch export)

**Effort:** 1–2 sessions.

---

## Sequencing

```
M1 ──┬── M2
     ├── M3
     └── M4 ── M5
M6 instrumentation can start alongside M2; M6 catalog + curation needs M1–M5 metrics defined.
```

## Appendix — internal accounts to flag (`is_internal_account = true`)

| Identifier | Reason |
| :--- | :--- |
| `jm.philocles@gmail.com` / display "Jean-Marie Philocles" | Founder/admin |
| `JMP2_972` (same person, `jm.philocles@gmail.com`) | Founder test account |
| "Tony" | Seed/test account (10-item Jul 20 session, referenced throughout CLAUDE.md) |
| "Maëlys 2" / "Maelys Philocles" | Family device-test accounts (Aug 28 iOS test) |

_Confirm these against `user_profiles` before the M1 backfill; add any others found._
