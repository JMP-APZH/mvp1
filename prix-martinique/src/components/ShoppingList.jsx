import React, { useState, useEffect } from 'react';
import { Trash2, ShoppingBasket, AlertCircle, Plus, Minus, Calculator, Store, Check, X, Package } from 'lucide-react';

const ShoppingList = ({ items, onUpdateQuantity, onRemoveItem, onClearList, supabase }) => {
    const [comparison, setComparison] = useState(null);
    const [loadingComparison, setLoadingComparison] = useState(false);
    const [expandedStore, setExpandedStore] = useState(null);

    useEffect(() => {
        const comparePrices = async () => {
            if (items.length === 0) {
                setComparison(null);
                return;
            }
            setLoadingComparison(true);

            try {
                const productIds = items.map(i => i.productId); // Assuming items have productId

                // Query logic: Get the most recent price for each product in each store
                // Since Supabase (PostgREST) doesn't support complex distinct on query easily via JS client without RPC,
                // We'll fetch recent prices for these products and process in JS for MVP.
                // Limit to last 30 days to be relevant? Or just last 100 prices per product?

                const { data: prices, error } = await supabase
                    .from('prices')
                    .select(`
                        price,
                        store_id,
                        product_id,
                        created_at,
                        stores (id, name, type)
                    `)
                    .in('product_id', productIds)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Process prices to find latest per (store, product)
                const storeBaskets = {}; // { storeId: { total: 0, missing: [], found: [], storeName: '' } }

                // 1. Group latest prices by store
                // We manually filter to get only the LATEST price for each product in each store
                const latestPrices = {}; // Key: "storeId_productId"

                prices.forEach(p => {
                    const key = `${p.store_id}_${p.product_id}`;
                    if (!latestPrices[key]) {
                        latestPrices[key] = p; // First one seen is latest due to sort
                    }
                });

                // 2. Build baskets
                Object.values(latestPrices).forEach(p => {
                    const storeId = p.store_id;
                    const storeName = p.stores?.name;

                    if (!storeBaskets[storeId]) {
                        storeBaskets[storeId] = {
                            storeId,
                            storeName,
                            totalPrice: 0,
                            foundItems: [], // { productId, price }
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

                // 3. Calculate missing items and format result
                const results = Object.values(storeBaskets).map(basket => {
                    const foundIds = new Set(basket.foundItems.map(i => i.productId));
                    const missingItems = items.filter(i => !foundIds.has(i.productId));

                    return {
                        ...basket,
                        missingCount: missingItems.length,
                        completeness: (basket.foundCount / items.length) * 100
                    };
                });

                // 4. Sort by: Completeness (desc), then Price (asc)
                results.sort((a, b) => {
                    if (b.completeness !== a.completeness) return b.completeness - a.completeness;
                    return a.totalPrice - b.totalPrice;
                });

                setComparison(results);

            } catch (err) {
                console.error("Error comparing prices:", err);
            } finally {
                setLoadingComparison(false);
            }
        };

        comparePrices();
    }, [items, supabase]);

    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

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

                {items.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingBasket className="w-10 h-10 text-orange-400" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-700">Votre panier est vide</h3>
                        <p className="mb-6">Ajoutez des produits depuis la recherche ou le scanner pour comparer les prix !</p>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default ShoppingList;
