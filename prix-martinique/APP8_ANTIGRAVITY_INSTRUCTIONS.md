# Prix Martinique App8.jsx - Antigravity Agent Instructions
## Progressive Store Selection Wizard Implementation

**Project**: Prix Martinique - Community Price Tracking App  
**Current Version**: App7.jsx (working with iOS/Android barcode scanning)  
**Target Version**: App8.jsx (enhanced store selection UX)  
**Workflow**: Antigravity (planning) → Claude Code (implementation)

---

## 🎯 Mission Overview

Implement a **3-step progressive wizard** for store selection that replaces the current dropdown menu, improving user experience through GPS auto-detection and smart filtering.

### **Success Criteria**
- ✅ 50%+ reduction in store selection time (target: <15 seconds)
- ✅ 70%+ reduction in wrong store selection errors
- ✅ 60%+ GPS adoption rate on mobile
- ✅ Zero breaking changes to existing App7.jsx functionality
- ✅ Works seamlessly on both Android and iOS

---

## 📊 Current State (Verified)

### **Database Status: ✅ READY**
- 78 official stores imported from government "Bouclier Qualité Prix 2024" decree
- Schema updated with all required columns:
  - `chain`, `name`, `full_address`, `city`, `postal_code`
  - `surface_m2`, `category`, `product_list`
  - `latitude`, `longitude`, `phone`, `hours`, `website`
  - `logo_url`, `is_active`, `popularity_score`
  - `search_vector` (full-text search), `created_at`, `updated_at`
- All indexes created for performance
- Popularity tracking trigger installed

**Verified via SQL:**
```sql
-- Total stores: 78
-- Categories: Hypermarché (7), Supermarché (26), Supérette (45)
-- Cities: 21+ locations across Martinique
-- Chains: 12 major chains (Carrefour, E.Leclerc, Auchan, etc.)
```

### **Current App7.jsx Store Selection**
```javascript
// Simple dropdown - works but suboptimal UX
<select value={manualEntry.storeId} onChange={...}>
  <option value="">Sélectionner un magasin</option>
  {stores.map(store => (
    <option key={store.id} value={store.id}>
      {store.name} - {store.city}
    </option>
  ))}
</select>
```

**Problems with current approach:**
- User must scroll through all 78 stores
- No visual hierarchy or categorization
- No GPS assistance
- Difficult to find correct store on mobile
- Easy to select wrong store

---

## 🎨 Desired App8.jsx Solution

### **3-Step Progressive Wizard**

**Step 1: City Selection**
- GPS auto-detection (if permission granted)
- Falls back to searchable dropdown
- Shows store count per city
- 78 stores → ~5-10 per city

**Step 2: Chain Selection** (filtered by selected city)
- Visual chain icons/logos
- Store count per chain
- Searchable list
- ~5-10 stores → ~2-5 per chain

**Step 3: Specific Store** (filtered by city + chain)
- Category badges (Hypermarché ⭐ / Supermarché 🏪 / Supérette 🏬)
- Store details (surface, product list, address)
- Popular stores highlighted
- Final selection with confirmation

**Navigation:**
- Progress indicator (Step 1 → 2 → 3)
- Back button (return to previous step)
- Reset button (start over)

---

## 🏗️ Architecture Plan

### **New Files to Create**

1. **`src/App8.jsx`**
   - Copy of App7.jsx
   - Modified store selection section only
   - All other functionality preserved

2. **`src/components/StoreSelectionWizard.jsx`**
   - Main wizard component
   - Manages 3-step flow
   - Handles GPS detection
   - Implements search functionality
   - Progressive filtering logic

3. **`src/utils/geocoding.js`**
   - GPS coordinate → Martinique city mapping
   - 21+ city definitions with lat/lon/radius
   - Haversine distance calculation
   - Permission handling
   - Fallback city list from database

4. **`src/index.jsx`** (update)
   - Change from App7 to App8
   - One-line change

### **Files to Preserve (No Changes)**
- `src/App7.jsx` - Keep as stable fallback
- `src/components/HybridBarcodeScanner.jsx` - Working iOS/Android scanner
- All Supabase config
- All authentication logic
- All gamification logic

