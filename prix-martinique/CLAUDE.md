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

## Known Issues & Limitations
None blocking. The app is in production.

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
**Last Updated**: 2026-07-06
**Current Version**: MVP v1.5 (App10)
**Status**: Launched — Production
