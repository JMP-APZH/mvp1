import React, { useState, useEffect } from 'react';
import { X, ScanLine, Store, TrendingDown, TrendingUp, Leaf, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PriceHistoryChart from './PriceHistoryChart';

const ProductDetailModal = ({ productId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
    const [photoUrl, setPhotoUrl] = useState(null);
    const [stats, setStats] = useState(null);
    const [priceHistory, setPriceHistory] = useState([]);
    const [storeComparison, setStoreComparison] = useState([]);

    useEffect(() => {
        if (!productId) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data: productData } = await supabase
                    .from('products')
                    .select('id, name, barcode, is_local_production, is_mdd, is_declared_bqp')
                    .eq('id', productId)
                    .single();
                setProduct(productData);

                const { data: rows, error } = await supabase
                    .from('prices')
                    .select('price, created_at, store_id, product_photo_url, stores(id, name, city)')
                    .eq('product_id', productId)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const photoRow = [...(rows || [])].reverse().find(r => r.product_photo_url);
                setPhotoUrl(photoRow?.product_photo_url || null);

                const prices = (rows || []).map(r => r.price);
                const distinctShops = new Set((rows || []).filter(r => r.store_id != null).map(r => r.store_id)).size;

                setStats({
                    totalScans: rows?.length || 0,
                    distinctShops,
                    min: prices.length ? Math.min(...prices) : null,
                    max: prices.length ? Math.max(...prices) : null,
                    avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
                });

                setPriceHistory((rows || []).map(r => ({
                    date: new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                    fullDate: new Date(r.created_at).toLocaleDateString('fr-FR'),
                    price: r.price,
                    store: r.stores?.name,
                })));

                // Most recent price per store, sorted cheapest first (unknown-store legacy rows excluded)
                const latestByStore = {};
                (rows || []).filter(r => r.store_id != null).forEach(r => {
                    latestByStore[r.store_id] = r; // rows are ascending by date, so last write wins = most recent
                });
                const comparison = Object.values(latestByStore)
                    .map(r => ({
                        storeId: r.store_id,
                        storeName: r.stores?.name || 'Magasin inconnu',
                        city: r.stores?.city,
                        price: r.price,
                        date: new Date(r.created_at).toLocaleDateString('fr-FR'),
                    }))
                    .sort((a, b) => a.price - b.price);
                setStoreComparison(comparison);
            } catch (err) {
                console.error('Error loading product detail:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [productId]);

    if (!productId) return null;

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
                        <div className="w-16 h-16 rounded-2xl bg-white/20 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {photoUrl ? (
                                <img src={photoUrl} alt={product?.name} className="w-full h-full object-cover" />
                            ) : (
                                <ScanLine className="w-8 h-8 text-white/70" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold leading-tight line-clamp-2">
                                {product?.name || '...'}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {product?.barcode && (
                                    <span className="text-[11px] font-mono text-orange-100 bg-white/10 px-2 py-0.5 rounded">
                                        {product.barcode}
                                    </span>
                                )}
                                {product?.is_local_production && (
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Leaf className="w-3 h-3" /> Local
                                    </span>
                                )}
                                {product?.is_declared_bqp && (
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">BQP</span>
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
                            {/* Headline stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 text-center">
                                    <div className="text-xl font-black text-orange-600">{stats?.totalScans ?? 0}</div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-orange-400 mt-1">Scans</p>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                                    <div className="text-xl font-black text-blue-600">{stats?.distinctShops ?? 0}</div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-blue-400 mt-1">Magasins</p>
                                </div>
                                <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
                                    <div className="text-xl font-black text-green-600">
                                        {stats?.min != null ? `${stats.min.toFixed(2)}€` : '—'}
                                    </div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-green-500 mt-1">Meilleur prix</p>
                                </div>
                            </div>

                            {/* Price trend */}
                            {priceHistory.length >= 2 ? (
                                <PriceHistoryChart data={priceHistory} title="Évolution du prix" />
                            ) : (
                                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4 text-center text-xs text-gray-400">
                                    Pas encore assez de scans pour afficher une tendance.
                                </div>
                            )}

                            {/* Cross-store comparison */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Store className="w-4 h-4 text-orange-500" /> Comparaison en Martinique
                                </h3>
                                {storeComparison.length > 0 ? (
                                    <div className="space-y-2">
                                        {storeComparison.map((s, i) => {
                                            const isCheapest = i === 0 && storeComparison.length > 1;
                                            const isMostExpensive = i === storeComparison.length - 1 && storeComparison.length > 1;
                                            return (
                                                <div
                                                    key={s.storeId}
                                                    className={`flex items-center justify-between p-3 rounded-xl border ${isCheapest ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'
                                                        }`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate">{s.storeName}</p>
                                                        {s.city && (
                                                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                <MapPin className="w-2.5 h-2.5" /> {s.city}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right flex-shrink-0 pl-2">
                                                        <div className={`text-base font-black flex items-center gap-1 justify-end ${isCheapest ? 'text-green-600' : isMostExpensive ? 'text-red-500' : 'text-gray-900'
                                                            }`}>
                                                            {isCheapest && <TrendingDown className="w-3.5 h-3.5" />}
                                                            {isMostExpensive && <TrendingUp className="w-3.5 h-3.5" />}
                                                            {s.price.toFixed(2)}€
                                                        </div>
                                                        <p className="text-[10px] text-gray-400">{s.date}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400">Aucune donnée de magasin disponible.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailModal;