---

## 🔑 Key Implementation Requirements

### **1. GPS Detection Must Be:**
- Non-blocking (app works if denied)
- Fast (10-second timeout)
- Battery-efficient (enableHighAccuracy: false)
- Cached (5-minute validity)
- Privacy-respectful (ask permission appropriately)

### **2. Search Must Be:**
- Accent-insensitive ("lamentin" finds "Le Lamentin")
- Case-insensitive
- Partial match ("fort" finds "Fort-de-France")
- Fast (client-side filtering with useMemo)
- Available in all 3 steps

### **3. Performance Requirements:**
- Initial render: <500ms
- Step transitions: <200ms
- Search results: <100ms
- No unnecessary re-renders (use React.memo, useMemo, useCallback)
- Smooth on low-end mobile devices

### **4. Mobile-First Design:**
- Touch targets: minimum 44x44px
- Large, readable text
- Clear visual hierarchy
- One-handed operation possible
- Works on 320px width screens

### **5. Accessibility:**
- Keyboard navigation
- Screen reader compatible
- ARIA labels on interactive elements
- Focus management
- Color contrast: WCAG AA compliant

---

## 📋 Antigravity Agent Checklist

As the planning agent, coordinate these tasks:

### **Phase 1: Setup & Verification** (15 min)
- [ ] Verify App7.jsx current location and structure
- [ ] Confirm database connection details
- [ ] Check existing component structure
- [ ] Identify store selection section in App7.jsx
- [ ] Review Tailwind CSS configuration

### **Phase 2: File Creation** (45 min)
- [ ] Create `src/utils/geocoding.js` with Martinique city data
- [ ] Create `src/components/StoreSelectionWizard.jsx` with wizard logic
- [ ] Copy App7.jsx → App8.jsx
- [ ] Integrate wizard into App8.jsx
- [ ] Update index.jsx to use App8

### **Phase 3: Integration** (30 min)
- [ ] Replace store dropdown with wizard component
- [ ] Test state management (selectedStoreId flows correctly)
- [ ] Verify form submission still works
- [ ] Check price submission end-to-end
- [ ] Ensure no console errors

### **Phase 4: Testing** (45 min)
- [ ] Desktop browser testing (Chrome, Firefox, Safari)
- [ ] Mobile browser testing (iOS Safari, Android Chrome)
- [ ] GPS detection testing
- [ ] Search functionality testing
- [ ] Navigation testing (back, reset)
- [ ] Full price submission flow
- [ ] Edge cases (GPS denied, slow connection, etc.)

### **Phase 5: Documentation** (15 min)
- [ ] Update CLAUDE.md with App8 features
- [ ] Document testing results
- [ ] Note any issues or improvements
- [ ] Prepare user testing guide

**Total Estimated Time: 2.5 hours**

---

## 🚦 Coordination with Claude Code

### **Pass to Claude Code:**
1. The detailed `APP8_CLAUDE_CODE_INSTRUCTIONS.md` file
2. Current App7.jsx file path
3. Supabase connection details (if not in code)
4. Any specific styling preferences

### **Expect from Claude Code:**
- Complete implementation of all files
- Zero breaking changes to App7 functionality
- Working wizard with GPS detection
- Mobile-responsive design
- Clean, commented code

### **Review Claude Code Output:**
- [ ] All files created
- [ ] Code follows React best practices
- [ ] No TypeScript errors (if using TS)
- [ ] Tailwind classes used correctly
- [ ] State management is clean
- [ ] No memory leaks (event listeners cleaned up)

---

## 🎯 Testing Strategy

### **Automated Checks (if possible)**
```bash
# Build check
npm run build

# Lint check  
npm run lint

# Type check (if TypeScript)
npm run type-check
```

### **Manual Testing Scenarios**

**Scenario 1: Happy Path (GPS)**
1. Open App8 on mobile
2. Grant GPS permission
3. Verify city auto-detected
4. Wizard skips to Step 2
5. Select chain
6. Select store
7. Submit price
8. ✅ Success

