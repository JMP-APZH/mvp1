import React, { useState, useEffect } from 'react';
import { ScanLine, Flag, RefreshCw, CheckCircle2, Loader2, AlertTriangle, UserCheck, ShieldCheck, X, ZoomIn, Tag, PackageSearch, Send, MessageSquareWarning } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/useAuth';

const STATUS_BADGES = {
    flagged: { label: 'Signalé', className: 'bg-amber-100 text-amber-700' },
    corrected_by_admin: { label: 'Corrigé par admin', className: 'bg-green-100 text-green-700' },
    recapture_requested: { label: 'Re-capture demandée', className: 'bg-blue-100 text-blue-700' },
    resolved: { label: 'Résolu', className: 'bg-gray-100 text-gray-600' },
};

// Quick-fill reasons for the "Signaler à l'auteur" composer -- covers the two
// incomplete-submission cases this tool exists to catch (see
// product_completion_and_messaging_migration.sql's header for the Charbonnier
// Laurent no-photo case that prompted this whole feature).
const QUICK_REASONS = {
    review: [
        {
            label: 'Code-barres illisible sur la photo',
            subject: 'Photo à reprendre : code-barres',
            body: "Merci pour votre contribution ! La photo du dos du produit ne permet pas de lire le code-barres. Pourriez-vous la reprendre la prochaine fois que vous verrez ce produit ?",
        },
        {
            label: 'Photo produit floue ou incomplète',
            subject: 'Photo à reprendre : produit',
            body: "Merci pour votre contribution ! La photo du produit ne montre pas clairement la marque et le nom. Pourriez-vous la reprendre la prochaine fois ?",
        },
    ],
    pending: [
        {
            label: 'Rappel : prix à ajouter',
            subject: 'Prix à compléter',
            body: "Vous avez enregistré ce produit avec ses photos, merci ! N'oubliez pas d'ajouter son prix la prochaine fois que vous serez dans ce magasin -- ou un autre contributeur pourra le faire à votre place.",
        },
    ],
};

