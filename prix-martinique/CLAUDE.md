# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) for the Prix Martinique project.

## Project Overview

**Prix Martinique ("Vie chère en Martinique")** is a community-driven PWA for price tracking and comparison across supermarkets in Martinique.

- **Live URL:** https://mvp1-prixmartinique.vercel.app
- **Stack:** React 19 (Vite), Tailwind CSS v3, Supabase (Postgres, Auth, Storage, Real-time).
- **Core Mission:** Empowering residents to combat the high cost of living through transparency and collective data.

## Current State (Audit: May 2026)

### Active Version: `App10.jsx`
- **Status:** Launched. Production.
- **Key Imports in `main.jsx`**: `App10.jsx` is the primary entry point.
- **Includes:** Advanced price charts (`recharts`), BQP (Bouclier Qualité Prix) verification system, Diaspora tracking, Personal stats, Shopping list (Supabase-synced), Toast notifications, Password reset flow.

### File Inventory (App Versions)
| File | Status | Description | Recommendation |
| :--- | :--- | :--- | :--- |
| `src/_archive/App.jsx` | Archived | Blue theme, original Price Entry prototype. | Do not touch |
| `src/_archive/App2.jsx` | Archived | Intermediate version. | Do not touch |
| `src/_archive/App3.jsx` | Archived | Orange/red gradient theme introduction. | Do not touch |
| `src/_archive/App4.jsx` | Archived | QuaggaJS integration for iOS. | Do not touch |
| `src/_archive/App5.jsx` | Archived | Basic Auth + Gamification integration. | Do not touch |
| `src/_archive/App6.jsx` | Archived | HybridBarcodeScanner implementation (v1). | Do not touch |
| `src/_archive/App7.jsx` | Archived | UI Refinements and French accent fixes. | Do not touch |
| `src/_archive/App8.jsx` | Archived | Feature-complete version prior to Antigravity sessions. | Do not touch |
| `src/_archive/App9.jsx` | Archived | Iteration on Z-index and Store Selection. | Do not touch |
| `src/App10.jsx` | **ACTIVE** | Current version. | **PRESERVE** |

### Features Completed (Fully Working)
- **Authentication**: Google OAuth & Email/Password via `AuthContext`. Password reset flow (implicit flow, cross-browser).
- **Gamification**: Points (+10 per scan), levels, and dynamic leaderboard.
- **Barcode Scanning**:
  - `BarcodeDetector` (Android/Chrome) → High performance.
  - `ZXing` / `Quagga` fallback (iOS/Safari). Validated on physical iOS.
- **Store Selection**: Multi-step wizard (`StoreSelectionWizard.jsx`) with favorites and geocoding support. 78 store locations loaded, aligned with latest BQP documentation.
- **BQP Verifier**: Association of products with BQP categories and community voting on accuracy/quality.
- **Diaspora Tracking**: Profile-level region/city tracking (e.g., Hexagone scans) with privacy-protected backend logging.
- **Real-time Updates**: Live price feed via Supabase real-time channels.
- **Personal Stats**: User-specific contribution analytics (`PersoStats.jsx`).
- **Shopping List (Cloud Sync)**: `src/hooks/useShoppingList.js`. Supabase-backed for authenticated users, localStorage fallback for anonymous users. Auto-migrates localStorage items on login. Product photos pulled from `prices` table.
- **Toast Notifications**: `src/components/Toast.jsx` + `src/hooks/useToast.js`.
- **Auth Loading Spinner**: Prevents mobile white screen during auth init (`AuthContext.jsx`, `index.css`).
- **Supabase Keep-Alive**: GitHub Actions cron (`.github/workflows/keep-supabase-alive.yml`) pings Supabase **twice a week** (Monday + Thursday at 08:00 UTC) to prevent free-tier auto-pause (threshold: 7 days inactivity). If the project gets paused despite this, restore it at supabase.com/dashboard — you have 90 days before data is lost. Long-term fix: upgrade to Supabase Pro ($25/month) for guaranteed uptime.

