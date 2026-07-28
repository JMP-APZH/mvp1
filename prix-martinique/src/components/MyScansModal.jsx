import React, { useState, useEffect } from 'react';
import { X, Loader2, Package, ScanLine, Star, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { posthog } from '../posthogClient';

// "il y a X" -- kept coarse (days, not hours/minutes) since a price's
// relevance is about staleness for re-verification, not precise timing.
const formatRelativeDate = (dateStr) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 30) return `Il y a ${days} jours`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Il y a ${months} mois`;
    return `Il y a ${Math.floor(months / 12)} an${months >= 24 ? 's' : ''}`;
};

const MyScansModal = ({ onClose, onAddItem, shoppingListItems }) => {
    const { user, userFavorites, toggleFavorite } = useAuth();
    const [loading, setLoading] = useState(true);
    const [scans, setScans] = useState([]);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('prices')
                    .select('id, product_id, price, created_at, product_photo_url, products(name), stores(name)')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(200);

                if (error) throw error;
                setScans(data || []);
                posthog.capture('my_scans_opened', { scan_count: data?.length || 0 });
            } catch (err) {
                console.error('Error loading my scans:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    const isInPanier = (productId) => shoppingListItems?.some(i => i.productId === productId);

    const handleAdd = (scan) => {
        onAddItem?.({ id: scan.product_id, name: scan.products?.name, productPhotoUrl: scan.product_photo_url });
        posthog.capture('my_scans_item_added_to_panier', { product_id: scan.product_id });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Mes Scans</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Tous vos prix partagés avec la communauté</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : scans.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
                        <ScanLine className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-600 font-medium">Vous n'avez pas encore scanné de prix</p>
                        <p className="text-sm text-gray-400 mt-1">Direction l'onglet Scanner pour contribuer votre premier prix !</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {scans.map(scan => {
                            const inPanier = isInPanier(scan.product_id);
                            const isFavorite = userFavorites?.has(scan.product_id);
                            return (
                                <div key={scan.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                        {scan.product_photo_url ? (
                                            <img src={scan.product_photo_url} alt={scan.products?.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Package className="w-5 h-5 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{scan.products?.name || 'Produit inconnu'}</p>
                                        <p className="text-xs text-gray-500 truncate">{scan.stores?.name || 'Magasin inconnu'}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeDate(scan.created_at)}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <span className="text-sm font-bold text-gray-900">{scan.price?.toFixed(2)}€</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => toggleFavorite(scan.product_id)}
                                                className={`p-1.5 rounded-lg transition-colors ${isFavorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                                title="Ajouter aux favoris"
                                            >
                                                <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
                                            </button>
                                            <button
                                                onClick={() => handleAdd(scan)}
                                                disabled={inPanier}
                                                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${inPanier
                                                    ? 'bg-green-50 text-green-600'
                                                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                                    }`}
                                            >
                                                {inPanier ? <><Check className="w-3 h-3" /> Ajouté</> : '+ Panier'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyScansModal;
