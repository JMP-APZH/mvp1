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
There are three App component variants in `src/`:
- `App.jsx` - Blue theme, original version
- `App2.jsx` - Intermediate version (commented out)
- `App3.jsx` - **Orange/red gradient theme, CURRENTLY ACTIVE** (imported in `main.jsx`)

All three share the same structure and functionality, differing only in color scheme.

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
Single-page app with three tabs (mobile-optimized):
1. **Scanner** (`scan`): Barcode scanning + manual price entry form + photo uploads
2. **Comparer** (`search`): Search and browse submitted prices with stats
3. **Stats** (`stats`): Community statistics and most-tracked products

## Key Features Implemented

### ✅ Core Functionality
- **Price Entry**: Manual form with product name, barcode, price, store selection
- **Photo Upload**: Product photo + price tag photo (stored in Supabase Storage)
- **Barcode Scanning**: BarcodeDetector API (Android only - see iOS limitation below)
- **Price Comparison**: Search, filter, min/max/avg stats, "best price" highlighting
- **Real-time Sync**: New prices appear instantly across all devices
- **PWA**: Installable on Android, custom install instructions for iOS

### 🚧 Database Ready (Not Yet Implemented)
- User authentication (Email, Google, Phone)
- Gamification system (points, levels, badges, leaderboards)
- Shopping list optimizer
- Category filtering (Bébé, Végétarien, Économique, etc.)
- Meal plan recommendations
- Enhanced store database (30+ locations)

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

### Gamification Tables (Ready, Not Active)

**user_profiles** - Extends Supabase auth.users
**badges** - Achievement definitions
**user_badges** - Earned achievements
**user_activities** - Point tracking
**shopping_lists** + **shopping_list_items** - List feature
**categories** + **tags** - Product categorization
**meal_plans** + **meal_plan_ingredients** - Recipe system

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

## Critical iOS Limitations ⚠️

**Barcode Scanning:**
- ❌ BarcodeDetector API does NOT work on iOS (any browser)
- All iOS browsers use Safari's WebKit (Apple restriction)
- Chrome/Edge on iOS = Safari with different UI
- **Solution needed:** Re-implement QuaggaJS for iOS devices
- Detection: `/iPad|iPhone|iPod/.test(navigator.userAgent)`

**PWA Install:**
- ❌ `beforeinstallprompt` event doesn't exist on iOS
- **Solution needed:** Show custom "Share → Add to Home Screen" instructions
- Check if installed: `window.matchMedia('(display-mode: standalone)').matches`

## Known Issues & Priority Todos

### 🔴 Critical (Blocks ~40-50% of Users)
- [ ] Re-implement QuaggaJS for iOS barcode scanning
- [ ] Add iOS-specific PWA install instructions UI
- [ ] Test on real iOS devices (Safari, Chrome, Firefox)

### 🟡 High Priority
- [ ] Implement user authentication (Supabase Auth)
- [ ] Build gamification UI (points, badges, leaderboards)
- [ ] Create shopping list feature
- [ ] Add category filters to search
- [ ] Import complete Martinique store database (CSV)

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
- [x] Barcode scanning works
- [x] PWA install prompt appears
- [x] Home screen installation works
- [x] Photos upload successfully
- [x] Real-time updates work

**iOS (Safari/Chrome/Firefox):**
- [ ] Barcode scanning (needs QuaggaJS)
- [ ] Install instructions shown
- [x] Manual entry works
- [x] Photos upload successfully
- [x] UI displays correctly

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

---

**Last Updated:** 2026-01-17  
**Current Version:** MVP v1 (Orange theme, photo uploads, Barcode API)  
**Next Milestone:** iOS support via QuaggaJS