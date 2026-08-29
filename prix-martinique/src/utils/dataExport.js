import { supabase } from '../supabaseClient';

// GDPR Article 20 (data portability) self-service export -- every query here
// reads only the caller's own rows, already permitted under existing RLS
// policies (the same ones that let a signed-in user see their own favorites,
// prices, etc. today), so no admin/service-role access is needed for this.
export async function exportUserData(user, userProfile) {
    const [
        { data: prices },
        { data: badges },
        { data: favorites },
        { data: favoriteStores },
        { data: lists },
        { data: recipeIdeas },
    ] = await Promise.all([
        supabase.from('prices')
            .select('price, created_at, products(name, barcode), stores(name)')
            .eq('user_id', user.id),
        supabase.from('user_badges')
            .select('earned_at, badges(name, description)')
            .eq('user_id', user.id),
        supabase.from('user_favorites')
            .select('products(name, barcode)')
            .eq('user_id', user.id),
        supabase.from('user_favorite_stores')
            .select('stores(name)')
            .eq('user_id', user.id),
        supabase.from('shopping_lists')
            .select('name, created_at, shopping_list_items(quantity, is_checked, added_at, products(name))')
            .eq('user_id', user.id),
        supabase.from('community_recipe_ideas')
            .select('title, description, meal_category, created_at')
            .eq('user_id', user.id),
    ]);

    return {
        export_date: new Date().toISOString(),
        profile: {
            email: user.email,
            display_name: userProfile?.display_name || null,
            region_code: userProfile?.region_code || null,
            city: userProfile?.city || null,
            account_created_at: user.created_at,
        },
        price_submissions: prices || [],
        badges: badges || [],
        favorite_products: favorites || [],
        favorite_stores: favoriteStores || [],
        shopping_lists: lists || [],
        recipe_ideas: recipeIdeas || [],
    };
}

export function downloadUserDataAsJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prix-martinique-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
