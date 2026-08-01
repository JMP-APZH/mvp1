/**
 * applyCartOp — the single place that actually writes a shopping-list mutation to
 * Supabase. Used both by useShoppingList.js's live actions (when online) and by
 * syncQueue.js's drainer (replaying a queued op after reconnecting) -- one function,
 * two callers, so the two paths can't drift apart.
 *
 * op: { type: 'add' | 'update_quantity' | 'remove' | 'clear', productId?, quantity? }
 */
export async function applyCartOp(supabase, listId, op) {
    switch (op.type) {
        case 'add': {
            const { error } = await supabase
                .from('shopping_list_items')
                .insert({ list_id: listId, product_id: op.productId, quantity: op.quantity ?? 1 });
            // 23505 = item already exists server-side (e.g. added from another
            // device while this one was offline) -- treat as success, not an error.
            if (error && error.code !== '23505') throw error;
            return;
        }
        case 'update_quantity': {
            const { error } = await supabase
                .from('shopping_list_items')
                .update({ quantity: op.quantity })
                .eq('list_id', listId)
                .eq('product_id', op.productId);
            if (error) throw error;
            return;
        }
        case 'remove': {
            const { error } = await supabase
                .from('shopping_list_items')
                .delete()
                .eq('list_id', listId)
                .eq('product_id', op.productId);
            if (error) throw error;
            return;
        }
        case 'clear': {
            const { error } = await supabase
                .from('shopping_list_items')
                .delete()
                .eq('list_id', listId);
            if (error) throw error;
            return;
        }
        default:
            throw new Error(`Unknown cart op type: ${op.type}`);
    }
}