### Feb 28, 2026 — Security Audit & Shopping List Milestone
Four Supabase database migrations applied:
1. **`enable_rls_on_public_tables`** — RLS enabled on `stores`, `prices`, `products` with correct public-read / authenticated-write policies.
2. **`fix_function_search_paths_and_view`** — Fixed mutable `search_path` on 6 DB functions; `increment_store_popularity` promoted to `SECURITY DEFINER`; `feature_request_stats` view recreated without `SECURITY DEFINER`.
3. **`fix_rls_policy_duplicates_and_auth_uid`** — Removed 7 duplicate RLS policies; fixed `auth.uid()` per-row evaluation → `(select auth.uid())` across 30+ policies on 12 tables.
4. **`add_missing_fk_indexes_and_drop_redundant`** — Added 9 missing FK indexes (`bqp_quality_votes`, `bqp_votes`, `feature_requests`, `feature_votes`, `price_likes`, `shopping_lists`, `user_badges`, `user_favorite_stores`, `user_favorites`); dropped `idx_bqp_code` (duplicate of existing unique constraint).

### Post-Launch Fixes & Polish (Mar–May 2026)
- **Password reset**: Full reset flow + in-app password change (`bd766a4`). Multiple iterations to resolve cross-browser failures; landed on implicit flow (`4c8a3ba`).
- **Bundle splitting**: Legacy `App*.jsx` files moved to `src/_archive/`. Vite `manualChunks` configured (`5b9e596`). Bundle reduced from ~890 KB.
- **Shopping list photos**: `fetchItems` in `useShoppingList.js` joins `prices` to retrieve `product_photo_url` per product (`5b9e596`).
- **UX polish**: Toast system, welcome screen, a11y improvements, BQP performance (`7528bae`).
- **Mobile white screen**: Loading spinner added during auth initialization (`3c3e105`).

### Jul 21, 2026 — Gamification (`award_points`) Regression Fixed
Discovered while auditing a 10-item test scan session ahead of the RPPRAC presentation: the test user completed 10 price submissions but earned **0 points**.

- **Root cause**: `awardPoints` in `AuthContext.jsx` was refactored on 2026-02-05 (`73f6c22`) from `(activityType, points, description)` down to `(points, description)`, dropping the `p_activity_type` arg sent to the `award_points` Postgres RPC (which requires it, no default). Call sites in `App10.jsx` (price submission `+10`, BQP verification `+5`) were never updated and kept calling it with 3 positional args, so `points`/`description` were silently misassigned and the RPC call failed every time. The error was caught and only `console.error`'d — the price/photo submission itself always succeeded, so the bug was invisible in normal use.
- **Impact**: Every point-earning action for every user since 2026-02-05 (~5.5 months) silently failed. Verified via direct Supabase query: all user_profiles created after that date sit at 0 points regardless of activity; only the one profile predating the regression has nonzero points.
- **Fix**: Restored the 3-arg signature and `p_activity_type` passthrough in `awardPoints` (`AuthContext.jsx`). No call-site changes needed — they were already correct.
- **Backfill**: The Jul 20 test session (10 price submissions by user "Tony") was manually backfilled via 10 direct `award_points` RPC calls → 100 pts, Level 2. All other historical activity since 2026-02-05 was **not** backfilled by design — only submissions from this fix onward award correctly.
- **Also observed, not fixed**: `user_profiles.city` is not trimmed before insert, producing duplicate-looking entries (e.g. `"Zurich"` vs `"Zurich "`) in city-based stats/leaderboards. Low priority, cosmetic.

### Jul 21, 2026 — Community Leaderboard Querying Nonexistent Table
Found while investigating why the Communauté → Classement tab showed no ranking at all for any user, not just Tony.

