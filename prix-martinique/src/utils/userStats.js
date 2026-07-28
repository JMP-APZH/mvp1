/**
 * Shared user-stat calculations, used anywhere a user's own savings figure
 * needs to be shown (PersoStats.jsx, UserMenu.jsx dropdown). Kept in one
 * place deliberately -- this app previously had two separate copies of a
 * "Mes Économies" calculation that drifted (one real, one a fake
 * scan-count * 0.85 placeholder); a single source of truth prevents that
 * from happening again.
 */

/**
 * For each product the user has priced, compare their price against the
 * highest price observed for that same product across all stores/users,
 * and sum the positive differences.
 * @param {object} supabase
 * @param {string} userId
 * @returns {Promise<number>} total estimated savings in euros
 */
export async function calculateSavings(supabase, userId) {
    const { data: ownPrices } = await supabase
        .from('prices')
        .select('product_id, price')
        .eq('user_id', userId);

    const productIds = [...new Set((ownPrices || []).map(p => p.product_id))];
    if (productIds.length === 0) return 0;

    const { data: allPricesForProducts } = await supabase
        .from('prices')
        .select('product_id, price')
        .in('product_id', productIds);

    const maxByProduct = {};
    (allPricesForProducts || []).forEach(p => {
        if (!(p.product_id in maxByProduct) || p.price > maxByProduct[p.product_id]) {
            maxByProduct[p.product_id] = p.price;
        }
    });

    return (ownPrices || []).reduce((total, p) => {
        const highest = maxByProduct[p.product_id] ?? p.price;
        return total + Math.max(0, highest - p.price);
    }, 0);
}
