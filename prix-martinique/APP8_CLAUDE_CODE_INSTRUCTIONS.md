# Prix Martinique App8.jsx - Claude Code Implementation
## Store Selection Wizard - Complete Code Implementation

**Task**: Implement 3-step progressive store selection wizard  
**Time Estimate**: 1.5-2 hours  
**Complexity**: Medium  
**Risk**: Low (App7 preserved as fallback)

---

## 🎯 Implementation Goal

Replace simple store dropdown in App7.jsx with an intelligent 3-step wizard:
1. City selection (GPS auto-detected)
2. Chain selection (filtered by city)
3. Store selection (filtered by city + chain)

---

## 📋 Pre-Implementation Checklist

Verify these before starting:
- [ ] App7.jsx location identified
- [ ] Database has 78 stores with all columns
- [ ] Supabase client configured in app
- [ ] Tailwind CSS available
- [ ] React version 16.8+ (hooks support)

---

## 📁 File Structure to Create

```
src/
├── App8.jsx                          # NEW: Copy of App7 with wizard
├── components/
│   ├── StoreSelectionWizard.jsx      # NEW: Main wizard component
│   └── HybridBarcodeScanner.jsx      # EXISTING: Keep unchanged
├── utils/
│   └── geocoding.js                  # NEW: GPS city detection
└── index.jsx                         # UPDATE: Switch to App8
```

---

## 🔨 Step 1: Create `src/utils/geocoding.js`

**File**: `src/utils/geocoding.js`

```javascript
/**
 * GPS Geolocation utilities for Martinique
 * Converts GPS coordinates to city names
 */

// Martinique cities with approximate coordinates and radius
const MARTINIQUE_CITIES = [
  // Major cities (most stores)
  { name: "Fort-de-France", lat: 14.6099, lon: -61.0792, radius: 5 },
  { name: "Le Lamentin", lat: 14.6100, lon: -60.9967, radius: 5 },
  { name: "Schoelcher", lat: 14.6156, lon: -61.1044, radius: 4 },
  { name: "Ducos", lat: 14.5733, lon: -60.9833, radius: 4 },
  { name: "Le Robert", lat: 14.6767, lon: -60.9333, radius: 4 },
  
  // South
  { name: "Le Marin", lat: 14.4667, lon: -60.8667, radius: 3 },
  { name: "Sainte-Anne", lat: 14.4333, lon: -60.8833, radius: 3 },
  { name: "Le Vauclin", lat: 14.5500, lon: -60.8333, radius: 3 },
  { name: "Rivière-Pilote", lat: 14.4833, lon: -60.9000, radius: 3 },
  { name: "Sainte-Luce", lat: 14.4667, lon: -60.9333, radius: 3 },
  { name: "Le Diamant", lat: 14.4833, lon: -61.0167, radius: 3 },
  { name: "Les Trois-Îlets", lat: 14.5333, lon: -61.0333, radius: 3 },
  { name: "Rivière-Salée", lat: 14.5333, lon: -60.9667, radius: 3 },
  
  // Center-North
  { name: "Le François", lat: 14.6167, lon: -60.9000, radius: 3 },
  { name: "La Trinité", lat: 14.7333, lon: -60.9667, radius: 3 },
  { name: "Gros-Morne", lat: 14.8667, lon: -61.0667, radius: 3 },
  { name: "Sainte-Marie", lat: 14.7833, lon: -60.9833, radius: 3 },
  
  // North
  { name: "Le Lorrain", lat: 14.8333, lon: -61.0500, radius: 3 },
  { name: "Basse-Pointe", lat: 14.8667, lon: -61.1167, radius: 3 },
  { name: "Marigot", lat: 14.7500, lon: -61.0333, radius: 3 },
  
  // West
  { name: "Saint-Pierre", lat: 14.7433, lon: -61.1783, radius: 3 },
  { name: "Le Carbet", lat: 14.7000, lon: -61.1667, radius: 3 },
  { name: "Case-Pilote", lat: 14.6333, lon: -61.1333, radius: 3 },
  { name: "Morne-Rouge", lat: 14.7667, lon: -61.1167, radius: 3 },
  
  // Other
  { name: "Saint-Joseph", lat: 14.6667, lon: -61.0333, radius: 3 },
  { name: "Saint-Esprit", lat: 14.5500, lon: -60.9167, radius: 3 },
  { name: "Tartane", lat: 14.7667, lon: -60.9167, radius: 2 },
  { name: "Morne-des-Esses", lat: 14.8000, lon: -61.0167, radius: 2 },
];

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Get city name from GPS coordinates
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {string|null} City name or null if not in Martinique
 */
export async function getCityFromCoordinates(latitude, longitude) {
  try {
    let nearestCity = null;
    let minDistance = Infinity;
    
    for (const city of MARTINIQUE_CITIES) {
      const distance = calculateDistance(latitude, longitude, city.lat, city.lon);
      
      if (distance <= city.radius && distance < minDistance) {
        minDistance = distance;
        nearestCity = city.name;
      }
    }
    
    return nearestCity;
  } catch (error) {
    console.error('Error detecting city:', error);
    return null;
  }
}

/**
 * Request GPS permission and get current location
 * @returns {Promise<{city: string|null, latitude: number, longitude: number, accuracy: number}|null>}
 */
export async function detectUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const city = await getCityFromCoordinates(latitude, longitude);
        
        resolve({ city, latitude, longitude, accuracy });
      },
      (error) => {
        console.log('GPS error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  });
}

/**
 * Get list of unique cities from stores database
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<string[]>} Array of city names
 */
export async function getCityList(supabase) {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('city')
      .eq('is_active', true)
      .order('city');
    
    if (error) throw error;
    
    const uniqueCities = [...new Set(data.map(s => s.city))];
    return uniqueCities.sort((a, b) => a.localeCompare(b, 'fr'));
  } catch (error) {
    console.error('Error loading cities:', error);
    return [];
  }
}

export default {
  detectUserLocation,
  getCityFromCoordinates,
  getCityList
};
```

