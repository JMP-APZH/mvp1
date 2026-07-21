import React, { useState, useEffect } from 'react';
import { X, ScanLine, Store, TrendingDown, TrendingUp, Leaf, MapPin, Loader2, MessageSquare, Heart, Share2, Link2, Trophy, Check, Globe2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import PriceHistoryChart from './PriceHistoryChart';
import PriceDuel from './PriceDuel';

const ProductDetailModal = ({ productId, onClose, onRequireAuth }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
    const [photoUrl, setPhotoUrl] = useState(null);
    const [stats, setStats] = useState(null);
    const [priceHistory, setPriceHistory] = useState([]);
    const [storeComparison, setStoreComparison] = useState([]);
    const [mainlandPrices, setMainlandPrices] = useState([]);
    const [comments, setComments] = useState([]);
    const [topHunterIds, setTopHunterIds] = useState(new Set());
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Isolated from the core prices query above: mainland_chain/source_type/source_url
    // are new columns (mainland_price_migration.sql) that may not exist yet on a given
    // environment, so a failure here must not break the rest of the card.
    const loadMainlandPrices = async () => {
        try {
            const { data, error } = await supabase
                .from('prices')
                .select('price, mainland_chain, source_type, source_url, created_at')
                .eq('product_id', productId)
                .eq('origin_region_code', 'Hexagone')
                .order('price', { ascending: true });

            if (error) throw error;

            setMainlandPrices((data || []).map(r => ({
                chain: r.mainland_chain || 'Chaîne inconnue',
                price: r.price,
                sourceType: r.source_type,
                sourceUrl: r.source_url,
                date: new Date(r.created_at).toLocaleDateString('fr-FR'),
            })));
        } catch (err) {
            console.error('Error loading mainland prices:', err);
            setMainlandPrices([]);
        }
    };

    const loadComments = async () => {
        const { data: commentRows, error } = await supabase
            .from('product_comments')
            .select('id, content, created_at, user_id, product_comment_likes(user_id)')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading comments:', error);
            return;
        }

        const userIds = [...new Set((commentRows || []).map(c => c.user_id))];
        let profileByUserId = {};
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, display_name')
                .in('id', userIds);
            profileByUserId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        }

        const enriched = (commentRows || []).map(c => ({
            id: c.id,
            content: c.content,
            createdAt: c.created_at,
            userId: c.user_id,
            authorName: profileByUserId[c.user_id]?.display_name || 'Anonyme',
            likeCount: c.product_comment_likes?.length || 0,
            likedByMe: user ? c.product_comment_likes?.some(l => l.user_id === user.id) : false,
        })).sort((a, b) => b.likeCount - a.likeCount || new Date(b.createdAt) - new Date(a.createdAt));

        setComments(enriched);
    };

    const submitComment = async () => {
        if (!user) {
            onRequireAuth?.();
            return;
        }
        if (!newComment.trim()) return;

        setSubmittingComment(true);
        try {
            const { error } = await supabase
                .from('product_comments')
                .insert([{ product_id: productId, user_id: user.id, content: newComment.trim() }]);
            if (error) throw error;
            setNewComment('');
            await loadComments();
        } catch (err) {
            console.error('Error posting comment:', err);
        } finally {
            setSubmittingComment(false);
        }
    };

    const toggleLike = async (comment) => {
        if (!user) {
            onRequireAuth?.();
            return;
        }
        try {
            if (comment.likedByMe) {
                await supabase.from('product_comment_likes').delete()
                    .eq('comment_id', comment.id).eq('user_id', user.id);
            } else {
                await supabase.from('product_comment_likes').insert([{ comment_id: comment.id, user_id: user.id }]);
            }
            await loadComments();
        } catch (err) {
            console.error('Error toggling comment like:', err);
        }
    };

    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${productId}`;

    const shareWhatsApp = () => {
        const text = `Regarde le prix de "${product?.name || 'ce produit'}" sur Prix Martinique : ${shareUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Error copying link:', err);
        }
    };

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

                const { data: allRows, error } = await supabase
                    .from('prices')
                    .select('price, created_at, store_id, product_photo_url, origin_region_code, stores(id, name, city)')
                    .eq('product_id', productId)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                // France Hexagonale reference prices are a different market entirely --
                // keep them out of the Martinique stats/trend/store-comparison below,
                // and surface them separately as the diaspora price-gap comparison.
                const rows = (allRows || []).filter(r => r.origin_region_code !== 'Hexagone');

                const photoRow = [...rows].reverse().find(r => r.product_photo_url);
                setPhotoUrl(photoRow?.product_photo_url || null);

                const prices = rows.map(r => r.price);
                const distinctShops = new Set(rows.filter(r => r.store_id != null).map(r => r.store_id)).size;

                setStats({
                    totalScans: rows.length,
                    distinctShops,
                    min: prices.length ? Math.min(...prices) : null,
                    max: prices.length ? Math.max(...prices) : null,
                    avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
                });

                setPriceHistory(rows.map(r => ({
                    date: new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                    fullDate: new Date(r.created_at).toLocaleDateString('fr-FR'),
                    price: r.price,
                    store: r.stores?.name,
                })));

                // Most recent price per store, sorted cheapest first (unknown-store legacy rows excluded)
                const latestByStore = {};
                rows.filter(r => r.store_id != null).forEach(r => {
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

                await loadMainlandPrices();

                const { data: topHunters } = await supabase
                    .from('user_profiles')
                    .select('id')
                    .order('points', { ascending: false })
                    .limit(3);
                setTopHunterIds(new Set((topHunters || []).map(h => h.id)));

                await loadComments();
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

                    {/* Share */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={shareWhatsApp}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                        >
                            <Share2 className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        <button
                            onClick={copyLink}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                        >
                            {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                            {linkCopied ? 'Copié !' : 'Copier le lien'}
                        </button>
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

                            {/* Diaspora price comparison */}
                            {stats?.min != null && mainlandPrices.length > 0 && (
                                <PriceDuel
                                    localPrice={stats.min}
                                    mainlandPrice={mainlandPrices[0].price}
                                    productName={product?.name}
                                    mainlandOrigin={mainlandPrices[0].chain}
                                    localStore="Meilleur prix Martinique"
                                />
                            )}

                            {mainlandPrices.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Globe2 className="w-4 h-4 text-blue-500" /> Prix en France Hexagonale
                                    </h3>
                                    <div className="space-y-2">
                                        {mainlandPrices.map((m, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-blue-100 bg-blue-50">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{m.chain}</p>
                                                    <p className="text-[10px] text-gray-500 flex items-center gap-2">
                                                        {m.sourceType === 'admin_reference' ? 'Source en ligne' : 'Scan communautaire'}
                                                        {m.sourceUrl && (
                                                            <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">lien</a>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0 pl-2">
                                                    <div className="text-base font-black text-blue-700">{m.price.toFixed(2)}€</div>
                                                    <p className="text-[10px] text-gray-400">{m.date}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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

                            {/* Comments */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-orange-500" /> Commentaires ({comments.length})
                                </h3>

                                {user ? (
                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                                            placeholder="Ajouter un commentaire..."
                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                        <button
                                            onClick={submitComment}
                                            disabled={submittingComment || !newComment.trim()}
                                            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold px-4 rounded-lg transition-colors"
                                        >
                                            Publier
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onRequireAuth?.()}
                                        className="w-full bg-gray-50 border border-dashed border-gray-200 rounded-lg py-2.5 text-xs text-gray-500 mb-4 hover:bg-gray-100 transition-colors"
                                    >
                                        Connectez-vous pour laisser un commentaire
                                    </button>
                                )}

                                {comments.length > 0 ? (
                                    <div className="space-y-3">
                                        {comments.map(c => (
                                            <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-sm font-bold text-gray-900 truncate">{c.authorName}</span>
                                                        {topHunterIds.has(c.userId) && (
                                                            <span className="flex-shrink-0 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                                <Trophy className="w-2.5 h-2.5" /> Top Chasseur
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 flex-shrink-0 pl-2">
                                                        {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-snug">{c.content}</p>
                                                <button
                                                    onClick={() => toggleLike(c)}
                                                    className={`mt-2 flex items-center gap-1 text-xs font-bold transition-colors ${c.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                                                        }`}
                                                >
                                                    <Heart className={`w-3.5 h-3.5 ${c.likedByMe ? 'fill-red-500' : ''}`} />
                                                    {c.likeCount || 0}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400">Aucun commentaire pour le moment.</p>
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
