import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { detectUserLocation, getCityList, getPostalCode, getStoresSortedByDistance } from '../utils/geocoding';
import { posthog } from '../posthogClient';

const STEP_NAMES = { 1: 'city', 2: 'chain', 3: 'store' };

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
    const [userFavorites, setUserFavorites] = useState([]);
    const [, setLoadingFavorites] = useState(false);

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
    const [userLocation, setUserLocation] = useState(null);
    const [gpsCity, setGpsCity] = useState(null);

    useEffect(() => {
        posthog.capture('store_wizard_step_viewed', { step_number: step, step_name: STEP_NAMES[step] });
    }, [step]);

    // Fires the moment a store is actually chosen, covering every path
    // (city→chain→store, single-store auto-select, favorites shortcut,
    // nearest-store shortcut). Previously this lived in a useEffect watching
    // `selectedStoreId`, but the parent unmounts this component in the same
    // render that prop would have become truthy (it swaps to a "store chosen"
    // summary view), so that effect could never actually observe the change --
    // store_wizard_completed had zero real events despite looking correctly
    // wired. Firing it here, at the actual point of selection, is reachable
    // regardless of what the parent does afterward.
    const selectStore = useCallback((storeId) => {
        if (storeId) {
            posthog.capture('store_wizard_completed', { store_id: storeId });
        }
        onStoreSelect(storeId);
    }, [onStoreSelect]);

    const loadUserFavorites = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setLoadingFavorites(true);
            const { data, error } = await supabase
                .from('user_favorite_stores')
                .select(`
                    store_id,
                    stores (*)
                `)
                .eq('user_id', user.id);

            if (error) throw error;
            setUserFavorites(data?.map(f => f.stores) || []);
        } catch (err) {
            console.error('Error loading favorite stores:', err);
        } finally {
            setLoadingFavorites(false);
        }
    }, [supabase]);

    const loadStores = useCallback(async () => {
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
    }, [supabase]);

    const loadCities = useCallback(async () => {
        const cityList = await getCityList(supabase);
        setCities(cityList);
    }, [supabase]);

    const attemptGPSDetection = useCallback(async () => {
        setGpsDetecting(true);
        const location = await detectUserLocation();

        if (location) {
            setUserLocation({ lat: location.latitude, lon: location.longitude });
            if (location.city) {
                setGpsCity(location.city);
                setSelectedCity(location.city);
                setStep(2); // Skip to chain selection
                posthog.capture('store_wizard_gps_detected', { city: location.city });
            }
        }

        setGpsDetecting(false);
    }, []);

    // Load stores and cities on mount
    useEffect(() => {
        loadStores();
        loadCities();
        attemptGPSDetection();
        loadUserFavorites();
    }, [loadStores, loadCities, attemptGPSDetection, loadUserFavorites]);

    // Filter cities by search
    const filteredCities = useMemo(() => {
        if (!citySearch) return cities;
        const search = citySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cities.filter(city =>
            city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(search)
        );
    }, [cities, citySearch]);

    // Nearest stores (if GPS available)
    const nearestStores = useMemo(() => {
        if (!userLocation) return [];
        return getStoresSortedByDistance(stores, userLocation.lat, userLocation.lon).slice(0, 3);
    }, [stores, userLocation]);

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
        selectStore(null);
        setStep(2);
    }, [selectStore]);

    const handleChainSelect = useCallback((chain) => {
        const cityStores = stores.filter(s => s.city === selectedCity && s.chain === chain);

        if (cityStores.length === 1) {
            // Only one store in this city/chain - select it automatically and finish
            selectStore(cityStores[0].id);
            // No need to setStep(3) if it's already selected and we want to skip
        } else {
            setSelectedChain(chain);
            selectStore(null);
            setStep(3);
        }
    }, [stores, selectedCity, selectStore]);

    const handleStoreSelect = useCallback((store) => {
        selectStore(store.id);
    }, [selectStore]);

    const handleBack = useCallback(() => {
        if (step === 3) {
            setStep(2);
            setSelectedChain(null);
            selectStore(null);
        } else if (step === 2) {
            setStep(1);
            setSelectedCity(null);
            setSelectedChain(null);
            selectStore(null);
        }
    }, [step, selectStore]);

    const handleReset = useCallback(() => {
        setStep(1);
        setSelectedCity(null);
        setSelectedChain(null);
        selectStore(null);
        setCitySearch('');
        setChainSearch('');
        setStoreSearch('');
    }, [selectStore]);

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 sm:gap-0">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                        {step > 1 ? '✓' : '1'}
                    </div>
                    <div className="text-xs text-gray-600">Ville</div>

                    <div className="w-4 sm:w-8 h-0.5 bg-gray-300"></div>

                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                        {step > 2 ? '✓' : '2'}
                    </div>
                    <div className="text-xs text-gray-600">Enseigne</div>

                    <div className="w-4 sm:w-8 h-0.5 bg-gray-300"></div>

                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                        3
                    </div>
                    <div className="text-xs text-gray-600">Magasin</div>
                </div>

                {step > 1 && (
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={handleBack}
                            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 bg-gray-100 px-2 py-1.5 rounded-lg"
                        >
                            ← Retour
                        </button>
                        <button
                            onClick={handleReset}
                            className="text-sm text-red-600 hover:text-red-800 bg-red-50 px-2 py-1.5 rounded-lg"
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

                        {/* Favorite Shortcuts */}
                        {userFavorites.length > 0 && !citySearch && (
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    ⭐ Mes magasins habituels
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {userFavorites.map(store => (
                                        <button
                                            key={`fav-${store.id}`}
                                            onClick={() => {
                                                setSelectedCity(store.city);
                                                setSelectedChain(store.chain);
                                                selectStore(store.id);
                                                setStep(3); // Go directly to summary/confirmation
                                            }}
                                            className="w-full text-left p-3 bg-orange-50 rounded-xl border-2 border-orange-100 hover:border-orange-400 transition-all group flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                                                    {CHAIN_ICONS[store.chain] || '🏪'}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 block">{store.name}</span>
                                                    <span className="text-[10px] text-orange-600 font-bold uppercase tracking-tight">{store.city}</span>
                                                </div>
                                            </div>
                                            <div className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Go →
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {nearestStores.length > 0 && !citySearch && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    📍 À proximité ({nearestStores.length})
                                </label>
                                <div className="space-y-2">
                                    {nearestStores.map(store => (
                                        <button
                                            key={`near-${store.id}`}
                                            onClick={() => {
                                                setSelectedCity(store.city);
                                                setSelectedChain(store.chain);
                                                selectStore(store.id);
                                                setStep(3);
                                            }}
                                            className="w-full text-left p-3 bg-blue-50 rounded-xl border border-blue-100 hover:border-blue-400 transition-colors group flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">
                                                    {CHAIN_ICONS[store.chain] || '🏪'}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900">{store.chain} {store.name}</span>
                                                    <p className="text-xs text-gray-500">{store.city} ({store.distance.toFixed(1)} km)</p>
                                                </div>
                                            </div>
                                            <span className="text-blue-300">→</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                            {filteredCities.length === 0 ? (
                                <div className="text-center py-4 text-gray-500">
                                    Aucune ville trouvée
                                </div>
                            ) : (
                                filteredCities.map(city => {
                                    const storeCount = stores.filter(s => s.city === city).length;
                                    const postalCode = getPostalCode(city);
                                    return (
                                        <button
                                            key={city}
                                            onClick={() => handleCitySelect(city)}
                                            className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg border border-transparent hover:border-orange-300 transition-colors flex items-center justify-between group"
                                        >
                                            <span className="font-medium text-gray-900">
                                                {city}{postalCode ? ` (${postalCode})` : ''}
                                            </span>
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
                                            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${isSelected
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