---

## 🔨 Step 2: Create `src/components/StoreSelectionWizard.jsx`

**File**: `src/components/StoreSelectionWizard.jsx`

```javascript
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { detectUserLocation, getCityList } from '../utils/geocoding';

// Chain icons for visual recognition
const CHAIN_ICONS = {
  'Carrefour': '🔵',
  'E.Leclerc': '🔴',
  'Euromarché': '🟠',
  'Auchan': '🔴',
  'Pli Bel Price': '🟡',
  'Caraïbe Price': '🟢',
  'U Express': '🔵',
  '8 à Huit': '🟣',
  'MACK 2': '🟤',
  'Proxi': '🟠',
  'Carrefour Market': '🔵',
  'Carrefour Express': '🔵',
};

// Store category badges
const CATEGORY_BADGES = {
  'Hypermarché': { icon: '⭐', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  'Supermarché': { icon: '🏪', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  'Supérette': { icon: '🏬', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
};

/**
 * Progressive 3-step wizard for store selection
 * Step 1: City (GPS auto-detected or manual)
 * Step 2: Chain (filtered by city)
 * Step 3: Store (filtered by city + chain)
 */
export default function StoreSelectionWizard({ 
  supabase, 
  selectedStoreId, 
  onStoreSelect,
  className = "" 
}) {
  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  
  // Data state
  const [stores, setStores] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [citySearch, setCitySearch] = useState('');
  const [chainSearch, setChainSearch] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  
  // GPS state
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsCity, setGpsCity] = useState(null);

  // Load stores and cities on mount
  useEffect(() => {
    loadStores();
    loadCities();
    attemptGPSDetection();
  }, []);

  async function loadStores() {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('popularity_score', { ascending: false });
      
      if (error) throw error;
      setStores(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading stores:', err);
      setLoading(false);
    }
  }

  async function loadCities() {
    const cityList = await getCityList(supabase);
    setCities(cityList);
  }

  async function attemptGPSDetection() {
    setGpsDetecting(true);
    const location = await detectUserLocation();
    
    if (location && location.city) {
      setGpsCity(location.city);
      setSelectedCity(location.city);
      setStep(2); // Skip to chain selection
    }
    
    setGpsDetecting(false);
  }

  // Filter cities by search
  const filteredCities = useMemo(() => {
    if (!citySearch) return cities;
    const search = citySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cities.filter(city => 
      city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(search)
    );
  }, [cities, citySearch]);

  // Get chains available in selected city
  const availableChains = useMemo(() => {
    if (!selectedCity) return [];
    
    const cityStores = stores.filter(s => s.city === selectedCity);
    const chainMap = new Map();
    
    cityStores.forEach(store => {
      if (!chainMap.has(store.chain)) {
        chainMap.set(store.chain, {
          name: store.chain,
          count: 1,
          icon: CHAIN_ICONS[store.chain] || '🏪'
        });
      } else {
        chainMap.get(store.chain).count++;
      }
    });
    
    return Array.from(chainMap.values()).sort((a, b) => b.count - a.count);
  }, [stores, selectedCity]);

  // Filter chains by search
  const filteredChains = useMemo(() => {
    if (!chainSearch) return availableChains;
    const search = chainSearch.toLowerCase();
    return availableChains.filter(chain => 
      chain.name.toLowerCase().includes(search)
    );
  }, [availableChains, chainSearch]);

  // Get stores for selected city + chain
  const availableStores = useMemo(() => {
    if (!selectedCity || !selectedChain) return [];
    
    return stores.filter(s => 
      s.city === selectedCity && 
      s.chain === selectedChain
    ).sort((a, b) => {
      if (b.popularity_score !== a.popularity_score) {
        return b.popularity_score - a.popularity_score;
      }
      const categoryOrder = { 'Hypermarché': 1, 'Supermarché': 2, 'Supérette': 3 };
      return (categoryOrder[a.category] || 4) - (categoryOrder[b.category] || 4);
    });
  }, [stores, selectedCity, selectedChain]);

  // Filter stores by search
  const filteredStores = useMemo(() => {
    if (!storeSearch) return availableStores;
    const search = storeSearch.toLowerCase();
    return availableStores.filter(store => 
      store.name.toLowerCase().includes(search) ||
      (store.full_address && store.full_address.toLowerCase().includes(search))
    );
  }, [availableStores, storeSearch]);

  // Handlers
  const handleCitySelect = useCallback((city) => {
    setSelectedCity(city);
    setSelectedChain(null);
    onStoreSelect(null);
    setStep(2);
  }, [onStoreSelect]);

  const handleChainSelect = useCallback((chain) => {
    setSelectedChain(chain);
    onStoreSelect(null);
    setStep(3);
  }, [onStoreSelect]);

  const handleStoreSelect = useCallback((store) => {
    onStoreSelect(store.id);
  }, [onStoreSelect]);

  const handleBack = useCallback(() => {
    if (step === 3) {
      setStep(2);
      setSelectedChain(null);
      onStoreSelect(null);
    } else if (step === 2) {
      setStep(1);
      setSelectedCity(null);
      setSelectedChain(null);
      onStoreSelect(null);
    }
  }, [step, onStoreSelect]);

  const handleReset = useCallback(() => {
    setStep(1);
    setSelectedCity(null);
    setSelectedChain(null);
    onStoreSelect(null);
    setCitySearch('');
    setChainSearch('');
    setStoreSearch('');
  }, [onStoreSelect]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-12 bg-gray-200 rounded-lg mb-3"></div>
        <div className="h-12 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step >= 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step > 1 ? '✓' : '1'}
          </div>
          <div className="text-xs text-gray-600">Ville</div>
          
          <div className="w-8 h-0.5 bg-gray-300"></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step >= 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step > 2 ? '✓' : '2'}
          </div>
          <div className="text-xs text-gray-600">Enseigne</div>
          
          <div className="w-8 h-0.5 bg-gray-300"></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step >= 3 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            3
          </div>
          <div className="text-xs text-gray-600">Magasin</div>
        </div>
        
        {step > 1 && (
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              ← Retour
            </button>
            <button
              onClick={handleReset}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Recommencer
            </button>
          </div>
        )}
      </div>

      {/* Step 1: City Selection */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📍 Où êtes-vous ?
            </label>
            
            {gpsDetecting && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <div className="animate-spin">🌍</div>
                <span className="text-sm text-blue-800">Détection de votre position...</span>
              </div>
            )}
            
            {gpsCity && !gpsDetecting && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-sm text-green-800">
                    Position détectée: <strong>{gpsCity}</strong>
                  </span>
                </div>
                <button
                  onClick={() => handleCitySelect(gpsCity)}
                  className="text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  Continuer →
                </button>
              </div>
            )}
            
            <div className="mb-2">
              <input
                type="text"
                placeholder="🔍 Rechercher votre ville..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
              {filteredCities.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Aucune ville trouvée
                </div>
              ) : (
                filteredCities.map(city => {
                  const storeCount = stores.filter(s => s.city === city).length;
                  return (
                    <button
                      key={city}
                      onClick={() => handleCitySelect(city)}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg border border-transparent hover:border-orange-300 transition-colors flex items-center justify-between group"
                    >
                      <span className="font-medium text-gray-900">{city}</span>
                      <span className="text-sm text-gray-500 group-hover:text-orange-600">
                        {storeCount} magasin{storeCount > 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Chain Selection */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏪 Quelle enseigne à {selectedCity} ?
            </label>
            
            <div className="mb-2">
              <input
                type="text"
                placeholder="🔍 Rechercher l'enseigne..."
                value={chainSearch}
                onChange={(e) => setChainSearch(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
              {filteredChains.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Aucune enseigne trouvée
                </div>
              ) : (
                filteredChains.map(chain => (
                  <button
                    key={chain.name}
                    onClick={() => handleChainSelect(chain.name)}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg border border-transparent hover:border-orange-300 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{chain.icon}</span>
                      <span className="font-medium text-gray-900">{chain.name}</span>
                    </div>
                    <span className="text-sm text-gray-500 group-hover:text-orange-600">
                      {chain.count} magasin{chain.count > 1 ? 's' : ''} →
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Store Selection */}
      {step === 3 && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📌 Quel magasin {selectedChain} ?
            </label>
            
            <div className="mb-2">
              <input
                type="text"
                placeholder="🔍 Rechercher le magasin..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
              {filteredStores.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Aucun magasin trouvé
                </div>
              ) : (
                filteredStores.map(store => {
                  const badge = CATEGORY_BADGES[store.category] || CATEGORY_BADGES['Supérette'];
                  const isSelected = selectedStoreId === store.id;
                  
                  return (
                    <button
                      key={store.id}
                      onClick={() => handleStoreSelect(store)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'bg-green-50 border-green-500'
                          : 'bg-white border-transparent hover:bg-orange-50 hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {store.popularity_score > 10 && (
                            <span className="text-yellow-500">⭐</span>
                          )}
                          <span className="font-medium text-gray-900">{store.name}</span>
                        </div>
                        {isSelected && <span className="text-green-600">✓</span>}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bgColor} ${badge.textColor}`}>
                          {badge.icon} {badge.label}
                        </span>
                        {store.product_list && (
                          <span className="text-xs text-gray-500">
                            • {store.product_list}
                          </span>
                        )}
                        {store.surface_m2 && (
                          <span className="text-xs text-gray-500">
                            • {store.surface_m2}m²
                          </span>
                        )}
                      </div>
                      
                      {store.full_address && (
                        <div className="text-xs text-gray-500 mt-1">
                          📍 {store.full_address}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Store Summary */}
      {selectedStoreId && step === 3 && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-green-800">
            <strong>✓ Magasin sélectionné</strong>
            <div className="mt-1">
              {availableStores.find(s => s.id === selectedStoreId)?.name} - {selectedCity}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🔨 Step 3: Create App8.jsx

**Instructions:**

1. **Copy** `src/App7.jsx` to `src/App8.jsx`
2. **Add import** at the top:
```javascript
import StoreSelectionWizard from './components/StoreSelectionWizard';
```

3. **Find** the store dropdown section (around line 300-400):
```javascript
// OLD CODE - Find this:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Magasin *
  </label>
  <select
    value={manualEntry.storeId}
    onChange={(e) => setManualEntry({ ...manualEntry, storeId: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg..."
  >
    <option value="">Sélectionner un magasin</option>
    {stores.map(...)}
  </select>
</div>
```

4. **Replace** with:
```javascript
// NEW CODE:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Magasin *
  </label>
  <StoreSelectionWizard
    supabase={supabase}
    selectedStoreId={manualEntry.storeId}
    onStoreSelect={(storeId) => setManualEntry({ ...manualEntry, storeId })}
    className="mb-4"
  />
</div>
```

**That's the ONLY change to App8.jsx** - everything else stays identical to App7.

---

## 🔨 Step 4: Update `src/index.jsx`

**Change**:
```javascript
// OLD
import App7 from './App7';

// NEW
import App8 from './App8';
```

**Change**:
```javascript
// OLD
<App7 />

// NEW
<App8 />
```

---

## ✅ Testing Checklist

After implementation, verify:

### **Build & Compile**
- [ ] No compile errors
- [ ] No console warnings
- [ ] App starts successfully

### **Visual Verification**
- [ ] Wizard appears in manual entry form
- [ ] Progress indicator visible (3 steps)
- [ ] Search boxes render correctly
- [ ] Buttons have proper styling

### **Step 1: City Selection**
- [ ] GPS detection attempts (check console for logs)
- [ ] City list appears
- [ ] Search filter works (type "fort")
- [ ] Store count shows per city
- [ ] Clicking city moves to Step 2

### **Step 2: Chain Selection**
- [ ] Only chains from selected city appear
- [ ] Chain icons display
- [ ] Store count per chain shows
- [ ] Search works
- [ ] Clicking chain moves to Step 3

### **Step 3: Store Selection**
- [ ] Only stores from selected city + chain appear
- [ ] Category badges display correctly
- [ ] Store details show (surface, product list)
- [ ] Clicking store shows green confirmation
- [ ] Selected store ID flows to parent component

### **Navigation**
- [ ] "Retour" button goes back one step
- [ ] "Recommencer" resets to Step 1
- [ ] State clears properly on reset

### **Integration**
- [ ] Can submit price with selected store
- [ ] Store name appears in recent prices
- [ ] No errors in console
- [ ] App7 fallback still works (if you switch index.jsx back)

---

## 🐛 Common Issues & Solutions

### **Issue: "Cannot find module './utils/geocoding'"**
**Solution**: Ensure `geocoding.js` file is in `src/utils/` exactly

### **Issue: GPS permission dialog doesn't appear**
**Solution**: HTTPS required for GPS. Check browser console for permission errors.

### **Issue: Cities list is empty**
**Solution**: Check database has stores. Run: `SELECT DISTINCT city FROM stores;`

### **Issue: Wizard doesn't show**
**Solution**: Check import path is correct. Verify component is exported as `default`.

### **Issue: Search doesn't filter**
**Solution**: Check `useMemo` dependencies. Add console.log to debug.

### **Issue: Mobile styling broken**
**Solution**: Verify Tailwind classes. Check responsive breakpoints.

---

## 📊 Expected Behavior

**Desktop Chrome:**
- GPS may not trigger (desktop)
- Manual city search works
- Smooth transitions between steps
- Search instant filtering

**Mobile Safari (iOS):**
- GPS permission dialog appears
- City auto-detected (if in Martinique)
- Wizard skips to Step 2
- Touch targets large enough

**Mobile Chrome (Android):**
- GPS permission dialog appears
- Faster GPS lock than iOS
- Smooth scrolling in lists
- Search works with mobile keyboard

---

## ⏱️ Time Estimates

- File creation: 30 minutes
- Integration: 15 minutes
- Testing: 30 minutes
- Bug fixes: 30 minutes
- **Total: ~2 hours**

---

## 🎯 Success Criteria

Implementation is complete when:
- ✅ All 3 files created
- ✅ App8 compiles without errors
- ✅ Wizard displays in UI
- ✅ All 3 steps work
- ✅ Search works in all steps
- ✅ GPS detection attempts (mobile)
- ✅ Price submission still works
- ✅ Zero breaking changes to other features

---

**Ready to implement? Follow these steps sequentially and test after each major change. Good luck! 🚀**