**Scenario 2: Happy Path (Manual)**
1. Open App8 on desktop
2. Deny GPS (or it doesn't ask)
3. Search for city: "fort"
4. Select "Fort-de-France"
5. Select chain: "Carrefour"
6. Select store: "Centre Commercial Dillon"
7. Submit price
8. ✅ Success

**Scenario 3: Navigation Test**
1. Start wizard
2. Select city → chain → store
3. Click "Retour" (should go back to chain selection)
4. Click "Retour" again (should go to city selection)
5. Click "Recommencer" (should reset entirely)
6. ✅ Navigation works

**Scenario 4: Search Test**
1. Step 1: Search "lam" → finds "Le Lamentin"
2. Step 2: Search "carre" → finds "Carrefour"
3. Step 3: Search "dillon" → finds Dillon stores
4. ✅ Search works in all steps

**Scenario 5: Edge Cases**
1. GPS timeout (wait 10+ seconds)
2. GPS outside Martinique (should fail gracefully)
3. Very slow internet (should still work)
4. Rapid clicking/navigation
5. Mobile keyboard open (UI should adapt)
6. ✅ No crashes

---

## 📱 Mobile Testing Priority Cities

Test GPS detection in these locations (if testing on-site in Martinique):

**High Priority:**
- Fort-de-France (most stores: 10+)
- Le Lamentin (major shopping area: 8+)
- Schoelcher (university area: 5+)

**Medium Priority:**
- Le Marin (south coast)
- Sainte-Anne (tourist area)
- La Trinité (east coast)

**Coverage Test:**
- Ensure at least one store from each category appears in testing
- Verify GPS works in both urban (Fort-de-France) and rural (Morne-des-Esses) areas

---

## 🐛 Known Potential Issues & Solutions

### **Issue: GPS Permission Timing**
**Problem**: Browser may not show permission dialog on first load  
**Solution**: Trigger GPS request only when user opens wizard, not on page load

### **Issue: City Name Mismatches**
**Problem**: GPS returns "Fort de France" but database has "Fort-de-France"  
**Solution**: Normalize city names (remove accents, hyphens) before matching

### **Issue: Slow Database Queries**
**Problem**: Loading all 78 stores on each page load is slow  
**Solution**: Query stores once, cache in React state, filter client-side

### **Issue: Mobile Keyboard Overlap**
**Problem**: Keyboard covers wizard on small screens  
**Solution**: Use `vh` units carefully, add `scrollIntoView` when focusing inputs

### **Issue: Back Button Confusion**
**Problem**: Browser back button vs. wizard back button  
**Solution**: Make wizard back button visually distinct, consider using React Router for proper browser history

---

## 🎨 Design Specifications

### **Colors (RVN Movement Theme)**
```css
/* Primary Actions */
--orange: #FF6B35   /* Main CTA, selected items */
--green: #4CAF50    /* Success, confirmation */
--red: #D32F2F      /* Errors, reset */

/* Neutrals */
--gray-900: #1F2937 /* Text */
--gray-700: #374151 /* Secondary text */
--gray-500: #6B7280 /* Disabled */
--gray-200: #E5E7EB /* Borders */
--gray-50: #F9FAFB  /* Backgrounds */

/* Status */
--blue: #2196F3     /* Info, GPS indicators */
--yellow: #FFC107   /* Warnings, popular stores */
```

### **Typography**
```css
/* Headers */
font-size: 1.125rem (18px)
font-weight: 600

/* Body */
font-size: 0.875rem (14px)
font-weight: 400

/* Small/Meta */
font-size: 0.75rem (12px)
font-weight: 400
```

### **Spacing**
```css
/* Between steps */
margin-bottom: 1.5rem (24px)

/* Between form fields */
margin-bottom: 1rem (16px)

/* Padding in cards */
padding: 1rem (16px)
```

---

## 📊 Success Metrics to Track

After implementation, monitor:

```javascript
{
  "wizard_metrics": {
    "avg_selection_time_seconds": null, // Target: <15
    "gps_detection_success_rate": null, // Target: >0.60
    "gps_detection_accuracy": null, // Target: >0.90 correct city
    "step_completion_rates": {
      "step_1": null, // Target: >0.95
      "step_2": null, // Target: >0.93
      "step_3": null  // Target: >0.90
    },
    "search_usage_rate": null, // How many use search vs browse
    "back_button_usage_avg": null, // How often users go back
    "wrong_store_selection_rate": null, // Target: <0.05
    "user_satisfaction_score": null // Target: >4.0 / 5.0
  }
}
```

**How to collect:**
- Add analytics events in wizard component
- Track with localStorage for development
- Use Google Analytics / Mixpanel in production

---

## 🎓 Key React Patterns Used

### **1. Progressive Disclosure**
```javascript
const [step, setStep] = useState(1);
// Only show relevant UI for current step
```

### **2. Derived State**
```javascript
// Don't store filtered lists in state
const filteredCities = useMemo(() => 
  cities.filter(c => c.includes(search)), 
  [cities, search]
);
```

### **3. Controlled Components**
```javascript
// Parent (App8) owns store selection state
<Wizard 
  selectedStoreId={manualEntry.storeId}
  onStoreSelect={(id) => setManualEntry({...manualEntry, storeId: id})}
/>
```

### **4. Side Effects Management**
```javascript
// GPS detection on mount only
useEffect(() => {
  detectGPS();
}, []); // Empty dependency array
```

### **5. Performance Optimization**
```javascript
// Memoize expensive filters
const filteredStores = useMemo(() => ...);

// Memoize callbacks
const handleSelect = useCallback(() => ...);

// Lazy load components if needed
const StoreDetails = lazy(() => import('./StoreDetails'));
```

---

## 🔐 Security Considerations

1. **GPS Data**: Never send exact coordinates to server (only city name)
2. **Input Validation**: Sanitize search queries (XSS prevention)
3. **SQL Injection**: Use Supabase client methods (parameterized queries)
4. **Rate Limiting**: Prevent abuse of store queries (use Supabase RLS)
5. **HTTPS**: Ensure GPS API only works on HTTPS (browsers enforce this)

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] Bundle size acceptable (<500KB added)
- [ ] Mobile performance tested (Lighthouse score >90)
- [ ] GPS tested on real devices
- [ ] Accessibility audit passed
- [ ] User testing completed (3+ users)
- [ ] Feedback incorporated
- [ ] CLAUDE.md updated
- [ ] App7.jsx preserved as fallback
- [ ] Vercel deployment successful
- [ ] PWA still installable
- [ ] Service worker still works

