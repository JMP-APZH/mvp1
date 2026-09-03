# Metric Catalog — Prix Martinique

**Purpose:** one place that says, for every metric we track, **what it means**, **which
system is authoritative**, and **which PostHog event cross-checks it**. A discrepancy
between the two is then a signal, not a mystery.

**Last updated:** 2026-09-03 (M6 of the Analytics & Monitoring Overhaul — see
[`ANALYTICS_MONITORING_PLAN.md`](./ANALYTICS_MONITORING_PLAN.md)).

---

## Division of responsibility

PostHog runs **cookieless** (`cookieless_mode: 'always'`, `person_profiles: 'never'`,
project "Cookieless server hash mode" = Stateful) since 2026-09-03. It therefore has
**no stable user identity**. That fixes what each tool is authoritative for:

| Question | Authoritative | Cross-check |
| :--- | :--- | :--- |
| How many real prices / products / contributors? | **Supabase** (`prices.submitted_by`) | PostHog `price_submitted` volume (authed only) |
| Contributor retention / cohorts / repeat rate | **Supabase only** — PostHog cannot do this cookieless | — |
| Data health: freshness, coverage, integrity | **Supabase** | PostHog `store_wizard_completed` by store |
| MTQ↔Hexagone gap, savings, value delivered | **Supabase** | PostHog `product_detail_viewed` / PriceDuel events (not yet emitted) |
| Traffic, sessions, acquisition, bounce | **PostHog** web analytics | Supabase `app_sessions` count (consent-independent floor) |
| Feature funnels *within a session* | **PostHog** | — |
| Error / exception rate | **PostHog** `$exception` | Supabase `captureException` call sites |
| Sessions by platform / PWA / auth method | **Supabase** `app_sessions` / `auth_events` | PostHog `$device_type` / `$pageview` |

**Retention constraint:** any cohort / retention / repeat-rate analysis is
**Supabase-only** (`prices.submitted_by` + `created_at`). PostHog retention insights are
meaningless while cookieless — do not build or trust them.

