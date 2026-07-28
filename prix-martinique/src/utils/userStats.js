/**
 * Shared user-stat calculations, used anywhere a user's own savings figure
 * needs to be shown (PersoStats.jsx, UserMenu.jsx dropdown, MyScansModal.jsx
 * per-scan badges). Kept in one place deliberately -- this app previously
 * had two separate copies of a "Mes Économies" calculation that drifted
 * (one real, one a fake scan-count * 0.85 placeholder); a single source of
 * truth prevents that from happening again.
 *
 * Methodology: for each price the user has personally submitted, compare it
 * against the AVERAGE price observed for that same product (across all
 * stores/users) within the last SAVINGS_WINDOW_DAYS, and sum the positive
 * differences. Deliberately average, not the highest-ever price -- comparing
 * against the single highest price ever recorded is the most flattering
 * baseline mathematically possible, not a representative one, and a stale
 * outlier from many months ago could distort it indefinitely. The window
 * keeps the comparison baseline current instead of comparing against
 * arbitrarily old data.
 */

const SAVINGS_WINDOW_DAYS = 365;

async function fetchComparisonAverages(supabase, productIds) {
    const since = new Date(Date.now() - SAVINGS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
        .from('prices')
        .select('product_id, price')
        .in('product_id', productIds)
        .gte('created_at', since);

    const sums = {};
    const counts = {};
    (data || []).forEach(p => {
        sums[p.product_id] = (sums[p.product_id] || 0) + p.price;
        counts[p.product_id] = (counts[p.product_id] || 0) + 1;
    });

    const avgByProduct = {};
    Object.keys(sums).forEach(id => { avgByProduct[id] = sums[id] / counts[id]; });
    return avgByProduct;
}

/**
 * @param {object} supabase
 * @param {string} userId
 * @returns {Promise<{ total: number, byScanId: Record<string, number> }>}
 *   total: sum of all positive differences, in euros.
 *   byScanId: per `prices.id` savings amount, only for scans that actually
 *   beat the comparison average (used for per-row badges in Mes Scans).
 */
export async function calculateSavingsBreakdown(supabase, userId) {
    const { data: ownPrices } = await supabase
        .from('prices')
        .select('id, product_id, price')
        .eq('user_id', userId);

    const rows = ownPrices || [];
    const productIds = [...new Set(rows.map(p => p.product_id))];
    if (productIds.length === 0) return { total: 0, byScanId: {} };

    const avgByProduct = await fetchComparisonAverages(supabase, productIds);

    const byScanId = {};
    let total = 0;
    rows.forEach(p => {
        const avg = avgByProduct[p.product_id];
        if (avg == null) return; // no comparison data in the window -- honest zero, not counted
        const diff = Math.max(0, avg - p.price);
        if (diff > 0) byScanId[p.id] = diff;
        total += diff;
    });

    return { total, byScanId };
}

/**
 * Convenience wrapper for callers that only need the aggregate number
 * (the dropdown tile, PersoStats.jsx's headline figure).
 * @returns {Promise<number>} total estimated savings in euros
 */
export async function calculateSavings(supabase, userId) {
    const { total } = await calculateSavingsBreakdown(supabase, userId);
    return total;
}
