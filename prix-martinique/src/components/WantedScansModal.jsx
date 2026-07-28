import React, { useState, useEffect } from 'react';
import { X, Loader2, Target, Users, Store, PartyPopper } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { posthog } from '../posthogClient';
import { getWantedScans } from '../utils/scanRequests';

const WantedScansModal = ({ onClose }) => {
    const { user, userFavoriteStores } = useAuth();
    const [loading, setLoading] = useState(true);
    const [wanted, setWanted] = useState([]);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            setLoading(true);
            try {
                const storeIds = [...(userFavoriteStores || [])];
                const results = await getWantedScans(supabase, storeIds);
                setWanted(results);
                posthog.capture('wanted_scans_opened', { wanted_count: results.length, favorite_store_count: storeIds.length });
            } catch (err) {
                console.error('Error loading wanted scans:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user, userFavoriteStores]);

    const hasFavoriteStores = (userFavoriteStores?.size || 0) > 0;

    const groupedByStore = wanted.reduce((acc, item) => {
        if (!acc[item.storeId]) acc[item.storeId] = { storeName: item.storeName, items: [] };
        acc[item.storeId].items.push(item);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Target className="w-5 h-5 text-orange-500" /> Prix recherchés
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Aidez la communauté à compléter ces prix dans vos magasins</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : !hasFavoriteStores ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
                        <Store className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-600 font-medium">Ajoutez des magasins habituels</p>
                        <p className="text-sm text-gray-400 mt-1">Configurez vos 3 magasins habituels dans votre profil pour voir les prix recherchés par la communauté.</p>
                    </div>
                ) : wanted.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
                        <PartyPopper className="w-12 h-12 text-green-400 mb-3" />
                        <p className="text-gray-600 font-medium">Bravo, tout est à jour !</p>
                        <p className="text-sm text-gray-400 mt-1">Tous les prix demandés par la communauté sont déjà couverts dans vos magasins habituels.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                        {Object.values(groupedByStore).map(group => (
                            <div key={group.storeName}>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <Store className="w-3.5 h-3.5 text-blue-500" /> {group.storeName}
                                </h4>
                                <div className="space-y-2">
                                    {group.items.map(item => (
                                        <div key={item.productId} className="flex items-center justify-between bg-gray-50 rounded-2xl p-3">
                                            <p className="text-sm font-bold text-gray-900 truncate flex-1 min-w-0">{item.productName}</p>
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                                                <Users className="w-3 h-3" />
                                                {item.favoriteCount} {item.favoriteCount > 1 ? 'personnes' : 'personne'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-gray-400 text-center pt-2">
                            Scannez ces produits dans le magasin correspondant pour gagner des points et aider la communauté !
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WantedScansModal;
