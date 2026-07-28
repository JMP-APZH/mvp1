/**
 * "Prix recherchés" -- for a user's favorite stores, find products the
 * community wants priced (favorited by at least one user, via the
 * get_product_favorite_counts() aggregate-only RPC -- see
 * product_favorite_counts_migration.sql) that haven't been priced at that
 * specific store yet.
 */

/**
 * @param {object} supabase
 * @param {string[]} storeIds - the user's own favorite store ids
 * @returns {Promise<Array<{ storeId, storeName, productId, productName, favoriteCount }>>}
 *   sorted by favoriteCount descending within each store.
 */
export async function getWantedScans(supabase, storeIds) {
    if (!storeIds || storeIds.length === 0) return [];

    const { data: counts, error: countsError } = await supabase.rpc('get_product_favorite_counts');
    if (countsError || !counts || counts.length === 0) return [];

    const favoriteProductIds = counts.map(c => c.product_id);
    const countByProduct = Object.fromEntries(counts.map(c => [c.product_id, c.favorite_count]));

    const [{ data: existingPrices }, { data: products }, { data: stores }] = await Promise.all([
        supabase.from('prices').select('store_id, product_id').in('store_id', storeIds).in('product_id', favoriteProductIds),
        supabase.from('products').select('id, name').in('id', favoriteProductIds),
        supabase.from('stores').select('id, name').in('id', storeIds),
    ]);

    const alreadyPriced = new Set((existingPrices || []).map(p => `${p.store_id}:${p.product_id}`));
    const nameByProduct = Object.fromEntries((products || []).map(p => [p.id, p.name]));
    const nameByStore = Object.fromEntries((stores || []).map(s => [s.id, s.name]));

    const wanted = [];
    storeIds.forEach(storeId => {
        favoriteProductIds.forEach(productId => {
            if (alreadyPriced.has(`${storeId}:${productId}`)) return;
            wanted.push({
                storeId,
                storeName: nameByStore[storeId] || 'Magasin inconnu',
                productId,
                productName: nameByProduct[productId] || 'Produit inconnu',
                favoriteCount: countByProduct[productId] || 0,
            });
        });
    });

    return wanted.sort((a, b) => b.favoriteCount - a.favoriteCount);
}