---

## 📞 Rollback Plan

If App8 has critical issues:

1. **Immediate**: Revert `index.jsx` to use App7
2. **Quick**: Fix issue in App8, redeploy
3. **Analysis**: Review logs, user reports
4. **Iteration**: Improve based on feedback
5. **Relaunch**: Deploy App8 again when ready

**App7 remains fully functional as safety net.**

---

## 🎯 Next Steps After App8

Once wizard is working well:

1. **User Testing** (Week 1)
   - 5-10 real users in Martinique
   - Collect metrics
   - Interview feedback

2. **Iteration** (Week 2)
   - Fix any UX issues
   - Optimize performance
   - Polish design

3. **Feature Additions** (Week 3-4)
   - Store logos
   - Favorites/recent stores
   - Distance calculation
   - Opening hours

4. **Marketing** (Week 5+)
   - Social media campaign
   - Community outreach
   - RVN movement partnership

---

## ✅ Antigravity Agent Success Criteria

This task is complete when:

1. ✅ App8.jsx deployed and functional
2. ✅ All 3 wizard steps working
3. ✅ GPS detection working on mobile
4. ✅ Search working in all steps
5. ✅ Price submission still works end-to-end
6. ✅ No breaking changes to App7 features
7. ✅ Zero console errors
8. ✅ Mobile responsive design verified
9. ✅ At least 3 user tests completed
10. ✅ Metrics show improvement over App7

---

**This is a high-value UX improvement that will significantly increase user engagement and price submission rates. The progressive disclosure pattern is proven and will make Prix Martinique feel professional and polished. Good luck! 🚀🌴**
