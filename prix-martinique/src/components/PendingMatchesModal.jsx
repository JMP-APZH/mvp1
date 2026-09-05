import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Tag, Store, PartyPopper, ArrowRight, ScanLine, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { posthog } from '../posthogClient';
import { MAINLAND_CHAINS } from '../constants/mainlandChains';
import FlagFrance from './flags/FlagFrance';
import FlagMartinique from './flags/FlagMartinique';

const CHANNEL_LABELS = {
    diaspora_scan: 'Scanné par la diaspora',
    chain_app_screenshot: "Capture app de l'enseigne",
    online_capture: 'Trouvé en ligne',
};

const DIRECTIONS = {
    mtq_to_france: {
        label: 'À scanner en France',
        rpc: 'public_pending_mtq_to_france',
        emptyTitle: 'Tout est comparé !',
        emptyBody: 'Aucun produit martiniquais n\'attend un prix France Hexagonale pour ce filtre.',
        banner: "Ces produits ont un prix en Martinique mais aucun prix France Hexagonale. Si vous (ou un proche) êtes en France, scannez-les -- idéalement dans la même enseigne -- pour compléter la comparaison.",
    },
    france_to_mtq: {
        label: 'À scanner en Martinique',
        rpc: 'public_pending_france_to_mtq',
        emptyTitle: 'Tout est comparé !',
        emptyBody: 'Aucun produit France Hexagonale n\'attend un prix Martinique pour ce filtre.',
        banner: 'Ces produits ont un prix en France Hexagonale mais aucun prix Martinique. Si vous êtes en Martinique, scannez-les pour compléter la comparaison.',
    },
};

// Normalizes both RPC shapes (public_pending_mtq_to_france / public_pending_france_to_mtq)
// into one shape the list/cards render, so the JSX below doesn't branch on direction.
const normalize = (row, direction) => direction === 'mtq_to_france'
    ? {
        productId: row.product_id,
        productName: row.product_name,
        photoUrl: row.photo_url,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryIcon: row.category_icon,
        price: row.mtq_price,
        chain: row.suggested_chain,
        contextLabel: row.store_name ? `Vu à ${row.store_name}` : null,
        date: row.scanned_at,
    }
    : {
        productId: row.product_id,
        productName: row.product_name,
        photoUrl: row.photo_url,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryIcon: row.category_icon,
        price: row.france_price,
        chain: row.chain,
        contextLabel: CHANNEL_LABELS[row.channel] || null,
        date: row.captured_at,
    };

