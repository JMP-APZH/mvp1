import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2, Globe2, Link2, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const CHAINS = ['Carrefour', 'E.Leclerc', 'Système U', 'Auchan', 'Autre'];

const MainlandPriceAdmin = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [productQuery, setProductQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [localBestPrice, setLocalBestPrice] = useState(null);
    const [mainlandEntries, setMainlandEntries] = useState([]);
    const [loadingProduct, setLoadingProduct] = useState(false);

    const [price, setPrice] = useState('');
    const [chain, setChain] = useState(CHAINS[0]);
    const [sourceUrl, setSourceUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadProducts = async () => {
            const { data } = await supabase.from('products').select('id, name, barcode').order('name');
            setProducts(data || []);
        };
        loadProducts();
    }, []);

    const filteredProducts = productQuery.trim()
        ? products.filter(p =>
            p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
            p.barcode?.includes(productQuery)
        ).slice(0, 8)
        : [];

    const selectProduct = async (product) => {
        setSelectedProduct(product);
        setProductQuery('');
        setPrice('');
        setSourceUrl('');
        setError(null);
        setLoadingProduct(true);
        try {
            const { data: localRows } = await supabase
                .from('prices')
                .select('price, origin_region_code')
                .eq('product_id', product.id);
            // Client-side filter, not .neq() server-side: NULL origin_region_code
            // (the common case) fails a SQL <> comparison and would be silently
            // dropped by .neq('origin_region_code', 'Hexagone').
            const prices = (localRows || [])
                .filter(r => r.origin_region_code !== 'Hexagone')
                .map(r => r.price);
            setLocalBestPrice(prices.length ? Math.min(...prices) : null);

            const { data: mainlandRows } = await supabase
                .from('prices')
                .select('id, price, mainland_chain, source_type, source_url, created_at, user_name')
                .eq('product_id', product.id)
                .eq('origin_region_code', 'Hexagone')
                .order('created_at', { ascending: false });
            setMainlandEntries(mainlandRows || []);
        } catch (err) {
            console.error('Error loading product mainland data:', err);
        } finally {
            setLoadingProduct(false);
        }
    };

    const submitMainlandPrice = async (e) => {
        e.preventDefault();
        if (!selectedProduct || !price || !user) return;

        setSubmitting(true);
        setError(null);
        try {
            const { error: insertError } = await supabase.from('prices').insert([{
                product_id: selectedProduct.id,
                store_id: null,
                price: parseFloat(price),
                user_name: `Admin (source en ligne)`,
                user_id: user.id,
                origin_region_code: 'Hexagone',
                mainland_chain: chain,
                source_type: 'admin_reference',
                source_url: sourceUrl.trim() || null,
            }]);
            if (insertError) throw insertError;

            setPrice('');
            setSourceUrl('');
            await selectProduct(selectedProduct);
        } catch (err) {
            console.error('Error adding mainland price:', err);
            setError(err.message || "Erreur lors de l'ajout.");
        } finally {
            setSubmitting(false);
        }
    };

    const deleteEntry = async (id) => {
        const { error: deleteError } = await supabase.from('prices').delete().eq('id', id);
        if (!deleteError) setMainlandEntries(prev => prev.filter(e => e.id !== id));
    };

    const gapPct = (localBestPrice && mainlandEntries[0])
        ? Math.round(((localBestPrice - mainlandEntries[0].price) / mainlandEntries[0].price) * 100)
        : null;

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 flex items-start gap-2">
                <Globe2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                    Ajoutez un prix de référence trouvé en ligne pour l'équivalent d'un produit en France
                    Hexagonale. Il apparaîtra automatiquement dans le "Duel des Prix" dès qu'un utilisateur
                    scanne ce produit en Martinique.
                </p>
            </div>

            {/* Product search */}
            <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={selectedProduct ? selectedProduct.name : productQuery}
                    onChange={(e) => { setProductQuery(e.target.value); setSelectedProduct(null); }}
                    placeholder="Chercher un produit (nom ou code-barres)..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
                {filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {filteredProducts.map(p => (
                            <button
                                key={p.id}
                                onClick={() => selectProduct(p)}
                                className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm text-gray-700 border-b border-gray-50 last:border-0"
                            >
                                {p.name}
                                {p.barcode && <span className="text-gray-400 font-mono text-[10px] ml-2">{p.barcode}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedProduct && (
                loadingProduct ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                            <p className="text-sm font-bold text-gray-900">{selectedProduct.name}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className="text-gray-500">
                                    Meilleur prix Martinique : <strong className="text-gray-900">
                                        {localBestPrice != null ? `${localBestPrice.toFixed(2)}€` : 'aucune donnée'}
                                    </strong>
                                </span>
                                {gapPct !== null && (
                                    <span className={`font-bold ${gapPct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {gapPct > 0 ? '+' : ''}{gapPct}% vs France Hexagonale
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Add form */}
                        <form onSubmit={submitMainlandPrice} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-red-600" /> Ajouter un prix de référence
                            </h4>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="Prix (€)"
                                    required
                                    className="w-28 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                                <select
                                    value={chain}
                                    onChange={(e) => setChain(e.target.value)}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                >
                                    {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="relative">
                                <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="url"
                                    value={sourceUrl}
                                    onChange={(e) => setSourceUrl(e.target.value)}
                                    placeholder="Lien source (optionnel)"
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                            {error && <p className="text-xs text-red-600">{error}</p>}
                            <button
                                type="submit"
                                disabled={submitting || !price}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                            >
                                {submitting ? 'Ajout...' : 'Ajouter le prix de référence'}
                            </button>
                        </form>

                        {/* Existing entries */}
                        {mainlandEntries.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Prix France Hexagonale existants
                                </h4>
                                <div className="space-y-2">
                                    {mainlandEntries.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900">
                                                    {entry.mainland_chain || 'Chaîne inconnue'} — {entry.price.toFixed(2)}€
                                                </p>
                                                <p className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                                                    {entry.source_type === 'admin_reference' ? 'Source en ligne (admin)' : 'Scan communautaire'}
                                                    <span>{new Date(entry.created_at).toLocaleDateString('fr-FR')}</span>
                                                    {entry.source_url && (
                                                        <a href={entry.source_url} target="_blank" rel="noreferrer" className="text-blue-500 underline">
                                                            lien
                                                        </a>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => deleteEntry(entry.id)}
                                                className="flex-shrink-0 p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
};

export default MainlandPriceAdmin;