- **Root cause**: `Leaderboard.jsx` has queried `.from('profiles')` since 2026-02-10 (`68fda8f`) — a table that **does not exist** in the schema (confirmed: `PGRST205`). The correct table, used everywhere else in the app, is `user_profiles`. The failed query was caught silently, leaving the component permanently stuck on its "Pas encore de classement" empty state for ~5.5 months, independent of the `award_points` bug above.
- **Fix**: `Leaderboard.jsx` now queries `user_profiles`, matching `AuthContext.jsx` / `AdminDashboard.jsx` / the schema.
- **`total_contributions` — permanent DB fix (Jul 21, 2026, applied manually via Supabase SQL Editor)**: this column was never written to by `award_points` or any migration (permanently 0 for everyone). Initially patched around client-side in `Leaderboard.jsx` (deriving the count from `COUNT(prices)` per leaderboard load); that workaround has since been **replaced** by `total_contributions_migration.sql`, which adds `sync_total_contributions()` — a trigger on `prices` (insert/update/delete) that recomputes the affected user's `total_contributions` from `COUNT(*)` server-side — plus a one-time backfill. `Leaderboard.jsx` now reads the column directly again. Verified after applying: backfilled counts matched actual `prices` rows exactly (Tony: 10, Jean-Marie Philocles: 8, others: 0). The migration file lives at `prix-martinique/total_contributions_migration.sql`; run manually in the Supabase Dashboard → SQL Editor (no `supabase/` CLI migrations folder in this project — all schema changes are applied this way, see the many `*_schema.sql` / `*_migration.sql` files in the repo root).

### Jul 21, 2026 — Component-Wide Bug Sweep (pre-RPPRAC audit)
Went looking for more of the same failure class (wrong table/column names, RPC signature mismatches) across every active component (everything reachable from `App10.jsx`; `src/_archive/**` and the unused `BQPSearchPrototype.jsx` excluded). Method: cross-referenced every `.from()`/`.rpc()`/embedded-select call against the real schema, then live-tested each one with the anon key.

