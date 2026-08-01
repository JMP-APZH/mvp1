import { useState, useEffect, useRef } from 'react';
import { enqueueCartOp } from '../utils/offlineDb';

/**
 * useShoppingList
 *
 * Manages the shopping list with Supabase persistence for authenticated users
 * and localStorage fallback for anonymous users.
 *
 * On login, any items stored in localStorage are automatically migrated to
 * Supabase and localStorage is cleared.
 *
 * Item shape (UI): { productId: uuid, name: string, quantity: number, photo: string|null }
 * DB shape: shopping_lists (one per user, is_primary=true) + shopping_list_items rows
 *
 * Offline: when `isOnline` is false (or a write fails mid-flight), the four write
 * actions below skip the Supabase call, queue the operation in IndexedDB instead
 * (see offlineDb.js / syncQueue.js for the drain-on-reconnect side), and still apply
 * the same optimistic local-state update as the online path -- so the UI behaves
 * identically either way, only the persistence timing differs.
 */
export function useShoppingList(supabase, user, isOnline = true) {
    const [shoppingList, setShoppingList] = useState([]);
    const [listId, setListId] = useState(null);

    // Refs so async callbacks always read fresh values without being recreated
    const userRef = useRef(user);
    const listIdRef = useRef(listId);
    const shoppingListRef = useRef(shoppingList);
    const isOnlineRef = useRef(isOnline);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { listIdRef.current = listId; }, [listId]);
    useEffect(() => { shoppingListRef.current = shoppingList; }, [shoppingList]);
    useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

    // ── Supabase helpers ────────────────────────────────────────────────────

    const getOrCreatePrimaryList = async () => {
        // .maybeSingle() errors out (returning null data, silently swallowed here
        // since only `data` was destructured) whenever more than one row matches --
        // which then fell through to creating ANOTHER primary list every time this
        // ran, compounding indefinitely. .limit(1) + explicit ordering tolerates
        // duplicates deterministically (oldest wins) instead of erroring.
        const { data, error } = await supabase
            .from('shopping_lists')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_primary', true)
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) throw error;
        if (data && data.length > 0) return data[0].id;

        const { data: newList, error: insertError } = await supabase
            .from('shopping_lists')
            .insert({ user_id: user.id, name: 'Mon Panier', is_primary: true })
            .select('id')
            .single();

        if (insertError) throw insertError;
        return newList.id;
    };

    const fetchItems = async (id) => {
        const { data, error } = await supabase
            .from('shopping_list_items')
            .select('product_id, quantity, products(name)')
            .eq('list_id', id)
            .order('added_at', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return [];

        const productIds = data.map(row => row.product_id);

        const { data: photoRows } = await supabase
            .from('prices')
            .select('product_id, product_photo_url')
            .in('product_id', productIds)
            .not('product_photo_url', 'is', null)
            .order('created_at', { ascending: false });

        // Keep only the most recent photo per product (first row wins due to sort)
        const photoByProduct = {};
        (photoRows || []).forEach(row => {
            if (!photoByProduct[row.product_id]) {
                photoByProduct[row.product_id] = row.product_photo_url;
            }
        });

        return data.map(row => ({
            productId: row.product_id,
            name: row.products?.name || 'Produit inconnu',
            quantity: row.quantity,
            photo: photoByProduct[row.product_id] || null,
        }));
    };

    // Small local snapshot of the authenticated cart, refreshed on every change --
    // exists purely so a reload while offline (before syncShoppingList's Supabase
    // call can succeed) has something better to fall back to than an empty list.
    // Not a source of truth; Supabase always wins once reachable.
    const cacheKeyForUser = (userId) => `shoppingList_cache_${userId}`;

    // Loads the shopping list from the right source for the current auth state --
    // Supabase for a signed-in user, localStorage for an anonymous one. Kept as a
    // single function (rather than an if/else directly in the effect below) with
    // one shared try/catch, since that shape is what this ESLint/React-hooks
    // version's set-state-in-effect analysis recognizes as effect-safe.
    const syncShoppingList = async () => {
        try {
            if (user) {
                const id = await getOrCreatePrimaryList();
                setListId(id);
                listIdRef.current = id;

                let items = await fetchItems(id);

                // Migrate any localStorage items that exist from before sign-in
                const raw = localStorage.getItem('shoppingList');
                if (raw) {
                    const localItems = JSON.parse(raw);
                    if (localItems.length > 0) {
                        const existingIds = new Set(items.map(i => i.productId));
                        const toMigrate = localItems.filter(i => !existingIds.has(i.productId));

                        if (toMigrate.length > 0) {
                            await supabase.from('shopping_list_items').insert(
                                toMigrate.map(item => ({
                                    list_id: id,
                                    product_id: item.productId,
                                    quantity: item.quantity,
                                }))
                            );
                            items = await fetchItems(id);
                        }
                    }
                    localStorage.removeItem('shoppingList');
                }

                setShoppingList(items);
            } else {
                // Revert to localStorage for anonymous users
                const saved = localStorage.getItem('shoppingList');
                setShoppingList(saved ? JSON.parse(saved) : []);
                setListId(null);
            }
        } catch (err) {
            console.error('Erreur chargement panier:', err);
            // Offline (or Supabase otherwise unreachable) on initial/refresh load for
            // an authenticated user -- fall back to the last known local snapshot
            // instead of leaving the cart looking empty until connectivity returns.
            if (user) {
                const cached = localStorage.getItem(cacheKeyForUser(user.id));
                if (cached) setShoppingList(JSON.parse(cached));
            }
        }
    };

    // Switch data source when auth state changes. Standard fetch-on-dependency-change
    // effect (same pattern used cleanly elsewhere in this codebase, e.g.
    // Leaderboard.jsx/Community.jsx). (Previously carried an additional
    // `react-hooks/set-state-in-effect` suppression -- confirmed a false positive at
    // the time per eslint-plugin-react-hooks@7.0.1's known inconsistency on this
    // shape, and no longer triggers at all after the offline-fallback catch block
    // above changed this function's surface shape.)
    useEffect(() => {
        syncShoppingList();
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist to localStorage for anonymous users only
    useEffect(() => {
        if (!userRef.current) {
            localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
        }
    }, [shoppingList]);

    // Mirror the authenticated cart into its own fallback cache too (see
    // syncShoppingList's catch above) -- cheap, no photos, just the same
    // small shape already used for the anonymous localStorage path.
    useEffect(() => {
        if (userRef.current) {
            localStorage.setItem(cacheKeyForUser(userRef.current.id), JSON.stringify(shoppingList));
        }
    }, [shoppingList]);

    // ── Public actions ──────────────────────────────────────────────────────

    const addToShoppingList = async (product) => {
        const currentUser = userRef.current;
        const currentListId = listIdRef.current;
        const currentList = shoppingListRef.current;
        const existing = currentList.find(i => i.productId === product.id);

        if (currentUser && currentListId) {
            if (existing) {
                const newQty = existing.quantity + 1;

                if (!isOnlineRef.current) {
                    await enqueueCartOp({ type: 'update_quantity', productId: product.id, quantity: newQty });
                } else {
                    try {
                        const { error } = await supabase
                            .from('shopping_list_items')
                            .update({ quantity: newQty })
                            .eq('list_id', currentListId)
                            .eq('product_id', product.id);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Erreur mise à jour quantité (mise en attente):', err);
                        await enqueueCartOp({ type: 'update_quantity', productId: product.id, quantity: newQty });
                    }
                }

                setShoppingList(prev =>
                    prev.map(i => i.productId === product.id ? { ...i, quantity: newQty } : i)
                );
            } else {
                const newItem = {
                    productId: product.id,
                    name: product.name || product.product,
                    quantity: 1,
                    photo: product.productPhotoUrl || null,
                };

                if (!isOnlineRef.current) {
                    await enqueueCartOp({ type: 'add', productId: product.id, quantity: 1 });
                    setShoppingList(prev => [...prev, newItem]);
                    return;
                }

                const { error } = await supabase
                    .from('shopping_list_items')
                    .insert({ list_id: currentListId, product_id: product.id, quantity: 1 });

                if (!error) {
                    setShoppingList(prev => [...prev, newItem]);
                } else if (error.code === '23505') {
                    // Unique-constraint conflict: the item is already in the DB list
                    // but local state didn't know that (stale after a slow round-trip,
                    // a second tab/device, etc.) -- previously this branch did nothing,
                    // leaving the "+ Panier" button stuck forever with no feedback,
                    // indistinguishable from the add having silently failed. Resync
                    // local state to the real DB row instead of dropping it.
                    const { data: row } = await supabase
                        .from('shopping_list_items')
                        .select('quantity')
                        .eq('list_id', currentListId)
                        .eq('product_id', product.id)
                        .single();

                    if (row) {
                        setShoppingList(prev => {
                            const alreadyTracked = prev.some(i => i.productId === product.id);
                            if (alreadyTracked) {
                                return prev.map(i => i.productId === product.id ? { ...i, quantity: row.quantity } : i);
                            }
                            return [...prev, { ...newItem, quantity: row.quantity }];
                        });
                    }
                } else {
                    // Any other failure (including a connection drop mid-request) --
                    // queue it for retry rather than silently losing the add.
                    console.error('Erreur ajout panier (mise en attente):', error);
                    await enqueueCartOp({ type: 'add', productId: product.id, quantity: 1 });
                    setShoppingList(prev => [...prev, newItem]);
                }
            }
        } else {
            // Anonymous user — localStorage path
            setShoppingList(prev => {
                const ex = prev.find(i => i.productId === product.id);
                if (ex) {
                    return prev.map(i =>
                        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
                    );
                }
                return [...prev, {
                    productId: product.id,
                    name: product.name || product.product,
                    quantity: 1,
                    photo: product.productPhotoUrl || null,
                }];
            });
        }
    };

    const removeFromShoppingList = async (productId) => {
        const currentUser = userRef.current;
        const currentListId = listIdRef.current;

        if (currentUser && currentListId) {
            if (!isOnlineRef.current) {
                await enqueueCartOp({ type: 'remove', productId });
            } else {
                try {
                    const { error } = await supabase
                        .from('shopping_list_items')
                        .delete()
                        .eq('list_id', currentListId)
                        .eq('product_id', productId);
                    if (error) throw error;
                } catch (err) {
                    console.error('Erreur suppression panier (mise en attente):', err);
                    await enqueueCartOp({ type: 'remove', productId });
                }
            }
        }
        setShoppingList(prev => prev.filter(i => i.productId !== productId));
    };

    const updateQuantity = async (productId, newQuantity) => {
        if (newQuantity <= 0) {
            await removeFromShoppingList(productId);
            return;
        }
        const currentUser = userRef.current;
        const currentListId = listIdRef.current;

        if (currentUser && currentListId) {
            if (!isOnlineRef.current) {
                await enqueueCartOp({ type: 'update_quantity', productId, quantity: newQuantity });
            } else {
                try {
                    const { error } = await supabase
                        .from('shopping_list_items')
                        .update({ quantity: newQuantity })
                        .eq('list_id', currentListId)
                        .eq('product_id', productId);
                    if (error) throw error;
                } catch (err) {
                    console.error('Erreur mise à jour quantité (mise en attente):', err);
                    await enqueueCartOp({ type: 'update_quantity', productId, quantity: newQuantity });
                }
            }
        }
        setShoppingList(prev =>
            prev.map(i => i.productId === productId ? { ...i, quantity: newQuantity } : i)
        );
    };

    const clearShoppingList = async () => {
        if (!window.confirm('Voulez-vous vraiment vider votre panier ?')) return;

        const currentUser = userRef.current;
        const currentListId = listIdRef.current;

        if (currentUser && currentListId) {
            if (!isOnlineRef.current) {
                await enqueueCartOp({ type: 'clear' });
            } else {
                try {
                    const { error } = await supabase
                        .from('shopping_list_items')
                        .delete()
                        .eq('list_id', currentListId);
                    if (error) throw error;
                } catch (err) {
                    console.error('Erreur vidage panier (mise en attente):', err);
                    await enqueueCartOp({ type: 'clear' });
                }
            }
        }
        setShoppingList([]);
    };

    return {
        shoppingList,
        addToShoppingList,
        removeFromShoppingList,
        updateQuantity,
        clearShoppingList,
        getOrCreatePrimaryList,
        refreshShoppingList: syncShoppingList,
    };
}
