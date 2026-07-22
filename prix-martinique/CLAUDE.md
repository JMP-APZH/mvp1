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

### Jul 21, 2026 — Leaderboard City Filter, Category Filtering, Store Filter
- **Leaderboard city filter silently excluded Tony**: root cause traced to `AuthModal.jsx`'s signup form, which uses a free-text "Ville" input for *every* region including Martinique (972) — unlike `UserMenu.jsx`'s profile editor, which uses a clean dropdown for 972 residents. Tony's stored `city` was `"Fort-de-France "` (confirmed via exact codepoint dump: trailing space, charcode 32). The Leaderboard's `.eq('city', city)` filter compares against the clean hardcoded Martinique-cities list, so it never matched — Tony only ever showed up under "Toute la Martinique" (no filter applied). Also found affecting a second profile (`"Zurich "` vs a separate clean `"Zurich"` profile). **Fix**: `AuthContext.jsx` now trims `city` in `signUp()`, and `updateProfile()` trims every string value generically (defense in depth for any future free-text profile field, not just city). **Data cleanup**: `trim_city_cleanup_migration.sql` — one-time `UPDATE ... SET city = trim(city)` for existing corrupted rows. Manual Supabase SQL Editor run, same as prior migrations.
- **`products.category` vs `category_id`**: confirmed **not a bug**. `category` (legacy text column) is intentionally always null — hardcoded in `submitPrice` (`App10.jsx`) with a `// Legacy field` comment. The real relationship is `category_id → categories.id`, verified live via a working embedded join (`products.select('*, categories(name, icon)')`). Data-completeness gap, not a technical one: only 5 of 23 products currently have `category_id` set, since it's an optional field during capture — most scans don't get categorized. Worth revisiting capture-flow UX later if category coverage matters for the Friday demo, but out of scope for this pass.
- **`CategoryManager.jsx`** (admin-only, Console Admin → "Catégories" sub-tab): lets an admin add a new category (icon + name, `display_order` auto-computed as current max + 10). Required a new RLS policy — `categories_schema.sql` only ever defined a public **read** policy; insert was completely blocked (confirmed live: `42501` RLS violation) until `categories_admin_insert_migration.sql` added an admin-gated insert policy (same `user_roles` check pattern as `barcode_flags`). **Superseded same day** — see the next entry below; the component was removed after a scope clarification, but the RLS migration/policy is harmless to leave in place.
- **Category icon picker + store filter** (`App10.jsx`, Comparer/search tab): the `categoryFilter` state and its filtering logic already existed but had **no UI to actually set it** — only a chip to clear it. Added: a "Catégorie" button under the search bar opens an icon-grid overlay (from the `categories` table); a new "Magasin" button opens a store-picker overlay, populated only with stores that have ≥1 scanned product (derived from the loaded `prices` feed, not a separate query). Selecting a store narrows the category picker to only categories with a product actually scanned at that store (`pickerCategories`), and narrows the product list (`filteredPrices`) to that store. Both filters are independent and combinable; each shows a dismissible chip when active. Required adding `stores(id, ...)` (previously just `name, full_address`) to the `prices` load query so store-level filtering has an ID to match on.

### Jul 21, 2026 — Product Completion Tool, Hunter Detail Card, Comments + Sharing
Scope clarification from Jean-Marie: the standalone "Catégories" admin tool (add brand-new category types) wasn't what was wanted — the actual need was the same *per-product* correction pattern already built for barcodes, extended to category. Three changes:

- **`ProductCompletion.jsx`** (renamed from `BarcodeAudit.jsx`; `CategoryManager.jsx` deleted, its sub-tab removed from `AdminDashboard.jsx`): Console Admin's sub-tab is now "Compléter produit" (was "Intégrité Codes-barres" + a separate "Catégories" tab). Same photo-zoom + barcode-flag workflow as before, plus a category `<select>` directly on each card (current category or "Non catégorisé", any category from the `categories` table) that updates `products.category_id` immediately on change — no flag/audit workflow for this one, since (unlike a barcode) there's no "ask the user to recapture" equivalent for a category; it's just a direct correction.
- **`HunterDetailModal.jsx`** (new): clicking any row in `Leaderboard.jsx` (not just the podium) opens a contributor card — prices collected and distinct shops visited at the top, then the full list of their collected products (name, price, store, date). Mirrors `ProductDetailModal`'s pattern but scoped by user instead of product.
- **Product comments + sharing** (`ProductDetailModal.jsx`): logged-in users can post a comment; anyone (including anonymous visitors) can read them, per spec. Comments are sorted most-liked-first (like count desc, then newest first as tiebreak). Each comment shows the author's `display_name` and a "Top Chasseur" badge if they're currently in the leaderboard's global top 3 (computed live each time the card loads, not a stored badge — the actual `user_badges` system is still unused/empty, see above). Non-logged-in users attempting to comment or like are routed to the existing auth modal via a new `onRequireAuth` callback prop (mirrors the `!user → setShowAuthModal(true)` pattern already used for price likes in `App10.jsx`). Sharing: a WhatsApp button (`wa.me` deep link) and a "copy link" button, both pointing at `<origin><path>?product=<id>`; `App10.jsx` now reads that query param on mount and auto-opens the corresponding `ProductDetailModal`, so shared links actually land on the right product. New tables: `product_comments`, `product_comment_likes` (`product_comments_migration.sql`) — public read, authenticated-own-row write, following the same RLS shape as every other user-generated-content table in this schema.

