import { useState, useEffect, useRef } from 'react';

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
 */
export function useShoppingList(supabase, user) {
    const [shoppingList, setShoppingList] = useState([]);
    const [listId, setListId] = useState(null);

    // Refs so async callbacks always read fresh values without being recreated
    const userRef = useRef(user);
    const listIdRef = useRef(listId);
    const shoppingListRef = useRef(shoppingList);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { listIdRef.current = listId; }, [listId]);
    useEffect(() => { shoppingListRef.current = shoppingList; }, [shoppingList]);

    // Switch data source when auth state changes
    useEffect(() => {
        if (user) {
            loadFromSupabase();
        } else {
            // Revert to localStorage for anonymous users
            const saved = localStorage.getItem('shoppingList');
            setShoppingList(saved ? JSON.parse(saved) : []);
            setListId(null);
        }
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist to localStorage for anonymous users only
    useEffect(() => {
        if (!userRef.current) {
            localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
        }
    }, [shoppingList]);

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

    const loadFromSupabase = async () => {
        try {
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
        } catch (err) {
            console.error('Erreur chargement panier:', err);
        }
    };

    // ── Public actions ──────────────────────────────────────────────────────

    const addToShoppingList = async (product) => {
        const currentUser = userRef.current;
        const currentListId = listIdRef.current;
        const currentList = shoppingListRef.current;
        const existing = currentList.find(i => i.productId === product.id);

        if (currentUser && currentListId) {
            if (existing) {
                const newQty = existing.quantity + 1;
                await supabase
                    .from('shopping_list_items')
                    .update({ quantity: newQty })
                    .eq('list_id', currentListId)
                    .eq('product_id', product.id);

                setShoppingList(prev =>
                    prev.map(i => i.productId === product.id ? { ...i, quantity: newQty } : i)
                );
            } else {
                const { error } = await supabase
                    .from('shopping_list_items')
                    .insert({ list_id: currentListId, product_id: product.id, quantity: 1 });

                if (!error) {
                    setShoppingList(prev => [...prev, {
                        productId: product.id,
                        name: product.name || product.product,
                        quantity: 1,
                        photo: product.productPhotoUrl || null,
                    }]);
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
                            return [...prev, {
                                productId: product.id,
                                name: product.name || product.product,
                                quantity: row.quantity,
                                photo: product.productPhotoUrl || null,
                            }];
                        });
                    }
                } else {
                    console.error('Erreur ajout panier:', error);
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
            await supabase
                .from('shopping_list_items')
                .delete()
                .eq('list_id', currentListId)
                .eq('product_id', productId);
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
            await supabase
                .from('shopping_list_items')
                .update({ quantity: newQuantity })
                .eq('list_id', currentListId)
                .eq('product_id', productId);
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
            await supabase
                .from('shopping_list_items')
                .delete()
                .eq('list_id', currentListId);
        }
        setShoppingList([]);
    };

    return {
        shoppingList,
        addToShoppingList,
        removeFromShoppingList,
        updateQuantity,
        clearShoppingList,
    };
}