// One "Signaler à l'auteur" composer, shared by both tabs below.
const MessageComposer = ({ target, onSend, onCancel, sending, sendError }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const reasons = QUICK_REASONS[target.tab] || [];

    return (
        <div className="border-t border-gray-100 bg-blue-50 p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                <MessageSquareWarning className="w-3.5 h-3.5" /> Signaler à l'auteur
            </p>
            <div className="flex flex-wrap gap-1.5">
                {reasons.map(r => (
                    <button
                        key={r.label}
                        onClick={() => { setSubject(r.subject); setBody(r.body); }}
                        className="text-[11px] font-bold bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                    >
                        {r.label}
                    </button>
                ))}
            </div>
            <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sujet"
                className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Message pour l'utilisateur..."
                className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {sendError && <p className="text-xs text-red-600">{sendError}</p>}
            <div className="flex gap-2">
                <button
                    onClick={() => onSend(subject, body)}
                    disabled={sending || !subject.trim() || !body.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                >
                    <Send className="w-4 h-4" /> Envoyer
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 bg-white border border-gray-200 text-gray-500 text-xs font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    Annuler
                </button>
            </div>
        </div>
    );
};

const ProductCompletion = () => {
    const { user } = useAuth();
    const [subTab, setSubTab] = useState('review'); // 'review' | 'pending'
    const [entries, setEntries] = useState([]);
    const [pendingProducts, setPendingProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [flagsByProduct, setFlagsByProduct] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [correctedBarcode, setCorrectedBarcode] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [zoomedEntry, setZoomedEntry] = useState(null);
    const [composingFor, setComposingFor] = useState(null); // { tab, recipientId, productId, priceId } | null
    const [sendingMessage, setSendingMessage] = useState(false);
    const [sendError, setSendError] = useState(null);
    const [messagedIds, setMessagedIds] = useState(new Set()); // entry/product ids messaged this session

    const load = async () => {
        setLoading(true);
        try {
            // Broader than a strict "has a prices photo" filter (that excluded any
            // product-only-registered pending product entirely, plus any full
            // submission whose back photo was the only one that survived) --
            // fetch a recent window and filter client-side for anything with a
            // photo to look at, on either table.
            const { data: priceRows, error } = await supabase
                .from('prices')
                .select('id, created_at, product_photo_url, submitted_by, user_id, products(id, name, barcode, category_id, photo_front_url, photo_back_url)')
                .order('created_at', { ascending: false })
                .limit(60);
            if (error) throw error;
            setEntries((priceRows || []).filter(r =>
                r.products && (r.product_photo_url || r.products.photo_front_url || r.products.photo_back_url)
            ));

            const { data: pending, error: pendingError } = await supabase
                .from('products')
                .select('id, name, barcode, photo_front_url, photo_back_url, photo_registered_by, photo_registered_at')
                .eq('has_price', false)
                .eq('is_test_data', false)
                .order('created_at', { ascending: false })
                .limit(50);
            if (pendingError) throw pendingError;
            setPendingProducts(pending || []);

            const { data: categoriesData } = await supabase
                .from('categories')
                .select('*')
                .order('display_order', { ascending: true });
            setCategories(categoriesData || []);

            const { data: flags } = await supabase
                .from('barcode_flags')
                .select('*')
                .order('created_at', { ascending: false });

            const map = {};
            (flags || []).forEach(f => {
                if (!map[f.product_id]) map[f.product_id] = f; // most recent wins, list is desc
            });
            setFlagsByProduct(map);
        } catch (err) {
            console.error('Error loading product completion data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openFlag = (entry) => {
        setExpandedId(entry.id);
        setCorrectedBarcode(entry.products?.barcode || '');
        setNote('');
        setSubmitError(null);
        setComposingFor(null);
    };

    const submitFlag = async (entry, actionType) => {
        if (!user) {
            setSubmitError("Vous devez être connecté en tant qu'admin.");
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const isAdminModification = actionType === 'admin_modification';
            const { error: insertError } = await supabase.from('barcode_flags').insert([{
                product_id: entry.products.id,
                price_id: entry.id,
                flagged_by: user.id,
                captured_barcode: entry.products.barcode,
                corrected_barcode: isAdminModification ? correctedBarcode : null,
                status: isAdminModification ? 'corrected_by_admin' : 'recapture_requested',
                resolution_type: actionType,
                note,
                resolved_at: isAdminModification ? new Date().toISOString() : null,
            }]);
            if (insertError) throw insertError;

            if (isAdminModification && correctedBarcode && correctedBarcode !== entry.products.barcode) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ barcode: correctedBarcode })
                    .eq('id', entry.products.id);
                if (updateError) throw updateError;
            }

            setExpandedId(null);
            await load();
        } catch (err) {
            console.error('Error submitting barcode flag:', err);
            setSubmitError(err.message || 'Erreur lors de l\'enregistrement.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateCategory = async (productId, categoryId) => {
        // Optimistic update so the select feels instant
        setEntries(prev => prev.map(e =>
            e.products.id === productId ? { ...e, products: { ...e.products, category_id: categoryId } } : e
        ));
        const { error } = await supabase
            .from('products')
            .update({ category_id: categoryId })
            .eq('id', productId);
        if (error) {
            console.error('Error updating category:', error);
            await load(); // revert to server truth on failure
        }
    };

    const sendMessage = async (subject, body) => {
        if (!user || !composingFor?.recipientId) return;
        setSendingMessage(true);
        setSendError(null);
        try {
            const { error } = await supabase.from('user_messages').insert([{
                recipient_id: composingFor.recipientId,
                sender_admin_id: user.id,
                subject,
                body,
                related_product_id: composingFor.productId || null,
                related_price_id: composingFor.priceId || null,
            }]);
            if (error) throw error;
            setMessagedIds(prev => new Set(prev).add(composingFor.entryKey));
            setComposingFor(null);
        } catch (err) {
            console.error('Error sending user message:', err);
            setSendError(err.message || "Erreur lors de l'envoi.");
        } finally {
            setSendingMessage(false);
        }
    };

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
            <div className="flex gap-2">
                <button
                    onClick={() => setSubTab('review')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${subTab === 'review' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                    <ScanLine className="w-3.5 h-3.5" /> À vérifier ({entries.length})
                </button>
                <button
                    onClick={() => setSubTab('pending')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${subTab === 'pending' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                    <PackageSearch className="w-3.5 h-3.5" /> Prix en attente ({pendingProducts.length})
                </button>
            </div>

            {subTab === 'review' ? (
                <>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                            Complétez ou corrigez les informations d'un produit à partir de sa photo : comparez le
                            code-barres capturé avec celui visible sur la photo du dos, et assignez ou corrigez sa catégorie.
                        </p>
                    </div>

                    {entries.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Aucune photo de produit à vérifier.</p>
                    ) : (
                        <div className="space-y-3">
                            {entries.map(entry => {
                                const flag = flagsByProduct[entry.products.id];
                                const badge = flag ? STATUS_BADGES[flag.status] : null;
                                const isExpanded = expandedId === entry.id;
                                // Prefer the back photo (shows the barcode -- the actual point of
                                // this cross-check) over the front, falling back to the legacy
                                // prices.product_photo_url for rows predating the front/back split.
                                const displayPhoto = entry.products.photo_back_url || entry.products.photo_front_url || entry.product_photo_url;
                                const recipientId = entry.submitted_by || entry.user_id || null;
                                const entryKey = `review_${entry.id}`;

                                return (
                                    <div key={entry.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="flex gap-3 p-3">
                                            <button
                                                onClick={() => setZoomedEntry({ ...entry, displayPhoto })}
                                                className="relative flex-shrink-0 w-20 h-20 group"
                                                title="Zoomer sur la photo"
                                            >
                                                <img
                                                    src={displayPhoto}
                                                    alt={entry.products.name}
                                                    className="w-20 h-20 rounded-lg object-cover border border-gray-100 group-hover:opacity-90 transition-opacity"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg">
                                                    <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                                                </div>
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate">{entry.products.name}</p>
                                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                    <ScanLine className="w-3.5 h-3.5" />
                                                    <span className="font-mono">{entry.products.barcode || 'Aucun code-barres'}</span>
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                                    <select
                                                        value={entry.products.category_id || ''}
                                                        onChange={(e) => updateCategory(entry.products.id, e.target.value || null)}
                                                        className="text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-red-500 outline-none max-w-[180px]"
                                                    >
                                                        <option value="">Non catégorisé</option>
                                                        {categories.map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1.5">
                                                    {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                                                </p>
                                                {badge && (
                                                    <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                                                        {badge.label}
                                                        {flag.resolution_type === 'admin_modification' && flag.corrected_barcode && (
                                                            <> → {flag.corrected_barcode}</>
                                                        )}
                                                    </span>
                                                )}
                                                {messagedIds.has(entryKey) && (
                                                    <span className="inline-block mt-2 ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                        Message envoyé
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => (isExpanded ? setExpandedId(null) : openFlag(entry))}
                                                    className="flex-shrink-0 self-end p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Signaler un problème de code-barres"
                                                >
                                                    <Flag className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setExpandedId(null);
                                                        setComposingFor(composingFor?.entryKey === entryKey ? null : {
                                                            tab: 'review', entryKey, recipientId,
                                                            productId: entry.products.id, priceId: entry.id,
                                                        });
                                                        setSendError(null);
                                                    }}
                                                    disabled={!recipientId}
                                                    title={recipientId ? "Signaler à l'auteur" : 'Utilisateur inconnu (contribution ancienne ou anonyme)'}
                                                    className="flex-shrink-0 self-end p-2 rounded-full text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <MessageSquareWarning className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                        Code-barres corrigé (si lisible sur la photo)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={correctedBarcode}
                                                        onChange={(e) => setCorrectedBarcode(e.target.value)}
                                                        className="w-full mt-1 bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm font-mono focus:ring-2 focus:ring-red-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                        Note (visible dans l'audit public)
                                                    </label>
                                                    <textarea
                                                        value={note}
                                                        onChange={(e) => setNote(e.target.value)}
                                                        rows={2}
                                                        className="w-full mt-1 bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                                        placeholder="Ex: chiffre 8 mal lu au scan, corrigé depuis la photo."
                                                    />
                                                </div>
                                                {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => submitFlag(entry, 'admin_modification')}
                                                        disabled={submitting || !correctedBarcode}
                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" /> J'ai corrigé
                                                    </button>
                                                    <button
                                                        onClick={() => submitFlag(entry, 'user_recapture')}
                                                        disabled={submitting}
                                                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                                                    >
                                                        <RefreshCw className="w-4 h-4" /> Demander re-capture
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {composingFor?.entryKey === entryKey && (
                                            <MessageComposer
                                                target={composingFor}
                                                onSend={sendMessage}
                                                onCancel={() => setComposingFor(null)}
                                                sending={sendingMessage}
                                                sendError={sendError}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2">
                        <PackageSearch className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                            Produits enregistrés avec leurs photos mais sans prix -- visibles aussi côté utilisateur
                            dans "Produits à compléter". Un rappel peut être envoyé à la personne qui les a photographiés.
                        </p>
                    </div>

                    {pendingProducts.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Aucun produit en attente de prix.</p>
                    ) : (
                        <div className="space-y-3">
                            {pendingProducts.map(product => {
                                const entryKey = `pending_${product.id}`;
                                return (
                                    <div key={product.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="flex gap-3 p-3">
                                            <div className="flex gap-1 flex-shrink-0">
                                                {product.photo_front_url && (
                                                    <img src={product.photo_front_url} alt={product.name} className="w-14 h-20 rounded-lg object-cover border border-gray-100" />
                                                )}
                                                {product.photo_back_url && (
                                                    <img src={product.photo_back_url} alt={`${product.name} (dos)`} className="w-14 h-20 rounded-lg object-cover border border-gray-100" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                    <ScanLine className="w-3.5 h-3.5" />
                                                    <span className="font-mono">{product.barcode || 'Aucun code-barres'}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1.5">
                                                    Enregistré le {product.photo_registered_at ? new Date(product.photo_registered_at).toLocaleDateString('fr-FR') : '?'}
                                                </p>
                                                {messagedIds.has(entryKey) && (
                                                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                        Message envoyé
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setComposingFor(composingFor?.entryKey === entryKey ? null : {
                                                        tab: 'pending', entryKey, recipientId: product.photo_registered_by,
                                                        productId: product.id, priceId: null,
                                                    });
                                                    setSendError(null);
                                                }}
                                                disabled={!product.photo_registered_by}
                                                title={product.photo_registered_by ? "Signaler à l'auteur" : 'Utilisateur inconnu'}
                                                className="flex-shrink-0 self-start p-2 rounded-full text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <MessageSquareWarning className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {composingFor?.entryKey === entryKey && (
                                            <MessageComposer
                                                target={composingFor}
                                                onSend={sendMessage}
                                                onCancel={() => setComposingFor(null)}
                                                sending={sendingMessage}
                                                sendError={sendError}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Photo zoom with barcode overlay for side-by-side comparison */}
            {zoomedEntry && (
                <div
                    className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setZoomedEntry(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                        onClick={() => setZoomedEntry(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>

                    <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={zoomedEntry.displayPhoto}
                            alt={zoomedEntry.products.name}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                        />
                        <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10">
                            <ScanLine className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="font-mono text-white text-base sm:text-lg font-bold tracking-wide">
                                {zoomedEntry.products.barcode || 'Aucun code-barres'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-[11px] text-gray-500 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                <p>
                    Chaque signalement de code-barres est conservé de façon permanente (table <code className="bg-white px-1 rounded border">barcode_flags</code>,
                    lecture publique) pour permettre un audit externe de l'intégrité des données —
                    <UserCheck className="inline w-3 h-3 mx-1" />"re-capture demandée" identifie une correction
                    attendue de l'utilisateur, <ShieldCheck className="inline w-3 h-3 mx-1" />"corrigé par admin" une
                    modification directe. Les changements de catégorie sont appliqués directement. Les messages envoyés
                    via <MessageSquareWarning className="inline w-3 h-3 mx-1" /> apparaissent dans la boîte "Messages" de l'utilisateur.
                </p>
            </div>
        </div>
    );
};

export default ProductCompletion;
