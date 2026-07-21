import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Tag } from 'lucide-react';
import { supabase } from '../supabaseClient';

const CategoryManager = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('display_order', { ascending: true });
        setCategories(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const submitCategory = async (e) => {
        e.preventDefault();
        if (!name.trim() || !icon.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            const maxOrder = categories.reduce((max, c) => Math.max(max, c.display_order || 0), 0);
            const { error: insertError } = await supabase
                .from('categories')
                .insert([{ name: name.trim(), icon: icon.trim(), display_order: maxOrder + 10 }]);

            if (insertError) throw insertError;

            setName('');
            setIcon('');
            await load();
        } catch (err) {
            console.error('Error adding category:', err);
            setError(err.message || "Erreur lors de l'ajout.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <form onSubmit={submitCategory} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-red-600" /> Ajouter une catégorie
                </h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        placeholder="Icône (ex: 🧴)"
                        maxLength={4}
                        className="w-20 bg-white border border-gray-200 rounded-lg py-2 px-3 text-center text-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nom de la catégorie"
                        className="flex-1 bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    />
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={submitting || !name.trim() || !icon.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                >
                    {submitting ? 'Ajout...' : 'Ajouter'}
                </button>
            </form>

            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                </div>
            ) : (
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> {categories.length} catégories existantes
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl p-2.5">
                                <span className="text-xl flex-shrink-0">{cat.icon}</span>
                                <span className="text-xs font-medium text-gray-700 truncate">{cat.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryManager;
