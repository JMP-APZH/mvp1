import React, { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, Link2, Trash2, ZoomIn, X, Camera, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { MAINLAND_CHAINS as CHAINS } from '../constants/mainlandChains';

const FILTERS = [
    { value: 'all', label: 'Tous' },
    { value: 'missing-mainland', label: 'Sans prix 🇫🇷' },
];

const MainlandPriceAdmin = () => {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [missingMartiniqueItems, setMissingMartiniqueItems] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [zoomedImage, setZoomedImage] = useState(null);

    const [price, setPrice] = useState('');
    const [chain, setChain] = useState(CHAINS[0]);
    const [sourceUrl, setSourceUrl] = useState('');
    const [evidencePhoto, setEvidencePhoto] = useState(null); // base64 data URL
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data: rows, error: loadError } = await supabase
                .from('prices')
                .select('id, price, created_at, product_photo_url, origin_region_code, products(id, name, barcode)')
                .order('created_at', { ascending: false });
            if (loadError) throw loadError;

            const byProduct = new Map();
            (rows || []).forEach(r => {
                if (!r.products) return;
                const pid = r.products.id;
                if (!byProduct.has(pid)) {
                    byProduct.set(pid, { product: r.products, photoUrl: null, localPrices: [] });
                }
                const entry = byProduct.get(pid);
                if (r.origin_region_code !== 'Hexagone') {
                    entry.localPrices.push(r.price);
                    if (!entry.photoUrl && r.product_photo_url) entry.photoUrl = r.product_photo_url;
                }
            });

            const list = Array.from(byProduct.values())
                .filter(e => e.photoUrl)
                .map(e => ({
                    product: e.product,
                    photoUrl: e.photoUrl,
                    bestLocalPrice: e.localPrices.length ? Math.min(...e.localPrices) : null,
                }))
                .sort((a, b) => a.product.name.localeCompare(b.product.name));

            setItems(list);

            // Isolated: mainland_chain/source_type/evidence_photo_url may not exist yet
            // on a given environment (mainland_price_migration.sql / mainland_evidence_photo_migration.sql).
            // A failure here must not block the browsable product list above.
            try {
                const { data: mainlandRows, error: mainlandError } = await supabase
                    .from('prices')
                    .select('id, product_id, price, mainland_chain, source_type, source_url, evidence_photo_url, created_at')
                    .eq('origin_region_code', 'Hexagone')
                    .order('created_at', { ascending: false });
                if (mainlandError) throw mainlandError;

                const byProductMainland = {};
                (mainlandRows || []).forEach(r => {
                    if (!byProductMainland[r.product_id]) byProductMainland[r.product_id] = [];
                    byProductMainland[r.product_id].push(r);
                });
                setItems(prev => prev.map(item => ({
                    ...item,
                    mainlandEntries: byProductMainland[item.product.id] || [],
                })));

                // Products with a France Hexagonale reference price but no Martinique
                // scan at all -- not part of `items` above (which requires a local
                // photo to be browsable). Surfaced separately so admin can monitor
                // and prioritize getting them scanned in Martinique.
                const missingMartinique = [];
                byProduct.forEach((entry, pid) => {
                    const mainlandEntries = byProductMainland[pid];
                    if (entry.localPrices.length === 0 && mainlandEntries?.length > 0) {
                        const bestMainland = mainlandEntries.reduce((min, r) => r.price < min.price ? r : min, mainlandEntries[0]);
                        missingMartinique.push({
                            product: entry.product,
                            mainlandPrice: bestMainland.price,
                            mainlandChain: bestMainland.mainland_chain,
                        });
                    }
                });
                missingMartinique.sort((a, b) => a.product.name.localeCompare(b.product.name));
                setMissingMartiniqueItems(missingMartinique);
            } catch (mainlandErr) {
                console.error('Error loading mainland prices (migration may not be applied yet):', mainlandErr);
                setItems(prev => prev.map(item => ({ ...item, mainlandEntries: [] })));
                setMissingMartiniqueItems([]);
            }
        } catch (err) {
            console.error('Error loading products for mainland pricing:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openForm = (productId) => {
        setExpandedId(productId);
        setPrice('');
        setChain(CHAINS[0]);
        setSourceUrl('');
        setEvidencePhoto(null);
        setError(null);
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setEvidencePhoto(reader.result);
        reader.readAsDataURL(file);
    };

    const submitMainlandPrice = async (item) => {
        if (!user || !price) return;
        setSubmitting(true);
        setError(null);
        try {
            let evidencePhotoUrl = null;
            if (evidencePhoto) {
                const fileName = `${Date.now()}_${item.product.id}_mainland.jpg`;
                const base64Data = evidencePhoto.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });

                const { error: uploadError } = await supabase.storage
                    .from('price-tag-photos')
                    .upload(fileName, blob);
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('price-tag-photos')
                    .getPublicUrl(fileName);
                evidencePhotoUrl = urlData.publicUrl;
            }

            const { error: insertError } = await supabase.from('prices').insert([{
                product_id: item.product.id,
                store_id: null,
                price: parseFloat(price),
                user_name: 'Admin (source en ligne)',
                user_id: user.id,
                origin_region_code: 'Hexagone',
                mainland_chain: chain,
                source_type: 'admin_reference',
                source_url: sourceUrl.trim() || null,
                evidence_photo_url: evidencePhotoUrl,
            }]);
            if (insertError) throw insertError;

            setExpandedId(null);
            await load();
        } catch (err) {
            console.error('Error adding mainland price:', err);
            setError(err.message || "Erreur lors de l'ajout.");
        } finally {
            setSubmitting(false);
        }
    };

    const deleteEntry = async (id) => {
        const { error: deleteError } = await supabase.from('prices').delete().eq('id', id);
        if (!deleteError) {
            setItems(prev => prev.map(item => ({
                ...item,
                mainlandEntries: (item.mainlandEntries || []).filter(e => e.id !== id),
            })));
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
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 flex items-start gap-2">
                <span className="flex-shrink-0">🇫🇷</span>
                <p>
                    Ajoutez un prix de référence trouvé en ligne pour l'équivalent d'un produit en France
                    Hexagonale, avec une capture d'écran du site du magasin comme preuve. Il apparaîtra
                    automatiquement dans le "Duel des Prix" dès qu'un utilisateur scanne ce produit en Martinique.
                </p>
            </div>

            {missingMartiniqueItems.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                        <AlertTriangle className="w-3.5 h-3.5" /> Sans prix Martinique ({missingMartiniqueItems.length})
                    </h4>
                    <p className="text-[11px] text-orange-700 mb-3">
                        Ces produits ont un prix France Hexagonale mais n'ont jamais été scannés en Martinique.
                    </p>
                    <div className="space-y-1.5">
                        {missingMartiniqueItems.map(item => (
                            <div key={item.product.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2">
                                <span className="text-xs font-bold text-gray-900 truncate">{item.product.name}</span>
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                                    {item.mainlandChain || '?'} : {item.mainlandPrice.toFixed(2)}€
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${filter === f.value
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {(() => {
                const filteredItems = filter === 'missing-mainland'
                    ? items.filter(i => (i.mainlandEntries || []).length === 0)
                    : items;

                if (filteredItems.length === 0) {
                    return <p className="text-sm text-gray-400 text-center py-8">{items.length === 0 ? 'Aucun produit avec photo à comparer.' : 'Aucun produit ne correspond à ce filtre.'}</p>;
                }

                return (
                <div className="space-y-3">
                    {filteredItems.map(item => {
                        const isExpanded = expandedId === item.product.id;
                        const entries = item.mainlandEntries || [];

                        return (
                            <div key={item.product.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <div className="flex gap-3 p-3">
                                    <button
                                        onClick={() => setZoomedImage(item.photoUrl)}
                                        className="relative flex-shrink-0 w-20 h-20 group"
                                        title="Zoomer sur la photo"
                                    >
                                        <img
                                            src={item.photoUrl}
                                            alt={item.product.name}
                                            className="w-20 h-20 rounded-lg object-cover border border-gray-100 group-hover:opacity-90 transition-opacity"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg">
                                            <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                                        </div>
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{item.product.name}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Meilleur prix Martinique : <strong className="text-gray-900">
                                                {item.bestLocalPrice != null ? `${item.bestLocalPrice.toFixed(2)}€` : 'aucune donnée'}
                                            </strong>
                                        </p>
                                        {entries.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {entries.map(e => (
                                                    <span key={e.id} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                                        {e.mainland_chain || '?'} : {e.price.toFixed(2)}€
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => (isExpanded ? setExpandedId(null) : openForm(item.product.id))}
                                        className="flex-shrink-0 self-start p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Ajouter un prix France Hexagonale"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder="Prix (€)"
                                                className="w-28 bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <select
                                                value={chain}
                                                onChange={(e) => setChain(e.target.value)}
                                                className="flex-1 bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                Capture d'écran (preuve)
                                            </label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />
                                            {evidencePhoto ? (
                                                <div className="relative w-24 h-24 mt-1">
                                                    <img src={evidencePhoto} alt="Preuve" className="w-24 h-24 rounded-lg object-cover border border-gray-200" />
                                                    <button
                                                        onClick={() => setEvidencePhoto(null)}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="mt-1 w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                                                >
                                                    <Camera className="w-5 h-5" />
                                                    <span className="text-[9px] font-bold">Ajouter</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <input
                                                type="url"
                                                value={sourceUrl}
                                                onChange={(e) => setSourceUrl(e.target.value)}
                                                placeholder="Lien source (optionnel)"
                                                className="w-full pl-9 pr-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>

                                        {error && <p className="text-xs text-red-600">{error}</p>}

                                        <button
                                            onClick={() => submitMainlandPrice(item)}
                                            disabled={submitting || !price}
                                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                                        >
                                            {submitting ? 'Ajout...' : 'Ajouter le prix de référence'}
                                        </button>

                                        {entries.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-gray-200">
                                                {entries.map(e => (
                                                    <div key={e.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-2.5">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {e.evidence_photo_url && (
                                                                <button onClick={() => setZoomedImage(e.evidence_photo_url)} className="flex-shrink-0">
                                                                    <img src={e.evidence_photo_url} alt="Preuve" className="w-10 h-10 rounded object-cover border border-gray-200" />
                                                                </button>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-gray-900">
                                                                    {e.mainland_chain} — {e.price.toFixed(2)}€
                                                                </p>
                                                                <p className="text-[9px] text-gray-400 flex items-center gap-2">
                                                                    {new Date(e.created_at).toLocaleDateString('fr-FR')}
                                                                    {e.source_url && (
                                                                        <a href={e.source_url} target="_blank" rel="noreferrer" className="text-blue-500 underline">lien</a>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteEntry(e.id)}
                                                            className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                );
            })()}

            {/* Zoom modal for product photos / evidence photos */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                        onClick={() => setZoomedImage(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={zoomedImage}
                        alt="Zoom"
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default MainlandPriceAdmin;
