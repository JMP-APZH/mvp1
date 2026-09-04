import React, { useState, useEffect } from 'react';
import { X, Star, Store, Package, Loader2, MapPin, Tag, Share2, Copy, Check, Flag } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/useAuth';
import { posthog } from '../posthogClient';
import ProductDetailModal from './ProductDetailModal';
import FlagFrance from './flags/FlagFrance';
import Avatar from './Avatar';

const REPORT_REASONS = [
    { value: 'impersonation', label: 'Usurpation d’identité' },
    { value: 'offensive', label: 'Contenu offensant' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Autre' },
];

const HunterDetailModal = ({ userId, onClose, onRequireAuth }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [reportReason, setReportReason] = useState('impersonation');
    const [reportDetails, setReportDetails] = useState('');
    const [reportBusy, setReportBusy] = useState(false);
    const [reportDone, setReportDone] = useState(false);
    const [reportError, setReportError] = useState(false);
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

                // Profile-card fields (bio/status/visibility) live behind
                // profile_card_migration.sql -- query them separately and
                // tolerate their absence so this card keeps working before the
                // migration is applied (same isolation pattern as the mainland
                // and test-flag queries elsewhere in this codebase).
                let cardFields = {};
                try {
                    const { data: extra, error: extraErr } = await supabase
                        .from('user_profiles')
                        .select('bio, status_text, status_updated_at, is_profile_public')
                        .eq('id', userId)
                        .single();
                    if (extraErr) throw extraErr;
                    cardFields = extra || {};
                } catch (cardErr) {
                    console.warn('Profile card fields unavailable (migration pending?):', cardErr.message);
                }

                setProfile(profileData ? { ...profileData, ...cardFields } : null);
                posthog.capture('profile_viewed', { via_share_link: new URLSearchParams(window.location.search).get('user') === userId });

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

    const isPublic = profile?.is_profile_public !== false;
    const showAvatar = isPublic && profile?.avatar_url;
    const shareUrl = `${window.location.origin}${window.location.pathname}?user=${userId}`;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Error copying profile link:', err);
        }
    };

    const shareWhatsApp = () => {
        const text = `Découvre les contributions de ${profile?.display_name || 'ce chasseur'} sur Prix Martinique : ${shareUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const submitReport = async () => {
        if (!user) { onRequireAuth?.(); return; }
        setReportBusy(true);
        setReportError(false);
        try {
            const { error } = await supabase.from('profile_reports').insert([{
                reported_user_id: userId,
                reporter_id: user.id,
                reason: reportReason,
                details: reportDetails.trim() || null,
            }]);
            if (error) throw error;
            posthog.capture('profile_report_submitted', { reason: reportReason });
            setReportDone(true);
            setTimeout(() => { setShowReport(false); setReportDone(false); setReportDetails(''); }, 1500);
        } catch (err) {
            console.error('Error submitting profile report:', err);
            posthog.captureException(err, { context: 'profile_report_submit' });
            setReportError(true);
        } finally {
            setReportBusy(false);
        }
    };

    const isOwnProfile = user?.id === userId;

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
                        <Avatar
                            src={showAvatar ? profile.avatar_url : null}
                            name={profile?.display_name || 'Chasseur'}
                            size={64}
                            rounded="rounded-2xl"
                            fallbackClassName="bg-white/20 text-white"
                        />
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold leading-tight truncate">
                                {profile?.display_name || 'Chasseur'}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Star className="w-3 h-3" /> {profile?.points ?? 0} pts
                                </span>
                                <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                    Niv.&nbsp;{profile?.level || 1}
                                </span>
                                {profile?.city && (
                                    <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {profile.city}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {isPublic && profile?.status_text && (
                        <p className="mt-3 text-sm text-white/90 italic">« {profile.status_text} »</p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                        <button
                            onClick={shareWhatsApp}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-full transition-colors"
                        >
                            <Share2 className="w-3.5 h-3.5" /> Partager
                        </button>
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-full transition-colors"
                        >
                            {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {linkCopied ? 'Copié' : 'Copier le lien'}
                        </button>
                        {!isOwnProfile && (
                            <button
                                onClick={() => (user ? setShowReport(v => !v) : onRequireAuth?.())}
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-full transition-colors ml-auto"
                            >
                                <Flag className="w-3.5 h-3.5" /> Signaler
                            </button>
                        )}
                    </div>

                    {showReport && (
                        <div className="mt-3 bg-white text-gray-800 rounded-xl p-3 space-y-2">
                            {reportDone ? (
                                <p className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                                    <Check className="w-4 h-4" /> Merci, votre signalement a été transmis.
                                </p>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Signaler ce profil</p>
                                    {reportError && (
                                        <p className="text-xs text-red-600">Envoi impossible. Réessayez plus tard.</p>
                                    )}
                                    <select
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                    <textarea
                                        value={reportDetails}
                                        maxLength={500}
                                        rows={2}
                                        onChange={(e) => setReportDetails(e.target.value)}
                                        placeholder="Détails (facultatif)"
                                        className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={submitReport}
                                            disabled={reportBusy}
                                            className="flex-1 bg-orange-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                                        >
                                            {reportBusy ? 'Envoi...' : 'Envoyer'}
                                        </button>
                                        <button
                                            onClick={() => setShowReport(false)}
                                            className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg hover:bg-gray-200"
                                        >
                                            Annuler
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                            <p className="text-sm text-gray-500">Chargement...</p>
                        </div>
                    ) : (
                        <>
                            {isPublic && profile?.bio && (
                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-2xl p-3 whitespace-pre-line">
                                    {profile.bio}
                                </p>
                            )}

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
