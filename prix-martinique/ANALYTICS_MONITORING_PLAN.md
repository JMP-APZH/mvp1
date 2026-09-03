# Analytics & Monitoring Overhaul — Milestone Plan

**Status legend:** ⬜ not started · 🔄 in progress · 🧪 in review (PR open / migration pending) · ✅ done
**Last updated:** 2026-09-03 — M1 ✅ · M2a ✅ · M2b ✅ · M3 ✅ (verified live, incl. fix1) · M4a 🧪 (PR open, `mainland_match_pipeline_migration.sql` pending). M4b next.

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

#### M2a — date range + trends + CSV + rich Activité Récente — ✅
- ✅ `analytics_admin_export_migration.sql` — `admin_submissions_detail(p_since, p_exclude_internal, p_limit)` — admin-gated joined rows (date, product, price, store, contributor, channel, is_test) from `v_admin_prices`. One fn for both CSV export + Activité Récente.
- ✅ **fix2** (`analytics_admin_functions_fix2_migration.sql`): `prices.created_at` is `timestamp` (no tz); `admin_price_timeseries` (never live-tested in M1) and `admin_submissions_detail` declared column 1 as `timestamptz` → PostgREST 400 (42804). Recreated both with `(... at time zone 'UTC')`.
- ✅ **Verified live 2026-09-03**: sparklines draw (blue + purple), CSV export → 200 / 26 rows / 3.4 KB Blob / download fired, Activité Récente shows 8 rich rows. (Also spotted real launch traffic — Michelle M + Sandra "SRN95" contributed batches today.)
- ✅ date-range segmented control (**7 j / 30 j / 90 j / Tout**), persisted (`pm_admin_range`), drives `admin_kpi_overview` `p_since` + the trend
- ✅ `Sparkline` (dependency-free inline SVG) on Contributions + Contributeurs tiles, gap-filled daily series from `admin_price_timeseries`
- ✅ badge → "+N · {range}" (hidden for "Tout")
- ✅ **"Exporter CSV"** wired — client-side Blob of the currently-scoped submissions (range + internal toggle), BOM for Excel, filename `prix-martinique-contributions-{range}-{date}.csv`
- ✅ "Activité Récente" upgraded — product · price · store · contributor · relative date · TEST/FR/RÉF badges (last 8, all-time)
- ✅ "Modérer Prix" button disabled with "Bientôt (M2b)"
- Diaspora Watch region-list already removed in M1 (was the confusing "972: 23" line) — nothing to fix.

#### M2b — drill-downs + moderation queue — ✅ (verified live 2026-09-03)

