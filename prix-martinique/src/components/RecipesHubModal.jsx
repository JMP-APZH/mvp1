import React, { useState, useEffect, useCallback } from 'react';
import { X, ChefHat, Heart, Bookmark, Plus, Sparkles } from 'lucide-react';
import { posthog } from '../posthogClient';
import { MEAL_CATEGORIES, mealCategoryLabel } from '../constants/mealCategories';

// "Idées recettes" hub: official (admin-curated) recipes + community-submitted
// recipe ideas, pulled out of ShoppingList.jsx into its own full-screen modal
// so the Panier tab itself only needs a short entry-point link and stays
// focused on favorites/basket info (per request, Aug 2026).
const RecipesHubModal = ({ items, onAddItem, onSelectRecipe, onRequireAuth, onClose, supabase, user }) => {
    // Official, admin-curated recipes -- logic moved unchanged from ShoppingList.jsx.
    const [officialRecipes, setOfficialRecipes] = useState([]);
    const [loadingOfficial, setLoadingOfficial] = useState(true);
    const [ingredientsByRecipe, setIngredientsByRecipe] = useState({});
    const [recipePriceInfo, setRecipePriceInfo] = useState({});

    // Community-submitted recipe ideas.
    const [ideas, setIdeas] = useState([]);
    const [loadingIdeas, setLoadingIdeas] = useState(true);
    const [ideasUnavailable, setIdeasUnavailable] = useState(false);
    const [mealFilter, setMealFilter] = useState(null);
    const [showSubmitForm, setShowSubmitForm] = useState(false);
    const [ideaTitle, setIdeaTitle] = useState('');
    const [ideaDescription, setIdeaDescription] = useState('');
    const [ideaMealCategory, setIdeaMealCategory] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [favoritedIdeaIds, setFavoritedIdeaIds] = useState(new Set());

    useEffect(() => {
        posthog.capture('recettes_hub_opened');
    }, []);

    useEffect(() => {
        const loadOfficial = async () => {
            setLoadingOfficial(true);
            try {
                const { data: recipeRows, error: recipesError } = await supabase
                    .from('recipes')
                    .select('*')
                    .eq('is_active', true)
                    .order('name', { ascending: true });
                if (recipesError) throw recipesError;
                setOfficialRecipes(recipeRows || []);

                const recipeIds = (recipeRows || []).map(r => r.id);
                if (recipeIds.length === 0) {
                    setIngredientsByRecipe({});
                    setRecipePriceInfo({});
                    return;
                }

                const { data: ingredientRows, error: ingredientsError } = await supabase
                    .from('recipe_ingredients')
                    .select('*')
                    .in('recipe_id', recipeIds)
                    .order('display_order', { ascending: true });
                if (ingredientsError) throw ingredientsError;

                const byRecipe = {};
                (ingredientRows || []).forEach(i => {
                    if (!byRecipe[i.recipe_id]) byRecipe[i.recipe_id] = [];
                    byRecipe[i.recipe_id].push(i);
                });
                setIngredientsByRecipe(byRecipe);

                const productIds = [...new Set((ingredientRows || []).filter(i => i.product_id).map(i => i.product_id))];
                let cheapestByProduct = {};
                if (productIds.length > 0) {
                    const { data: priceRows } = await supabase
                        .from('prices')
                        .select('product_id, price, created_at, origin_region_code')
                        .in('product_id', productIds)
                        .order('created_at', { ascending: false });
                    // Never .neq('origin_region_code', 'Hexagone') server-side -- NULL rows
                    // (the normal case for Martinique scans) get dropped by three-valued logic.
                    const byProduct = {};
                    (priceRows || []).forEach(r => {
                        if (r.origin_region_code === 'Hexagone') return;
                        if (!byProduct[r.product_id]) byProduct[r.product_id] = [];
                        byProduct[r.product_id].push(r.price);
                    });
                    Object.entries(byProduct).forEach(([pid, prices]) => {
                        cheapestByProduct[pid] = Math.min(...prices);
                    });
                }

                const priceInfo = {};
                (recipeRows || []).forEach(r => {
                    const ingredients = byRecipe[r.id] || [];
                    const matched = ingredients.filter(i => i.product_id && cheapestByProduct[i.product_id] != null);
                    priceInfo[r.id] = {
                        estimatedTotal: matched.reduce((sum, i) => sum + cheapestByProduct[i.product_id], 0),
                        matchedCount: matched.length,
                        totalCount: ingredients.length,
                    };
                });
                setRecipePriceInfo(priceInfo);
            } catch (err) {
                console.error('Error loading recipes:', err);
            } finally {
                setLoadingOfficial(false);
            }
        };
        loadOfficial();
    }, [supabase]);

    const loadIdeas = useCallback(async () => {
        setLoadingIdeas(true);
        try {
            const { data: ideaRows, error } = await supabase
                .from('community_recipe_ideas')
                .select('id, title, description, meal_category, user_id, created_at, community_recipe_idea_likes(user_id)')
                .order('created_at', { ascending: false });
            if (error) throw error;

            const userIds = [...new Set((ideaRows || []).map(i => i.user_id))];
            let profileByUserId = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, display_name')
                    .in('id', userIds);
                profileByUserId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
            }

            const enriched = (ideaRows || []).map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                mealCategory: i.meal_category,
                createdAt: i.created_at,
                authorName: profileByUserId[i.user_id]?.display_name || 'Anonyme',
                likeCount: i.community_recipe_idea_likes?.length || 0,
                likedByMe: user ? i.community_recipe_idea_likes?.some(l => l.user_id === user.id) : false,
            })).sort((a, b) => b.likeCount - a.likeCount || new Date(b.createdAt) - new Date(a.createdAt));

            setIdeas(enriched);
            setIdeasUnavailable(false);

            if (user) {
                const { data: favRows } = await supabase
                    .from('community_recipe_idea_favorites')
                    .select('idea_id')
                    .eq('user_id', user.id);
                setFavoritedIdeaIds(new Set((favRows || []).map(f => f.idea_id)));
            } else {
                setFavoritedIdeaIds(new Set());
            }
        } catch (err) {
            // The migration adding these tables may not be applied yet in every
            // environment -- degrade to an honest "pas encore disponible" state
            // rather than breaking the whole hub (same pattern already used for
            // product_test_flag_migration.sql / mainland_price_migration.sql).
            console.error('Error loading community recipe ideas:', err);
            setIdeas([]);
            setIdeasUnavailable(true);
        } finally {
            setLoadingIdeas(false);
        }
    }, [supabase, user]);

    useEffect(() => { loadIdeas(); }, [loadIdeas]);

    const addAllIngredients = (recipe, ingredients) => {
        const toAdd = ingredients.filter(i => i.product_id && !items.some(it => it.productId === i.product_id));
        toAdd.forEach(i => onAddItem?.({ id: i.product_id, name: i.ingredient_name, productPhotoUrl: null }));
        posthog.capture('recipe_ingredients_added_to_list', {
            recipe_id: recipe.id,
            ingredient_count: toAdd.length,
            source: 'card',
        });
    };

    const submitIdea = async () => {
        if (!user) {
            onRequireAuth?.();
            return;
        }
        if (!ideaTitle.trim() || !ideaMealCategory) {
            setSubmitError('Ajoutez un titre et choisissez une catégorie.');
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const { error } = await supabase.from('community_recipe_ideas').insert([{
                user_id: user.id,
                title: ideaTitle.trim(),
                description: ideaDescription.trim() || null,
                meal_category: ideaMealCategory,
            }]);
            if (error) throw error;
            posthog.capture('community_recipe_idea_submitted', { meal_category: ideaMealCategory });
            setIdeaTitle('');
            setIdeaDescription('');
            setIdeaMealCategory('');
            setShowSubmitForm(false);
            await loadIdeas();
        } catch (err) {
            console.error('Error submitting recipe idea:', err);
            setSubmitError("Impossible d'enregistrer votre idée pour le moment.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleLike = async (idea) => {
        if (!user) {
            onRequireAuth?.();
            return;
        }
        try {
            if (idea.likedByMe) {
                await supabase.from('community_recipe_idea_likes').delete()
                    .eq('idea_id', idea.id).eq('user_id', user.id);
            } else {
                await supabase.from('community_recipe_idea_likes').insert([{ idea_id: idea.id, user_id: user.id }]);
            }
            posthog.capture('community_recipe_idea_liked', { idea_id: idea.id, liked: !idea.likedByMe });
            await loadIdeas();
        } catch (err) {
            console.error('Error toggling recipe idea like:', err);
        }
    };

    const toggleFavorite = async (idea) => {
        if (!user) {
            onRequireAuth?.();
            return;
        }
        const isFavorited = favoritedIdeaIds.has(idea.id);
        try {
            if (isFavorited) {
                await supabase.from('community_recipe_idea_favorites').delete()
                    .eq('idea_id', idea.id).eq('user_id', user.id);
            } else {
                await supabase.from('community_recipe_idea_favorites').insert([{ idea_id: idea.id, user_id: user.id }]);
            }
            posthog.capture('community_recipe_idea_favorited', { idea_id: idea.id, favorited: !isFavorited });
            setFavoritedIdeaIds(prev => {
                const next = new Set(prev);
                if (isFavorited) next.delete(idea.id); else next.add(idea.id);
                return next;
            });
        } catch (err) {
            console.error('Error toggling recipe idea favorite:', err);
        }
    };

    const filteredIdeas = mealFilter ? ideas.filter(i => i.mealCategory === mealFilter) : ideas;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-orange-500" /> Idées recettes
                    </h3>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Official, admin-curated recipes */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recettes officielles</h4>
                        {loadingOfficial ? (
                            <div className="p-4 text-center text-gray-400 text-xs bg-gray-50 rounded-lg">Chargement...</div>
                        ) : officialRecipes.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-xs bg-gray-50 rounded-lg border border-dashed">
                                Aucune recette disponible pour le moment.
                            </div>
                        ) : (
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {officialRecipes.map(recipe => {
                                    const ingredients = ingredientsByRecipe[recipe.id] || [];
                                    const priceInfo = recipePriceInfo[recipe.id];
                                    const matchedIngredients = ingredients.filter(i => i.product_id);
                                    const allAdded = matchedIngredients.length > 0 &&
                                        matchedIngredients.every(i => items.some(it => it.productId === i.product_id));
                                    return (
                                        <div key={recipe.id} className="flex-shrink-0 w-32 bg-white border border-gray-200 rounded-lg p-2">
                                            <button onClick={() => onSelectRecipe?.(recipe.id)} className="block w-full text-left">
                                                <div className="w-full h-16 rounded bg-gray-100 flex items-center justify-center overflow-hidden mb-1.5">
                                                    {recipe.photo_url ? (
                                                        <img src={recipe.photo_url} alt={recipe.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ChefHat className="w-6 h-6 text-gray-300" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-medium text-gray-900 leading-tight line-clamp-2 h-8">{recipe.name}</p>
                                                <p className="text-xs font-bold text-gray-700 mt-0.5">
                                                    {priceInfo?.matchedCount ? `~${priceInfo.estimatedTotal.toFixed(2)}€` : '—'}
                                                </p>
                                                <p className="text-[9px] text-gray-400">
                                                    {priceInfo ? `${priceInfo.matchedCount} sur ${priceInfo.totalCount} prix connu${priceInfo.matchedCount > 1 ? 's' : ''}` : ''}
                                                </p>
                                            </button>
                                            <button
                                                onClick={() => addAllIngredients(recipe, ingredients)}
                                                disabled={allAdded || matchedIngredients.length === 0}
                                                className={`w-full mt-1.5 text-[10px] font-bold py-1.5 rounded transition-colors ${allAdded ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                            >
                                                {allAdded ? 'Ajoutés ✓' : '+ Tout'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Community-submitted recipe ideas */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Idées de la communauté</h4>
                            <button
                                onClick={() => { if (!user) { onRequireAuth?.(); return; } setShowSubmitForm(v => !v); }}
                                className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Proposer une idée
                            </button>
                        </div>

                        {showSubmitForm && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                                <input
                                    type="text"
                                    value={ideaTitle}
                                    onChange={(e) => setIdeaTitle(e.target.value)}
                                    placeholder="Titre de la recette"
                                    className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <textarea
                                    value={ideaDescription}
                                    onChange={(e) => setIdeaDescription(e.target.value)}
                                    placeholder="Description (facultatif)"
                                    rows={2}
                                    className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                />
                                <select
                                    value={ideaMealCategory}
                                    onChange={(e) => setIdeaMealCategory(e.target.value)}
                                    className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="">Catégorie...</option>
                                    {MEAL_CATEGORIES.map(c => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                </select>
                                {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                                <button
                                    onClick={submitIdea}
                                    disabled={submitting || !ideaTitle.trim() || !ideaMealCategory}
                                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                                >
                                    Publier
                                </button>
                            </div>
                        )}

                        {/* Meal-time filter chips */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
                            <button
                                onClick={() => setMealFilter(null)}
                                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${!mealFilter ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                Tous
                            </button>
                            {MEAL_CATEGORIES.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setMealFilter(mealFilter === c.id ? null : c.id)}
                                    className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${mealFilter === c.id ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        {loadingIdeas ? (
                            <div className="p-4 text-center text-gray-400 text-xs bg-gray-50 rounded-lg">Chargement...</div>
                        ) : ideasUnavailable ? (
                            <div className="p-4 text-center text-gray-400 text-xs bg-gray-50 rounded-lg border border-dashed">
                                Les idées de la communauté arrivent bientôt.
                            </div>
                        ) : filteredIdeas.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-xs bg-gray-50 rounded-lg border border-dashed">
                                Aucune idée {mealFilter ? `pour "${mealCategoryLabel(mealFilter)}"` : ''} pour le moment. Soyez le premier à en proposer une !
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredIdeas.map(idea => (
                                    <div key={idea.id} className="bg-white border border-gray-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-1 gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-sm font-bold text-gray-900 truncate">{idea.title}</span>
                                                <span className="flex-shrink-0 text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                                    {mealCategoryLabel(idea.mealCategory)}
                                                </span>
                                            </div>
                                        </div>
                                        {idea.description && (
                                            <p className="text-sm text-gray-700 leading-snug">{idea.description}</p>
                                        )}
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] text-gray-400">
                                                Par {idea.authorName} · {new Date(idea.createdAt).toLocaleDateString('fr-FR')}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => toggleLike(idea)}
                                                    className={`flex items-center gap-1 text-xs font-bold transition-colors ${idea.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                                >
                                                    <Heart className={`w-3.5 h-3.5 ${idea.likedByMe ? 'fill-red-500' : ''}`} />
                                                    {idea.likeCount || 0}
                                                </button>
                                                <button
                                                    onClick={() => toggleFavorite(idea)}
                                                    className={`transition-colors ${favoritedIdeaIds.has(idea.id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                                    title={favoritedIdeaIds.has(idea.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                                >
                                                    <Bookmark className={`w-3.5 h-3.5 ${favoritedIdeaIds.has(idea.id) ? 'fill-yellow-400' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!ideasUnavailable && (
                            <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] text-orange-800 leading-snug">
                                    Les idées les plus appréciées pourront rejoindre nos recettes officielles, avec leurs ingrédients liés aux produits scannés par la communauté.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecipesHubModal;
