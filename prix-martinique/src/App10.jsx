import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import BQPVerifier from './components/BQPVerifier';

import { Camera, Search, TrendingDown, BarChart3, Users, Package, AlertCircle, Image as ImageIcon, X, Share, Star, Info, ShieldCheck, ThumbsUp, ThumbsDown, Heart, ShoppingBasket, Bookmark, Leaf, ScanLine, MapPin } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import Leaderboard from './components/Leaderboard';
import AboutPage from './components/AboutPage';
import ZXingBarcodeScanner from './components/ZXingBarcodeScanner';
import StoreSelectionWizard from './components/StoreSelectionWizard';
import ShoppingList from './components/ShoppingList';
import Community from './components/Community';

const ImageWithSkeleton = ({ src, alt, className, ...props }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
            {!loaded && (
                <div className="absolute inset-0 animate-pulse bg-gray-200" />
            )}
            <img
                src={src}
                alt={alt}
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLoaded(true)}
                {...props}
            />
        </div>
    );
};

const PriceHistoryChart = ({ data }) => {
    if (!data || data.length < 2) return null;

    return (
        <div className="bg-white border border-gray-100 rounded-lg p-3 mt-4">
            <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                Évolution du prix (TTC)
            </p>
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#94a3b8' }}
                        />
                        <YAxis
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#94a3b8' }}
                            tickFormatter={(val) => `${val}€`}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white border shadow-sm p-2 rounded-lg text-xs">
                                            <p className="font-bold text-gray-900">{payload[0].value.toFixed(2)}€</p>
                                            <p className="text-gray-500">{payload[0].payload.fullDate}</p>
                                            <p className="text-orange-600 font-medium">{payload[0].payload.store}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const App10 = () => {

    const [activeTab, setActiveTab] = useState('scan');
    const [showScanner, setShowScanner] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [recentPrices, setRecentPrices] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [bqpCheckResult, setBqpCheckResult] = useState(null); // { status: 'loading' | 'found' | 'not_found', product: ..., category: ... }
    const [bqpVoteStats, setBqpVoteStats] = useState({ upvotes: 0, downvotes: 0, userVote: 0 }); // userVote: 1 (up), -1 (down), 0 (none)
    const [bqpQualityStats, setBqpQualityStats] = useState({ upvotes: 0, downvotes: 0, userVote: 0 });
    const [priceHistory, setPriceHistory] = useState([]);
    const [showBqpSelector, setShowBqpSelector] = useState(false);
    const [scannedProduct, setScannedProduct] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [manualEntry, setManualEntry] = useState({
        productName: '',
        barcode: '',
        price: '',
        storeId: '',
        userName: '',
        productPhoto: null,
        priceTagPhoto: null,
        isDeclaredBqp: false,
        categoryId: null,
        isLocal: false
    });
    const [categories, setCategories] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState(null);

    const [shoppingList, setShoppingList] = useState(() => {
        // Initialize from localStorage to prevent overwriting
        const savedList = localStorage.getItem('shoppingList');
        return savedList ? JSON.parse(savedList) : [];
    });
    const productPhotoInputRef = useRef(null);
    const priceTagPhotoInputRef = useRef(null);

    // Save Shopping List to LocalStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
    }, [shoppingList]);

    const addToShoppingList = (product) => {
        setShoppingList(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                return [...prev, {
                    productId: product.id,
                    name: product.name || product.product, // Handle different objects
                    quantity: 1,
                    photo: product.productPhotoUrl || null // Handle unavailable photo
                }];
            }
        });
        // Feedback
        // alert("Produit ajouté au panier !"); // Too intrusive?
    };

    const removeFromShoppingList = (productId) => {
        setShoppingList(prev => prev.filter(item => item.productId !== productId));
    };

    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromShoppingList(productId);
            return;
        }
        setShoppingList(prev => prev.map(item =>
            item.productId === productId ? { ...item, quantity: newQuantity } : item
        ));
    };

    const clearShoppingList = () => {
        if (window.confirm("Voulez-vous vraiment vider votre panier ?")) {
            setShoppingList([]);
        }
    };

    // Auth context
    const { user, userProfile, awardPoints, refreshProfile, userFavorites, toggleFavorite } = useAuth();

    // Detect iOS device
    const isIOS = () => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    // Check if running as installed PWA
    const isInstalledPWA = () => {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    };

    // PWA Install Prompt (Android) or iOS instructions
    useEffect(() => {
        // Android install prompt
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // iOS: Show install prompt if not installed and on iOS
        if (isIOS() && !isInstalledPWA()) {
            setShowInstallPrompt(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Android
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setShowInstallPrompt(false);
            }

            setDeferredPrompt(null);
        }
        // iOS instructions are shown inline, no action needed
    };

    // Load stores from Supabase
    useEffect(() => {
        loadStores();
    }, []);

    // Load recent prices from Supabase
    useEffect(() => {
        loadRecentPrices();

        // Set up real-time subscription for new prices
        const subscription = supabase
            .channel('prices_channel')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'prices' },
                (payload) => {
                    loadRecentPrices(); // Reload when new price is added
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Set username from profile when user logs in
    useEffect(() => {
        if (userProfile?.display_name && !manualEntry.userName) {
            setManualEntry(prev => ({ ...prev, userName: userProfile.display_name }));
        }
    }, [userProfile]);

    const loadStores = async () => {
        try {
            const { data, error } = await supabase
                .from('stores')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;
            setStores(data || []);
        } catch (err) {
            console.error('Error loading stores:', err);
            setError('Erreur lors du chargement des magasins');
        }
    };

    const loadRecentPrices = async () => {
        try {
            setLoading(true);

            // Fetch categories for the selector
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('*')
                .order('display_order', { ascending: true });

            if (categoriesData) setCategories(categoriesData);

            // Join prices with products and stores to get all info
            const { data, error } = await supabase
                .from('prices')
                .select(`
                  id,
                  price,
                  user_name,
                  user_id,
                  created_at,
                  product_photo_url,
                  price_tag_photo_url,
                  products (id, name, barcode, category_id, is_local_production),
                  stores (name, full_address),
                  price_likes (user_id)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const transformedPrices = data.map(item => ({
                id: item.id,
                productId: item.products?.id,
                categoryId: item.products?.category_id,
                product: item.products?.name || 'Produit inconnu',
                isLocal: item.products?.is_local_production,
                barcode: item.products?.barcode,
                price: item.price,
                store: item.stores?.name || 'Magasin inconnu',
                location: item.stores?.full_address,
                userName: item.user_name || 'Anonyme',
                userId: item.user_id,
                date: new Date(item.created_at).toLocaleDateString('fr-FR'),
                productPhotoUrl: item.product_photo_url,
                priceTagPhotoUrl: item.price_tag_photo_url,
                likesCount: item.price_likes?.length || 0,
                isLikedByUser: item.price_likes?.some(l => l.user_id === user?.id)
            }));

            setRecentPrices(transformedPrices);
            setLoading(false);
        } catch (err) {
            console.error('Error loading prices:', err);
            setError('Erreur lors du chargement des prix');
            setLoading(false);
        }
    };

    // Handle barcode detection from ZXingBarcodeScanner
    // Handle barcode detection from ZXingBarcodeScanner
    const handleBarcodeDetected = async (code) => {
        console.log('Barcode detected:', code);
        setShowScanner(false);

        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        setManualEntry(prev => ({ ...prev, barcode: code }));

        // Start BQP Check
        setBqpCheckResult({ status: 'loading' });

        try {
            // 1. Check if product exists
            const { data: product, error: prodError } = await supabase
                .from('products')
                .select('id, name, barcode')
                .eq('barcode', code)
                .single();

            if (prodError && prodError.code !== 'PGRST116') throw prodError;

            if (product) {
                setScannedProduct(product);

                // Fetch the most recent price for this product
                const { data: latestPriceData } = await supabase
                    .from('prices')
                    .select('*, stores(name)')
                    .eq('product_id', product.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                // 2. Check for BQP association
                const { data: association, error: assocError } = await supabase
                    .from('product_bqp_associations')
                    .select('*, bqp_categories(*)')
                    .eq('product_id', product.id)
                    .single();

                if (assocError && assocError.code !== 'PGRST116') throw assocError;

                if (association) {
                    setBqpCheckResult({
                        status: 'found',
                        category: association.bqp_categories,
                        product: product,
                        associationId: association.id, // Store association ID for voting
                        latestPrice: latestPriceData
                    });
                    setActiveTab('scan'); // stay on scan

                    // Fetch history
                    fetchPriceHistory(product.id);

                    // Fetch existing votes
                    fetchBqpVotes(association.id);

                } else {
                    setBqpCheckResult({
                        status: 'not_found',
                        product: product,
                        latestPrice: latestPriceData
                    });
                    fetchPriceHistory(product.id);
                }
            } else {
                // New product
                setBqpCheckResult({ status: 'new_product', barcode: code });
            }

        } catch (err) {
            console.error('Error checking BQP status:', err);
            // Fallback to manual entry
            alert(`Code-barres détecté: ${code}`);
        }
    };

    const handleBqpSelect = async (category) => {
        if (!scannedProduct) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('product_bqp_associations')
                .insert([{
                    product_id: scannedProduct.id,
                    bqp_category_id: category.id,
                    is_verified: true // User initiated link
                }]);

            if (error) throw error;

            alert(`Produit associé à la catégorie BQP: ${category.code}`);
            setShowBqpSelector(false);
            setBqpCheckResult({
                status: 'found',
                category: category,
                product: scannedProduct
            });

        } catch (err) {
            console.error('Error linking BQP:', err);
            alert('Erreur lors de l\'association BQP');
        } finally {
            setLoading(false);
        }
    };

    const fetchBqpVotes = async (associationId) => {
        try {
            // Get vote counts
            const { count: upvotes } = await supabase
                .from('bqp_votes')
                .select('*', { count: 'exact', head: true })
                .eq('association_id', associationId)
                .eq('vote_type', 1);

            const { count: downvotes } = await supabase
                .from('bqp_votes')
                .select('*', { count: 'exact', head: true })
                .eq('association_id', associationId)
                .eq('vote_type', -1);

            // Get user's vote if logged in
            let userVote = 0;
            if (user) {
                const { data } = await supabase
                    .from('bqp_votes')
                    .select('vote_type')
                    .eq('association_id', associationId)
                    .eq('user_id', user.id)
                    .single();

                if (data) userVote = data.vote_type;
            }

            setBqpVoteStats({ upvotes: upvotes || 0, downvotes: downvotes || 0, userVote });

            // Also fetch quality votes
            fetchBqpQualityVotes(bqpCheckResult.product.id);
        } catch (err) {
            console.error('Error fetching votes:', err);
        }
    };

    const fetchBqpQualityVotes = async (productId) => {
        try {
            const { count: upvotes } = await supabase
                .from('bqp_quality_votes')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', productId)
                .eq('vote', 1);

            const { count: downvotes } = await supabase
                .from('bqp_quality_votes')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', productId)
                .eq('vote', -1);

            let userVote = 0;
            if (user) {
                const { data } = await supabase
                    .from('bqp_quality_votes')
                    .select('vote')
                    .eq('product_id', productId)
                    .eq('user_id', user.id)
                    .single();
                if (data) userVote = data.vote;
            }
            setBqpQualityStats({ upvotes: upvotes || 0, downvotes: downvotes || 0, userVote });
        } catch (err) {
            console.error('Error fetching quality votes:', err);
        }
    };

    const handleQualityVote = async (voteValue) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }
        if (!bqpCheckResult?.product?.id) return;

        try {
            const productId = bqpCheckResult.product.id;
            const newVote = bqpQualityStats.userVote === voteValue ? 0 : voteValue;

            // Optimistic update
            setBqpQualityStats(prev => {
                let newUp = prev.upvotes - (prev.userVote === 1 ? 1 : 0);
                let newDown = prev.downvotes - (prev.userVote === -1 ? 1 : 0);
                if (newVote === 1) newUp++;
                if (newVote === -1) newDown++;
                return { upvotes: newUp, downvotes: newDown, userVote: newVote };
            });

            if (newVote === 0) {
                await supabase.from('bqp_quality_votes').delete().eq('product_id', productId).eq('user_id', user.id);
            } else {
                await supabase.from('bqp_quality_votes').upsert({
                    product_id: productId,
                    user_id: user.id,
                    vote: voteValue
                }, { onConflict: 'user_id, product_id' });
            }
        } catch (err) {
            console.error('Error voting on quality:', err);
        }
    };

    const fetchPriceHistory = async (productId) => {
        try {
            const { data, error } = await supabase
                .from('prices')
                .select('price, created_at, stores(name)')
                .eq('product_id', productId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Format for Recharts
            const formatted = data.map(p => ({
                date: new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                fullDate: new Date(p.created_at).toLocaleDateString('fr-FR'),
                price: p.price,
                store: p.stores?.name
            }));

            setPriceHistory(formatted);
        } catch (err) {
            console.error('Error fetching history:', err);
        }
    };



    const handleVote = async (voteType) => {
        if (!user) {
            alert("Vous devez être connecté pour voter !");
            setShowAuthModal(true);
            return;
        }

        if (!bqpCheckResult?.associationId) return;

        try {
            // Optimistic update
            setBqpVoteStats(prev => {
                // Remove old vote
                let newUp = prev.upvotes - (prev.userVote === 1 ? 1 : 0);
                let newDown = prev.downvotes - (prev.userVote === -1 ? 1 : 0);

                // Add new vote (toggle off if clicking same)
                const newVote = prev.userVote === voteType ? 0 : voteType;

                if (newVote === 1) newUp++;
                if (newVote === -1) newDown++;

                return { upvotes: newUp, downvotes: newDown, userVote: newVote };
            });

            const associationId = bqpCheckResult.associationId;

            // If toggling off
            if (bqpVoteStats.userVote === voteType) {
                await supabase
                    .from('bqp_votes')
                    .delete()
                    .eq('association_id', associationId)
                    .eq('user_id', user.id);
            } else {
                // Upsert new vote
                await supabase
                    .from('bqp_votes')
                    .upsert({
                        association_id: associationId,
                        user_id: user.id,
                        vote_type: voteType
                    }, { onConflict: 'association_id, user_id' });
            }

        } catch (err) {
            console.error('Error voting:', err);
            alert('Erreur lors du vote');
            // Revert state (could implement proper rollback here)
        }
    };

    const handlePhotoCapture = (photoType) => {
        if (photoType === 'product') {
            productPhotoInputRef.current?.click();
        } else {
            priceTagPhotoInputRef.current?.click();
        }
    };

    const handlePhotoChange = (e, photoType) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (photoType === 'product') {
                    setManualEntry(prev => ({ ...prev, productPhoto: reader.result }));
                } else {
                    setManualEntry(prev => ({ ...prev, priceTagPhoto: reader.result }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const removePhoto = (photoType) => {
        if (photoType === 'product') {
            setManualEntry(prev => ({ ...prev, productPhoto: null }));
        } else {
            setManualEntry(prev => ({ ...prev, priceTagPhoto: null }));
        }
    };

    // Helper to toggle favorites
    const handleToggleFavorite = async (productId) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        try {
            const { error } = await toggleFavorite(productId);
            if (error) {
                console.error('Error toggling favorite:', error);
                // AuthContext usually handles rollback, but we can alert if needed
            }
        } catch (err) {
            console.error('Unexpected error toggling favorite:', err);
        }
    };

    const handleToggleLike = async (priceId, isLiked) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        try {
            if (isLiked) {
                // Remove like
                await supabase
                    .from('price_likes')
                    .delete()
                    .eq('price_id', priceId)
                    .eq('user_id', user.id);
            } else {
                // Add like
                await supabase
                    .from('price_likes')
                    .insert([{ price_id: priceId, user_id: user.id }]);

                // Award symbolic point for "gratefulness" or community spirit? 
                // Maybe for the price owner? For now just refresh.
            }
            loadRecentPrices();
        } catch (err) {
            console.error('Error toggling like:', err);
        }
    };

    const submitPrice = async () => {
        if (!manualEntry.productName || !manualEntry.price || !manualEntry.storeId) {
            alert('Veuillez remplir tous les champs obligatoires (produit, prix, magasin)');
            return;
        }

        if (!manualEntry.categoryId && !manualEntry.barcode) {
            // Optional: Force category for new non-barcoded items?
            // For now, let's make it optional but recommended in UI
        }

        try {
            setLoading(true);
            setError(null);

            // Step 1: Check if product exists or create it
            let productId;

            if (manualEntry.barcode) {
                // Try to find by barcode first
                const { data: existingProduct } = await supabase
                    .from('products')
                    .select('id')
                    .eq('barcode', manualEntry.barcode)
                    .single();

                productId = existingProduct?.id;
            }

            if (!productId) {
                // Try to find by name
                const { data: existingProduct } = await supabase
                    .from('products')
                    .select('id')
                    .ilike('name', manualEntry.productName)
                    .single();

                productId = existingProduct?.id;
            }

            if (!productId) {
                // Create new product
                const { data: newProduct, error: productError } = await supabase
                    .from('products')
                    .insert([{
                        name: manualEntry.productName,
                        barcode: manualEntry.barcode || null,
                        category: null, // Legacy field
                        category_id: manualEntry.categoryId || null,
                        is_local_production: manualEntry.isLocal || false,
                        is_declared_bqp: manualEntry.isDeclaredBqp || false
                    }])
                    .select()
                    .single();

                if (productError) throw productError;
                productId = newProduct.id;
            }

            // Step 2: Upload photos if they exist
            let productPhotoUrl = null;
            let priceTagPhotoUrl = null;

            if (manualEntry.productPhoto) {
                const fileName = `${Date.now()}_${productId}_product.jpg`;
                const base64Data = manualEntry.productPhoto.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('product-photos')
                    .upload(fileName, blob);

                if (uploadError) {
                    console.error('Product photo upload error:', uploadError);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('product-photos')
                        .getPublicUrl(fileName);
                    productPhotoUrl = urlData.publicUrl;
                }
            }

            if (manualEntry.priceTagPhoto) {
                const fileName = `${Date.now()}_${productId}_pricetag.jpg`;
                const base64Data = manualEntry.priceTagPhoto.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('price-tag-photos')
                    .upload(fileName, blob);

                if (uploadError) {
                    console.error('Price tag photo upload error:', uploadError);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('price-tag-photos')
                        .getPublicUrl(fileName);
                    priceTagPhotoUrl = urlData.publicUrl;
                }
            }

            // Step 3: Insert price with photo URLs and user_id if authenticated
            const priceData = {
                product_id: productId,
                store_id: manualEntry.storeId,
                price: parseFloat(manualEntry.price),
                user_name: manualEntry.userName || 'Anonyme',
                product_photo_url: productPhotoUrl,
                price_tag_photo_url: priceTagPhotoUrl
            };

            // Add user_id if authenticated
            if (user) {
                priceData.user_id = user.id;
            }

            const { error: priceError } = await supabase
                .from('prices')
                .insert([priceData]);

            if (priceError) throw priceError;

            // Step 4: Award points if user is authenticated
            let pointsAwarded = 0;
            if (user) {
                const { error: pointsError } = await awardPoints(
                    'price_submission',
                    10,
                    `Prix soumis: ${manualEntry.productName}`
                );

                if (!pointsError) {
                    pointsAwarded = 10;
                }
            }

            // Success message
            // Success message
            const successMessage = user
                ? `Prix enregistré avec succès! +${pointsAwarded} points`
                : 'Prix enregistré avec succès! Merci pour votre contribution.';

            // Check BQP status before alerting/resetting to decide flow
            let showBqpPrompt = false;
            let productForBqp = null;

            // Check if product is already BQP linked
            const { data: existingAssoc } = await supabase
                .from('product_bqp_associations')
                .select('id')
                .eq('product_id', productId)
                .single();

            if (!existingAssoc) {
                // Not linked? We should prompt!
                showBqpPrompt = true;
                // Fetch full product for the prompt state if needed
                if (manualEntry.barcode) {
                    const { data: p } = await supabase.from('products').select('*').eq('id', productId).single();
                    productForBqp = p;
                } else {
                    // If created by name, we might not have a barcode, but we have the ID and Name
                    const { data: p } = await supabase.from('products').select('*').eq('id', productId).single();
                    productForBqp = p;
                }
            }

            alert(successMessage);

            // Reset form but conditionally set BQP prompt
            setManualEntry(prev => ({
                productName: '',
                barcode: '',
                price: '',
                storeId: prev.storeId, // Keep shop selection persistent!
                userName: userProfile?.display_name || prev.userName, // Keep username
                productPhoto: null,
                priceTagPhoto: null,
                isDeclaredBqp: false,
                categoryId: null,
                isLocal: false
            }));

            if (showBqpPrompt && productForBqp) {
                setBqpCheckResult({
                    status: 'new_product', // Use 'new_product' to trigger the specific prompt text
                    product: productForBqp
                });
                setScannedProduct(productForBqp); // Important for the selector to work
            } else {
                setBqpCheckResult(null);
            }

            // Reload prices
            loadRecentPrices();
            setLoading(false);

        } catch (err) {
            console.error('Error submitting price:', err);
            setError('Erreur lors de l\'enregistrement du prix. Veuillez réessayer.');
            setLoading(false);
        }
    };

    const filteredPrices = recentPrices.filter(p => {
        const matchesQuery = p.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.store.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter ? p.categoryId === categoryFilter : true;
        return matchesQuery && matchesCategory;
    });

    const getProductStats = (productName) => {
        const productPrices = recentPrices.filter(p => p.product === productName);
        if (productPrices.length === 0) return null;

        const prices = productPrices.map(p => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

        // Calculate variance percentage
        const variance = min > 0 ? ((max - min) / min) * 100 : 0;

        return { min, max, avg, count: productPrices.length, variance };
    };

    // Calculate Community Basket (Standard essential items)
    const getCommunityBasket = () => {
        // Essential items identifiers (keywords in name)
        const essentials = [
            { name: 'Lait', icon: '🥛' },
            { name: 'Pain', icon: '🥖' },
            { name: 'Oeufs', icon: '🥚' },
            { name: 'Riz', icon: '🍚' },
            { name: 'Pâtes', icon: '🍝' },
            { name: 'Eau', icon: '💧' }
        ];

        // Group by chain (Carrefour, Super U, etc.)
        const chainCosts = {};

        recentPrices.forEach(p => {
            const chain = p.store.split(' ')[0]; // Basic chain detection from store name
            if (!chainCosts[chain]) chainCosts[chain] = { total: 0, items: new Set() };

            essentials.forEach(ess => {
                if (p.product.toLowerCase().includes(ess.name.toLowerCase())) {
                    // Update if it's the latest price for this essential in this chain
                    chainCosts[chain].total += p.price;
                    chainCosts[chain].items.add(ess.name);
                }
            });
        });

        // Filter chains that have at least 3 essential items
        return Object.entries(chainCosts)
            .filter(([_, data]) => data.items.size >= 2)
            .map(([chain, data]) => ({
                chain,
                total: data.total / data.items.size, // Average cost per item for fair comparison
                count: data.items.size
            }))
            .sort((a, b) => a.total - b.total);
    };

    // Get Top Price Gaps (high variance)
    const getPriceGaps = () => {
        const uniqueProducts = [...new Set(recentPrices.map(p => p.product))];
        return uniqueProducts
            .map(name => ({ name, stats: getProductStats(name) }))
            .filter(item => item.stats.count > 1 && item.stats.variance > 15) // At least 2 prices and 15% gap
            .sort((a, b) => b.stats.variance - a.stats.variance)
            .slice(0, 3);
    };

    return (
        <div className="max-w-2xl mx-auto bg-white min-h-screen">
            {/* ZXingBarcodeScanner - Full screen overlay when active */}
            {showScanner && (
                <ZXingBarcodeScanner
                    onDetected={handleBarcodeDetected}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {/* Header with UserMenu */}
            <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-xl font-bold">Vie chère en Martinique</h1>
                    <UserMenu onSignInClick={() => setShowAuthModal(true)} />
                </div>
                <p className="text-orange-100 text-sm">Quid de votre pouvoir d'achat</p>

                {/* Points indicator for logged in users */}
                {user && userProfile && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                        <div className="bg-white/20 rounded-full px-3 py-1 flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-300" />
                            <span>{userProfile.points || 0} points</span>
                        </div>
                        <div className="bg-white/20 rounded-full px-3 py-1">
                            Niveau {userProfile.level || 1}
                        </div>
                    </div>
                )}
            </div>

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />

            {/* Error Alert */}
            {error && (
                <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-red-800">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="text-xs text-red-600 underline mt-1"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}

            {/* PWA Install Prompt - Different for iOS vs Android */}
            {showInstallPrompt && (
                <div className="mx-4 mt-4 bg-amber-50 border border-amber-300 rounded-lg p-4">
                    {isIOS() ? (
                        // iOS-specific install instructions
                        <div>
                            <p className="text-sm font-semibold text-amber-900 mb-2">
                                Installer l'application sur iPhone/iPad
                            </p>
                            <div className="text-xs text-amber-700 space-y-2">
                                <p className="flex items-center gap-2">
                                    <span className="bg-amber-200 rounded px-1">1</span>
                                    Appuyez sur <Share className="w-4 h-4 inline" /> en bas de Safari
                                </p>
                                <p className="flex items-center gap-2">
                                    <span className="bg-amber-200 rounded px-1">2</span>
                                    Faites défiler et sélectionnez "Sur l'écran d'accueil"
                                </p>
                                <p className="flex items-center gap-2">
                                    <span className="bg-amber-200 rounded px-1">3</span>
                                    Appuyez sur "Ajouter"
                                </p>
                            </div>
                            <button
                                onClick={() => setShowInstallPrompt(false)}
                                className="mt-3 text-xs text-amber-600 underline"
                            >
                                J'ai compris
                            </button>
                        </div>
                    ) : (
                        // Android install prompt
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-900 mb-1">
                                Installer l'application
                            </p>
                            <p className="text-xs text-amber-700 mb-3">
                                Ajoutez Vie chère en Martinique à votre écran d'accueil pour un accès rapide !
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleInstallClick}
                                    className="text-xs bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600"
                                >
                                    Installer
                                </button>
                                <button
                                    onClick={() => setShowInstallPrompt(false)}
                                    className="text-xs text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-100"
                                >
                                    Plus tard
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation - Fixed for mobile */}
            <div className="flex border-b bg-white sticky top-0 shadow-sm z-[100]">
                <button
                    onClick={() => setActiveTab('scan')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'scan'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <Camera className="w-5 h-5" />
                        <span className="text-xs">Scanner</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('search')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'search'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <Search className="w-5 h-5" />
                        <span className="text-xs">Comparer</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('community')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'community'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <Users className="w-5 h-5" />
                        <span className="text-xs">Communauté</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'list'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="relative">
                            <ShoppingBasket className="w-5 h-5" />
                            {shoppingList.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {shoppingList.reduce((acc, item) => acc + item.quantity, 0)}
                                </span>
                            )}
                        </div>
                        <span className="text-xs">Panier</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('bqp')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'bqp'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-xs">BQP</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('about')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'about'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <Info className="w-5 h-5" />
                        <span className="text-xs">Info</span>
                    </div>
                </button>
            </div>

            {/* Content & Bottom Padding */}
            <div className="p-4 pb-20">
                {/* Tabs Placeholders */}
                {/* Scan Tab */}
                {activeTab === 'scan' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                <Users className="inline w-4 h-4 mr-1" />
                                <strong>{recentPrices.length}</strong> prix partagés par la communauté
                            </p>
                        </div>

                        {/* Sign in prompt for anonymous users */}
                        {!user && (
                            <div className="bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200 rounded-lg p-4">
                                <p className="text-sm text-orange-800 mb-2">
                                    <Star className="inline w-4 h-4 mr-1 text-orange-500" />
                                    Connectez-vous pour gagner des points et badges!
                                </p>
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="text-xs bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600"
                                >
                                    Se connecter
                                </button>
                            </div>
                        )}

                        {/* Shop Selection - NOW FIRST */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
                            {!manualEntry.storeId ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-orange-600 mb-2">
                                        <MapPin className="w-5 h-5" />
                                        <h3 className="font-bold">Où êtes-vous ?</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 italic">
                                        Sélectionnez votre magasin pour commencer à scanner
                                    </p>
                                    <StoreSelectionWizard
                                        supabase={supabase}
                                        selectedStoreId={manualEntry.storeId}
                                        onStoreSelect={(storeId) => setManualEntry({ ...manualEntry, storeId })}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Magasin Actuel</p>
                                            <h3 className="font-bold text-gray-900">
                                                {recentPrices.find(p => p.storeId === manualEntry.storeId)?.store || "Magasin sélectionné"}
                                            </h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setManualEntry({ ...manualEntry, storeId: '' })}
                                        className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 transition-colors"
                                    >
                                        Changer
                                    </button>
                                </div>
                            )}
                        </div>

                        {manualEntry.storeId && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                {/* Scanner UI */}
                                <div className="space-y-4">
                                    {showScanner ? (
                                        <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black aspect-square max-w-sm mx-auto">
                                            <ZXingBarcodeScanner
                                                onBarcodeDetected={handleBarcodeDetected}
                                                onClose={() => setShowScanner(false)}
                                            />
                                            <button
                                                onClick={() => setShowScanner(false)}
                                                className="absolute top-4 right-4 z-10 bg-white/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-white/40 transition-colors"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowScanner(true)}
                                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl p-4 shadow-md flex items-center justify-center gap-3 hover:shadow-lg transition-all"
                                        >
                                            <ScanLine className="w-6 h-6" />
                                            <span className="text-lg font-bold">Scanner un produit</span>
                                        </button>
                                    )}

                                    {/* BQP & Price Results */}
                                    {bqpCheckResult && bqpCheckResult.status === 'found' && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
                                            <ShieldCheck className="w-8 h-8 text-green-600" />
                                            <div>
                                                <h3 className="font-bold text-green-800">Produit BQP Vérifié !</h3>
                                                <p className="text-sm text-green-700">
                                                    {bqpCheckResult.category.code} - {bqpCheckResult.category.label}
                                                </p>
                                            </div>
                                            <div className="ml-auto flex flex-col items-end gap-2">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleToggleFavorite(bqpCheckResult.product.id)}
                                                        className="p-2 rounded-full bg-white border border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
                                                        title="Ajouter aux favoris"
                                                    >
                                                        <Bookmark className={`w-5 h-5 ${userFavorites.has(bqpCheckResult.product.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => addToShoppingList({
                                                            id: bqpCheckResult.product.id,
                                                            name: bqpCheckResult.product.name,
                                                            productPhotoUrl: null
                                                        })}
                                                        className={`p-2 rounded-full border transition-colors ${shoppingList.some(item => item.productId === bqpCheckResult.product.id)
                                                            ? 'bg-green-100 border-green-500 text-green-700'
                                                            : 'bg-white border-gray-200 text-gray-400 hover:text-green-600'
                                                            }`}
                                                    >
                                                        <ShoppingBasket className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleVote(1)}
                                                        className={`p-2 rounded-full border ${bqpVoteStats.userVote === 1 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}
                                                    >
                                                        <ThumbsUp className="w-4 h-4" />
                                                        <span className="text-[10px] font-bold block text-center">{bqpVoteStats.upvotes}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleVote(-1)}
                                                        className={`p-2 rounded-full border ${bqpVoteStats.userVote === -1 ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-400'}`}
                                                    >
                                                        <ThumbsDown className="w-4 h-4" />
                                                        <span className="text-[10px] font-bold block text-center">{bqpVoteStats.downvotes}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {(bqpCheckResult && (bqpCheckResult.status === 'not_found' || bqpCheckResult.status === 'new_product')) && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top-4 duration-300">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Info className="w-5 h-5 text-blue-600" />
                                                <h3 className="font-bold text-blue-800 text-sm">Produit non classé BQP</h3>
                                            </div>
                                            <p className="text-xs text-blue-700 mb-3">
                                                Voulez-vous lier ce produit à une catégorie BQP existante ?
                                            </p>
                                            <button
                                                onClick={() => setShowBqpSelector(true)}
                                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors"
                                            >
                                                Lier à une catégorie BQP
                                            </button>
                                        </div>
                                    )}

                                    {bqpCheckResult && bqpCheckResult.latestPrice && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 animate-in slide-in-from-top-4 duration-300">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingDown className="w-5 h-5 text-orange-600" />
                                                <h3 className="font-bold text-orange-800 text-sm">Vérification du prix</h3>
                                            </div>
                                            <p className="text-xs text-orange-700 mb-3">
                                                Dernier prix : <strong>{bqpCheckResult.latestPrice.price.toFixed(2)}€</strong> chez <strong>{bqpCheckResult.latestPrice.stores?.name}</strong>.
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        setLoading(true);
                                                        try {
                                                            const { error } = await supabase.from('prices').insert([{
                                                                product_id: bqpCheckResult.latestPrice.product_id,
                                                                store_id: bqpCheckResult.latestPrice.store_id,
                                                                price: bqpCheckResult.latestPrice.price,
                                                                user_name: userProfile?.display_name || 'Anonyme',
                                                                user_id: user?.id,
                                                                is_verified: true
                                                            }]);
                                                            if (error) throw error;
                                                            if (user) await awardPoints('price_submission', 5, `Prix vérifié: ${bqpCheckResult.product.name}`);
                                                            alert("Prix confirmé !");
                                                            setBqpCheckResult(null);
                                                            loadRecentPrices();
                                                        } catch (err) { console.error(err); }
                                                        finally { setLoading(false); }
                                                    }}
                                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-green-700"
                                                >
                                                    C'est le même
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setManualEntry(prev => ({
                                                            ...prev,
                                                            productName: bqpCheckResult.product.name,
                                                            barcode: bqpCheckResult.product.barcode,
                                                            storeId: bqpCheckResult.latestPrice.store_id,
                                                            price: ''
                                                        }));
                                                        document.getElementById('manual-entry-section')?.scrollIntoView({ behavior: 'smooth' });
                                                    }}
                                                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-gray-50"
                                                >
                                                    Il a changé
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {(bqpCheckResult?.status === 'found' || bqpCheckResult?.status === 'not_found' || bqpCheckResult?.status === 'new_product') && (
                                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                            <PriceHistoryChart data={priceHistory} />
                                        </div>
                                    )}
                                </div>

                                {/* BQP Category Picker Overlay */}
                                {showBqpSelector && (
                                    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
                                        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300">
                                            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50 backdrop-blur-sm sticky top-0 z-10">
                                                <div>
                                                    <h3 className="font-bold text-gray-900">Catégories BQP</h3>
                                                    <p className="text-xs text-gray-500">Choisissez la catégorie pour lier le produit</p>
                                                </div>
                                                <button onClick={() => setShowBqpSelector(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                                    <X className="w-5 h-5 text-gray-500" />
                                                </button>
                                            </div>
                                            <div className="overflow-y-auto p-4 scrollbar-hide">
                                                <BQPVerifier onSelect={handleBqpSelect} />
                                            </div>
                                        </div>
                                    </div>
                                )}


                                {/* Manual Entry Form */}
                                <div id="manual-entry-section" className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <h3 className="font-semibold text-gray-800 mb-3">Saisie manuelle</h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nom du produit *
                                        </label>
                                        <input
                                            type="text"
                                            value={manualEntry.productName}
                                            onChange={(e) => setManualEntry({ ...manualEntry, productName: e.target.value })}
                                            placeholder="Ex: Lait Lactel 1L"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Code-barres (optionnel)
                                        </label>
                                        <input
                                            type="text"
                                            value={manualEntry.barcode}
                                            onChange={(e) => setManualEntry({ ...manualEntry, barcode: e.target.value })}
                                            placeholder="Ex: 3254567890123"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Photo Upload Section */}
                                    <div className="space-y-3 pt-2 border-t">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Photos (optionnel)
                                        </label>

                                        {/* Product Photo */}
                                        <div>
                                            <p className="text-xs text-gray-600 mb-2">Photo du produit</p>
                                            {!manualEntry.productPhoto ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handlePhotoCapture('product')}
                                                    className="w-full border-2 border-dashed border-orange-300 rounded-lg p-4 hover:border-orange-500 transition-colors bg-orange-50"
                                                >
                                                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                                                    <p className="text-sm text-orange-600">Ajouter une photo du produit</p>
                                                </button>
                                            ) : (
                                                <div className="relative">
                                                    <img
                                                        src={manualEntry.productPhoto}
                                                        alt="Produit"
                                                        className="w-full h-40 object-cover rounded-lg"
                                                    />
                                                    <button
                                                        onClick={() => removePhoto('product')}
                                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                            <input
                                                ref={productPhotoInputRef}
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={(e) => handlePhotoChange(e, 'product')}
                                                className="hidden"
                                            />
                                        </div>

                                        {/* Price Tag Photo */}
                                        <div>
                                            <p className="text-xs text-gray-600 mb-2">Photo de l'étiquette de prix</p>
                                            {!manualEntry.priceTagPhoto ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handlePhotoCapture('priceTag')}
                                                    className="w-full border-2 border-dashed border-orange-300 rounded-lg p-4 hover:border-orange-500 transition-colors bg-orange-50"
                                                >
                                                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                                                    <p className="text-sm text-orange-600">Ajouter une photo de l'étiquette (incluant le code barres et son numéro lisible)</p>
                                                </button>
                                            ) : (
                                                <div className="relative">
                                                    <img
                                                        src={manualEntry.priceTagPhoto}
                                                        alt="Etiquette de prix"
                                                        className="w-full h-40 object-cover rounded-lg"
                                                    />
                                                    <button
                                                        onClick={() => removePhoto('priceTag')}
                                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                            <input
                                                ref={priceTagPhotoInputRef}
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={(e) => handlePhotoChange(e, 'priceTag')}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>



                                    {/* Category Selector */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Catégorie
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {categories.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setManualEntry({ ...manualEntry, categoryId: cat.id })}
                                                    className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors border min-h-[80px] ${manualEntry.categoryId === cat.id
                                                        ? 'bg-orange-100 border-orange-500 ring-2 ring-orange-200'
                                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <span className="text-2xl" role="img" aria-label={cat.name}>{cat.icon}</span>
                                                    <span className="text-xs text-center leading-tight text-gray-700">
                                                        {cat.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Local Production Toggle */}
                                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                        <div className="bg-green-100 p-2 rounded-full">
                                            <Leaf className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="isLocal" className="block text-sm font-bold text-green-900">
                                                Produit Local ? 🇲🇶
                                            </label>
                                            <p className="text-xs text-green-700">Cochez si produit en Martinique</p>
                                        </div>
                                        <input
                                            id="isLocal"
                                            type="checkbox"
                                            checked={manualEntry.isLocal || false}
                                            onChange={(e) => setManualEntry({ ...manualEntry, isLocal: e.target.checked })}
                                            className="w-6 h-6 text-green-600 rounded border-green-300 focus:ring-green-500 cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Prix (EUR) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={manualEntry.price}
                                            onChange={(e) => setManualEntry({ ...manualEntry, price: e.target.value })}
                                            placeholder="Ex: 2.45"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* BQP Check in Manual Entry */}
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className={`w-5 h-5 ${manualEntry.isDeclaredBqp ? 'text-green-600' : 'text-gray-400'}`} />
                                                <span className="text-sm font-medium text-gray-700">Produit BQP ?</span>
                                            </div>
                                            <button
                                                onClick={() => setManualEntry({ ...manualEntry, isDeclaredBqp: !manualEntry.isDeclaredBqp })}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${manualEntry.isDeclaredBqp ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${manualEntry.isDeclaredBqp ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {manualEntry.isDeclaredBqp && (
                                            <div className="animate-in slide-in-from-top-2 duration-300">
                                                <button
                                                    onClick={() => setShowBqpSelector(true)}
                                                    className="w-full py-2 px-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center justify-between hover:bg-blue-100 transition-colors"
                                                >
                                                    <span>
                                                        {manualEntry.categoryId
                                                            ? `Catégorie: ${categories.find(c => c.id === manualEntry.categoryId)?.name || 'Sélectionnée'}`
                                                            : 'Choisir la catégorie BQP...'}
                                                    </span>
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>








                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Votre nom {user ? '' : '(optionnel)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={manualEntry.userName}
                                            onChange={(e) => setManualEntry({ ...manualEntry, userName: e.target.value })}
                                            placeholder="Ex: Marie L."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            disabled={user && userProfile?.display_name}
                                        />
                                        {user && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Connecté en tant que {userProfile?.display_name || user.email}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={submitPrice}
                                        disabled={loading}
                                        className={`w-full py-3 rounded-lg font-medium transition-colors shadow-md ${loading
                                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                                            }`}
                                    >
                                        {loading ? 'Enregistrement...' : user ? 'Enregistrer le prix (+10 pts)' : 'Enregistrer le prix'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* Search/Compare Tab */}
                {
                    activeTab === 'search' && (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Chercher un produit ou magasin..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>

                            {categoryFilter && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{categories.find(c => c.id === categoryFilter)?.icon}</span>
                                        <span className="text-sm font-medium text-orange-800">
                                            Filtré par: <span className="font-bold">{categories.find(c => c.id === categoryFilter)?.name}</span>
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setCategoryFilter(null)}
                                        className="p-1 hover:bg-orange-100 rounded-full text-orange-600 transition-colors"
                                        title="Réinitialiser le filtre"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {loading ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                    <p>Chargement...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredPrices.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>Aucun prix trouvé</p>
                                        </div>
                                    ) : (
                                        filteredPrices.map(price => {
                                            const stats = getProductStats(price.product);
                                            const isLowest = stats && price.price === stats.min;
                                            const isCurrentUser = user && price.userId === user.id;

                                            return (
                                                <div key={price.id} className={`bg-white border rounded-lg p-4 shadow-sm ${isCurrentUser ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1">
                                                            <h3 className="font-semibold text-gray-900 flex items-center gap-1">
                                                                {price.product}
                                                                {price.isLocal && <Leaf className="w-4 h-4 text-green-600 fill-green-100" title="Produit Local" />}
                                                            </h3>
                                                            <p className="text-sm text-gray-600">{price.store}</p>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-1 pl-2">
                                                            <div className={`text-2xl font-bold ${isLowest ? 'text-green-600' : 'text-gray-900'}`}>
                                                                {price.price.toFixed(2)}€
                                                            </div>
                                                            {isLowest && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap mb-1">
                                                                    <TrendingDown className="inline w-3 h-3" /> Meilleur prix
                                                                </span>
                                                            )}
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleToggleFavorite(price.productId);
                                                                    }}
                                                                    className={`p-2 rounded-full transition-colors border ${userFavorites.has(price.productId)
                                                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-500'
                                                                        : 'bg-transparent border-transparent text-gray-300 hover:text-yellow-400'
                                                                        }`}
                                                                    title="Ajouter aux favoris (Sauvegarder)"
                                                                >
                                                                    <Bookmark
                                                                        className={`w-5 h-5 ${userFavorites.has(price.productId) ? 'fill-yellow-400' : ''}`}
                                                                    />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        addToShoppingList({
                                                                            id: price.productId,
                                                                            name: price.product,
                                                                            productPhotoUrl: price.productPhotoUrl
                                                                        });
                                                                    }}
                                                                    className={`p-2 rounded-full transition-colors border ${shoppingList.some(item => item.productId === price.productId)
                                                                        ? 'bg-green-100 border-green-200 text-green-600'
                                                                        : 'bg-transparent border-transparent text-gray-300 hover:text-green-500'
                                                                        }`}
                                                                    title="Ajouter au panier (Liste de courses)"
                                                                >
                                                                    <ShoppingBasket className={`w-5 h-5 ${shoppingList.some(item => item.productId === price.productId) ? 'fill-green-100' : ''}`} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Photos display */}
                                                    {(price.productPhotoUrl || price.priceTagPhotoUrl) && (
                                                        <div className="flex gap-2 mt-3 mb-2 overflow-x-auto pb-1 no-scrollbar">
                                                            {price.productPhotoUrl && (
                                                                <div
                                                                    onClick={() => setSelectedImage(price.productPhotoUrl)}
                                                                    className="relative flex-shrink-0 cursor-zoom-in group w-20 h-20"
                                                                >
                                                                    <ImageWithSkeleton
                                                                        src={price.productPhotoUrl}
                                                                        alt="Produit"
                                                                        className="rounded border border-gray-200 group-hover:opacity-90"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded pointer-events-none">
                                                                        <Search className="w-5 h-5 text-white" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {price.priceTagPhotoUrl && (
                                                                <div
                                                                    onClick={() => setSelectedImage(price.priceTagPhotoUrl)}
                                                                    className="relative flex-shrink-0 cursor-zoom-in group w-20 h-20"
                                                                >
                                                                    <ImageWithSkeleton
                                                                        src={price.priceTagPhotoUrl}
                                                                        alt="Etiquette"
                                                                        className="rounded border border-gray-200 group-hover:opacity-90"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded pointer-events-none">
                                                                        <Search className="w-5 h-5 text-white" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t">
                                                        <div className="flex items-center gap-4">
                                                            <button
                                                                onClick={() => handleToggleLike(price.id, price.isLikedByUser)}
                                                                className={`flex items-center gap-1.5 transition-colors ${price.isLikedByUser ? 'text-red-500' : 'hover:text-red-500'}`}
                                                            >
                                                                <Heart className={`w-4 h-4 ${price.isLikedByUser ? 'fill-red-500' : ''}`} />
                                                                <span className="font-bold">{price.likesCount || 0}</span>
                                                                <span className="hidden sm:inline">Merci !</span>
                                                            </button>
                                                            <span>
                                                                Par {price.userName}
                                                                {isCurrentUser && <span className="text-orange-500 ml-1">(vous)</span>}
                                                            </span>
                                                        </div>
                                                        <span>{price.date}</span>
                                                    </div>
                                                    {stats && stats.count > 1 && (
                                                        <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                                                            <span>Prix moyen: {stats.avg.toFixed(2)}€</span>
                                                            <span className="mx-2">-</span>
                                                            <span>De {stats.min.toFixed(2)}€ à {stats.max.toFixed(2)}€</span>
                                                            <span className="mx-2">-</span>
                                                            <span>{stats.count} magasins</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )
                }
                {/* Community Tab */}
                {
                    activeTab === 'community' && (
                        <Community />
                    )
                }
                {/* List Tab */}
                {
                    activeTab === 'list' && (
                        <div className="space-y-4 pt-8 px-4">
                            <ShoppingList
                                items={shoppingList}
                                onUpdateQuantity={updateQuantity}
                                onRemoveItem={removeFromShoppingList}
                                onClearList={clearShoppingList}
                                supabase={supabase}
                                user={user}
                            />
                        </div>
                    )
                }

                {/* BQP Tab */}
                {
                    activeTab === 'bqp' && (
                        <div className="space-y-4 pt-8 px-4">
                            <BQPVerifier />
                        </div>
                    )
                }

                {/* À Propos Tab */}
                {activeTab === 'about' && <AboutPage />}

                {/* Footer */}
                <div className="bg-gray-50 border-t p-4 text-center text-sm text-gray-600 mt-8">
                    <p className="mb-2">Ensemble, nous créons la transparence sur les prix</p>
                    <p className="text-xs text-gray-500">
                        Données crowdsourcées - Gratuit et ouvert à tous
                    </p>
                </div>
            </div >

            {/* Image Zoom Modal */}
            {
                selectedImage && (
                    <div
                        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <img
                                src={selectedImage}
                                alt="Zoom"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default App10;
