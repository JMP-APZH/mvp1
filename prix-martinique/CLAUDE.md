# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) for the Prix Martinique project.

## Project Overview

**Prix Martinique ("Vie chère en Martinique")** is a community-driven PWA for price tracking and comparison across supermarkets in Martinique.

- **Live URL:** https://mvp1-prixmartinique.vercel.app
- **Stack:** React 19 (Vite), Tailwind CSS v3, Supabase (Postgres, Auth, Storage, Real-time).
- **Core Mission:** Empowering residents to combat the high cost of living through transparency and collective data.

## Current State (Audit: Feb 28, 2026)

### Active Version: `App10.jsx`
- **Status:** Stable. Production-ready candidate.
- **Key Imports in `main.jsx`**: `App10.jsx` is the primary entry point.
- **Includes:** Advanced price charts (`recharts`), BQP (Bouclier Qualité Prix) verification system, Diaspora tracking, Personal stats, and Shopping list (Supabase-synced).

### File Inventory (App Versions)
| File | Status | Description | Recommendation |
| :--- | :--- | :--- | :--- |
| `App.jsx` | Legacy | Blue theme, original Price Entry prototype. | Archive |
| `App2.jsx` | Legacy | Intermediate version. | Archive |
| `App3.jsx` | Legacy | Orange/red gradient theme introduction. | Archive |
| `App4.jsx` | Legacy | QuaggaJS integration for iOS. | Archive |
| `App5.jsx` | Legacy | Basic Auth + Gamification integration. | Archive |
| `App6.jsx` | Legacy | HybridBarcodeScanner implementation (v1). | Archive |
| `App7.jsx` | Legacy | UI Refinements and French accent fixes. | Archive |
| `App8.jsx` | Stable | Feature-complete version prior to Antigravity sessions. | Preserve (Fallback) |
| `App9.jsx` | Legacy | Iteration on Z-index and Store Selection. | Archive |
| `App10.jsx` | **ACTIVE** | Current version with Diaspora, Privacy, BQP voting, and cloud Shopping List. | **PRESERVE** |

### Features Completed (Fully Working)
- **Authentication**: Google OAuth & Email/Password via `AuthContext`.
- **Gamification**: Points (+10 per scan), levels, and dynamic leaderboard.
- **Barcode Scanning**:
  - `BarcodeDetector` (Android/Chrome) → High performance.
  - `ZXing` / `Quagga` fallback (iOS/Safari). Validated on physical iOS — behaviour equivalent to Android.
- **Store Selection**: Multi-step wizard (`StoreSelectionWizard.jsx`) with favorites and geocoding support. 78 store locations loaded, aligned with latest BQP documentation.
- **BQP Verifier**: Association of products with BQP categories and community voting on accuracy/quality.
- **Diaspora Tracking**: Profile-level region/city tracking (e.g., Hexagone scans) with privacy-protected backend logging.
- **Real-time Updates**: Live price feed via Supabase real-time channels.
- **Personal Stats**: User-specific contribution analytics (`PersoStats.jsx`).
- **Shopping List (Cloud Sync)**: Implemented via `src/hooks/useShoppingList.js`. Supabase-backed for authenticated users, localStorage fallback for anonymous users. Auto-migrates localStorage items on login.

### Feb 28, 2026 — Security Audit & Shopping List Milestone
Four Supabase database migrations applied:
1. **`enable_rls_on_public_tables`** — RLS enabled on `stores`, `prices`, `products` with correct public-read / authenticated-write policies.
2. **`fix_function_search_paths_and_view`** — Fixed mutable `search_path` on 6 DB functions; `increment_store_popularity` promoted to `SECURITY DEFINER`; `feature_request_stats` view recreated without `SECURITY DEFINER`.
3. **`fix_rls_policy_duplicates_and_auth_uid`** — Removed 7 duplicate RLS policies; fixed `auth.uid()` per-row evaluation → `(select auth.uid())` across 30+ policies on 12 tables.
4. **`add_missing_fk_indexes_and_drop_redundant`** — Added 9 missing FK indexes (`bqp_quality_votes`, `bqp_votes`, `feature_requests`, `feature_votes`, `price_likes`, `shopping_lists`, `user_badges`, `user_favorite_stores`, `user_favorites`); dropped `idx_bqp_code` (duplicate of existing unique constraint).

Frontend:
- **Shopping List** migrated from `localStorage` to Supabase via `src/hooks/useShoppingList.js`.

## Known Issues & Limitations
- **Shopping List photos**: When loading list items from Supabase, product photos show the fallback Package icon. Product photos live in the `prices` table (not `products`), so an additional join is needed to display them. Low priority — the list functions correctly without them.
- **Bundle size**: Single JS bundle is ~890 KB (255 KB gzipped). Caused by 9 legacy `App*.jsx` files being included in the build. Address post-launch by archiving legacy files and adding Vite code-splitting.

## Accepted Risks & Frozen Dependencies

### Quagga CVEs — Do Not Auto-Fix
`quagga ≥ 0.7.0` carries transitive CVEs via its dependency chain:
`get-pixels` → `request` (abandoned) → `form-data`, `qs`, `tough-cookie`, `lodash`.

**These vulnerabilities are NOT exploitable in production.** All affected packages are Node.js server-side libraries. Vite excludes them from the browser bundle — they are never executed on the user's device. The app has no server process running Quagga.

**Do NOT run `npm audit fix --force`** to address these. Doing so installs `quagga@0.6.16` (a breaking API change) and risks breaking the iOS barcode scanner — a critical, hard-won feature that took multiple development iterations to stabilize.

**Post-launch plan**: evaluate replacing `quagga` with `@ericblade/quagga2` (a maintained drop-in fork that patches all these CVEs) during a dedicated sprint with physical iOS device testing available.

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
- `src/contexts/AuthContext.jsx` — Auth state, points, profile, favorites.
- `src/components/ShoppingList.jsx` — Shopping list UI + basket price comparator.
- `src/components/StoreSelectionWizard.jsx` — Store selection flow.
- `src/components/BQPVerifier.jsx` — BQP product verification engine.
- `src/components/ZXingBarcodeScanner.jsx` — iOS/fallback barcode scanner.

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

## Next Priorities (Post-Launch)
1. **Bundle splitting**: Archive legacy `App*.jsx` files and configure Vite `manualChunks` to reduce the 890 KB bundle.
2. **Quagga replacement**: Evaluate `@ericblade/quagga2` with dedicated iOS regression testing.
3. **Shopping List photos**: Join `prices` table to display product photos in the shopping list when loading from Supabase.

---
**Last Updated**: 2026-02-28
**Current Version**: MVP v1.5 (App10)
**Status**: Production-ready candidate