**Live check (PRs #35, #36, #37, #38):** Contributions drill paginates ("1–25 sur 26" → "26–26 sur 26", prev/next), channel chips (Tous / Martinique / Diaspora / Réf. en ligne) + "à revoir" toggle work; **Modérer Prix** surfaces the review-flagged rows (`compte récent` / `nouveau` / TEST / RÉF / MQ badges); Contributeurs roster loads; Activité Récente rows open `ProductDetailModal`; header pill = 61. Two DB-type surprises found & fixed: fix1 `42702` (OUT-param/column clash), fix2 `42804` (`store_id` is `bigint` not `uuid`).

- 🧪 `analytics_admin_m2b_migration.sql` + `analytics_admin_m2b_fix1_migration.sql` (**not yet applied**):
  - **fix1**: `admin_submissions_browse` hit `42702` (column "product_id" ambiguous) — RETURNS TABLE OUT params share names with bare column refs in the `medians` / `filtered` CTEs. Added `#variable_conflict use_column` + qualified those CTEs.
  - **fix2**: then `42804` — `store_id` declared `uuid` but `prices.store_id` / `stores.id` are `bigint` (unlike `prices.id` / `products.id`). Changed to `bigint`; client doesn't read it.
  - `admin_submissions_browse(p_since, p_exclude_internal, p_channel, p_review_only, p_limit, p_offset)` — paginated, channel-filterable, review-flag-filterable rows from `v_admin_prices`; each row carries `review_reason` (`magasin manquant` · `prix aberrant` [>3× or <0.34× product median, ≥3 real prices] · `compte récent` [account <7 j at submission]), `contributor_is_new`, `product_id`, and `total_count` (window size for pagination). One fn powers the Contributions drill, "Voir tout", **and** the "Modérer Prix" queue (`p_review_only := true`).
  - `admin_contributors(p_exclude_internal, p_limit)` — one row per contributor: first/last contribution, totals, channel mix (MQ/FR/réf/test).
  - `admin_submissions_detail` widened with `product_id` (drop + recreate) so "Activité Récente" rows are click-through.
- ✅ `AdminDrillPanel.jsx` (new) — full-screen overlay, 3 modes (`submissions` / `review` / `contributors`), graceful "migration pending" notice; rows → `ProductDetailModal` (z-[300], above the panel).
- ✅ `AdminDashboard.jsx` — 4 KPI tiles now buttons (Contributions → submissions drill · Contributeurs → contributors drill · Produits / Produits MDD → "Compléter produit" sub-tab); "Activité Récente" gets a "Voir tout" link + click-through rows; "Modérer Prix" enabled → review queue.
- ✅ `npm run build` + eslint clean.

**Done when:** migration applied; drill lists load, pagination works, "Modérer Prix" surfaces the flagged rows, row → product card.

**PostHog counterpart:** trend shapes should match PostHog `price_submitted` daily series.

**Effort:** M2a done 2026-09-03; M2b = 1 session.

---

### M3 — "Santé des données" section (flywheel health) — ✅ (verified live 2026-09-03, PRs #40 #41)

**Live check:** meters render (59.6% fresh · 68.4% categorised · 90.2% photo · 94.7% barcode · 5/78 magasins actifs · 1/16 BQP · 0 flags). "Voir les lacunes" drill: per-category coverage bars + 73 stores sans prix récent ("Carrefour C.C. Cluny · il y a 44 j") + 7 uncategorized real-priced products. fix1: `admin_coverage_gaps` unnamed derived-table columns (`42703`) → `g(kind, ref_id, label, sublabel, weight)` alias-list.

**Why:** tells you whether the app is *becoming useful*, not just *growing*.

**Deliverables**
- 🧪 `analytics_data_health_migration.sql` + `analytics_data_health_fix1_migration.sql` (**not yet applied**), all admin-gated `SECURITY DEFINER`, `#variable_conflict use_column`:
  - **fix1**: `admin_coverage_gaps` → `42703 column g.weight does not exist` — the `( <union> ) g` derived table had unnamed columns. Fixed with the `g(kind, ref_id, label, sublabel, weight)` alias-list. (`admin_data_health` + `admin_category_coverage` verified 200 on the same pass.)
  - `admin_data_health()` → one row: catalogue size, price freshness (% products whose newest real price is <30 d, median latest-price age d), categorisation % (+ N/total categories used), photo % (real price rows with `product_photo_url`), barcode %, magasins actifs 30 j / total, postes BQP couverts / total, open `barcode_flags` (`flagged` + `recapture_requested`). "Real" = `not is_test_data` and `source_type <> 'admin_reference'`.
  - `admin_category_coverage()` → per-category priced/total/% (+ a "Sans catégorie" row).
  - `admin_coverage_gaps(p_limit)` → flat list `(kind, ref_id, label, sublabel, weight)`: `store_stale` (no real price in 30 d / ever), `demanded_unpriced` (favourited product, `user_favorites`, with no real price anywhere), `uncategorized` (real-priced product, null category). Sorted by weight.
- ✅ dashboard section **"Santé des données"** — `Meter` bars (freshness / categorisation / photo / barcode) + magasins/BQP/flags counters + "Voir les lacunes" → `AdminDrillPanel` new `health` mode (category-coverage bars + grouped gap lists).
- ✅ graceful "migration pending" notice; `admin_data_health` fetched in `fetchAdminStats`.
- ✅ build + eslint clean.

**PostHog counterpart:** `store_wizard_completed` breakdown by `store_id` vs magasins actifs.

**Effort:** 1 session — done 2026-09-03 (pending migration apply + live verify).

---

### M4 — Martinique ↔ France Hexagonale matching pipeline

**Why:** the flagship "vie chère" comparison only works with real matched pairs. Sources:
1. **Diaspora users' real scans** in France (`source_type='scan'` + `origin_region_code='Hexagone'`) — flow exists
2. **Screenshot uploads from chains' own shopping apps** (Carrefour, E.Leclerc, Auchan, Système U) — *new capture path*, distinct from "admin found it on the website"
3. Admin online capture (`source_type='admin_reference'` + `source_url`) — exists

#### M4a — schema + coverage + attribution — 🧪 (PR open, `mainland_match_pipeline_migration.sql` pending)
- 🧪 `mainland_match_pipeline_migration.sql`:
  - `prices.source_channel text` check-constrained `('martinique_scan','diaspora_scan','chain_app_screenshot','online_capture')` + index; backfilled from `source_type` + `origin_region_code`.
  - `prices.match_verified boolean` + `match_verified_by uuid` + `match_verified_at timestamptz` (for the M4b queue).
  - `admin_mainland_match_coverage()` → one row: MTQ-priced products, # also with a France price, match rate %, France-priced products, France-without-MTQ (inverse gap), coverage by channel, **median / avg gap %** (latest MTQ vs latest France, + = MTQ dearer), # MTQ-dearer / -cheaper, unverified-France count. Every classifier uses `coalesce(source_channel, <derive from source_type/origin>)` so it works even before the client stamps the column.
  - `admin_mainland_gap_by_category()` → per-category matched count + median gap %.
- ✅ attribution: `MainlandPriceAdmin.jsx` stamps `source_channel='online_capture'`; diaspora hot-path (`priceSubmission.js`) left to the coalesce fallback for now (avoid a deploy-ordering break on the critical submission path) — stamped explicitly in M4b.
- ✅ dashboard section **"Comparaison France Hexagonale"** — `Meter` match rate + median-gap headline + coverage-by-channel counters + France-without-MTQ / unverified counts; "Détail par catégorie" → `AdminDrillPanel` `mainland` mode (diverging gap bars per category).
- ✅ build + eslint clean.

#### M4b — screenshot capture + verification queue — ⬜
- ⬜ `admin_mainland_match_queue(p_limit)` → unverified France rows (product, FR price, MTQ price, gap %, channel, has-evidence) + `admin_verify_mainland_match(p_price_id, p_ok boolean)`.
- ⬜ **screenshot-upload capture** in `MainlandPriceAdmin.jsx`: "depuis l'app d'une enseigne" source option → screenshot (`evidence_photo_url`, `price-tag-photos`) + chain + `source_channel='chain_app_screenshot'`.
- ⬜ diaspora-scan attribution stamped explicitly in `priceSubmission.js` (once the column is guaranteed present).
- ⬜ verification queue UI (extend `MainlandPriceAdmin` or a drill mode with verify/reject).
- ⬜ (stretch) user-facing screenshot upload for diaspora users.

**PostHog counterpart:** `mainland_screenshot_uploaded`, `mainland_match_verified`,
France-scan `price_submitted` where `origin_region_code = 'Hexagone'`.

**Effort:** M4a done 2026-09-03 (pending migration apply + verify); M4b = 1 session.

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
