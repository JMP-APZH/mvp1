import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    Award,
    History,
    ChevronRight,
    Zap,
    Target,
    Info,
    ArrowBigUp,
    Store,
    Calendar,
    Wallet,
    Download,
    ShieldAlert,
    Clock
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/useAuth';
import { calculateSavings } from '../utils/userStats';
import { exportUserData, downloadUserDataAsJson } from '../utils/dataExport';
import { requestAccountDeletion, getMyDeletionRequest } from '../utils/accountDeletion';

const PersoStats = ({ onClose }) => {
    const { user, userProfile, userBadges } = useAuth();
    const [stats, setStats] = useState({
        firstScan: null,
        totalUpdates: 0,
        estimatedSavings: 0,
        bestOffers: []
    });
    const [, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [deletionRequest, setDeletionRequest] = useState(null);
    const [confirmingDeletion, setConfirmingDeletion] = useState(false);
    const [requestingDeletion, setRequestingDeletion] = useState(false);

    useEffect(() => {
        if (!user) return;
        getMyDeletionRequest(user.id).then(setDeletionRequest);
    }, [user]);

    const handleExport = async () => {
        if (!user) return;
        setExporting(true);
        try {
            const data = await exportUserData(user, userProfile);
            downloadUserDataAsJson(data);
        } catch (err) {
            console.error('Failed to export user data:', err);
        } finally {
            setExporting(false);
        }
    };

    const handleRequestDeletion = async () => {
        if (!user) return;
        setRequestingDeletion(true);
        try {
            await requestAccountDeletion(user);
            setDeletionRequest({ status: 'pending', requested_at: new Date().toISOString() });
            setConfirmingDeletion(false);
        } catch (err) {
            console.error('Failed to request account deletion:', err);
        } finally {
            setRequestingDeletion(false);
        }
    };

    useEffect(() => {
        const fetchPersonalData = async () => {
            if (!user) return;

            setLoading(true);
            try {
                // 1. Fetch first scan date
                const { data: firstScan } = await supabase
                    .from('prices')
                    .select('created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();

                // 2. Fetch total updates/confirmations
                const { count: updatesCount } = await supabase
                    .from('prices')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                // 3. Fetch best offers for favorite stores
                let bestOffersData = [];
                if (userProfile?.id) {
                    const { data: favoriteStores } = await supabase
                        .from('user_favorite_stores')
                        .select('store_id')
                        .eq('user_id', userProfile.id);

                    if (favoriteStores?.length > 0) {
                        const storeIds = favoriteStores.map(s => s.store_id);
                        const { data: offers } = await supabase
                            .from('prices')
                            .select(`
                  id,
                  price,
                  created_at,
                  products(name, barcode),
                  stores(name)
                `)
                            .in('store_id', storeIds)
                            .order('price', { ascending: true })
                            .limit(3);
                        bestOffersData = offers || [];
                    }
                }

                // 4. "Mes économies" -- shared calculation, see userStats.js.
                const savings = await calculateSavings(supabase, user.id);

                setStats({
                    firstScan: firstScan?.created_at,
                    totalUpdates: updatesCount || 0,
                    estimatedSavings: savings,
                    bestOffers: bestOffersData
                });
            } catch (err) {
                console.error("Error fetching stats:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPersonalData();
    }, [user, userProfile]);

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-50 z-[200] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-white border-b px-4 py-4 pt-12 flex items-center justify-between sticky top-0 z-10">
                <button onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                    <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <h2 className="text-xl font-bold font-display text-gray-900">Mon Impact</h2>
                <div className="w-10"></div> {/* Spacer for symmetry */}
            </div>

            <div className="flex-1 overflow-y-auto pb-24">
                {/* Banner Section */}
                <div className="bg-gradient-to-br from-orange-500 to-red-600 px-6 py-8 text-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                            {userProfile?.avatar_url ? (
                                <img src={userProfile.avatar_url} className="w-full h-full rounded-2xl object-cover" />
                            ) : "👤"}
                        </div>
                        <div>
                            <p className="text-orange-100 text-sm font-medium">Contributeur depuis</p>
                            <h3 className="text-lg font-bold">{formatDate(stats.firstScan)}</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                            <div className="text-3xl font-black mb-1">{stats.estimatedSavings.toFixed(2)}€</div>
                            <p className="text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1">
                                <Wallet className="w-3 h-3" /> Mes Économies
                            </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                            <div className="text-3xl font-black mb-1">{stats.totalUpdates}</div>
                            <p className="text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Prix partagés
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Tabs/Sections */}
                <div className="p-6 space-y-8">

                    {/* Badge Progression */}
                    <section>
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Award className="w-5 h-5 text-orange-500" /> Mes Badges
                            </h3>
                            <span className="text-xs font-bold text-orange-500">{userBadges.length} obtenus</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                            {userBadges.map((ub) => (
                                <div key={ub.id} className="flex-shrink-0 w-24 text-center group">
                                    <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center text-4xl mb-2 border-2 border-amber-200 group-hover:scale-110 transition-transform">
                                        {ub.badges?.icon}
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-700 leading-tight">{ub.badges?.name}</p>
                                </div>
                            ))}
                            {/* Empty placeholder if no badges */}
                            {userBadges.length === 0 && (
                                <div className="w-full py-8 text-center bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 text-sm">Continuez à contribuer pour gagner des badges !</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Savings Information */}
                    <section className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
                                <Info className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-900 mb-1">Comment c'est calculé ?</h4>
                                <p className="text-sm text-blue-800/80 leading-relaxed">
                                    Pour chaque produit que vous avez scanné, on compare votre prix au prix moyen observé pour ce même produit sur les 12 derniers mois (tous magasins confondus), et on additionne les écarts positifs. Un produit que vous êtes seul(e) à avoir scanné n'a pas encore assez de données pour être comparé.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Best offers for my shops */}
                    <section>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                            <Store className="w-5 h-5 text-orange-500" /> Meilleures offres (Mes Magasins)
                        </h3>
                        {stats.bestOffers.length > 0 ? (
                            <div className="space-y-3">
                                {stats.bestOffers.map(offer => (
                                    <div key={offer.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{offer.products?.name}</p>
                                            <p className="text-[10px] text-gray-500">{offer.stores?.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-green-600">{offer.price.toFixed(2)}€</div>
                                            <p className="text-[10px] text-gray-400">{formatDate(offer.created_at)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-100 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                                <p className="text-gray-500 text-sm">Configurez vos magasins favoris dans votre profil pour voir les meilleures offres locales.</p>
                            </div>
                        )}
                    </section>

                    {/* Confidentialité & mon compte -- GDPR export/deletion */}
                    <section className="bg-white border border-gray-100 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Confidentialité & mon compte</h3>

                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors disabled:opacity-50 mb-3"
                        >
                            <div className="flex items-center gap-3 text-left">
                                <Download className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">Télécharger mes données</p>
                                    <p className="text-xs text-gray-500">Export JSON de vos contributions, favoris et badges</p>
                                </div>
                            </div>
                            {exporting && <span className="text-xs text-gray-400">Préparation...</span>}
                        </button>

                        {deletionRequest?.status === 'pending' ? (
                            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800">
                                    Demande de suppression envoyée le {formatDate(deletionRequest.requested_at)}.
                                    Elle sera traitée sous peu et vous recevrez une confirmation par email.
                                </p>
                            </div>
                        ) : !confirmingDeletion ? (
                            <button
                                onClick={() => setConfirmingDeletion(true)}
                                className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-red-50 rounded-2xl transition-colors text-left"
                            >
                                <ShieldAlert className="w-5 h-5 text-red-500" />
                                <p className="font-bold text-gray-900 text-sm">Supprimer mon compte</p>
                            </button>
                        ) : (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3">
                                <p className="text-sm text-red-800">
                                    Votre compte et vos données privées (favoris, listes) seront supprimés.
                                    Vos prix soumis resteront visibles, mais anonymisés. Cette action est
                                    traitée manuellement sous 30 jours maximum, conformément au RGPD.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setConfirmingDeletion(false)}
                                        className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg font-medium text-sm hover:bg-gray-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleRequestDeletion}
                                        disabled={requestingDeletion}
                                        className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {requestingDeletion ? 'Envoi...' : 'Confirmer la suppression'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <div className="p-4 bg-white border-t sticky bottom-0">
                <button
                    onClick={onClose}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-lg shadow-gray-200 active:scale-[0.98] transition-all"
                >
                    Retour à l'accueil
                </button>
            </div>
        </div>
    );
};

export default PersoStats;
