import React, { useState, useEffect, useRef } from 'react';
import { Trash2, ShoppingBasket, AlertCircle, Plus, Minus, Calculator, Store, Check, X, Package, Bookmark, Wallet, TrendingDown, Pencil, ChefHat, ChevronRight, ChevronDown, ClipboardCheck, Tag, Clock, PieChart, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { posthog } from '../posthogClient';
import UnmatchedItemsModal from './UnmatchedItemsModal';
import RecipesHubModal from './RecipesHubModal';
import FlagFrance from './flags/FlagFrance';

// How recent a price needs to be to count as "up to date" for the basket
// completeness tracker. Chosen from real production data, not guessed: the
// most-recent price per product currently splits cleanly into two clusters
// (9-15 days old vs. 181-206 days old, nothing in between) -- any threshold
// between ~16 and ~180 days produces the identical result today, so 30 days
// was picked as a conventional, easily-explained value inside that gap.
const FRESHNESS_WINDOW_DAYS = 30;

const ShoppingList = ({ items, onUpdateQuantity, onRemoveItem, onClearList, onAddItem, onSelectRecipe, onRequestPriceUpdate, onRequireAuth, supabase, user }) => {
    const { userProfile, userFavorites, updateProfile, toggleFavorite } = useAuth();
    const [comparison, setComparison] = useState(null);
    const [loadingComparison, setLoadingComparison] = useState(false);
    // Set (not a single value) so expanding one store's details never force-closes
    // another -- each store's row independently toggles its own detail panel.
    const [expandedStores, setExpandedStores] = useState(() => new Set());
    const [savingsOpportunities, setSavingsOpportunities] = useState([]);
    const [mainlandComparison, setMainlandComparison] = useState(null);
    const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);
    const [favoritesDetails, setFavoritesDetails] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState(false);
    const [editingBudget, setEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');
    const [showRecipesHub, setShowRecipesHub] = useState(false);
    const [showBasketDetail, setShowBasketDetail] = useState(false);
    const [showCompletenessDetail, setShowCompletenessDetail] = useState(false);
    const [categoriesList, setCategoriesList] = useState([]);
    const [completenessItems, setCompletenessItems] = useState([]);
    const [categoryBreakdown, setCategoryBreakdown] = useState([]);
    const [categorizingProductId, setCategorizingProductId] = useState(null);
    const [categorizeErrorProductId, setCategorizeErrorProductId] = useState(null);
    const completenessViewedRef = useRef(false);

    // All categories -- needed for the "Catégoriser" quick-action, which must
    // offer every category, not just ones already used by a scanned product
    // (unlike the Comparer tab's filter picker, which intentionally narrows
    // to `pickerCategories`).
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('*')
                    .order('display_order', { ascending: true });
                if (error) throw error;
                setCategoriesList(data || []);
            } catch (err) {
                console.error('Error loading categories in Panier:', err);
            }
        };
        loadCategories();
    }, [supabase]);

    // Favorites watchlist -- build the panier from your favorites
    useEffect(() => {
        const loadFavorites = async () => {
            if (!userFavorites || userFavorites.size === 0) {
                setFavoritesDetails([]);
                return;
            }
            setLoadingFavorites(true);
            try {
                const favoriteIds = [...userFavorites];
                const { data: products, error } = await supabase
                    .from('products')
                    .select('id, name')
                    .in('id', favoriteIds);
                if (error) throw error;

                const { data: priceRows } = await supabase
                    .from('prices')
                    .select('product_id, price, product_photo_url, origin_region_code')
                    .in('product_id', favoriteIds);

                const bestByProduct = {};
                (priceRows || []).forEach(p => {
                    if (p.origin_region_code === 'Hexagone') return;
                    if (!bestByProduct[p.product_id] || p.price < bestByProduct[p.product_id].price) {
                        bestByProduct[p.product_id] = { price: p.price, photo: bestByProduct[p.product_id]?.photo };
                    }
                    if (p.product_photo_url && !bestByProduct[p.product_id].photo) {
                        bestByProduct[p.product_id].photo = p.product_photo_url;
                    }
                });

                setFavoritesDetails((products || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    photo: bestByProduct[p.id]?.photo || null,
                    bestPrice: bestByProduct[p.id]?.price ?? null,
                })).sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error('Error loading favorites watchlist:', err);
            } finally {
                setLoadingFavorites(false);
            }
        };
        loadFavorites();
    }, [userFavorites, supabase]);

    useEffect(() => {
        const comparePrices = async () => {
            if (items.length === 0) {
                setComparison(null);
                setSavingsOpportunities([]);
                setMainlandComparison(null);
                setCompletenessItems([]);
                setCategoryBreakdown([]);
                return;
            }
            setLoadingComparison(true);

            try {
                const productIds = items.map(i => i.productId);

                const { data: allRows, error } = await supabase
                    .from('prices')
                    .select(`
                        price,
                        store_id,
                        product_id,
                        created_at,
                        origin_region_code,
                        mainland_chain,
                        stores (id, name)
                    `)
                    .in('product_id', productIds)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // France Hexagonale entries are a different market -- keep them out
                // of the Martinique store comparator (they have no real store_id and
                // would otherwise show up as a phantom "undefined" store).
                const prices = (allRows || []).filter(p => p.origin_region_code !== 'Hexagone');
                const mainlandRows = (allRows || []).filter(p => p.origin_region_code === 'Hexagone');

                // category_id isn't part of a `prices` row -- a small, separate
                // products fetch (not price data, so this doesn't duplicate the
                // price-resolution logic above).
                const { data: productRows } = await supabase
                    .from('products')
                    .select('id, category_id')
                    .in('id', productIds);
                const categoryByProduct = {};
                (productRows || []).forEach(p => { categoryByProduct[p.id] = p.category_id ?? null; });

                // One pass over `prices` builds both the cheapest-known-price-per-product
                // map (used below for savings opportunities and the category budget
                // breakdown) and the most-recent-price-date-per-product map (used for the
                // completeness tracker's freshness check) -- avoids scanning `prices` twice
                // for what is fundamentally the same price-resolution pass.
                const priceInfoByProduct = {};
                prices.forEach(p => {
                    const info = priceInfoByProduct[p.product_id] || {
                        cheapestPrice: null, cheapestStoreId: null, cheapestStoreName: null, mostRecentDate: null,
                    };
                    if (info.cheapestPrice == null || p.price < info.cheapestPrice) {
                        info.cheapestPrice = p.price;
                        info.cheapestStoreId = p.store_id;
                        info.cheapestStoreName = p.stores?.name;
                    }
                    if (info.mostRecentDate == null || new Date(p.created_at) > new Date(info.mostRecentDate)) {
                        info.mostRecentDate = p.created_at;
                    }
                    priceInfoByProduct[p.product_id] = info;
                });

                // Basket completeness: an item is "up to date" once it has a category
                // AND its most recently recorded Martinique price is within the freshness
                // window. Missing pieces are surfaced individually so the UI can offer the
                // right quick-action per item.
                const now = Date.now();
                const completeness = items.map(item => {
                    const categoryId = categoryByProduct[item.productId] ?? null;
                    const info = priceInfoByProduct[item.productId];
                    const daysSincePrice = info?.mostRecentDate
                        ? Math.floor((now - new Date(info.mostRecentDate).getTime()) / 86400000)
                        : null;
                    const isFresh = daysSincePrice != null && daysSincePrice <= FRESHNESS_WINDOW_DAYS;
                    const hasCategory = categoryId != null;
                    return {
                        productId: item.productId,
                        name: item.name,
                        categoryId,
                        hasCategory,
                        isFresh,
                        daysSincePrice,
                        isComplete: hasCategory && isFresh,
                    };
                });
                setCompletenessItems(completeness);

                // Category budget breakdown -- purely descriptive: groups the panier by
                // category_id (an explicit "Non catégorisé" bucket for nulls, never hidden),
                // valuing each item at its cheapest known Martinique price (the same
                // priceInfoByProduct resolution used everywhere else in this effect, not a
                // second price-lookup implementation). No cross-store savings claim here --
                // that's the separate "Économies possibles" section below.
                const breakdownMap = {};
                items.forEach(item => {
                    const categoryId = categoryByProduct[item.productId] ?? null;
                    const key = categoryId || 'uncategorized';
                    if (!breakdownMap[key]) {
                        breakdownMap[key] = { categoryId, subtotal: 0, itemCount: 0, knownCount: 0 };
                    }
                    breakdownMap[key].itemCount += 1;
                    const knownPrice = priceInfoByProduct[item.productId]?.cheapestPrice;
                    if (knownPrice != null) {
                        breakdownMap[key].subtotal += knownPrice * item.quantity;
                        breakdownMap[key].knownCount += 1;
                    }
                });
                const grandTotal = Object.values(breakdownMap).reduce((sum, b) => sum + b.subtotal, 0);
                const breakdown = Object.values(breakdownMap)
                    .map(b => ({ ...b, pctOfTotal: grandTotal > 0 ? (b.subtotal / grandTotal) * 100 : 0 }))
                    .sort((a, b) => b.subtotal - a.subtotal);
                setCategoryBreakdown(breakdown);

                // Process prices to find latest per (store, product)
                const storeBaskets = {};
                const latestPrices = {};

                prices.forEach(p => {
                    const key = `${p.store_id}_${p.product_id}`;
                    if (!latestPrices[key]) {
                        latestPrices[key] = p;
                    }
                });

                Object.values(latestPrices).forEach(p => {
                    const storeId = p.store_id;
                    const storeName = p.stores?.name;

                    if (!storeBaskets[storeId]) {
                        storeBaskets[storeId] = {
                            storeId,
                            storeName,
                            totalPrice: 0,
                            foundItems: [],
                            foundCount: 0
                        };
                    }

                    const itemInList = items.find(i => i.productId === p.product_id);
                    if (itemInList) {
                        storeBaskets[storeId].totalPrice += p.price * itemInList.quantity;
                        storeBaskets[storeId].foundItems.push({
                            productId: p.product_id,
                            price: p.price,
                            quantity: itemInList.quantity
                        });
                        storeBaskets[storeId].foundCount++;
                    }
                });

                const results = Object.values(storeBaskets).map(basket => {
                    const foundIds = new Set(basket.foundItems.map(i => i.productId));
                    const missingItems = items.filter(i => !foundIds.has(i.productId));

                    return {
                        ...basket,
                        missingCount: missingItems.length,
                        completeness: (basket.foundCount / items.length) * 100
                    };
                });

                results.sort((a, b) => {
                    if (b.completeness !== a.completeness) return b.completeness - a.completeness;
                    return a.totalPrice - b.totalPrice;
                });

                setComparison(results);

                // Savings opportunities: for the recommended (best) basket, does any
                // item have a strictly cheaper price at a different Martinique store?
                const best = results[0];
                if (best) {
                    const opportunities = best.foundItems
                        .map(item => {
                            const cheapest = priceInfoByProduct[item.productId];
                            if (!cheapest || cheapest.cheapestStoreId === best.storeId || cheapest.cheapestPrice >= item.price) return null;
                            const itemInfo = items.find(i => i.productId === item.productId);
                            return {
                                productId: item.productId,
                                name: itemInfo?.name,
                                currentPrice: item.price,
                                quantity: item.quantity,
                                cheaperPrice: cheapest.cheapestPrice,
                                cheaperStore: cheapest.cheapestStoreName,
                                savings: (item.price - cheapest.cheapestPrice) * item.quantity,
                            };
                        })
                        .filter(Boolean)
                        .sort((a, b) => b.savings - a.savings);

                    setSavingsOpportunities(opportunities);
                } else {
                    setSavingsOpportunities([]);
                }

                // France Hexagonale comparison: only over items with both a
                // Martinique price (in the recommended basket) and a known mainland
                // price, so the comparison is honestly apples-to-apples.
                if (best && mainlandRows.length > 0) {
                    const cheapestMainlandByProduct = {};
                    mainlandRows.forEach(p => {
                        if (!cheapestMainlandByProduct[p.product_id] || p.price < cheapestMainlandByProduct[p.product_id].price) {
                            cheapestMainlandByProduct[p.product_id] = p.price;
                        }
                    });

                    let martiniqueTotal = 0;
                    let mainlandTotal = 0;
                    let matchedCount = 0;
                    let unmatchedAmount = 0;
                    const unmatchedItems = [];
                    best.foundItems.forEach(item => {
                        const mainlandPrice = cheapestMainlandByProduct[item.productId];
                        if (mainlandPrice != null) {
                            martiniqueTotal += item.price * item.quantity;
                            mainlandTotal += mainlandPrice * item.quantity;
                            matchedCount++;
                        } else {
                            const lineTotal = item.price * item.quantity;
                            unmatchedAmount += lineTotal;
                            unmatchedItems.push({
                                productId: item.productId,
                                name: items.find(i => i.productId === item.productId)?.name || 'Produit inconnu',
                                price: item.price,
                                quantity: item.quantity,
                                lineTotal,
                            });
                        }
                    });

                    setMainlandComparison(matchedCount > 0 ? {
                        martiniqueTotal,
                        mainlandTotal,
                        matchedCount,
                        totalCount: items.length,
                        bestFoundCount: best.foundCount,
                        bestStoreName: best.storeName,
                        unmatchedAmount,
                        unmatchedItems,
                    } : null);
                } else {
                    setMainlandComparison(null);
                }

            } catch (err) {
                console.error("Error comparing prices:", err);
            } finally {
                setLoadingComparison(false);
            }
        };

        comparePrices();
    }, [items, supabase]);

    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
    const recommendedTotal = comparison?.[0]?.totalPrice ?? null;
    const budgetMax = userProfile?.budget_max;

    const saveBudget = async () => {
        const value = parseFloat(budgetInput);
        if (!isNaN(value) && value > 0) {
            await updateProfile({ budget_max: value });
        }
        setEditingBudget(false);
    };

    const completeCount = completenessItems.filter(s => s.isComplete).length;
    const incompleteItems = completenessItems.filter(s => !s.isComplete);

    // Fires once per Panier visit that has items -- not on every render/recompute,
    // matching the "meaningful action, not every click" instrumentation convention.
    useEffect(() => {
        if (items.length > 0 && !completenessViewedRef.current) {
            completenessViewedRef.current = true;
            posthog.capture('panier_completeness_viewed', { item_count: items.length });
        }
    }, [items.length]);

    // Writes directly to products.category_id, same correction pattern as
    // ProductCompletion.jsx's admin tool -- but user-facing here. Whether the
    // `products` authenticated-write RLS policy already covers any logged-in
    // user (as it does for `prices`/`products` elsewhere in this codebase --
    // see the Jul 21, 2026 mainland_price_migration.sql entry in CLAUDE.md) or
    // is actually admin-gated wasn't independently re-verified against a real
    // non-admin authenticated session this pass (see CLAUDE.md for what was
    // checked). Optimistic update + rollback so a denied write fails visibly
    // and gracefully instead of showing a category that didn't actually save.
    const submitCategory = async (productId, categoryId) => {
        const previous = completenessItems.find(s => s.productId === productId)?.categoryId ?? null;
        setCategorizeErrorProductId(null);
        setCategorizingProductId(null);
        setCompletenessItems(prev => prev.map(s => s.productId === productId
            ? { ...s, categoryId, hasCategory: true, isComplete: s.isFresh }
            : s));
        try {
            const { error } = await supabase.from('products').update({ category_id: categoryId }).eq('id', productId);
            if (error) throw error;
            posthog.capture('panier_categorize_completed', { product_id: productId, category_id: categoryId });
        } catch (err) {
            console.error('Erreur mise à jour catégorie depuis le Panier:', err);
            setCompletenessItems(prev => prev.map(s => s.productId === productId
                ? { ...s, categoryId: previous, hasCategory: previous != null, isComplete: previous != null && s.isFresh }
                : s));
            setCategorizeErrorProductId(productId);
        }
    };

    const requestPriceUpdate = (item) => {
        posthog.capture('panier_stale_price_clicked', { product_id: item.productId, days_since_price: item.daysSincePrice });
        onRequestPriceUpdate?.(item);
    };

    const toggleStoreExpanded = (storeId) => {
        setExpandedStores(prev => {
            const next = new Set(prev);
            if (next.has(storeId)) next.delete(storeId); else next.add(storeId);
            return next;
        });
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm border-b sticky top-0 z-10">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShoppingBasket className="text-orange-500" />
                        Mon Panier ({totalItems})
                    </h2>
                    {items.length > 0 && (
                        <button
                            onClick={onClearList}
                            className="text-red-500 text-xs flex items-center gap-1 hover:bg-red-50 p-2 rounded"
                        >
                            <Trash2 className="w-4 h-4" /> Vider
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {items.length > 0 && (
                    <>
                        {/* Basket detail -- collapsed by default, right under the header/Vider row. */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => {
                                    const next = !showBasketDetail;
                                    setShowBasketDetail(next);
                                    if (next) posthog.capture('panier_basket_detail_expanded', { item_count: items.length });
                                }}
                                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <span className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                    <ClipboardList className="w-4 h-4 text-orange-600" />
                                    Consulter le détail de mon panier ({totalItems})
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBasketDetail ? 'rotate-180' : ''}`} />
                            </button>

                            {showBasketDetail && (
                                <div className="border-t border-gray-100 divide-y animate-in fade-in slide-in-from-top-2">
                                    {items.map(item => (
                                        <div key={item.productId} className="p-3 flex items-center gap-3">
                                            {item.photo ? (
                                                <img src={item.photo} alt={item.name} className="w-12 h-12 rounded object-cover bg-gray-100" />
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <Package className="w-6 h-6" />
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                                                <p className="text-xs text-gray-500">{item.brand || 'Marque inconnue'}</p>
                                            </div>

                                            <div className="flex items-center border rounded-lg bg-gray-50">
                                                <button
                                                    onClick={() => onUpdateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                                                    className="p-2 hover:bg-gray-200 rounded-l-lg text-gray-600"
                                                    disabled={item.quantity <= 1}
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                                                <button
                                                    onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                                                    className="p-2 hover:bg-gray-200 rounded-r-lg text-gray-600"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => onRemoveItem(item.productId)}
                                                className="p-2 text-gray-400 hover:text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Category budget breakdown -- purely descriptive, valued at each
                            item's cheapest known Martinique price across all stores (not
                            tied to any single recommended store). Right after basket detail,
                            per request. */}
                        {categoryBreakdown.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <PieChart className="w-5 h-5 text-orange-600" />
                                    Répartition par catégorie
                                </h3>
                                <div className="bg-white border border-gray-200 rounded-lg divide-y">
                                    {categoryBreakdown.map(b => {
                                        const cat = categoriesList.find(c => c.id === b.categoryId);
                                        return (
                                            <div key={b.categoryId || 'uncategorized'} className="p-3 flex items-center gap-3">
                                                <span className="text-xl flex-shrink-0">{cat?.icon || '📦'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-medium text-gray-900 truncate">
                                                            {cat?.name || 'Non catégorisé'}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">
                                                            {b.subtotal.toFixed(2)}€
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 mt-1">
                                                        <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${b.pctOfTotal}%` }} />
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                                                            {b.pctOfTotal.toFixed(0)}% · {b.knownCount}/{b.itemCount} article{b.itemCount > 1 ? 's' : ''} avec prix connu
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Complétude du panier -- headline stays visible as the toggle; the
                            explanatory caption + per-item fix list collapse under it. */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => setShowCompletenessDetail(v => !v)}
                                className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                        <ClipboardCheck className="w-4 h-4 text-orange-600" /> Complétude du panier
                                    </h3>
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showCompletenessDetail ? 'rotate-180' : ''}`} />
                                </div>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-lg font-black text-gray-900 tabular-nums">
                                        {completeCount}/{items.length} article{items.length > 1 ? 's' : ''} à jour
                                    </span>
                                </div>
                                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-orange-500 transition-all duration-500"
                                        style={{ width: `${items.length > 0 ? (completeCount / items.length) * 100 : 0}%` }}
                                    />
                                </div>
                            </button>

                            {showCompletenessDetail && (
                                <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-[10px] text-gray-400 mb-2">
                                        À jour = catégorie renseignée et prix relevé il y a moins de {FRESHNESS_WINDOW_DAYS} jours.
                                    </p>

                                    {incompleteItems.length > 0 && (
                                        <div className="space-y-1.5 pt-3 border-t border-gray-100">
                                            {incompleteItems.map(s => (
                                                <div key={s.productId}>
                                                    <div className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-2">
                                                        <span className="text-gray-700 truncate min-w-0">{s.name}</span>
                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                            {!s.hasCategory && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setCategorizingProductId(categorizingProductId === s.productId ? null : s.productId); }}
                                                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                                                                >
                                                                    <Tag className="w-3 h-3" /> Catégoriser
                                                                </button>
                                                            )}
                                                            {!s.isFresh && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); requestPriceUpdate(s); }}
                                                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                                                >
                                                                    <Clock className="w-3 h-3" /> Prix à confirmer
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {categorizingProductId === s.productId && (
                                                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 mt-1 animate-in fade-in slide-in-from-top-2">
                                                            {categoriesList.length === 0 ? (
                                                                <p className="text-xs text-gray-400 text-center py-2">Chargement des catégories...</p>
                                                            ) : (
                                                                <div className="grid grid-cols-4 gap-2">
                                                                    {categoriesList.map(cat => (
                                                                        <button
                                                                            key={cat.id}
                                                                            onClick={(e) => { e.stopPropagation(); submitCategory(s.productId, cat.id); }}
                                                                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-orange-50 transition-colors"
                                                                        >
                                                                            <span className="text-xl">{cat.icon}</span>
                                                                            <span className="text-[9px] text-gray-600 font-medium text-center leading-tight">{cat.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {categorizeErrorProductId === s.productId && (
                                                        <p className="text-[10px] text-red-500 mt-1 px-1">
                                                            Impossible d'enregistrer la catégorie pour le moment. Réessayez plus tard.
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Budget bar -- always visible so it's there "while you keep adding items" */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                            <Wallet className="w-4 h-4 text-orange-600" /> Mon budget
                        </h3>
                        {!editingBudget && (
                            <button
                                onClick={() => { setBudgetInput(budgetMax ? String(budgetMax) : ''); setEditingBudget(true); }}
                                className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:bg-orange-50 px-2 py-1 rounded"
                            >
                                <Pencil className="w-3 h-3" /> {budgetMax ? 'Modifier' : 'Définir'}
                            </button>
                        )}
                    </div>

                    {editingBudget ? (
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="1"
                                min="0"
                                autoFocus
                                value={budgetInput}
                                onChange={(e) => setBudgetInput(e.target.value)}
                                placeholder="Budget (€)"
                                className="flex-1 bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                            <button onClick={saveBudget} className="bg-orange-500 text-white text-sm font-bold px-4 rounded-lg hover:bg-orange-600">
                                OK
                            </button>
                        </div>
                    ) : !budgetMax ? (
                        <p className="text-xs text-gray-400">Définissez un budget pour suivre en direct si votre panier reste dans vos moyens.</p>
                    ) : recommendedTotal == null ? (
                        <p className="text-xs text-gray-400">Ajoutez des articles pour voir votre panier par rapport à votre budget de {budgetMax.toFixed(0)}€.</p>
                    ) : (() => {
                        const pct = Math.min((recommendedTotal / budgetMax) * 100, 100);
                        const overBudget = recommendedTotal > budgetMax;
                        return (
                            <div>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className={`text-lg font-black ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                                        {recommendedTotal.toFixed(2)}€
                                    </span>
                                    <span className="text-xs text-gray-400">Budget : {budgetMax.toFixed(0)}€</span>
                                </div>
                                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <p className={`text-xs font-bold mt-1.5 ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                                    {overBudget
                                        ? `Dépassement de ${(recommendedTotal - budgetMax).toFixed(2)}€`
                                        : `Il vous reste ${(budgetMax - recommendedTotal).toFixed(2)}€`}
                                </p>
                            </div>
                        );
                    })()}
                </div>

                {/* Favorites watchlist -- build your panier from your favorites */}
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm">
                        <Bookmark className="w-4 h-4 text-yellow-500 fill-yellow-400" /> Mes Favoris
                    </h3>
                    {loadingFavorites ? (
                        <div className="p-4 text-center text-gray-400 text-xs bg-white rounded-lg border">Chargement...</div>
                    ) : favoritesDetails.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-xs bg-white rounded-lg border border-dashed">
                            Appuyez sur le signet 🔖 d'un produit dans "Comparer" pour l'ajouter ici.
                        </div>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {favoritesDetails.map(fav => {
                                const inPanier = items.some(i => i.productId === fav.id);
                                return (
                                    <div key={fav.id} className="flex-shrink-0 w-28 bg-white border border-gray-200 rounded-lg p-2">
                                        <div className="relative w-full h-16 rounded bg-gray-100 flex items-center justify-center overflow-hidden mb-1.5">
                                            {fav.photo ? (
                                                <img src={fav.photo} alt={fav.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-6 h-6 text-gray-300" />
                                            )}
                                            <button
                                                onClick={() => toggleFavorite(fav.id)}
                                                className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-yellow-500 hover:bg-white transition-colors shadow-sm"
                                                title="Retirer des favoris"
                                            >
                                                <Bookmark className="w-3.5 h-3.5 fill-yellow-400" />
                                            </button>
                                        </div>
                                        <p className="text-[11px] font-medium text-gray-900 leading-tight line-clamp-2 h-8">{fav.name}</p>
                                        <p className="text-xs font-bold text-gray-700 mt-0.5">
                                            {fav.bestPrice != null ? `${fav.bestPrice.toFixed(2)}€` : '—'}
                                        </p>
                                        <button
                                            onClick={() => onAddItem?.({ id: fav.id, name: fav.name, productPhotoUrl: fav.photo })}
                                            disabled={inPanier}
                                            className={`w-full mt-1.5 text-[10px] font-bold py-1.5 rounded transition-colors ${inPanier
                                                ? 'bg-green-50 text-green-600'
                                                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                                }`}
                                        >
                                            {inPanier ? 'Ajouté ✓' : '+ Panier'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Idées recettes -- moved to its own full-screen hub (browse, submit,
                    like, favorite) so Panier itself stays focused on favorites/basket
                    info; this is just the entry point. */}
                <button
                    onClick={() => setShowRecipesHub(true)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                    <span className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <ChefHat className="w-4 h-4 text-orange-600" /> Idées recettes
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                {items.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingBasket className="w-10 h-10 text-orange-400" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-700">Votre panier est vide</h3>
                        <p className="mb-6">Ajoutez des produits depuis vos favoris, la recherche ou le scanner pour comparer les prix !</p>
                    </div>
                ) : (
                    <>
                        {/* Comparator Result */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-orange-600" />
                                Comparateur de Panier
                            </h3>

                            {loadingComparison ? (
                                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">
                                    <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                    Calcul des meilleurs prix...
                                </div>
                            ) : comparison && comparison.length > 0 ? (
                                <div className="space-y-3">
                                    {comparison.slice(0, 5).map((result, idx) => (
                                        <div
                                            key={result.storeId}
                                            className={`bg-white border rounded-lg overflow-hidden transition-all ${idx === 0 ? 'border-green-500 ring-1 ring-green-500 shadow-md' : 'border-gray-200'}`}
                                        >
                                            <div
                                                className="p-4 cursor-pointer"
                                                onClick={() => toggleStoreExpanded(result.storeId)}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <Store className={`w-4 h-4 ${idx === 0 ? 'text-green-600' : 'text-gray-400'}`} />
                                                        <span className="font-bold text-gray-900">{result.storeName}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-lg font-bold ${idx === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                                            {result.totalPrice.toFixed(2)}€
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-2">
                                                        {result.missingCount === 0 ? (
                                                            <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
                                                                <Check className="w-3 h-3" /> Complet (100%)
                                                            </span>
                                                        ) : (
                                                            <span className="text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-full">
                                                                <AlertCircle className="w-3 h-3" /> Manque {result.missingCount} article{result.missingCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {idx === 0 && <span className="text-green-600 font-medium text-[10px] uppercase tracking-wide">Meilleure offre</span>}
                                                </div>
                                            </div>

                                            {/* Detailed Breakdown */}
                                            {expandedStores.has(result.storeId) && (
                                                <div className="border-t bg-gray-50 p-3 text-xs space-y-2">
                                                    <p className="font-semibold text-gray-600 mb-2">Détail des prix :</p>
                                                    {result.foundItems.map(item => {
                                                        const pInfo = items.find(i => i.productId === item.productId);
                                                        return (
                                                            <div key={item.productId} className="flex justify-between">
                                                                <span className="text-gray-700 truncate max-w-[200px]">{pInfo?.name}</span>
                                                                <span className="font-medium">
                                                                    {item.quantity} x {item.price.toFixed(2)}€
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                    {result.missingCount > 0 && (
                                                        <div className="mt-3 pt-2 border-t border-gray-200">
                                                            <p className="font-semibold text-red-500 mb-1">Non disponibles ici :</p>
                                                            {items.filter(i => !result.foundItems.find(f => f.productId === i.productId)).map(missing => (
                                                                <div key={missing.productId} className="text-gray-400 flex items-center gap-1">
                                                                    <X className="w-3 h-3" /> {missing.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6 text-center text-gray-500 bg-white rounded-lg border border-dashed">
                                    Pas assez de données pour comparer les prix de ce panier.
                                </div>
                            )}
                        </div>

                        {/* Savings opportunities across Martinique stores */}
                        {savingsOpportunities.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <TrendingDown className="w-5 h-5 text-green-600" />
                                    Économies possibles en Martinique
                                </h3>
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 space-y-2">
                                    {savingsOpportunities.map(op => (
                                        <div key={op.productId} className="flex items-center justify-between text-xs">
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{op.name}</p>
                                                <p className="text-gray-500">
                                                    moins cher chez <strong>{op.cheaperStore}</strong> ({op.cheaperPrice.toFixed(2)}€ au lieu de {op.currentPrice.toFixed(2)}€)
                                                </p>
                                            </div>
                                            <span className="font-black text-green-700 flex-shrink-0 pl-2">-{op.savings.toFixed(2)}€</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-green-200 flex justify-between items-center">
                                        <span className="text-xs font-bold text-green-900">Total économisable</span>
                                        <span className="text-sm font-black text-green-700">
                                            -{savingsOpportunities.reduce((sum, o) => sum + o.savings, 0).toFixed(2)}€
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* France Hexagonale comparison */}
                        {mainlandComparison && (
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <FlagFrance className="w-4 h-4" /> Comparaison France Hexagonale
                                </h3>
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                    {mainlandComparison.bestFoundCount < mainlandComparison.totalCount && (
                                        <p className="text-[10px] text-blue-500 mb-2 pb-2 border-b border-blue-100">
                                            {mainlandComparison.bestFoundCount} sur {mainlandComparison.totalCount} article{mainlandComparison.totalCount > 1 ? 's' : ''} de votre panier disponible{mainlandComparison.bestFoundCount > 1 ? 's' : ''} chez {mainlandComparison.bestStoreName}.
                                        </p>
                                    )}
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-sm text-blue-800">Ce panier en Martinique (articles comparables)</span>
                                        <span className="text-base font-black tabular-nums text-gray-900">{mainlandComparison.martiniqueTotal.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between items-baseline mb-2">
                                        <span className="text-sm text-blue-800">Équivalent en France Hexagonale</span>
                                        <span className="text-base font-black tabular-nums text-blue-700">{mainlandComparison.mainlandTotal.toFixed(2)}€</span>
                                    </div>
                                    <div className="pt-2 border-t border-blue-200">
                                        <p className="text-sm font-black text-red-600">
                                            +{(mainlandComparison.martiniqueTotal - mainlandComparison.mainlandTotal).toFixed(2)}€
                                            {' '}({(((mainlandComparison.martiniqueTotal - mainlandComparison.mainlandTotal) / mainlandComparison.mainlandTotal) * 100).toFixed(0)}%)
                                            {' '}de perte de pouvoir d'achat
                                        </p>
                                        <p className="text-[10px] text-blue-500 mt-1">
                                            Basé sur {mainlandComparison.matchedCount} sur {mainlandComparison.bestFoundCount} article{mainlandComparison.bestFoundCount > 1 ? 's' : ''} disponible{mainlandComparison.bestFoundCount > 1 ? 's' : ''} chez {mainlandComparison.bestStoreName} ayant un prix France Hexagonale connu.
                                        </p>
                                    </div>
                                    {mainlandComparison.unmatchedItems.length > 0 && (
                                        <button
                                            onClick={() => setShowUnmatchedModal(true)}
                                            className="w-full mt-3 pt-3 border-t border-blue-200 flex items-center justify-between text-left group"
                                        >
                                            <span className="text-[11px] text-orange-700 font-medium group-hover:underline">
                                                ⚠ {mainlandComparison.unmatchedAmount.toFixed(2)}€ non comparés — {mainlandComparison.unmatchedItems.length} article{mainlandComparison.unmatchedItems.length > 1 ? 's' : ''} sans prix France Hexagonale
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showUnmatchedModal && mainlandComparison && (
                <UnmatchedItemsModal
                    items={mainlandComparison.unmatchedItems}
                    storeName={mainlandComparison.bestStoreName}
                    totalAmount={mainlandComparison.unmatchedAmount}
                    onClose={() => setShowUnmatchedModal(false)}
                />
            )}

            {showRecipesHub && (
                <RecipesHubModal
                    items={items}
                    onAddItem={onAddItem}
                    onSelectRecipe={onSelectRecipe}
                    onRequireAuth={onRequireAuth}
                    onClose={() => setShowRecipesHub(false)}
                    supabase={supabase}
                    user={user}
                />
            )}
        </div>
    );
};

export default ShoppingList;