**Confirmed and fixed:**
- **`Community.jsx` "Score de Souveraineté"**: filtered `products.is_bqp` (column doesn't exist — real column is `is_declared_bqp`). Introduced in the same commit as the `profiles`-table bug (`68fda8f`, 2026-02-10) — this stat has read a hardcoded **0%** since the feature was created. Fixed: now filters `is_declared_bqp`.
- **`ShoppingList.jsx` basket price comparator**: embedded select `stores(id, name, type)` — `stores` has no `type` column (closest real column is `category`, e.g. `"Hypermarché"`). Every comparison silently failed the moment a shopping list had ≥1 item (`storeBaskets` never populated — this is the "compare your basket total across nearby stores" feature). `type` wasn't used downstream, so it was simply dropped from the select.
- **`get_bqp_vote_stats` RPC**: called from `App10.jsx`'s `fetchBqpVotes` (fires whenever a scanned barcode matches an existing BQP association) — errored every time with `column "vote_type" does not exist`, because `bqp_quality_votes` uses a column named `vote` (see `milestone2_schema.sql`), not `vote_type` like `bqp_votes`. Confirmed live: both vote tables currently have 0 rows, consistent with community voting never having round-tripped successfully. Fix written as `bqp_vote_stats_fix_migration.sql` (DB-side — same manual-apply-via-SQL-Editor flow as `total_contributions_migration.sql`; **not yet applied as of this writing**, pending you running it).

**Flagged, not changed (uncertain or out of scope):**
- **Admin/journalist role gate** (`UserMenu.jsx` `userRoles.includes('admin')`, sourced from the `user_roles` table via `AuthContext.jsx`'s `fetchUserRoles`): an anon-key probe showed 0 rows, but RLS may simply be hiding other users' rows from an unauthenticated read — this could **not** be confirmed as broken vs. working-as-intended. Worth a manual check: log in as your own account and confirm the "Console Admin" entry still appears in the user menu.
- **`AdminDashboard.jsx` KPI trend badges**: the `+12%` / `+5%` arrows next to Total Scans / Utilisateurs Actifs are hardcoded, not computed from any query. Low risk technically, but worth knowing before presenting real-looking-but-fake growth numbers to RPPRAC.
- **`PersoStats.jsx` "Mes Économies"**: computed as `points * 0.15` (explicitly commented `// Mock logic`), but the adjacent "Comment c'est calculé ?" explainer describes a completely different methodology (savings vs. highest observed price for the same product). The number itself isn't wrong per se, but the stated methodology doesn't match the code — worth rewording the explainer or implementing the described logic before anyone asks how it's calculated.
- **Badges system** (`user_badges`, `badges` tables): both empty in production; no code path was found that ever inserts into them. The "Mes Badges" UI in `PersoStats.jsx` is fully wired but has nothing to display — appears to be a stubbed-out feature rather than a bug.

### Jul 21, 2026 — Product Detail Card, Swipeable Photos, Admin Barcode Audit
Three features requested ahead of the RPPRAC presentation, built against real production data:

- **`ProductDetailModal.jsx`** (new): tapping a card in the recent-prices feed opens a "wow" detail view — total scan count, distinct-shop count, best price, a price-trend chart (reusing the extracted `PriceHistoryChart.jsx`), and an intra-Martinique store-by-store price comparison sorted cheapest-first. Excludes legacy `prices` rows with a null `store_id` (pre-dates mandatory store selection) from the shop count and comparison table — confirmed live that at least one such row exists (`881db4d5-...`, submitted before store selection was enforced) and would otherwise show as a misleading "Magasin inconnu — cheapest!" entry.
- **`PriceHistoryChart.jsx`** (extracted from `App10.jsx`, where it was previously inline and only used by the BQP-scan flow): now shared between that flow and `ProductDetailModal`. Same props/behavior, just relocated.
- **Swipeable photo viewer**: the image zoom modal (`App10.jsx`) previously showed one image at a time — closing and reopening was required to compare the product photo against the price-tag photo. Now a single modal with left/right arrows, dot indicators, and touch-swipe (50px threshold) cycles between all photos for that scan.
- **`BarcodeAudit.jsx`** (new, admin-only, Console Admin → "Intégrité Codes-barres" sub-tab): lists recent scans with a product photo next to the currently-stored `products.barcode`, so an admin can visually compare the captured value against the barcode printed on the packaging. Two actions per entry: **"J'ai corrigé"** (admin enters the correct barcode, updates `products.barcode` directly, logged with `resolution_type = 'admin_modification'`) or **"Demander re-capture"** (flags the item for the original user to rescan, `resolution_type = 'user_recapture'`, no value changed). Every action is an insert into `barcode_flags` — append-only, publicly readable (RLS `for select using (true)`) so the audit trail survives corrections and is inspectable by RPPRAC or any other external party, not just admins. Migration: `barcode_audit_migration.sql`, applied 2026-07-21 (verified: table exists, both migrations from this date confirmed live — `get_bqp_vote_stats` no longer errors, `barcode_flags` is queryable).
- **Photo zoom + barcode overlay** (`BarcodeAudit.jsx`, added same day after initial admin testing): the product photo thumbnail is now clickable, opening a full-screen zoom with the stored barcode overlaid bottom-left (dark chip, monospace) so the admin can compare the captured value against the packaging without leaving the zoomed view.

### Jul 21, 2026 — Closed Out: Fake Trend Badges, Savings Methodology Mismatch
- **`AdminDashboard.jsx` KPI badges**: replaced the hardcoded `+12%`/`+5%` with real numbers — count of scans and count of distinct active users in the trailing 7 days (`created_at >= now() - 7 days`). Percentage-of-previous-period was considered and rejected: with volumes this low, a previous-period count of 0 makes any % swing either undefined or absurd (e.g. "+∞%"); an absolute weekly count stays honest and meaningful regardless of baseline. Badge is hidden entirely when the weekly count is 0, rather than showing a claim with nothing behind it. Verified live: 10 scans / 1 active user this week (Tony's Jul 20 session).
- **`PersoStats.jsx` "Mes Économies"**: replaced the mock `points * 0.15` with the methodology the UI already claimed — for each product the user has priced, compare their price to the highest price observed for that same product across all stores, sum the positive differences. Verified live: Tony (all 10 products unique, no other pricer to compare against) → €0.00; Jean-Marie Philocles (has repeat-priced products) → €0.35. Both are real, non-hardcoded, and match the on-screen explainer (also tightened for precision — "highest price observed," not "average of highest prices observed").

## Known Issues & Limitations
None blocking. Both pending migrations (`bqp_vote_stats_fix_migration.sql`, `barcode_audit_migration.sql`) have been applied and verified live as of 2026-07-21.
- See "Jul 21, 2026 — Component-Wide Bug Sweep" above for items flagged but intentionally not changed (admin-role RLS uncertainty, unused badges system).

## Accepted Risks & Frozen Dependencies

### Quagga CVEs — Do Not Auto-Fix
`quagga ≥ 0.7.0` carries transitive CVEs via its dependency chain:
`get-pixels` → `request` (abandoned) → `form-data`, `qs`, `tough-cookie`, `lodash`.

**These vulnerabilities are NOT exploitable in production.** All affected packages are Node.js server-side libraries. Vite excludes them from the browser bundle — they are never executed on the user's device. The app has no server process running Quagga.

**Do NOT run `npm audit fix --force`** to address these. Doing so installs `quagga@0.6.16` (a breaking API change) and risks breaking the iOS barcode scanner — a critical, hard-won feature that took multiple development iterations to stabilize.

**Planned**: Evaluate replacing `quagga` with `@ericblade/quagga2` (a maintained drop-in fork patching all CVEs) in a dedicated sprint with physical iOS device testing. This may also be superseded by a broader barcode scanner rework — keep open until direction is decided.

## Technical Details

### Tech Stack & Dependencies
- **React 19** / **Vite 7**
- **UI**: Tailwind CSS v3 (Utility classes only).
- **Icons**: `lucide-react`.
- **Charts**: `recharts` for price history trends.
- **Scanner**: `zxing/library` + `quagga`.
- **Backend**: Supabase.
  - `supabaseClient.js` uses standard VITE_ env vars.

### Key Source Files
- `src/App10.jsx` — Main app entry point.
- `src/hooks/useShoppingList.js` — Shopping list state + Supabase sync logic.
- `src/hooks/useToast.js` — Toast notification hook.
- `src/contexts/AuthContext.jsx` — Auth state, points, profile, favorites.
- `src/components/ShoppingList.jsx` — Shopping list UI + basket price comparator.
- `src/components/StoreSelectionWizard.jsx` — Store selection flow.
- `src/components/BQPVerifier.jsx` — BQP product verification engine.
- `src/components/ZXingBarcodeScanner.jsx` — iOS/fallback barcode scanner.
- `src/components/Toast.jsx` — Toast notification UI.
- `src/components/ProductDetailModal.jsx` — Per-product "wow" card (scans, trend, cross-store comparison).
- `src/components/PriceHistoryChart.jsx` — Shared recharts line chart (BQP scan flow + ProductDetailModal).
- `src/components/BarcodeAudit.jsx` — Admin-only barcode integrity review (Console Admin sub-tab).

### Database Schema (Critical Tables)
- `products`: Includes `is_local_production`, `is_mdd` (distributor brand), `barcode`.
- `prices`: Records current price, store association, and price tag photos. RLS enabled.
- `stores`: 78 Martinique supermarket locations, aligned with BQP 2025 documentation. RLS enabled (public read).
- `user_profiles`: Extends auth with `points`, `level`, `region_code`, and `is_diaspora`.
- `bqp_categories` & `product_bqp_associations`: Driving the BQP verification engine.
- `shopping_lists` + `shopping_list_items`: Cloud shopping list (one primary list per user).

### Environment Variables
Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Open Items
1. **Quagga → @ericblade/quagga2** — CVE mitigation / potential scanner rework. Requires physical iOS testing. Keep open; direction TBD.
2. **Next Milestone** — TBD.

---
**Last Updated**: 2026-07-21
**Current Version**: MVP v1.5 (App10)
**Status**: Launched — Production
