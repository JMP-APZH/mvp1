import React, { useState, useEffect } from 'react';
import { Trash2, ShoppingBasket, AlertCircle, Plus, Minus, Calculator, Store, Check, X, Package, Star, Wallet, TrendingDown, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ShoppingList = ({ items, onUpdateQuantity, onRemoveItem, onClearList, onAddItem, supabase }) => {
    const { userProfile, userFavorites, updateProfile } = useAuth();
    const [comparison, setComparison] = useState(null);
    const [loadingComparison, setLoadingComparison] = useState(false);
    const [expandedStore, setExpandedStore] = useState(null);
    const [savingsOpportunities, setSavingsOpportunities] = useState([]);
    const [mainlandComparison, setMainlandComparison] = useState(null);
    const [favoritesDetails, setFavoritesDetails] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState(false);
    const [editingBudget, setEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');

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
                    const cheapestByProduct = {};
                    prices.forEach(p => {
                        if (!cheapestByProduct[p.product_id] || p.price < cheapestByProduct[p.product_id].price) {
                            cheapestByProduct[p.product_id] = { price: p.price, storeName: p.stores?.name, storeId: p.store_id };
                        }
                    });

                    const opportunities = best.foundItems
                        .map(item => {
                            const cheapest = cheapestByProduct[item.productId];
                            if (!cheapest || cheapest.storeId === best.storeId || cheapest.price >= item.price) return null;
                            const itemInfo = items.find(i => i.productId === item.productId);
                            return {
                                productId: item.productId,
                                name: itemInfo?.name,
                                currentPrice: item.price,
                                quantity: item.quantity,
                                cheaperPrice: cheapest.price,
                                cheaperStore: cheapest.storeName,
                                savings: (item.price - cheapest.price) * item.quantity,
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
                    best.foundItems.forEach(item => {
                        const mainlandPrice = cheapestMainlandByProduct[item.productId];
                        if (mainlandPrice != null) {
                            martiniqueTotal += item.price * item.quantity;
                            mainlandTotal += mainlandPrice * item.quantity;
                            matchedCount++;
                        }
                    });

                    setMainlandComparison(matchedCount > 0 ? {
                        martiniqueTotal,
                        mainlandTotal,
                        matchedCount,
                        totalCount: items.length,
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
                        <Star className="w-4 h-4 text-yellow-500" /> Mes Favoris
                    </h3>
                    {loadingFavorites ? (
                        <div className="p-4 text-center text-gray-400 text-xs bg-white rounded-lg border">Chargement...</div>
                    ) : favoritesDetails.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-xs bg-white rounded-lg border border-dashed">
                            Appuyez sur l'étoile ⭐ d'un produit dans "Comparer" pour l'ajouter ici.
                        </div>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {favoritesDetails.map(fav => {
                                const inPanier = items.some(i => i.productId === fav.id);
                                return (
                                    <div key={fav.id} className="flex-shrink-0 w-28 bg-white border border-gray-200 rounded-lg p-2">
                                        <div className="w-full h-16 rounded bg-gray-100 flex items-center justify-center overflow-hidden mb-1.5">
                                            {fav.photo ? (
                                                <img src={fav.photo} alt={fav.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-6 h-6 text-gray-300" />
                                            )}
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
                        {/* List Items */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
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
                                                onClick={() => setExpandedStore(expandedStore === result.storeId ? null : result.storeId)}
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
                                            {expandedStore === result.storeId && (
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
                                    <span>🇫🇷</span> Comparaison France Hexagonale
                                </h3>
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-sm text-blue-800">Ce panier en Martinique</span>
                                        <span className="text-base font-black text-gray-900">{mainlandComparison.martiniqueTotal.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between items-baseline mb-2">
                                        <span className="text-sm text-blue-800">Équivalent en France Hexagonale</span>
                                        <span className="text-base font-black text-blue-700">{mainlandComparison.mainlandTotal.toFixed(2)}€</span>
                                    </div>
                                    <div className="pt-2 border-t border-blue-200">
                                        <p className="text-sm font-black text-red-600">
                                            +{(mainlandComparison.martiniqueTotal - mainlandComparison.mainlandTotal).toFixed(2)}€
                                            {' '}({(((mainlandComparison.martiniqueTotal - mainlandComparison.mainlandTotal) / mainlandComparison.mainlandTotal) * 100).toFixed(0)}%)
                                            {' '}de perte de pouvoir d'achat
                                        </p>
                                        <p className="text-[10px] text-blue-500 mt-1">
                                            Basé sur {mainlandComparison.matchedCount} sur {mainlandComparison.totalCount} article{mainlandComparison.totalCount > 1 ? 's' : ''} de votre panier ayant un prix France Hexagonale connu.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ShoppingList;
