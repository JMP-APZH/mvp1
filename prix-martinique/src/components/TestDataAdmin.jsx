import React, { useState, useEffect } from 'react';
import { Loader2, Package, FlaskConical, Search, RotateCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const FILTERS = [
    { value: 'all', label: 'Tous' },
    { value: 'real', label: 'Réels' },
    { value: 'test', label: 'Test' },
];

const TestDataAdmin = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [togglingId, setTogglingId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data: productRows, error: productsError } = await supabase
                .from('products')
                .select('id, name, is_test_data, categories(name, icon)')
                .order('name', { ascending: true });
            if (productsError) throw productsError;

            const productIds = (productRows || []).map(p => p.id);
            let priceRows = [];
            if (productIds.length > 0) {
                const { data, error: pricesError } = await supabase
                    .from('prices')
                    .select('product_id, price, created_at, product_photo_url, stores(name)')
                    .in('product_id', productIds)
                    .order('created_at', { ascending: false });
                if (pricesError) throw pricesError;
                priceRows = data || [];
            }

            // Keep only the most recent price row per product (first wins, thanks
            // to the descending sort above), plus a total-scan count per product.
            const latestByProduct = {};
            const countByProduct = {};
            priceRows.forEach(row => {
                countByProduct[row.product_id] = (countByProduct[row.product_id] || 0) + 1;
                if (!latestByProduct[row.product_id]) latestByProduct[row.product_id] = row;
            });

            setProducts((productRows || []).map(p => ({
                id: p.id,
                name: p.name,
                isTestData: p.is_test_data,
                categoryName: p.categories?.name || null,
                categoryIcon: p.categories?.icon || null,
                scanCount: countByProduct[p.id] || 0,
                latestPrice: latestByProduct[p.id]?.price ?? null,
                latestStore: latestByProduct[p.id]?.stores?.name || null,
                photoUrl: latestByProduct[p.id]?.product_photo_url || null,
            })));
        } catch (err) {
            console.error('Error loading products for test-flag admin:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggleTestFlag = async (product) => {
        setTogglingId(product.id);
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_test_data: !product.isTestData })
                .eq('id', product.id);
            if (error) throw error;
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isTestData: !p.isTestData } : p));
        } catch (err) {
            console.error('Error toggling test flag:', err);
        } finally {
            setTogglingId(null);
        }
    };

    const filtered = products.filter(p => {
        if (filter === 'real' && p.isTestData) return false;
        if (filter === 'test' && !p.isTestData) return false;
        if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
        return true;
    });

    const realCount = products.filter(p => !p.isTestData).length;
    const testCount = products.filter(p => p.isTestData).length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Chargement...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-xs text-orange-800 flex items-start gap-2">
                <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                    Marquez les produits créés pour des tests/démos plutôt que par de vrais utilisateurs.
                    Les produits marqués "Test" restent en base (rien n'est supprimé) mais sont exclus du fil
                    Comparer vu par les utilisateurs -- utile pour garder l'app propre sans perdre l'historique.
                </p>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                <span>{realCount} produit{realCount > 1 ? 's' : ''} réel{realCount > 1 ? 's' : ''}</span>
                <span className="text-orange-600">{testCount} marqué{testCount > 1 ? 's' : ''} test</span>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Chercher un produit..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
            </div>

            <div className="flex gap-2">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${filter === f.value
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun produit ne correspond à ce filtre.</p>
            ) : (
                <div className="space-y-2">
                    {filtered.map(product => (
                        <div
                            key={product.id}
                            className={`flex items-center gap-3 p-3 rounded-2xl border ${product.isTestData ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {product.photoUrl ? (
                                    <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="w-5 h-5 text-gray-300" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                                    {product.isTestData && (
                                        <span className="text-[9px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full flex-shrink-0">TEST</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">
                                    {product.categoryName ? `${product.categoryName} · ` : ''}
                                    {product.scanCount} prix{product.latestStore ? ` · ${product.latestStore}` : ''}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                {product.latestPrice != null && (
                                    <span className="text-sm font-bold text-gray-900">{product.latestPrice.toFixed(2)}€</span>
                                )}
                                <button
                                    onClick={() => toggleTestFlag(product)}
                                    disabled={togglingId === product.id}
                                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${product.isTestData
                                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                        }`}
                                >
                                    {togglingId === product.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : product.isTestData ? (
                                        <><RotateCcw className="w-3 h-3" /> Remettre en réel</>
                                    ) : (
                                        <><FlaskConical className="w-3 h-3" /> Marquer test</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TestDataAdmin;
