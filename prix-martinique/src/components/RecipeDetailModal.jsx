import React, { useState, useEffect } from 'react';
import { X, ChefHat, Loader2, Share2, Link2, Check, ShoppingBasket, Clock, Users as UsersIcon, Flame } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { posthog } from '../posthogClient';

const RECIPE_COOKED_POINTS = 15;

const RecipeDetailModal = ({ recipeId, onClose, onRequireAuth, onAddItem, shoppingListItems }) => {
    const { user, awardPoints } = useAuth();
    const [loading, setLoading] = useState(true);
    const [recipe, setRecipe] = useState(null);
    const [ingredients, setIngredients] = useState([]);
    const [priceByProduct, setPriceByProduct] = useState({});
    const [cooking, setCooking] = useState(false);
    const [cookMessage, setCookMessage] = useState(null);
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        if (!recipeId) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data: recipeData, error: recipeError } = await supabase
                    .from('recipes')
                    .select('*')
                    .eq('id', recipeId)
                    .single();
                if (recipeError) throw recipeError;
                setRecipe(recipeData);

                const { data: ingredientRows, error: ingredientsError } = await supabase
                    .from('recipe_ingredients')
                    .select('*')
                    .eq('recipe_id', recipeId)
                    .order('display_order', { ascending: true });
                if (ingredientsError) throw ingredientsError;
                setIngredients(ingredientRows || []);

                const productIds = [...new Set((ingredientRows || []).filter(i => i.product_id).map(i => i.product_id))];
                if (productIds.length > 0) {
                    const { data: priceRows, error: priceError } = await supabase
                        .from('prices')
                        .select('product_id, price, created_at, origin_region_code')
                        .in('product_id', productIds)
                        .order('created_at', { ascending: false });
                    if (priceError) throw priceError;

                    // Never use .neq('origin_region_code', 'Hexagone') server-side -- NULL rows
                    // (the normal case for Martinique scans) get dropped by Postgres's three-valued
                    // logic. Filter client-side instead, same pattern used everywhere else in this app.
                    const byProduct = {};
                    (priceRows || []).forEach(r => {
                        if (r.origin_region_code === 'Hexagone') return;
                        if (!byProduct[r.product_id]) byProduct[r.product_id] = [];
                        byProduct[r.product_id].push(r.price);
                    });
                    const cheapest = {};
                    Object.entries(byProduct).forEach(([pid, prices]) => {
                        cheapest[pid] = Math.min(...prices);
                    });
                    setPriceByProduct(cheapest);
                } else {
                    setPriceByProduct({});
                }

                posthog.capture('recipe_viewed', { recipe_id: recipeId });
            } catch (err) {
                console.error('Error loading recipe detail:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [recipeId]);

    if (!recipeId) return null;

    const matchedIngredients = ingredients.filter(i => i.product_id);
    const knownPriceIngredients = matchedIngredients.filter(i => priceByProduct[i.product_id] != null);
    const estimatedTotal = knownPriceIngredients.reduce((sum, i) => sum + priceByProduct[i.product_id], 0);
    const isInCart = (ingredient) => shoppingListItems?.some(it => it.productId === ingredient.product_id);
    const allAdded = matchedIngredients.length > 0 && matchedIngredients.every(isInCart);

    const addIngredient = (ingredient) => {
        if (!ingredient.product_id) return;
        onAddItem?.({ id: ingredient.product_id, name: ingredient.ingredient_name, productPhotoUrl: null });
    };

    const addAllIngredients = () => {
        const toAdd = matchedIngredients.filter(i => !isInCart(i));
        toAdd.forEach(addIngredient);
        posthog.capture('recipe_ingredients_added_to_list', {
            recipe_id: recipeId,
            ingredient_count: toAdd.length,
            source: 'modal',
        });
    };

    const cookRecipe = async () => {
        if (!user) {
            onRequireAuth?.();
            return;
        }
        setCooking(true);
        setCookMessage(null);
        try {
            const { error } = await supabase.from('recipe_cooked_log').insert([{
                recipe_id: recipeId,
                user_id: user.id,
                points_awarded: RECIPE_COOKED_POINTS,
            }]);
            if (error) {
                if (error.code === '23505') {
                    setCookMessage('Déjà cuisiné aujourd\'hui — revenez demain pour regagner des points !');
                    return;
                }
                throw error;
            }
            await awardPoints('recipe_cooked', RECIPE_COOKED_POINTS, `Recette cuisinée : ${recipe?.name}`);
            posthog.capture('recipe_cooked', { recipe_id: recipeId, points_awarded: RECIPE_COOKED_POINTS });
            setCookMessage(`+${RECIPE_COOKED_POINTS} points !`);
        } catch (err) {
            console.error('Error logging cooked recipe:', err);
            posthog.captureException(err, { context: 'recipe_cooked' });
            setCookMessage("Erreur lors de l'enregistrement.");
        } finally {
            setCooking(false);
        }
    };

    const shareUrl = `${window.location.origin}${window.location.pathname}?recipe=${recipeId}`;

    const shareWhatsApp = () => {
        const text = `Regarde cette recette "${recipe?.name || 'martiniquaise'}" sur Prix Martinique : ${shareUrl}`;
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
                            {recipe?.photo_url ? (
                                <img src={recipe.photo_url} alt={recipe.name} className="w-full h-full object-cover" />
                            ) : (
                                <ChefHat className="w-8 h-8 text-white/70" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold leading-tight line-clamp-2">
                                {recipe?.name || '...'}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {recipe?.servings && (
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <UsersIcon className="w-3 h-3" /> {recipe.servings} pers.
                                    </span>
                                )}
                                {recipe?.prep_time_minutes && (
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {recipe.prep_time_minutes} min
                                    </span>
                                )}
                                {recipe?.difficulty && (
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Flame className="w-3 h-3" /> {recipe.difficulty}
                                    </span>
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
                            {recipe?.description && (
                                <p className="text-sm text-gray-600 leading-snug">{recipe.description}</p>
                            )}

                            {/* Estimated cost */}
                            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-black text-orange-600 tabular-nums">
                                        {knownPriceIngredients.length > 0 ? `~${estimatedTotal.toFixed(2)}€` : '—'}
                                    </div>
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-orange-400 mt-1">
                                        Coût estimé
                                    </p>
                                </div>
                                <p className="text-xs text-gray-500 text-right max-w-[55%]">
                                    {knownPriceIngredients.length} sur {ingredients.length} ingrédient{ingredients.length > 1 ? 's' : ''} avec prix connu
                                </p>
                            </div>

                            {/* Ingredients */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3">Ingrédients</h3>
                                <div className="space-y-2">
                                    {ingredients.map(ingredient => {
                                        const price = ingredient.product_id ? priceByProduct[ingredient.product_id] : null;
                                        const added = isInCart(ingredient);
                                        return (
                                            <div key={ingredient.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl p-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{ingredient.ingredient_name}</p>
                                                    <p className="text-[11px] text-gray-400">
                                                        {[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')}
                                                        {ingredient.notes ? ` — ${ingredient.notes}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs font-bold text-gray-700 tabular-nums">
                                                        {price != null ? `${price.toFixed(2)}€` : (
                                                            <span className="text-gray-300 italic font-normal">Prix inconnu</span>
                                                        )}
                                                    </span>
                                                    {ingredient.product_id && (
                                                        <button
                                                            onClick={() => addIngredient(ingredient)}
                                                            disabled={added}
                                                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${added ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                                        >
                                                            {added ? 'Ajouté ✓' : '+ Panier'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={addAllIngredients}
                                    disabled={allAdded || matchedIngredients.length === 0}
                                    className="w-full mt-3 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
                                >
                                    <ShoppingBasket className="w-4 h-4" />
                                    {allAdded ? 'Tous les ingrédients sont dans le panier' : 'Ajouter tous les ingrédients'}
                                </button>
                                <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                                    Chaque ingrédient est ajouté en quantité 1 — ajustez dans le panier si besoin de plus.
                                </p>
                            </div>

                            {/* Cooked / gamification */}
                            <div className="border-t border-gray-100 pt-4">
                                <button
                                    onClick={cookRecipe}
                                    disabled={cooking}
                                    className="w-full bg-gray-900 hover:bg-black disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
                                >
                                    {cooking ? 'Enregistrement...' : "J'ai cuisiné cette recette ✅"}
                                </button>
                                {cookMessage && (
                                    <p className="text-xs text-center text-gray-500 mt-2">{cookMessage}</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecipeDetailModal;
