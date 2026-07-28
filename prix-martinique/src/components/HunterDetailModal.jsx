import React, { useState, useEffect } from 'react';
import { X, Star, Store, Package, Loader2, MapPin, Tag } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ProductDetailModal from './ProductDetailModal';
import FlagFrance from './flags/FlagFrance';

const HunterDetailModal = ({ userId, onClose, onRequireAuth }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [mainlandByProduct, setMainlandByProduct] = useState({});
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [storeFilter, setStoreFilter] = useState(null);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showStorePicker, setShowStorePicker] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState(null);

    useEffect(() => {
        if (!userId) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data: profileData } = await supabase
                    .from('user_profiles')
                    .select('id, display_name, avatar_url, level, points, city')
                    .eq('id', userId)
                    .single();
                setProfile(profileData);

                const { data: rows, error } = await supabase
                    .from('prices')
                    .select('id, price, created_at, store_id, products(id, name, category_id), stores(id, name, city)')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setItems(rows || []);

                const { data: categoriesData } = await supabase
                    .from('categories')
                    .select('*')
                    .order('display_order', { ascending: true });
                setCategories(categoriesData || []);

                // At-a-glance France Hexagonale comparison per item, isolated so a
                // failure here can't break the rest of the card.
                try {
                    const productIds = [...new Set((rows || []).map(r => r.products?.id).filter(Boolean))];
                    if (productIds.length > 0) {
                        const { data: mainlandRows, error: mainlandError } = await supabase
                            .from('prices')
                            .select('product_id, price, mainland_chain')
                            .in('product_id', productIds)
                            .eq('origin_region_code', 'Hexagone');
                        if (mainlandError) throw mainlandError;

                        const byProduct = {};
                        (mainlandRows || []).forEach(r => {
                            if (!byProduct[r.product_id] || r.price < byProduct[r.product_id].price) {
                                byProduct[r.product_id] = { price: r.price, chain: r.mainland_chain };
                            }
                        });
                        setMainlandByProduct(byProduct);
                    } else {
                        setMainlandByProduct({});
                    }
                } catch (mainlandErr) {
                    console.error('Error loading mainland comparison for hunter items:', mainlandErr);
                    setMainlandByProduct({});
                }
            } catch (err) {
                console.error('Error loading hunter detail:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [userId]);

    if (!userId) return null;

    const distinctShops = Array.from(
        items.reduce((map, item) => {
            if (item.store_id != null && !map.has(item.store_id)) {
                map.set(item.store_id, item.stores?.name || 'Magasin inconnu');
            }
            return map;
        }, new Map())
    ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

    const availableCategoryIds = new Set(items.map(i => i.products?.category_id).filter(Boolean));
    const pickerCategories = categories.filter(c => availableCategoryIds.has(c.id));

    const filteredItems = items.filter(item => {
        const matchesCategory = categoryFilter ? item.products?.category_id === categoryFilter : true;
        const matchesStore = storeFilter ? item.store_id === storeFilter : true;
        return matchesCategory && matchesStore;
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-orange-500 to-red-600 p-6 pt-10 text-white flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl font-bold">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                            ) : (
                                profile?.level || 1
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold leading-tight truncate">
                                {profile?.display_name || 'Chasseur'}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Star className="w-3 h-3" /> {profile?.points ?? 0} pts
                                </span>
                                {profile?.city && (
                                    <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {profile.city}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                            <p className="text-sm text-gray-500">Chargement...</p>
                        </div>
                    ) : (
                        <>
                            {/* Headline stats, at the top as requested -- both clickable filters */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setShowCategoryPicker(v => !v); setShowStorePicker(false); }}
                                    className={`rounded-2xl p-3 text-center border transition-colors ${categoryFilter || showCategoryPicker
                                        ? 'bg-orange-100 border-orange-300'
                                        : 'bg-orange-50 border-orange-100 hover:bg-orange-100'
                                        }`}
                                >
                                    <div className="text-xl font-black text-orange-600">{items.length}</div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-orange-400 mt-1">Prix collectés</p>
                                </button>
                                <button
                                    onClick={() => { setShowStorePicker(v => !v); setShowCategoryPicker(false); }}
                                    className={`rounded-2xl p-3 text-center border transition-colors ${storeFilter || showStorePicker
                                        ? 'bg-blue-100 border-blue-300'
                                        : 'bg-blue-50 border-blue-100 hover:bg-blue-100'
                                        }`}
                                >
                                    <div className="text-xl font-black text-blue-600">{distinctShops.length}</div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-blue-400 mt-1">Magasins visités</p>
                                </button>
                            </div>

                            {/* Category picker overlay */}
                            {showCategoryPicker && (
                                <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 animate-in fade-in slide-in-from-top-2">
                                    {pickerCategories.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-2">Aucune catégorie disponible.</p>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-3">
                                            {pickerCategories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => { setCategoryFilter(cat.id); setShowCategoryPicker(false); }}
                                                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-orange-50 transition-colors"
                                                >
                                                    <span className="text-2xl">{cat.icon}</span>
                                                    <span className="text-[10px] text-gray-600 font-medium text-center leading-tight">{cat.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Store picker overlay */}
                            {showStorePicker && (
                                <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                    {distinctShops.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-2">Aucun magasin disponible.</p>
                                    ) : (
                                        distinctShops.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => { setStoreFilter(s.id); setShowStorePicker(false); }}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-gray-700 transition-colors flex items-center gap-2"
                                            >
                                                <Store className="w-4 h-4 text-gray-400 flex-shrink-0" /> {s.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Active filter chips */}
                            {(categoryFilter || storeFilter) && (
                                <div className="flex flex-wrap gap-2">
                                    {categoryFilter && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                            <Tag className="w-3.5 h-3.5 text-orange-600" />
                                            <span className="text-xs font-medium text-orange-800">
                                                {categories.find(c => c.id === categoryFilter)?.name}
                                            </span>
                                            <button onClick={() => setCategoryFilter(null)} className="p-0.5 hover:bg-orange-100 rounded-full text-orange-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    {storeFilter && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                            <Store className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="text-xs font-medium text-blue-800">
                                                {distinctShops.find(s => s.id === storeFilter)?.name}
                                            </span>
                                            <button onClick={() => setStoreFilter(null)} className="p-0.5 hover:bg-blue-100 rounded-full text-blue-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Collected products list */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-orange-500" /> Produits collectés
                                </h3>
                                {filteredItems.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredItems.map(item => {
                                            const mainland = mainlandByProduct[item.products?.id];
                                            const diff = mainland ? item.price - mainland.price : null;
                                            const pct = mainland ? (diff / mainland.price) * 100 : null;
                                            const isCheaper = diff != null && diff < 0;

                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => setSelectedProductId(item.products?.id)}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white cursor-pointer hover:shadow-md hover:border-orange-200 active:scale-[0.99] transition-all"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate">{item.products?.name || 'Produit inconnu'}</p>
                                                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                            <Store className="w-2.5 h-2.5" /> {item.stores?.name || 'Magasin inconnu'}
                                                        </p>
                                                        {mainland ? (
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${isCheaper ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                <FlagFrance className="w-3 h-3" />
                                                                {mainland.price.toFixed(2)}€ · {diff > 0 ? '+' : ''}{diff.toFixed(2)}€ ({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 bg-gray-100 text-gray-400">
                                                                <FlagFrance className="w-3 h-3" /> Pas encore dispo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-right flex-shrink-0 pl-2">
                                                        <div className="text-base font-black tabular-nums text-gray-900">{item.price.toFixed(2)}€</div>
                                                        <p className="text-[10px] text-gray-400">
                                                            {new Date(item.created_at).toLocaleDateString('fr-FR')}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400">Aucun prix collecté pour le moment.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {selectedProductId && (
                <ProductDetailModal
                    productId={selectedProductId}
                    onClose={() => setSelectedProductId(null)}
                    onRequireAuth={onRequireAuth}
                />
            )}
        </div>
    );
};

export default HunterDetailModal;
