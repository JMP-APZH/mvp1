import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShieldCheck, ShoppingBag, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function BQPVerifier({ initialSearchTerm = '', onSelect = null }) {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [selectedList, setSelectedList] = useState('all');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalItems: 0, verifiedStore: null });
    const [error, setError] = useState(null);

    useEffect(() => {
        loadBQPCategories();
    }, []);

    // Update search if prop changes
    useEffect(() => {
        if (initialSearchTerm) {
            setSearchTerm(initialSearchTerm);
        }
    }, [initialSearchTerm]);

    async function loadBQPCategories() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('bqp_categories')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;
            setCategories(data || []);

            // Load some aggregate stats for the watchdog
            const { data: assocData } = await supabase
                .from('product_bqp_associations')
                .select('product_id, bqp_category_id');

            setStats(prev => ({ ...prev, totalItems: assocData?.length || 0 }));

        } catch (err) {
            console.error('Error loading BQP categories:', err);
            setError('Impossible de charger la liste BQP.');
        } finally {
            setLoading(false);
        }
    }

    const filteredItems = useMemo(() => {
        if (!categories.length) return [];

        return categories.filter(item =>
            (selectedList === 'all' || item.list_type === selectedList) &&
            (
                item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.section?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.code.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [categories, searchTerm, selectedList]);

    const listTypes = [
        { id: 'all', label: 'Tous' },
        { id: 'hypermarket', label: 'Hyper' },
        { id: 'supermarket', label: 'Super' },
        { id: 'superette', label: 'Supérette' }
    ];

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-800 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {error}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-blue-600 p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-6 h-6" />
                    <h2 className="font-bold text-lg">BQP Watchdog 🛡️</h2>
                </div>

                <div className="flex gap-4 mb-3">
                    <div className="bg-white/20 px-3 py-2 rounded-xl flex-1">
                        <p className="text-[10px] uppercase font-bold opacity-80">Produits suivis</p>
                        <p className="text-xl font-black">{stats.totalItems}</p>
                    </div>
                    <div className="bg-white/20 px-3 py-2 rounded-xl flex-1">
                        <p className="text-[10px] uppercase font-bold opacity-80">Compliance Globale</p>
                        <p className="text-xl font-black text-green-300">84%</p>
                    </div>
                </div>

                <p className="text-blue-100 text-xs leading-tight mb-2">
                    Le Bouclier Qualité Prix est une liste officielle de produits à prix plafonnés.
                    <strong> Votre mission :</strong> signalez tout écart ou absence en rayon.
                </p>
            </div>

            <div className="p-4 space-y-4">
                {/* Search & Filter */}
                <div className="flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Ex: Lait, Riz, Poulet..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex gap-2 text-sm overflow-x-auto pb-2 scrollbar-hide">
                        {listTypes.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setSelectedList(type.id)}
                                className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${selectedList === type.id
                                    ? 'bg-blue-100 text-blue-800 font-medium'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse flex gap-3 p-3 border rounded-lg">
                                    <div className="w-12 h-12 bg-gray-200 rounded"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>Aucun produit BQP correspondant trouvé.</p>
                        </div>
                    ) : (
                        filteredItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => onSelect && onSelect(item)}
                                className={`border rounded-lg p-3 transition-colors ${onSelect
                                    ? 'cursor-pointer hover:bg-blue-50 border-blue-200 hover:border-blue-400'
                                    : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                {item.code}
                                            </span>
                                            {item.section && (
                                                <span className="text-xs text-gray-500 uppercase tracking-wide">
                                                    {item.section}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-medium text-gray-900">{item.label}</h3>
                                    </div>
                                    {item.is_local && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 flex-shrink-0">
                                            Local 🌴
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                                        <ShoppingBag className="w-3 h-3" />
                                        Format: <strong>{item.unit_standard}</strong>
                                    </span>
                                    <span className="text-xs text-gray-400 capitalize">
                                        {item.list_type}
                                    </span>
                                </div>

                                {onSelect && (
                                    <div className="mt-2 text-center">
                                        <span className="text-blue-600 text-xs font-semibold uppercase tracking-wider">
                                            Sélectionner
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800 flex gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <p>
                        <strong>Info BQP :</strong> Ces produits font partie du Bouclier Qualité Prix. Les magasins participants s'engagent à respecter un prix global plafonné pour le panier entier.
                    </p>
                </div>
            </div>
        </div>
    );
}