### Jul 21, 2026 — France Hexagonale Price Comparison (flagship diaspora feature)
The core "combat the cost of living" comparison — Martinique price vs. its France Hexagonale equivalent — already had a display mechanism (`PriceDuel.jsx`, wired into `App10.jsx`'s barcode-scan flow via a `mainlandPriceData` fetch on `origin_region_code = 'Hexagone'`), but nothing ever fed it data. Two feed mechanisms were discussed:
1. **French community contributors** submitting their own scans — the existing mechanism already supports this in principle, but `submitPrice`'s store selection (`StoreSelectionWizard.jsx`) is hardcoded to the 78-row Martinique-only `stores` table, so a Hexagone-based contributor has no store to pick from today. **Not built this pass** — flagged as real future work, not something to fake.
2. **Admin-entered reference prices found online** — built this pass, since it's immediately testable and doesn't require reworking the store-selection flow.

- **`mainland_price_migration.sql`**: adds `mainland_chain` (checked against `Carrefour`, `E.Leclerc`, `Système U`, `Auchan`, `Autre`), `source_type` (`'scan'` default vs `'admin_reference'`, so provenance is always honestly labeled wherever a price is shown), and `source_url` (optional, for the admin's online source) to `prices`. No new RLS policy — admin-only reach is enforced at the UI layer, consistent with `ProductCompletion.jsx`'s existing precedent (the `prices`/`products` authenticated-write policies already allow any logged-in user to write these columns via direct API; only the admin tool's own visibility gates who normally would).
- **`MainlandPriceAdmin.jsx`** (new, Console Admin → "Prix France Hexagonale" sub-tab): search a Martinique product, see its current best local price and the live % gap, enter a mainland reference price (amount, chain, optional source link), with existing entries listed (and deletable) below. Inserts directly into `prices` with `store_id: null`, `origin_region_code: 'Hexagone'`, `source_type: 'admin_reference'` — the exact shape `PriceDuel`'s existing fetch already expects, so a newly-added reference price shows up in the barcode-scan "Duel des Prix" with zero changes needed there.
- **`ProductDetailModal.jsx`** also now surfaces this: a `PriceDuel` card (Martinique's best price vs. the cheapest mainland reference) plus a full list of all mainland entries by chain, both isolated into their own query (`loadMainlandPrices`) separate from the core stats query — the new `mainland_chain`/`source_type`/`source_url` columns don't exist until the migration runs, and a shared query would have broken the *entire* already-deployed detail card (stats, chart, store comparison, comments) for every product until then, not just the new section. Verified this isolation live before shipping: the core query succeeds and the mainland query fails cleanly on its own pre-migration.
- **Bug caught before shipping**: `MainlandPriceAdmin.jsx`'s "best local price" calc originally used `.neq('origin_region_code', 'Hexagone')` server-side — Postgres's `<>` excludes `NULL` rows entirely (three-valued logic), and `origin_region_code` is `NULL` for a large share of existing prices. Confirmed live against a real product (1 total price row, `.neq()` returned 0). Fixed to match `ProductDetailModal`'s existing approach: fetch all rows, filter client-side where `!== 'Hexagone'` (which correctly treats `null` as "local").

### Jul 22, 2026 — Mainland Price Admin Redesigned as a Browsable List
Feedback after first hands-on test: requiring a manual search before seeing anything wasn't practical. Redesigned to match `ProductCompletion.jsx`'s pattern instead — a scrollable list of products (deduped from the `prices` feed, one card per product with a photo), each showing its photo, current best Martinique price, and any existing mainland entries as small chips; tapping "+" expands an inline add-price form. Verified live: 17 real products with photos populate the list correctly.

- **Evidence photo upload added**: rather than (or alongside) a plain source-link field, the admin can now attach a screenshot of the French chain's website as proof of the price — same base64→Blob→upload pattern already used for product/price-tag photos in `App10.jsx`'s `submitPrice`. New `evidence_photo_url` column (`mainland_evidence_photo_migration.sql`). Reuses the existing public `price-tag-photos` storage bucket rather than creating a new one, to avoid depending on storage-level permissions that can't be verified from the SQL editor alone.
- **`ProductDetailModal.jsx`** updated to match: each mainland price entry now shows its evidence photo as a clickable thumbnail (own lightweight zoom overlay, `zoomedEvidence` state) alongside the existing source-link.
- Mainland-column loading in the new list is isolated in its own try/catch (same reasoning as `loadMainlandPrices` in `ProductDetailModal.jsx`) — the browsable product list itself doesn't depend on `mainland_price_migration.sql`/`mainland_evidence_photo_migration.sql` having run; only the "existing entries" chips do, and they degrade to empty rather than breaking the list.

### Jul 22, 2026 — Product Card: Explicit 4-Source Price Comparison
Replaced the ad-hoc `PriceDuel` + generic "Prix en France Hexagonale" list in `ProductDetailModal.jsx` with a structured comparison always showing exactly 4 labeled sources, each either a real price + diff badge or an honest "Information manquante" placeholder (never silently hidden):

1. **Martinique (dernier scan)** — the reference every other source is compared against. Computed as the most recent non-Hexagone `prices` row for the product (`latestLocal`), not the cheapest — "dernier scan" (last scan), matching what a shopper would have most recently seen, as opposed to the pre-existing "Meilleur prix" headline stat (which stays, unchanged, as a separate vanity stat).
2. **France Hexagonale — communauté**: most recent entry with `source_type = 'scan'`. Was always empty as of Jul 21 (Option 1 wasn't buildable yet) — **built Jul 22, see below**.
3. **France Hexagonale — capture en ligne**: most recent entry with `source_type = 'admin_reference'`, including its evidence photo as a clickable thumbnail if one was attached.
4. **Autres magasins en Martinique**: every other Martinique store price for this product (`storeComparison`, minus whichever store is source 1), each with its own diff badge.

Diff badges (`abs €` and `%`) are always computed against source 1, colored green when the source is cheaper and red when it's more expensive — verified live against a real 2-store product (Pli Bel Price François 2.10€ as reference vs. Leclerc 1.75€ → correctly shows `-0.35€ (-17%)` in green).

### Jul 22, 2026 — Option 1 Built: France Hexagonale Community Scans
Following the design discussion above, extended the existing scan/manual-entry flow (`App10.jsx`) rather than building a parallel one:

- **Region toggle** added to the "Où êtes-vous ?" gate that starts every scan session: 🇲🇶 Martinique (unchanged — `StoreSelectionWizard`) vs. 🌍 France Hexagonale (new — a plain chain `<select>` using the same `MAINLAND_CHAINS` list as the admin tool, now extracted to `src/constants/mainlandChains.js` so both places can never drift from the DB's `mainland_chain` CHECK constraint). The rest of the form (barcode scan, manual entry, photos) is unchanged either way — only what happens at submission differs.
- **`submitPrice`**: when the Hexagone toggle is active, writes `store_id: null`, `origin_region_code: 'Hexagone'`, `mainland_chain`, `source_type: 'scan'` — deliberately `'scan'`, not `'admin_reference'`, so it's honestly distinguished from an admin-entered reference price everywhere provenance is shown. This is the exact shape source #2 on the product card and the scan-flow "Duel des Prix" were already built to read, so no display-side changes were needed — they just started working once real data existed to feed them.
- **Bug found and fixed while in this code**, not something introduced today: `handleBarcodeDetected`'s fetch of the "local" price for the scan-result `PriceDuel` (`latestPriceData`) had no filter excluding `origin_region_code = 'Hexagone'` at all — it just took the single most recent price row for the product, mainland or not. Confirmed this was **already live and wrong** against the admin's own test data: the Carrefour reference price added for "350G EMMENTAL RAPE" (2.85€, Jul 22) was the most recent row overall, so scanning that barcode would have shown 2.85€ mislabeled as the Martinique price. Fixed using the same verified-correct pattern as the earlier `ProductDetailModal`/`MainlandPriceAdmin` fixes (fetch a few recent rows, filter client-side for `origin_region_code !== 'Hexagone'` — not `.neq()`, which drops `NULL` rows). Also updated `PriceDuel`'s mainland label to show the real chain name (`mainland_chain`) instead of the hardcoded "France Continentale" placeholder.
- No new migration — reuses `mainland_price_migration.sql`'s columns entirely.

### Jul 22, 2026 — Global Fix: Invisible Input Text in Dark Mode
Reported after testing `MainlandPriceAdmin.jsx`: typed text in the price/chain/link fields was invisible while typing (visible only after submit, in the saved list). Root cause: this app has no dark-mode theme of its own, and none of its `<input>`/`<select>` elements set an explicit text color — on a device/browser with OS dark mode enabled, browsers style native form controls using that preference by default regardless of the page's own light background, so typed text can render white-on-white. Confirmed no `color-scheme` declaration existed anywhere in the project. Fixed globally in `src/index.css` (`html { color-scheme: light; }`) rather than patching individual components, since every input in the app was equally exposed, not just this one form.

### Jul 22, 2026 — Mainland Entries Were Leaking Into the Comparer Feed; Added At-a-Glance Diff Badge
Reported after adding the first two mainland reference prices: the "Comparer" feed card for the affected product (Emmental) appeared to lose its product photo. Root cause: `loadRecentPrices` (`App10.jsx`) had no filter on `origin_region_code` at all — France Hexagonale entries (`store_id: null`, usually no `product_photo_url` since they're admin-entered from an evidence screenshot, not a real scan) were being pulled into the general feed and rendered as ordinary Martinique scan cards. Since the feed shows one card per `prices` row (not deduped by product), the photo-less mainland row became a new, separate, more-recent card for the same product — the original Martinique card and its photo were never actually touched, but the new card next to/above it made it look that way. Confirmed live: of the 50 most recent rows, 2 were Hexagone entries incorrectly present in what should be an all-Martinique feed.

- **Fixed**: `loadRecentPrices` now excludes `origin_region_code === 'Hexagone'` rows from the feed entirely — mainland/reference prices belong in the product detail card's comparison section (built Jul 21–22), not as regular scan cards here.
- **Added**: each remaining card now shows an at-a-glance diff badge (🌍 `+0.80€ (+28%)` in red, or green if cheaper) against the cheapest known France Hexagonale price for that product, computed in a second, isolated query (`mainlandByProduct`, keyed by `product_id`) so a failure there can't break the main feed. Clicking the card still opens the full detail breakdown (all 4 sources) — this is the "headline number," not a replacement for it. Verified live: Emmental's real data (Martinique 3.65€ vs. Carrefour reference 2.85€) computes to exactly `+0.80€ (+28%)`.

## Known Issues & Limitations
None blocking. All migrations to date (`bqp_vote_stats_fix_migration.sql`, `barcode_audit_migration.sql`, `trim_city_cleanup_migration.sql`, `categories_admin_insert_migration.sql`, `product_comments_migration.sql`, `mainland_price_migration.sql`, `mainland_evidence_photo_migration.sql`) — check each file's header comment for apply status as of the date you're reading this; the newest one or two may not yet be applied.
- See "Jul 21, 2026 — Component-Wide Bug Sweep" above for items flagged but intentionally not changed (admin-role RLS uncertainty, unused badges system).
- Category coverage is currently low (5/23 products) since assigning a category during capture is optional — the category/store filters and the "Compléter produit" tool will look sparse until more products are categorized.

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
- `src/components/ProductDetailModal.jsx` — Per-product "wow" card (scans, trend, cross-store comparison, comments, sharing).
- `src/components/PriceHistoryChart.jsx` — Shared recharts line chart (BQP scan flow + ProductDetailModal).
- `src/components/ProductCompletion.jsx` — Admin-only barcode + category correction (Console Admin "Compléter produit" sub-tab).
- `src/components/HunterDetailModal.jsx` — Per-contributor card from the Leaderboard (prices collected, shops visited, product list).
- `src/components/PriceDuel.jsx` — Martinique vs. France Hexagonale price comparison visual (`localPrice`/`mainlandPrice` props); used in both the barcode-scan flow (`App10.jsx`) and `ProductDetailModal.jsx`.
- `src/components/MainlandPriceAdmin.jsx` — Admin-only France Hexagonale reference price entry (Console Admin sub-tab).

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
