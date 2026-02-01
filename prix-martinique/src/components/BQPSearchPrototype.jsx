import React, { useState, useMemo } from 'react';
import bqpData from '../data/bqp_data.json';
import { Search, ShieldCheck, ShoppingBag, Info } from 'lucide-react';

export default function BQPSearchPrototype() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedList, setSelectedList] = useState('all');

    // Flatten the nested data for easier searching
    const allCategories = useMemo(() => {
        let categories = [];
        const lists = {
            'Hyper': bqpData.lists.hypermarket_134.categories,
            'Super': bqpData.lists.supermarket_72.categories,
            'Supérette': bqpData.lists.superette_35.categories
        };

        Object.entries(lists).forEach(([type, items]) => {
            items.forEach(item => {
                categories.push({ ...item, storeType: type });
            });
        });
        return categories;
    }, []);

    const filteredItems = useMemo(() => {
        return allCategories.filter(item =>
            (selectedList === 'all' || item.storeType === selectedList) &&
            (item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.section.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [allCategories, searchTerm, selectedList]);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-blue-600 p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-6 h-6" />
                    <h2 className="font-bold text-lg">Vérificateur BQP (Prototype)</h2>
                </div>
                <p className="text-blue-100 text-sm">
                    Visualisation de la stratégie "Shadow BQP".
                    Recherchez un produit pour voir sa catégorie officielle.
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

                    <div className="flex gap-2 text-sm overflow-x-auto pb-2">
                        {['all', 'Hyper', 'Super', 'Supérette'].map(type => (
                            <button
                                key={type}
                                onClick={() => setSelectedList(type)}
                                className={`px-3 py-1 rounded-full whitespace-nowrap ${selectedList === type
                                        ? 'bg-blue-100 text-blue-800 font-medium'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {type === 'all' ? 'Tous' : type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>Aucun produit BQP correspondant trouvé.</p>
                        </div>
                    ) : (
                        filteredItems.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                {item.id}
                                            </span>
                                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                                                {item.section}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-gray-900">{item.label}</h3>
                                    </div>
                                    {item.local && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                                            Local 🌴
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                        Format cible: <strong>{item.unit}</strong>
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {item.storeType}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800 flex gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <p>
                        <strong>Simulateur :</strong> En production, scanner un code-barres (ex: 301234...) affichera automatiquement la catégorie correspondante ci-dessus.
                    </p>
                </div>
            </div>
        </div>
    );
}
