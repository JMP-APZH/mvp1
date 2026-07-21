import React, { useState, useEffect } from 'react';
import { X, Star, Store, Package, Loader2, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';

const HunterDetailModal = ({ userId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [items, setItems] = useState([]);
    const [distinctShops, setDistinctShops] = useState(0);

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
                    .select('id, price, created_at, store_id, products(name), stores(name, city)')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setItems(rows || []);
                setDistinctShops(new Set((rows || []).filter(r => r.store_id != null).map(r => r.store_id)).size);
            } catch (err) {
                console.error('Error loading hunter detail:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [userId]);

    if (!userId) return null;

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
                            {/* Headline stats, at the top as requested */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 text-center">
                                    <div className="text-xl font-black text-orange-600">{items.length}</div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-orange-400 mt-1">Prix collectés</p>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                                    <div className="text-xl font-black text-blue-600">{distinctShops}</div>
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-blue-400 mt-1">Magasins visités</p>
                                </div>
                            </div>

                            {/* Collected products list */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-orange-500" /> Produits collectés
                                </h3>
                                {items.length > 0 ? (
                                    <div className="space-y-2">
                                        {items.map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{item.products?.name || 'Produit inconnu'}</p>
                                                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Store className="w-2.5 h-2.5" /> {item.stores?.name || 'Magasin inconnu'}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0 pl-2">
                                                    <div className="text-base font-black text-gray-900">{item.price.toFixed(2)}€</div>
                                                    <p className="text-[10px] text-gray-400">
                                                        {new Date(item.created_at).toLocaleDateString('fr-FR')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400">Aucun prix collecté pour le moment.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HunterDetailModal;
