# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) for the Prix Martinique project.

## Project Overview

**Prix Martinique ("Vie chère en Martinique")** is a community-driven PWA for price tracking and comparison across supermarkets in Martinique.

- **Live URL:** https://mvp1-prixmartinique.vercel.app
- **Stack:** React 19 (Vite), Tailwind CSS v3, Supabase (Postgres, Auth, Storage, Real-time).
- **Core Mission:** Empowering residents to combat the high cost of living through transparency and collective data.

## Current State (Audit: Feb 21, 2026)

### Active Version: `App10.jsx`
- **Status:** Stable but under active development.
- **Key Imports in `main.jsx`**: `App10.jsx` is the primary entry point.
- **Includes:** Advanced price charts (`recharts`), BQP (Bouclier Qualité Prix) verification system, Diaspora tracking, Personal stats, and Shopping list.

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
| `App10.jsx` | **ACTIVE** | Current version with Diaspora, Privacy, and BQP voting. | **PRESERVE** |

### Features Completed (Fully Working)
- **Authentication**: Google OAuth & Email/Password via `AuthContext`.
- **Gamification**: Points (+10 per scan), levels, and dynamic leaderboard.
- **Barcode Scanning**: 
  - `BarcodeDetector` (Android/Chrome) → High performance.
  - `ZXing` / `Quagga` fallback (iOS/Safari).
- **Store Selection**: Multi-step wizard (`StoreSelectionWizard.jsx`) with favorites and geocoding support.
- **BQP Verifier**: Association of products with BQP categories and community voting on accuracy/quality.
- **Diaspora Tracking**: Profile-level region/city tracking (e.g., Hexagone scans) with privacy-protected backend logging.
- **Real-time Updates**: Live price feed via Supabase real-time channels.
- **Personal Stats**: User-specific contribution analytics (`PersoStats.jsx`).

### Antigravity Session Work (Recent History)
Recent development focused on maturation and community scaling:
1. **Diaspora & Privacy**: Added DB schema and UI to allow mainland France users to scan products for price comparison while keeping origin data private.
2. **Scanner UX**: Optimized `StoreSelectionWizard` to show favorite stores first and skip redundant confirmations.
3. **Z-Index Overhaul**: Systematically resolved stacking context issues where navigation or modals were obscured.
4. **BQP Logic**: Implemented deep verification for BQP products, including the "BQP Duel" and community voting.

## Known Issues & Limitations
- **iOS Barcode Scanner**: QuaggaJS often shows a "black screen" or fails to initialize on certain iOS versions. Native fallback exists but isn't as seamless as Android.
- **Storage**: `localStorage` is used for the Shopping List and UI state. This prevents cross-device sync and is a priority for migration to Supabase.
- **Store Database**: Currently uses a subset of stores; requires full CSV import for 100% coverage of Martinique.

## Technical Details

### Tech Stack & Dependencies
- **React 19** / **Vite 7**
- **UI**: Tailwind CSS v3 (Utility classes only).
- **Icons**: `lucide-react`.
- **Charts**: `recharts` for price history trends.
- **Scanner**: `zxing/library` + `quagga`.
- **Backend**: Supabase.
  - `supabaseClient.js` uses standard VITE_ env vars.

### Database Schema (Critical Tables)
- `products`: Includes `is_local_production`, `is_mdd` (distributor brand), `barcode`.
- `prices`: Records current price, store association, and price tag photos.
- `user_profiles`: Extends auth with `points`, `level`, `region_code`, and `is_diaspora`.
- `bqp_categories` & `product_bqp_associations`: Driving the BQP verification engine.

### Environment Variables
Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Immediate Next Priorities
1. **Shopping List Supabase Sync**: Replace `localStorage` in `App10.jsx` (lines 131-185) with Supabase database persistence to allow users to access their list across devices.
2. **Batch Store Import**: Import the full dataset of Martinique supermarkets into the `stores` table to eliminate manual store entry.
3. **iOS Validation**: Dedicated testing and refinement of the `ZXingBarcodeScanner` on physical iOS devices to resolve remaining black-screen edge cases.

---
**Last Updated**: 2026-02-21
**Current Version**: MVP v1.5 (App10)
**Next Milestone**: Cloud Shopping List & Full Store Expansion