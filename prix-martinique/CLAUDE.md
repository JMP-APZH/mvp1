# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prix Martinique ("Vie chère en Martinique") is a Progressive Web App designed to fight the high cost of living in Martinique by enabling community-driven price tracking and comparison across supermarkets. Built with React, Tailwind CSS, and Supabase.

**Live URL:** https://mvp1-prixmartinique.vercel.app

**Mission:** Empower Martinique residents to combat "la vie chère" through transparent, community-sourced price data, enabling informed shopping decisions and collective action.

## Quick Reference

### Commands
```bash
npm run dev      # Start Vite dev server with HMR
npm run build    # Production build to dist/
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
```

### Environment Variables
Required in `.env.local`:
```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

### Language
The UI is entirely in French (Caribbean French). Maintain French for all user-facing strings.

## Architecture

### Tech Stack
- **React 19** with Vite 7
- **Supabase** for backend (PostgreSQL, Storage, Real-time)
- **Tailwind CSS v3** for styling (core utilities only, no custom compiler)
- **Lucide React** for icons
- **PWA** with service worker (`public/sw.js`) and manifest
- **Barcode Scanning:**
  - Barcode Detection API (Android Chrome/Edge)
  - QuaggaJS (iOS - needs re-implementation)
- **Deployment:** Vercel (auto-deploy from GitHub)

### App Versions
There are multiple App component variants in `src/`:
- `App.jsx` - Blue theme, original version
- `App2.jsx` - Intermediate version
- `App3.jsx` - Orange/red gradient theme
- `App4.jsx` - Added QuaggaJS for iOS barcode scanning
- `App5.jsx` - **CURRENTLY ACTIVE** (imported in `main.jsx`) - Full authentication + gamification integration

All variants share similar structure but differ in features and color scheme.

### Data Flow
1. **Supabase Client** (`src/supabaseClient.js`): Configured with env vars
2. **Core Tables**: 
   - `products` - Product catalog with barcodes, brands, categories
   - `stores` - Supermarkets with location data
   - `prices` - Price submissions (FK to products and stores)
3. **Storage Buckets**: 
   - `product-photos` (public)
   - `price-tag-photos` (public)
4. **Real-time**: Subscribed to `prices` table INSERT events for live updates

### UI Structure
Single-page app with four tabs (mobile-optimized):
1. **Scanner** (`scan`): Barcode scanning + manual price entry form + photo uploads
2. **Comparer** (`search`): Search and browse submitted prices with stats
3. **Stats** (`stats`): Community statistics and most-tracked products
4. **À Propos** (`about`): Community manifesto with RVN colors and activist vision

## Key Features Implemented

### ✅ Core Functionality
- **Price Entry**: Manual form with product name, barcode, price, store selection
- **Photo Upload**: Product photo + price tag photo (stored in Supabase Storage)
- **Barcode Scanning**:
  - BarcodeDetector API (Android/Chrome)
  - QuaggaJS fallback (iOS Safari)
- **Price Comparison**: Search, filter, min/max/avg stats, "best price" highlighting
- **Real-time Sync**: New prices appear instantly across all devices
- **PWA**:
  - Installable on Android (beforeinstallprompt)
  - Custom install instructions for iOS (Share → Add to Home Screen)
  - Network-first service worker for cache management

### ✅ Authentication System (NEW)
- **Google OAuth**: Sign in with Google account
- **Email/Password**: Traditional sign up/sign in
- **AuthContext**: React context for auth state management (`src/contexts/AuthContext.jsx`)
- **AuthModal**: Sign in/sign up modal component (`src/components/AuthModal.jsx`)
- **UserMenu**: User dropdown with avatar, points, level display (`src/components/UserMenu.jsx`)
- **Session Persistence**: Auth state persists across page refreshes
- **Optional Auth**: Anonymous contributions still allowed

### ✅ Gamification System (NEW)
- **Points**: +10 points per price submission (for authenticated users)
- **Levels**: Level up system based on points
- **Leaderboard**: Top 10 contributors display (`src/components/Leaderboard.jsx`)
- **User Profiles**: Display name, avatar (Google), points, level, total contributions
- **Badges**: Database ready (user_badges table)

### 🚧 Database Ready (Not Yet Implemented)
- Shopping list optimizer
- Category filtering (Bébé, Végétarien, Économique, etc.)
- Meal plan recommendations
- Enhanced store database (30+ locations)
- Badge awarding logic

## Database Schema (Supabase)

### Core Tables

**products**
```sql
id UUID PK
name TEXT NOT NULL
barcode TEXT
brand TEXT
size TEXT              -- "1L", "500g"
unit_price DECIMAL     -- price per kg/liter
nutrition_score TEXT   -- A-E Nutri-Score
image_url TEXT
description TEXT
category TEXT          -- deprecated, use product_categories
is_verified BOOLEAN
created_at TIMESTAMP
```

**stores**
```sql
id UUID PK
name TEXT NOT NULL
chain TEXT             -- "Carrefour", "Super U"
type TEXT              -- "hypermarche", "supermarche", "epicerie"
address TEXT
city TEXT NOT NULL
postal_code TEXT
phone TEXT
latitude DECIMAL
longitude DECIMAL
opening_hours JSONB
is_verified BOOLEAN
is_active BOOLEAN
created_at, updated_at TIMESTAMP
```

**prices**
```sql
id UUID PK
product_id UUID FK → products
store_id UUID FK → stores
user_id UUID FK → user_profiles (nullable for now)
price DECIMAL NOT NULL
user_name TEXT             -- legacy, optional
product_photo_url TEXT
price_tag_photo_url TEXT
created_at TIMESTAMP
```

### User & Gamification Tables (ACTIVE)

**user_profiles** - Extends Supabase auth.users
```sql
id UUID PK (FK → auth.users)
username TEXT
display_name TEXT
avatar_url TEXT           -- Google profile picture
points INTEGER DEFAULT 0
level INTEGER DEFAULT 1
badges JSONB DEFAULT '[]'
total_contributions INTEGER DEFAULT 0
created_at, updated_at TIMESTAMP
```

**badges** - Achievement definitions
**user_badges** - Earned achievements (FK → user_profiles, badges)
**user_activities** - Point tracking

### Other Tables (Database Ready)
**shopping_lists** + **shopping_list_items** - List feature
**categories** + **tags** - Product categorization
**meal_plans** + **meal_plan_ingredients** - Recipe system

### Database Triggers
- `handle_new_user`: Auto-creates user_profile on auth.users INSERT (extracts Google avatar, display name)

See full schema details in project conversation history.

## Design System (Caribbean Theme)

### Color Palette
**Primary (Warm Caribbean Sunset):**
- Header: `bg-gradient-to-r from-orange-500 via-red-500 to-pink-500`
- Active nav: `border-orange-500 text-orange-600`
- Buttons: `from-orange-500 to-red-500` (gradient)
- Success: `from-green-500 to-emerald-600`

**Accents:**
- Info boxes: `bg-amber-50 border-amber-300`
- Scanner frame: `border-yellow-400`
- Best price: `bg-green-100 text-green-700`

**Neutrals:** Standard grays (900, 600, 500, 300, 200)

### Layout
- Max width: `max-w-2xl` (mobile-first)
- Consistent padding: `p-4`
- Cards: `rounded-lg shadow-sm`
- Navigation: Vertical icon + label layout on mobile

## iOS Support ✅

**Barcode Scanning:**
- ✅ QuaggaJS implemented as fallback for iOS (App4.jsx, App5.jsx)
- BarcodeDetector API used on Android/Chrome
- Auto-detection: `/iPad|iPhone|iPod/.test(navigator.userAgent)`

**PWA Install:**
- ✅ Custom iOS install instructions shown (Share → Add to Home Screen)
- `beforeinstallprompt` for Android, manual instructions for iOS
- Check if installed: `window.matchMedia('(display-mode: standalone)').matches`

## Known Issues & Priority Todos

### ✅ Recently Completed
- [x] QuaggaJS for iOS barcode scanning
- [x] iOS-specific PWA install instructions
- [x] User authentication (Google OAuth + Email/Password)
- [x] Gamification UI (points, levels, leaderboards)
- [x] User profile with Google avatar
- [x] Network-first service worker (fixes stale cache)
- [x] PWA theme colors updated to orange
- [x] French accent corrections in App5.jsx (é, è, ê, à, etc.)
- [x] À Propos page with community manifesto and RVN colors

### 🟡 High Priority
- [ ] Create shopping list feature
- [ ] Add category filters to search
- [ ] Import complete Martinique store database (CSV)
- [ ] Badge awarding automation
- [ ] Test on real iOS devices

### 🟢 Medium Priority
- [ ] Mainland France price comparison
- [ ] Meal plan recommendations
- [ ] User dietary preferences
- [ ] Store location map view
- [ ] Price trend graphs

## Important Development Notes

### Tailwind Limitations
- **Only core Tailwind v3 utilities available** - no custom compiler
- Avoid arbitrary values like `bg-[#123456]`
- Use only pre-defined classes from Tailwind's base stylesheet

### Browser Storage
- **NEVER use localStorage or sessionStorage** in React components
- Not supported in claude.ai artifact environment
- Use React state (useState, useReducer) instead

### Photo Uploads
- Photos stored as URLs in Supabase Storage (not base64 in database)
- Convert base64 from file input → blob → upload → save URL
- Public buckets allow direct image access

### Real-time Updates
- Subscribe to `prices` channel for INSERT events
- Reload price list when new data arrives
- Unsubscribe on component unmount

## Testing Checklist

**Android (Chrome/Edge):**
- [x] Barcode scanning works (BarcodeDetector API)
- [x] PWA install prompt appears
- [x] Home screen installation works
- [x] Photos upload successfully
- [x] Real-time updates work
- [x] Google sign-in works
- [x] User avatar displays
- [x] Points awarded on submission

**iOS (Safari/Chrome/Firefox):**
- [x] Barcode scanning (QuaggaJS)
- [x] Install instructions shown
- [x] Manual entry works
- [x] Photos upload successfully
- [x] UI displays correctly
- [ ] Google sign-in (needs testing)
- [ ] PWA with auth (needs testing)

## Deployment

**Vercel:**
- Auto-deploy from GitHub main branch
- Build: `npm run build` → `dist/`
- Environment variables set in Vercel dashboard

**Supabase:**
- Run SQL migrations in SQL Editor first
- Enable RLS on all user-facing tables
- Storage policies: public read, authenticated write
- Real-time enabled on `prices` table

## User Feedback Summary

**Positive:**
- ✅ Android experience smooth and fast
- ✅ Photo upload valuable for verification
- ✅ Caribbean colors well-received ("reflects local culture")
- ✅ Price comparison saves money

**Issues:**
- ❌ iOS users can't scan barcodes
- ❌ Limited store database (needs expansion)
- ❌ No PWA install guidance on iOS

**Requested Features:**
- Shopping list with total cost calculator
- Meal planning ideas (économique/nutritionnel)
- More product categories
- Price alerts for favorite products

## Context for Future Development

This app is designed to evolve from a price tracker into a comprehensive platform for fighting high cost of living:

**Phase 1 (Current):** Price tracking & comparison  
**Phase 2 (Planned):** Gamification + shopping lists  
**Phase 3 (Future):** Meal planning + collective action tools  
**Phase 4 (Vision):** Economic education + mainland comparison + activist coordination

But MVP focus remains: **Make it dead simple to contribute and compare prices.**

## Key Design Principles

1. **Mobile-first**: Most users are on phones
2. **Low friction**: No login required to view/contribute
3. **Community trust**: Photos build verification
4. **Caribbean identity**: Warm colors, local focus
5. **Data sovereignty**: Open data, Supabase (not corporate APIs)

## Common Patterns

### Adding a new database field
1. Add column in Supabase SQL Editor
2. Update TypeScript interfaces (if using)
3. Update SELECT queries to include new field
4. Update transform functions in `loadRecentPrices()`
5. Update UI to display/edit new field

### Adding a new feature
1. Design database schema changes first
2. Run SQL migrations in Supabase
3. Update Supabase client queries
4. Build React components
5. Test on Android AND iOS
6. Deploy to Vercel

### Debugging tips
- Check browser console for Supabase errors
- Verify RLS policies in Supabase dashboard
- Test storage bucket policies with direct URLs
- Use React DevTools to inspect state
- Check Network tab for failed API calls

## Authentication Implementation Notes

### Auth Flow
1. `AuthProvider` wraps app in `main.jsx`
2. `initializeAuth()` called on mount → `getSession()` restores session
3. `onAuthStateChange` listener handles sign-in/sign-out events
4. `isInitialized` and `currentLoadedUserId` flags prevent duplicate loads

### Key Files
- `src/contexts/AuthContext.jsx` - Auth state management
- `src/components/AuthModal.jsx` - Sign in/up modal
- `src/components/UserMenu.jsx` - User dropdown menu
- `src/components/Leaderboard.jsx` - Top contributors
- `src/components/AboutPage.jsx` - Community manifesto page

### Supabase Auth Configuration
- Google OAuth enabled
- Redirect URLs configured for localhost:5173 and Vercel production
- `handle_new_user` trigger creates profile on signup

### Known Auth Quirks
- Supabase fires multiple `SIGNED_IN` events (handled via deduplication)
- Session stored in localStorage by Supabase client
- `getSession()` is authoritative for page refresh

---

**Last Updated:** 2026-01-18
**Current Version:** MVP v1.1 (Auth + Gamification + iOS support)
**Next Milestone:** Shopping lists + Badge automation