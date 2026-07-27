import React, { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, Trash2, X, ChefHat, Search, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { RECIPE_CATEGORIES, RECIPE_DIFFICULTIES } from '../constants/recipeCategories';

const emptyIngredient = () => ({
    key: `new-${Math.random().toString(36).slice(2)}`,
    id: null,
    ingredient_name: '',
    product_id: null,
    product_name: null,
    quantity: '',
    unit: '',
    notes: '',
    productQuery: '',
    productResults: [],
});

const emptyForm = () => ({
    name: '',
    description: '',
    photo_url: '',
    servings: 4,
    prep_time_minutes: '',
    category: RECIPE_CATEGORIES[0],
    difficulty: RECIPE_DIFFICULTIES[0],
    is_active: true,
});

const RecipeAdmin = () => {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null); // recipe id being edited, or 'new'
    const [form, setForm] = useState(emptyForm());
    const [ingredientRows, setIngredientRows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const searchTimers = useRef({});

    const load = async () => {
        setLoading(true);
        try {
            const { data: recipeRows, error: recipeError } = await supabase
                .from('recipes')
                .select('*')
                .order('name', { ascending: true });
            if (recipeError) throw recipeError;

            const recipeIds = (recipeRows || []).map(r => r.id);
            const ingredientsByRecipe = {};
            if (recipeIds.length > 0) {
                const { data: ingredientRowsData, error: ingredientsError } = await supabase
                    .from('recipe_ingredients')
                    .select('*')
                    .in('recipe_id', recipeIds)
                    .order('display_order', { ascending: true });
                if (ingredientsError) throw ingredientsError;
                (ingredientRowsData || []).forEach(i => {
                    if (!ingredientsByRecipe[i.recipe_id]) ingredientsByRecipe[i.recipe_id] = [];
                    ingredientsByRecipe[i.recipe_id].push(i);
                });
            }

            setRecipes((recipeRows || []).map(r => ({ ...r, ingredients: ingredientsByRecipe[r.id] || [] })));
        } catch (err) {
            console.error('Error loading recipes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setExpandedId('new');
        setForm(emptyForm());
        setIngredientRows([emptyIngredient()]);
        setError(null);
    };

    const openEdit = (recipe) => {
        setExpandedId(recipe.id);
        setForm({
            name: recipe.name || '',
            description: recipe.description || '',
            photo_url: recipe.photo_url || '',
            servings: recipe.servings || 4,
            prep_time_minutes: recipe.prep_time_minutes || '',
            category: recipe.category || RECIPE_CATEGORIES[0],
            difficulty: recipe.difficulty || RECIPE_DIFFICULTIES[0],
            is_active: recipe.is_active,
        });
        setIngredientRows((recipe.ingredients.length ? recipe.ingredients : [{}]).map(i => ({
            key: i.id || `new-${Math.random().toString(36).slice(2)}`,
            id: i.id || null,
            ingredient_name: i.ingredient_name || '',
            product_id: i.product_id || null,
            product_name: null,
            quantity: i.quantity ?? '',
            unit: i.unit || '',
            notes: i.notes || '',
            productQuery: '',
            productResults: [],
        })));
        setError(null);
    };

    const closeForm = () => setExpandedId(null);

    const toggleActive = async (recipe) => {
        const { error: updateError } = await supabase
            .from('recipes')
            .update({ is_active: !recipe.is_active })
            .eq('id', recipe.id);
        if (!updateError) {
            setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_active: !r.is_active } : r));
        }
    };

    const updateIngredientRow = (key, patch) => {
        setIngredientRows(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row));
    };

    const addIngredientRow = () => setIngredientRows(prev => [...prev, emptyIngredient()]);
    const removeIngredientRow = (key) => setIngredientRows(prev => prev.filter(row => row.key !== key));

    const searchProducts = (key, query) => {
        updateIngredientRow(key, { productQuery: query });
        clearTimeout(searchTimers.current[key]);
        if (!query.trim()) {
            updateIngredientRow(key, { productResults: [] });
            return;
        }
        searchTimers.current[key] = setTimeout(async () => {
            const { data, error: searchError } = await supabase
                .from('products')
                .select('id, name')
                .ilike('name', `%${query.trim()}%`)
                .limit(10);
            if (!searchError) {
                updateIngredientRow(key, { productResults: data || [] });
            }
        }, 300);
    };

    const selectProduct = (key, product) => {
        updateIngredientRow(key, { product_id: product.id, product_name: product.name, productQuery: '', productResults: [] });
    };

    const clearProduct = (key) => updateIngredientRow(key, { product_id: null, product_name: null });

    const saveRecipe = async () => {
        if (!form.name.trim()) {
            setError('Le nom de la recette est obligatoire.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                photo_url: form.photo_url.trim() || null,
                servings: form.servings ? parseInt(form.servings, 10) : null,
                prep_time_minutes: form.prep_time_minutes ? parseInt(form.prep_time_minutes, 10) : null,
                category: form.category || null,
                difficulty: form.difficulty || null,
                is_active: form.is_active,
            };

            let recipeId = expandedId !== 'new' ? expandedId : null;
            if (recipeId) {
                const { error: updateError } = await supabase.from('recipes').update(payload).eq('id', recipeId);
                if (updateError) throw updateError;
            } else {
                const { data: inserted, error: insertError } = await supabase.from('recipes').insert([payload]).select('id').single();
                if (insertError) throw insertError;
                recipeId = inserted.id;
            }

            // No multi-statement transaction primitive via supabase-js without a custom
            // RPC -- delete-then-reinsert is simple and matches the lack of transactions
            // elsewhere in this codebase.
            const { error: deleteError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
            if (deleteError) throw deleteError;

            const validRows = ingredientRows.filter(row => row.ingredient_name.trim());
            if (validRows.length > 0) {
                const { error: insertIngredientsError } = await supabase.from('recipe_ingredients').insert(
                    validRows.map((row, index) => ({
                        recipe_id: recipeId,
                        ingredient_name: row.ingredient_name.trim(),
                        product_id: row.product_id || null,
                        quantity: row.quantity !== '' ? parseFloat(row.quantity) : null,
                        unit: row.unit.trim() || null,
                        notes: row.notes.trim() || null,
                        display_order: index,
                    }))
                );
                if (insertIngredientsError) throw insertIngredientsError;
            }

            setExpandedId(null);
            await load();
        } catch (err) {
            console.error('Error saving recipe:', err);
            setError(err.message || "Erreur lors de l'enregistrement.");
        } finally {
            setSaving(false);
        }
    };

    const deleteRecipe = async (recipe) => {
        if (!window.confirm(`Supprimer la recette "${recipe.name}" ? Cette action est irréversible.`)) return;
        const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipe.id);
        if (!deleteError) {
            setRecipes(prev => prev.filter(r => r.id !== recipe.id));
            if (expandedId === recipe.id) setExpandedId(null);
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
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-xs text-orange-800 flex items-start gap-2">
                <ChefHat className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                    Gérez les recettes affichées dans l'onglet Panier. Associez chaque ingrédient à un produit
                    du catalogue quand un équivalent existe -- laissez sans produit sinon (épices, herbes,
                    produits frais non encore suivis) : le prix affichera "inconnu" plutôt qu'une valeur inventée.
                </p>
            </div>

            <button
                onClick={openNew}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
                <Plus className="w-4 h-4" /> Nouvelle recette
            </button>

            {expandedId === 'new' && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <RecipeForm
                        form={form} setForm={setForm}
                        ingredientRows={ingredientRows}
                        updateIngredientRow={updateIngredientRow}
                        addIngredientRow={addIngredientRow}
                        removeIngredientRow={removeIngredientRow}
                        searchProducts={searchProducts}
                        selectProduct={selectProduct}
                        clearProduct={clearProduct}
                        onSave={saveRecipe}
                        onCancel={closeForm}
                        saving={saving}
                        error={error}
                    />
                </div>
            )}

            {recipes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucune recette pour le moment.</p>
            ) : (
                <div className="space-y-3">
                    {recipes.map(recipe => {
                        const isExpanded = expandedId === recipe.id;
                        return (
                            <div key={recipe.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <div className="flex gap-3 p-3">
                                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                        {recipe.photo_url ? (
                                            <img src={recipe.photo_url} alt={recipe.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <ChefHat className="w-6 h-6 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-gray-900 truncate">{recipe.name}</p>
                                            {!recipe.is_active && (
                                                <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">Masquée</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {recipe.category || 'Sans catégorie'} · {recipe.ingredients.length} ingrédient{recipe.ingredients.length > 1 ? 's' : ''}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <button
                                                onClick={() => toggleActive(recipe)}
                                                className="text-[10px] font-bold text-blue-600 hover:underline"
                                            >
                                                {recipe.is_active ? 'Masquer' : 'Activer'}
                                            </button>
                                            <button
                                                onClick={() => deleteRecipe(recipe)}
                                                className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> Supprimer
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => (isExpanded ? closeForm() : openEdit(recipe))}
                                        className="flex-shrink-0 self-start p-2 rounded-full text-orange-600 hover:bg-orange-50 transition-colors"
                                        title="Modifier"
                                    >
                                        {isExpanded ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                    </button>
                                </div>

                                {isExpanded && (
                                    <RecipeForm
                                        form={form} setForm={setForm}
                                        ingredientRows={ingredientRows}
                                        updateIngredientRow={updateIngredientRow}
                                        addIngredientRow={addIngredientRow}
                                        removeIngredientRow={removeIngredientRow}
                                        searchProducts={searchProducts}
                                        selectProduct={selectProduct}
                                        clearProduct={clearProduct}
                                        onSave={saveRecipe}
                                        onCancel={closeForm}
                                        saving={saving}
                                        error={error}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const RecipeForm = ({
    form, setForm, ingredientRows, updateIngredientRow, addIngredientRow, removeIngredientRow,
    searchProducts, selectProduct, clearProduct, onSave, onCancel, saving, error,
}) => (
    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
        <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nom de la recette"
            className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        />
        <textarea
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            rows={2}
            className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
            <select
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                className="bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            >
                {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
                value={form.difficulty}
                onChange={(e) => setForm(f => ({ ...f, difficulty: e.target.value }))}
                className="bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            >
                {RECIPE_DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <input
                type="number"
                min="1"
                value={form.servings}
                onChange={(e) => setForm(f => ({ ...f, servings: e.target.value }))}
                placeholder="Portions"
                className="bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <input
                type="number"
                min="1"
                value={form.prep_time_minutes}
                onChange={(e) => setForm(f => ({ ...f, prep_time_minutes: e.target.value }))}
                placeholder="Préparation (min)"
                className="bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
        </div>
        <input
            type="url"
            value={form.photo_url}
            onChange={(e) => setForm(f => ({ ...f, photo_url: e.target.value }))}
            placeholder="URL de la photo (optionnel)"
            className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        />

        <div className="pt-2 border-t border-gray-200">
            <p className="text-xs font-bold text-gray-700 mb-2">Ingrédients</p>
            <div className="space-y-2">
                {ingredientRows.map(row => (
                    <div key={row.key} className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={row.ingredient_name}
                                onChange={(e) => updateIngredientRow(row.key, { ingredient_name: e.target.value })}
                                placeholder="Nom de l'ingrédient"
                                className="flex-1 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                            <button
                                onClick={() => removeIngredientRow(row.key)}
                                className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={row.quantity}
                                onChange={(e) => updateIngredientRow(row.key, { quantity: e.target.value })}
                                placeholder="Qté"
                                className="w-16 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                            <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => updateIngredientRow(row.key, { unit: e.target.value })}
                                placeholder="Unité"
                                className="w-24 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                            <input
                                type="text"
                                value={row.notes}
                                onChange={(e) => updateIngredientRow(row.key, { notes: e.target.value })}
                                placeholder="Notes (optionnel)"
                                className="flex-1 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        {row.product_id ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg py-1.5 px-2">
                                <span className="text-[11px] font-bold text-green-700 flex items-center gap-1 truncate">
                                    <Check className="w-3 h-3 flex-shrink-0" /> {row.product_name || 'Produit associé'}
                                </span>
                                <button onClick={() => clearProduct(row.key)} className="text-green-600 flex-shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={row.productQuery}
                                        onChange={(e) => searchProducts(row.key, e.target.value)}
                                        placeholder="Associer un produit du catalogue (optionnel)"
                                        className="w-full pl-7 pr-2 py-1.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                {row.productResults.length > 0 && (
                                    <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
                                        {row.productResults.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => selectProduct(row.key, p)}
                                                className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-orange-50 transition-colors"
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {row.productQuery.trim() && row.productResults.length === 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1 px-1">Aucun produit correspondant.</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={addIngredientRow}
                className="mt-2 text-xs font-bold text-orange-600 hover:underline flex items-center gap-1"
            >
                <Plus className="w-3.5 h-3.5" /> Ajouter un ingrédient
            </button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
            <button
                onClick={onCancel}
                className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm font-bold py-2.5 rounded-lg transition-colors hover:bg-gray-50"
            >
                Annuler
            </button>
            <button
                onClick={onSave}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
            >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
        </div>
    </div>
);

export default RecipeAdmin;