const PendingMatchesModal = ({ onClose, categories, onScanRequest }) => {
    const [direction, setDirection] = useState('mtq_to_france');
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [chainFilter, setChainFilter] = useState(null);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showChainPicker, setShowChainPicker] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setCategoryFilter(null);
            setChainFilter(null);
            try {
                const { data, error } = await supabase.rpc(DIRECTIONS[direction].rpc, {
                    p_category_id: null,
                    p_chain: null,
                    p_limit: 200,
                });
                if (error) throw error;
                if (cancelled) return;
                const normalized = (data || []).map(row => normalize(row, direction));
                setItems(normalized);
                posthog.capture('pending_matches_opened', { direction, item_count: normalized.length });
            } catch (err) {
                console.error('Error loading pending matches (migration may not be applied yet):', err);
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [direction]);

    const filtered = useMemo(() => items.filter(i =>
        (!categoryFilter || i.categoryId === categoryFilter) &&
        (!chainFilter || i.chain === chainFilter)
    ), [items, categoryFilter, chainFilter]);

    const pickerCategories = useMemo(() => {
        const ids = new Set(items.filter(i => !chainFilter || i.chain === chainFilter).map(i => i.categoryId).filter(Boolean));
        return (categories || []).filter(c => ids.has(c.id));
    }, [items, categories, chainFilter]);

    const pickerChains = useMemo(() => {
        const present = new Set(items.filter(i => !categoryFilter || i.categoryId === categoryFilter).map(i => i.chain).filter(Boolean));
        return MAINLAND_CHAINS.filter(c => present.has(c));
    }, [items, categoryFilter]);

    const dir = DIRECTIONS[direction];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ScanLine className="w-5 h-5 text-orange-500" /> Prix en attente de comparaison
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Guidez vos scans là où ils comptent le plus</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors flex-shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 pb-0 flex-shrink-0 space-y-3">
                    {/* Direction toggle */}
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => setDirection('mtq_to_france')}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-md transition-colors ${direction === 'mtq_to_france' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                            <FlagMartinique className="w-4 h-4" /> <ArrowRight className="w-3 h-3" /> <FlagFrance className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('france_to_mtq')}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-md transition-colors ${direction === 'france_to_mtq' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                            <FlagFrance className="w-4 h-4" /> <ArrowRight className="w-3 h-3" /> <FlagMartinique className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-[11px] text-blue-800">
                        {dir.banner}
                    </div>

                    {/* Filter buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowCategoryPicker(v => !v); setShowChainPicker(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${categoryFilter || showCategoryPicker
                                ? 'bg-orange-50 border-orange-300 text-orange-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Tag className="w-4 h-4" /> Catégorie
                        </button>
                        <button
                            onClick={() => { setShowChainPicker(v => !v); setShowCategoryPicker(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${chainFilter || showChainPicker
                                ? 'bg-orange-50 border-orange-300 text-orange-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Store className="w-4 h-4" /> Enseigne
                        </button>
                    </div>

                    {showCategoryPicker && (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 animate-in fade-in slide-in-from-top-2">
                            {pickerCategories.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4">Aucune catégorie parmi les produits en attente{chainFilter ? ' pour cette enseigne' : ''}.</p>
                            ) : (
                                <div className="grid grid-cols-4 gap-3">
                                    {pickerCategories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                setCategoryFilter(cat.id);
                                                setShowCategoryPicker(false);
                                                posthog.capture('pending_matches_filter_applied', { direction, filter: 'category' });
                                            }}
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

                    {showChainPicker && (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-2 animate-in fade-in slide-in-from-top-2">
                            {pickerChains.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4">Aucune enseigne parmi les produits en attente{categoryFilter ? ' pour cette catégorie' : ''}.</p>
                            ) : (
                                pickerChains.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setChainFilter(c);
                                            setShowChainPicker(false);
                                            posthog.capture('pending_matches_filter_applied', { direction, filter: 'chain' });
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 text-sm text-gray-700 transition-colors flex items-center gap-2"
                                    >
                                        <Store className="w-4 h-4 text-gray-400 flex-shrink-0" /> {c}
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {(categoryFilter || chainFilter) && (
                        <div className="flex flex-wrap gap-2">
                            {categoryFilter && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <span className="text-base">{categories.find(c => c.id === categoryFilter)?.icon}</span>
                                    <span className="text-xs font-medium text-orange-800">{categories.find(c => c.id === categoryFilter)?.name}</span>
                                    <button onClick={() => setCategoryFilter(null)} className="p-0.5 hover:bg-orange-100 rounded-full text-orange-600 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            {chainFilter && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <Store className="w-4 h-4 text-orange-600" />
                                    <span className="text-xs font-medium text-orange-800">{chainFilter}</span>
                                    <button onClick={() => setChainFilter(null)} className="p-0.5 hover:bg-orange-100 rounded-full text-orange-600 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
                        <PartyPopper className="w-12 h-12 text-green-400 mb-3" />
                        <p className="text-gray-600 font-medium">{dir.emptyTitle}</p>
                        <p className="text-sm text-gray-400 mt-1">{dir.emptyBody}</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 pt-3 space-y-2">
                        {filtered.map(item => (
                            <div key={item.productId} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                                {item.photoUrl ? (
                                    <img src={item.photoUrl} alt={item.productName} className="w-14 h-14 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">
                                        {item.categoryIcon || '📦'}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="text-xs font-bold text-gray-900 tabular-nums">{Number(item.price).toFixed(2)}€</span>
                                        {item.chain && (
                                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{item.chain}</span>
                                        )}
                                    </div>
                                    {item.contextLabel && (
                                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                            <MapPin className="w-2.5 h-2.5" /> {item.contextLabel}
                                        </p>
                                    )}
                                </div>
                                {onScanRequest && (
                                    <button
                                        onClick={() => onScanRequest(item, direction)}
                                        className="flex-shrink-0 p-2.5 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                                        title="Scanner ce produit"
                                    >
                                        <ScanLine className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingMatchesModal;