**Unrecoverable gap:** PostHog emitted nothing from 2026-07 through 2026-09-03 (consent
gate + missing build env var, both fixed in PRs #26/#27). That whole window exists only
in Supabase (`app_sessions`, `auth_events`, `prices`).

---

## 1. Contribution & adoption (M1 / M2)

| Metric | Definition | Supabase source | PostHog counterpart | Notes / target |
| :--- | :--- | :--- | :--- | :--- |
| **Contributions de prix** | non-test `prices` rows, `channel ∈ {martinique_scan, diaspora_scan}` (i.e. not `admin_reference`), counting `coalesce(submitted_by, user_id)` | `admin_kpi_overview.real_submissions` | `price_submitted` count (`is_mainland` split) | PostHog ≤ Supabase (misses pre-consent + anon SDK gaps) |
| **Contributeurs** | distinct `coalesce(submitted_by, user_id)` among real rows | `admin_kpi_overview.distinct_contributors` | distinct authed `price_submitted` actors (rough, cookieless) | internal-account toggle excludes team/test |
| **Contributions in window** | real rows since `p_since` | `admin_kpi_overview.submissions_in_window` | `price_submitted` daily trend | date-range control drives `p_since` |
| **Produits avec prix** | distinct `product_id` with ≥1 real price | `admin_kpi_overview.real_products_priced` | — | vs `stats.catalogProducts` total |
| **Produits MDD avec prix** | ...where `products.is_mdd` | `admin_kpi_overview.mdd_priced_products` | — | |
| **Scans diaspora** | real rows, `channel = diaspora_scan` | `admin_kpi_overview.diaspora_scan_submissions` | `price_submitted` where `is_mainland = true` | distinct from admin `online_capture` |
| **Prix de référence France** | `channel = admin_reference` / `online_capture` | `admin_kpi_overview.reference_prices` | — | data-quality context, NOT adoption; not internal-filtered |
| **Prix partagés (header pill)** | same as *Contributions de prix* but never internal-filtered (public total) | `community_price_count()` (public RPC) | — | the in-app header number; must match admin's "Contributions de prix" (internal-OFF) |
| **Signups in window** | `user_profiles` created since `p_since` | `admin_kpi_overview.signups_in_window` | `anon_to_signup_converted` | |
| **Sessions in window** | `app_sessions` since `p_since` | `admin_kpi_overview.sessions_in_window` | `$pageview` / web analytics sessions | Supabase is the consent-independent floor |
| **Repeat / retention** | contributors with ≥2 real rows on different days | *(compute from `v_admin_prices`)* | **N/A cookieless** | Supabase-only by design |

Drill-downs (`admin_submissions_browse`, `admin_contributors`) and CSV
(`admin_submissions_detail`) read the same `v_admin_prices` view, so every number
reconciles.

---

## 2. Data health (M3)

Source: `admin_data_health()` (one row) + `admin_category_coverage()` +
`admin_coverage_gaps(p_limit)`. "Real" = `not is_test_data AND source_type <> 'admin_reference'`.

| Metric | Definition | Field | PostHog counterpart | Target |
| :--- | :--- | :--- | :--- | :--- |
| **Prix récents (<30j)** | % of real-priced products whose newest real price is < 30 days old | `pct_fresh` (+ `median_latest_price_age_days`) | — | > 60% |
| **Catégorisation** | % of non-test products with `category_id` | `pct_categorized` (+ `categories_with_products` / `total_categories`) | — | > 90% |
| **Photo jointe** | % of real price rows with `product_photo_url` | `pct_photo` | `price_submitted.has_product_photo` | > 85% |
| **Code-barres renseigné** | % of non-test products with a non-empty `barcode` | `pct_barcode` | — | > 90% |
| **Magasins actifs 30j** | distinct `store_id` with a real price in the last 30d / `count(stores)` | `stores_priced_30d` / `stores_total` | `store_wizard_completed` breakdown by `store_id` | grow |
| **Postes BQP couverts** | distinct `bqp_category_id` in `product_bqp_associations` / `count(bqp_categories)` | `bqp_categories_covered` / `bqp_categories_total` | — | 16/16 |
| **Signalements ouverts** | `barcode_flags` where `status ∈ {flagged, recapture_requested}` | `open_barcode_flags` | — | 0 |
| **Lacunes** | stores stale / demanded-unpriced (`user_favorites`) / uncategorized | `admin_coverage_gaps` rows | — | drive to 0 |

---

## 3. Martinique ↔ France Hexagonale matching (M4)

Source: `admin_mainland_match_coverage()` + `admin_mainland_gap_by_category()` +
`admin_mainland_match_queue(p_limit)`. Provenance column: `prices.source_channel ∈
{martinique_scan, diaspora_scan, chain_app_screenshot, online_capture}` (functions
`coalesce(source_channel, derive-from-source_type/origin)` so they work pre-stamp).

| Metric | Definition | Field | PostHog counterpart | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Taux de correspondance** | products with a real MTQ price that also have a France price / MTQ-priced products | `match_rate_pct` (`mtq_with_france_price` / `mtq_priced_products`) | — | flagship coverage |
| **Écart médian MTQ vs FR** | median over matched products of `(mtq_latest − fr_latest)/fr_latest × 100` | `median_gap_pct` | — | + = dearer in MTQ |
| **Coverage by channel** | distinct France-priced products per `source_channel` | `cov_diaspora_scan` / `cov_online_capture` / `cov_chain_app_screenshot` | `mainland_screenshot_uploaded` *(not yet emitted)* | |
| **France sans prix MTQ** | France-priced products with no real MTQ price (inverse gap) | `france_without_mtq` | — | → prioritise MTQ scans |
| **Entrées à vérifier** | France rows with `match_verified = false` | `unverified_france_entries` | `mainland_match_verified` *(not yet emitted)* | worked via `admin_verify_mainland_match` |
| **Gap by category** | median gap % + matched count per category | `admin_mainland_gap_by_category` | — | |

---

## 4. Valeur livrée (M5)

Source: `admin_value_delivered(p_since)` (admin) + `community_mainland_gap()` (public,
anon-safe — feeds the in-app Community → Impact card).

| Metric | Definition | Field | PostHog counterpart | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Écart pondéré (panier)** | `Σ(mtq − fr) / Σ(fr) × 100` over matched products | `weighted_gap_pct` | — | weights costlier items — the "basket" gap |
| **Écart médian** | as M4 `median_gap_pct` | `median_gap_pct` | — | the number shown in-app |
| **MTQ plus chers / moins chers** | count of matched products with gap `> 0` / `< 0` | `mtq_dearer` / `mtq_cheaper` | — | |
| **BQP appariés** | matched products that are BQP-associated (+ their median gap) | `bqp_matched_products` / `bqp_median_gap_pct` | — | mission-critical: BQP items still dearer here |
| **Économies communauté** | `Σ max(0, 365d-product-avg − price)` over Martinique real rows since `p_since` | `community_savings_eur` / `savings_contributions` | — | community-wide port of `userStats.calculateSavingsBreakdown` |

---

## 5. Traffic & behaviour — PostHog-authoritative

| Metric | PostHog | Supabase cross-check |
| :--- | :--- | :--- |
| Sessions / visitors / bounce | web analytics | `app_sessions` row count (floor) |
| Traffic by host | `$pageview` by `$host` | — (dashboard **928161**) |
| Acquisition source | `$referrer` / UTM | — |
| Store-selection funnel | `store_wizard_step_viewed` by `step_name` (city→chain→store) | `app_sessions` |
| Feature adoption | `my_scans_opened`, `wanted_scans_opened`, `recettes_hub_opened`, `panier_*`, `recipe_viewed`, `feature_request_opened` | — |
| Activation | `$pageview`/signup → `first_contribution_completed` | `user_profiles` vs first `prices.submitted_by` |
| Errors | `$exception` / day | `posthog.captureException` call sites |

---

## 6. PostHog instrumentation — gaps to close

Events the catalog references that **do not fire yet**:

- `product_detail_viewed` — ProductDetailModal open (cross-check for M4/M5 engagement + PriceDuel exposure).
- `price_duel_viewed` — when the MTQ↔Hexagone comparison actually renders with data.
- `mainland_screenshot_uploaded` — MainlandPriceAdmin `chain_app_screenshot` submit.
- `mainland_match_verified` / `mainland_match_rejected` — `admin_verify_mainland_match`.
- `bqp_verified` — `product_bqp_associations` community verification.
- `comparer_opened` / `bqp_search_used` — top-level feature entry points (audit whether `$pageview` on the route is enough).

Events that **already fire** (keep): `price_submitted`, `first_contribution_completed`,
`anon_to_signup_converted`, `scan_session_started`, `barcode_detected`,
`product_matched`, `store_wizard_step_viewed` / `_completed` / `_gps_detected`,
`my_scans_*`, `wanted_scans_opened`, `panier_*`, `recipe_*`, `recettes_hub_opened`,
`community_recipe_idea_*`, `feature_*`, `scan_celebration_choice`.

---

## 7. PostHog dashboard curation — ✅ done 2026-09-03

Two dashboards, project **232864**:

- **[928161 — Launch Monitoring](https://eu.posthog.com/project/232864/dashboard/928161)** (pinned): traffic-by-`$host`, submissions/day, contributors & onboarding, `$exception`/day, daily visitors + the new distinct-stores tile.
- **[862895 — Product Analytics](https://eu.posthog.com/project/232864/dashboard/862895)** (primary): price submissions, new contributors, store-selection funnel, repeat contributors, community engagement, personal feature usage + the new activation funnel and M4/M5 cross-check tiles.

**M6 cross-check pass applied:**
- [x] Both dashboard **header text blocks rewritten** — removed the stale "consent-gated / zero prod events" note (PostHog is cookieless / consent-exempt since 2026-09-03), added the cookieless retention caveat, the unrecoverable Jul→Sep 3 gap, and a link to this catalog as source of truth.
- [x] **"Price Submissions (daily)"** insight annotated: "≤ Console Admin *Contributions de prix* — PostHog misses pre-consent + anon".
- [x] **New tile → 928161: "Store coverage — distinct stores selected (weekly)"** (`uniq(store_id)` on `store_wizard_completed`) — cross-check for *Magasins actifs 30j*.
- [x] **New tile → 862895: "Activation funnel — store selected → first contribution"** (`store_wizard_completed` → `first_contribution_completed`).
- [x] **"Repeat Contributors (weekly retention)"** insight renamed `— ⚠ cookieless-unreliable` and its description points to Console Admin / Supabase as authoritative.
- [x] **New tile → 862895: "M4 / M5 cross-check events"** (`product_detail_viewed`, `mainland_match_verified`/`_rejected`, `mainland_screenshot_uploaded`/`mainland_online_capture_added`) — forward-looking; populates as the app is used.

**Not done (deliberately):** the `anon_to_signup_converted` event still records nothing in PostHog, so a signup→contribution funnel isn't possible there — activation is cross-checked against Supabase (`user_profiles` vs first `prices.submitted_by`) instead. The stretch `posthog_metrics_daily` export table (§ANALYTICS_MONITORING_PLAN M6 stretch) is not built.
