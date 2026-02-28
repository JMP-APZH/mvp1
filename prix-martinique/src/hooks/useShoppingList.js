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
        const { data } = await supabase
            .from('shopping_lists')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_primary', true)
            .maybeSingle();

        if (data) return data.id;

        const { data: newList, error } = await supabase
            .from('shopping_lists')
            .insert({ user_id: user.id, name: 'Mon Panier', is_primary: true })
            .select('id')
            .single();

        if (error) throw error;
        return newList.id;
    };

    const fetchItems = async (id) => {
        const { data, error } = await supabase
            .from('shopping_list_items')
            .select('product_id, quantity, products(name)')
            .eq('list_id', id)
            .order('added_at', { ascending: true });

        if (error) throw error;

        return (data || []).map(row => ({
            productId: row.product_id,
            name: row.products?.name || 'Produit inconnu',
            quantity: row.quantity,
            photo: null, // product photos live in prices table; Package icon shown as fallback
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
