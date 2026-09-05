import React, { useState, useEffect } from 'react';
import { X, Loader2, PackageSearch, Camera, PartyPopper } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { posthog } from '../posthogClient';

// "Produits à compléter": products registered with front/back photos (see
// product_completion_and_messaging_migration.sql) but no price yet -- anyone
// can pick one up and complete it next time they're at the right store.
const PendingPriceProductsModal = ({ onClose, onSelectProduct }) => {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [migrationPending, setMigrationPending] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, name, barcode, photo_front_url, photo_back_url, created_at')
                    .eq('has_price', false)
                    .eq('is_test_data', false)
                    .order('created_at', { ascending: false })
                    .limit(50);
                if (error) throw error;
                setProducts(data || []);
                posthog.capture('pending_products_opened', { pending_count: (data || []).length });
            } catch (err) {
                // Column doesn't exist yet if the migration hasn't been applied --
                // degrade to the empty state rather than a broken screen, same
                // pattern used elsewhere in this codebase for pending migrations.
                console.error('Error loading pending-price products (migration pending?):', err);
                setMigrationPending(true);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <PackageSearch className="w-5 h-5 text-orange-500" /> Produits à compléter
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Ajoutez le prix de ces produits déjà photographiés</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : migrationPending || products.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
                        <PartyPopper className="w-12 h-12 text-green-400 mb-3" />
                        <p className="text-gray-600 font-medium">Rien à compléter pour le moment</p>
                        <p className="text-sm text-gray-400 mt-1">Tous les produits enregistrés ont déjà un prix.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {products.map(product => (
                            <button
                                key={product.id}
                                onClick={() => onSelectProduct(product)}
                                className="w-full flex items-center gap-3 bg-gray-50 hover:bg-orange-50 rounded-2xl p-3 text-left transition-colors border border-transparent hover:border-orange-200"
                            >
                                <div className="flex gap-1 flex-shrink-0">
                                    {product.photo_front_url ? (
                                        <img src={product.photo_front_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover border border-gray-100" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center">
                                            <Camera className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500 font-mono truncate">{product.barcode || 'Sans code-barres'}</p>
                                </div>
                                <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full flex-shrink-0">
                                    Ajouter le prix
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingPriceProductsModal;
