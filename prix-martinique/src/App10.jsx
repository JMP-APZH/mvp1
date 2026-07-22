import React, { useState, useEffect, useRef, useMemo } from 'react';
import BQPVerifier from './components/BQPVerifier';
import PriceHistoryChart from './components/PriceHistoryChart';
import ProductDetailModal from './components/ProductDetailModal';

import { Camera, Search, TrendingDown, Users, Package, AlertCircle, Image as ImageIcon, X, Share, Star, Info, ShieldCheck, ThumbsUp, ThumbsDown, Heart, ShoppingBasket, Bookmark, Leaf, ScanLine, MapPin, Plus, Store, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { MAINLAND_CHAINS } from './constants/mainlandChains';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import Leaderboard from './components/Leaderboard';
import AboutPage from './components/AboutPage';
import ZXingBarcodeScanner from './components/ZXingBarcodeScanner';
import StoreSelectionWizard from './components/StoreSelectionWizard';
import ShoppingList from './components/ShoppingList';
import { useShoppingList } from './hooks/useShoppingList';
import Community from './components/Community';
import PersoStats from './components/PersoStats';
import AdminDashboard from './components/AdminDashboard';
import PriceDuel from './components/PriceDuel';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';

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

const App10 = () => {

    const [activeTab, setActiveTab] = useState('scan');
    const [showScanner, setShowScanner] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [recentPrices, setRecentPrices] = useState([]);
    const [mainlandByProduct, setMainlandByProduct] = useState({});
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [bqpCheckResult, setBqpCheckResult] = useState(null); // { status: 'loading' | 'found' | 'not_found', product: ..., category: ... }
    const [showPersoStats, setShowPersoStats] = useState(false);
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [bqpVoteStats, setBqpVoteStats] = useState({ upvotes: 0, downvotes: 0, userVote: 0 }); // userVote: 1 (up), -1 (down), 0 (none)
    const [bqpQualityStats, setBqpQualityStats] = useState({ upvotes: 0, downvotes: 0, userVote: 0 });
    const [priceHistory, setPriceHistory] = useState([]);
    const [showBqpSelector, setShowBqpSelector] = useState(false);
    const [scannedProduct, setScannedProduct] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authModalMode, setAuthModalMode] = useState('signin');
    const [manualEntry, setManualEntry] = useState({
        productName: '',
        barcode: '',
        price: '',
        storeId: '',
        isMainland: false,
        mainlandChain: '',
        userName: '',
        productPhoto: null,
        priceTagPhoto: null,
        isDeclaredBqp: false,
        categoryId: null,
        isLocal: false,
        isMdd: false
    });
    const [categories, setCategories] = useState([]);
    const [imageViewer, setImageViewer] = useState(null); // { images: string[], index: number, labels: string[] } | null
    const [selectedProductId, setSelectedProductId] = useState(null);

    // Auto-open the product detail modal when arriving via a shared link (?product=<id>)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedProductId = params.get('product');
        if (sharedProductId) setSelectedProductId(sharedProductId);
    }, []);
    const touchStartXRef = useRef(0);
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [storeFilter, setStoreFilter] = useState(null);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showStorePicker, setShowStorePicker] = useState(false);
    const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('welcome_v1_shown'));

    const productPhotoInputRef = useRef(null);
    const priceTagPhotoInputRef = useRef(null);

    // Toast notifications
    const { toasts, toast } = useToast();

    // Auth context
    const { user, userProfile, awardPoints, refreshProfile, userFavorites, toggleFavorite, passwordRecoveryMode } = useAuth();

    // Open modal in password-reset mode when user arrives via reset email link
    useEffect(() => {
        if (passwordRecoveryMode) {
            setAuthModalMode('set_password');
            setShowAuthModal(true);
        }
    }, [passwordRecoveryMode]);

    // Shopping list — Supabase-backed for authenticated users, localStorage for anonymous
    const { shoppingList, addToShoppingList, removeFromShoppingList, updateQuantity, clearShoppingList } = useShoppingList(supabase, user);

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
                .select('id, name, chain')
                .order('name', { ascending: true });

            if (error) throw error;
            setStores(data || []);
        } catch (err) {
            console.error('Error loading stores:', err);
            toast.error('Impossible de charger les magasins. Vérifiez votre connexion.');
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
                  origin_region_code,
                  products (id, name, barcode, category_id, is_local_production),
                  stores (id, name, full_address),
                  price_likes (user_id)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // France Hexagonale reference/community prices are a different market --
            // they belong in the product detail card's comparison section, not as
            // regular Martinique scan cards in this feed (they have no store_id and
            // typically no product photo, since they're often admin-entered from an
            // evidence screenshot rather than a real in-store scan).
            const localData = data.filter(item => item.origin_region_code !== 'Hexagone');

            const transformedPrices = localData.map(item => ({
                id: item.id,
                productId: item.products?.id,
                categoryId: item.products?.category_id,
                product: item.products?.name || 'Produit inconnu',
                isLocal: item.products?.is_local_production,
                barcode: item.products?.barcode,
                price: item.price,
                storeId: item.stores?.id,
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

            // At-a-glance France Hexagonale diff badge on each card: cheapest
            // mainland reference/community price per product. Isolated in its
            // own try/catch -- a failure here must not break the feed above.
            try {
                const productIds = [...new Set(transformedPrices.map(p => p.productId).filter(Boolean))];
                if (productIds.length > 0) {
                    const { data: mainlandRows, error: mainlandError } = await supabase
                        .from('prices')
                        .select('product_id, price, mainland_chain')
                        .in('product_id', productIds)
                        .eq('origin_region_code', 'Hexagone');
                    if (mainlandError) throw mainlandError;

                    const byProduct = {};
                    (mainlandRows || []).forEach(r => {
                        if (!byProduct[r.product_id] || r.price < byProduct[r.product_id].price) {
                            byProduct[r.product_id] = { price: r.price, chain: r.mainland_chain };
                        }
                    });
                    setMainlandByProduct(byProduct);
                } else {
                    setMainlandByProduct({});
                }
            } catch (mainlandErr) {
                console.error('Error loading mainland comparison data:', mainlandErr);
                setMainlandByProduct({});
            }

            setLoading(false);
        } catch (err) {
            console.error('Error loading prices:', err);
            toast.error('Impossible de charger les prix. Vérifiez votre connexion.');
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

                // Fetch the most recent *local* price for this product. Filtered
                // client-side, not via .neq('origin_region_code', 'Hexagone') --
                // that drops NULL rows entirely (SQL three-valued logic), and most
                // existing prices have a null origin_region_code.
                const { data: recentPriceRows } = await supabase
                    .from('prices')
                    .select('*, stores(name)')
                    .eq('product_id', product.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                const latestPriceData = (recentPriceRows || []).find(r => r.origin_region_code !== 'Hexagone') || null;

                // 2. Fetch Mainland Counterpart (Live Diaspora Scan)
                const { data: mainlandPriceData } = await supabase
                    .from('prices')
                    .select('*, stores(name)')
                    .eq('product_id', product.id)
                    .eq('origin_region_code', 'Hexagone')
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
                        latestPrice: latestPriceData,
                        mainlandPrice: mainlandPriceData
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
                        latestPrice: latestPriceData,
                        mainlandPrice: mainlandPriceData
                    });
                    fetchPriceHistory(product.id);
                }
            } else {
                // New product
                setBqpCheckResult({ status: 'new_product', barcode: code });
            }

        } catch (err) {
            console.error('Error checking BQP status:', err);
            toast.error('Erreur de lecture. Veuillez saisir le produit manuellement.');
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

            toast.success(`Produit lié à la catégorie BQP : ${category.code}`);
            setShowBqpSelector(false);
            setBqpCheckResult({
                status: 'found',
                category: category,
                product: scannedProduct
            });

        } catch (err) {
            console.error('Error linking BQP:', err);
            toast.error('Erreur lors de l\'association BQP');
        } finally {
            setLoading(false);
        }
    };

    // Single RPC replaces 6 sequential queries (3 for accuracy votes + 3 for quality votes)
    const fetchBqpVotes = async (associationId) => {
        try {
            const { data, error } = await supabase
                .rpc('get_bqp_vote_stats', {
                    p_association_id: associationId,
                    p_user_id: user?.id ?? null,
                });

            if (error) throw error;

            setBqpVoteStats({
                upvotes:  data.upvotes  || 0,
                downvotes: data.downvotes || 0,
                userVote: data.user_vote || 0,
            });
            setBqpQualityStats({
                upvotes:  data.quality_upvotes  || 0,
                downvotes: data.quality_downvotes || 0,
                userVote: data.quality_user_vote || 0,
            });
        } catch (err) {
            console.error('Error fetching votes:', err);
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
            toast.info('Connectez-vous pour voter');
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
            toast.error('Erreur lors du vote');
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
        const hasLocation = manualEntry.isMainland ? manualEntry.mainlandChain : manualEntry.storeId;
        if (!manualEntry.productName || !manualEntry.price || !hasLocation) {
            toast.error('Veuillez remplir tous les champs obligatoires (produit, prix, magasin)');
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
                        is_declared_bqp: manualEntry.isDeclaredBqp || false,
                        is_mdd: manualEntry.isMdd || false
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
                store_id: manualEntry.isMainland ? null : manualEntry.storeId,
                price: parseFloat(manualEntry.price),
                user_name: manualEntry.userName || 'Anonyme',
                product_photo_url: productPhotoUrl,
                price_tag_photo_url: priceTagPhotoUrl
            };

            if (manualEntry.isMainland) {
                // Community scan from France Hexagonale -- same shape ProductDetailModal's
                // "communauté" comparison slot and the scan-flow "Duel des Prix" already expect.
                priceData.origin_region_code = 'Hexagone';
                priceData.mainland_chain = manualEntry.mainlandChain;
                priceData.source_type = 'scan';
            }

            // Add user_id if authenticated and tag origin
            if (user) {
                priceData.user_id = user.id;
                // Add geographical origin for backend analysis (skip if already set above for a mainland scan)
                if (userProfile && !manualEntry.isMainland) {
                    priceData.origin_region_code = userProfile.region_code;
                    priceData.origin_city = userProfile.city;
                }
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

            toast.success(successMessage);

            // Reset form but conditionally set BQP prompt
            setManualEntry(prev => ({
                productName: '',
                barcode: '',
                price: '',
                storeId: prev.storeId, // Keep shop selection persistent!
                isMainland: prev.isMainland, // Keep region/chain selection persistent!
                mainlandChain: prev.mainlandChain,
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
        const matchesStore = storeFilter ? p.storeId === storeFilter : true;
        return matchesQuery && matchesCategory && matchesStore;
    });

    // Stores that have at least one scanned product, for the store filter picker
    const scannedStores = Array.from(
        recentPrices.reduce((map, p) => {
            if (p.storeId && !map.has(p.storeId)) map.set(p.storeId, p.store);
            return map;
        }, new Map())
    ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

    // Categories that actually have a scanned product at the selected store
    // (falls back to all categories with any scanned product when no store is selected)
    const availableCategoryIds = new Set(
        recentPrices.filter(p => !storeFilter || p.storeId === storeFilter).map(p => p.categoryId).filter(Boolean)
    );
    const pickerCategories = categories.filter(c => availableCategoryIds.has(c.id));

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
                    <UserMenu
                        onSignInClick={() => setShowAuthModal(true)}
                        onOpenStats={() => setShowPersoStats(true)}
                        onOpenAdmin={() => setShowAdminDashboard(true)}
                        stores={stores}
                    />
                </div>
                <p className="text-orange-100 text-sm">Quid de votre pouvoir d'achat</p>

                {/* Admin Dashboard View */}
                {showAdminDashboard && <AdminDashboard onClose={() => setShowAdminDashboard(false)} />}

                {/* Perso Stats View */}
                {showPersoStats && <PersoStats onClose={() => setShowPersoStats(false)} />}

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
                onClose={() => { setShowAuthModal(false); setAuthModalMode('signin'); }}
                initialMode={authModalMode}
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
                            {!manualEntry.storeId && !manualEntry.mainlandChain ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-orange-600 mb-2">
                                        <MapPin className="w-5 h-5" />
                                        <h3 className="font-bold">Où êtes-vous ?</h3>
                                    </div>

                                    {/* Region toggle */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setManualEntry({ ...manualEntry, isMainland: false, mainlandChain: '' })}
                                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold border transition-colors ${!manualEntry.isMainland
                                                ? 'bg-orange-50 border-orange-300 text-orange-700'
                                                : 'bg-white border-gray-200 text-gray-500'
                                                }`}
                                        >
                                            🇲🇶 Martinique
                                        </button>
                                        <button
                                            onClick={() => setManualEntry({ ...manualEntry, isMainland: true, storeId: '' })}
                                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold border transition-colors ${manualEntry.isMainland
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-500'
                                                }`}
                                        >
                                            <span>🇫🇷</span> France Hexagonale
                                        </button>
                                    </div>

                                    {manualEntry.isMainland ? (
                                        <>
                                            <p className="text-sm text-gray-600 italic">
                                                Sélectionnez la chaîne du magasin où vous avez trouvé ce prix
                                            </p>
                                            <select
                                                value={manualEntry.mainlandChain}
                                                onChange={(e) => setManualEntry({ ...manualEntry, mainlandChain: e.target.value })}
                                                className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">Choisir une chaîne...</option>
                                                {MAINLAND_CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-600 italic">
                                                Sélectionnez votre magasin pour commencer à scanner
                                            </p>
                                            <StoreSelectionWizard
                                                supabase={supabase}
                                                selectedStoreId={manualEntry.storeId}
                                                onStoreSelect={(storeId) => setManualEntry({ ...manualEntry, storeId })}
                                            />
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${manualEntry.isMainland ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                            {manualEntry.isMainland ? <span className="text-lg leading-none">🇫🇷</span> : <MapPin className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                                                {manualEntry.isMainland ? 'Chaîne actuelle (France Hexagonale)' : 'Magasin Actuel'}
                                            </p>
                                            <h3 className="font-bold text-gray-900">
                                                {manualEntry.isMainland
                                                    ? manualEntry.mainlandChain
                                                    : (stores.find(s => String(s.id) === String(manualEntry.storeId))?.name || "Magasin sélectionné")}
                                            </h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setManualEntry({ ...manualEntry, storeId: '', mainlandChain: '' })}
                                        className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 transition-colors"
                                    >
                                        Changer
                                    </button>
                                </div>
                            )}
                        </div>

                        {(manualEntry.storeId || manualEntry.mainlandChain) && (
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
                                                        aria-label="Voter pour"
                                                        className={`p-3 rounded-full border min-w-[44px] min-h-[44px] flex flex-col items-center justify-center ${bqpVoteStats.userVote === 1 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}
                                                    >
                                                        <ThumbsUp className="w-4 h-4" />
                                                        <span className="text-[10px] font-bold block text-center">{bqpVoteStats.upvotes}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleVote(-1)}
                                                        aria-label="Voter contre"
                                                        className={`p-3 rounded-full border min-w-[44px] min-h-[44px] flex flex-col items-center justify-center ${bqpVoteStats.userVote === -1 ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-400'}`}
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
                                                            toast.success('Prix confirmé ! +5 points');
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
                                        <div className="space-y-4">
                                            {bqpCheckResult.mainlandPrice && (
                                                <PriceDuel
                                                    localPrice={bqpCheckResult.latestPrice?.price || parseFloat(manualEntry.price) || 0}
                                                    mainlandPrice={bqpCheckResult.mainlandPrice.price}
                                                    productName={bqpCheckResult.product?.name || manualEntry.productName}
                                                    mainlandOrigin={bqpCheckResult.mainlandPrice.mainland_chain || "France Continentale"}
                                                />
                                            )}
                                            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                                <PriceHistoryChart data={priceHistory} />
                                            </div>
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

                                    {/* MDD (Marque Distributeur) Toggle */}
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="bg-blue-100 p-2 rounded-full">
                                            <Store className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="isMdd" className="block text-sm font-bold text-blue-900">
                                                Marque Distributeur (MDD) ? 🛒
                                            </label>
                                            <p className="text-xs text-blue-700">Ex: Carrefour, U, Marque Repère...</p>
                                        </div>
                                        <input
                                            id="isMdd"
                                            type="checkbox"
                                            checked={manualEntry.isMdd || false}
                                            onChange={(e) => setManualEntry({ ...manualEntry, isMdd: e.target.checked })}
                                            className="w-6 h-6 text-blue-600 rounded border-blue-300 focus:ring-blue-500 cursor-pointer"
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

                            {/* Filter buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowCategoryPicker(v => !v); setShowStorePicker(false); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${categoryFilter || showCategoryPicker
                                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Tag className="w-4 h-4" /> Catégorie
                                </button>
                                <button
                                    onClick={() => { setShowStorePicker(v => !v); setShowCategoryPicker(false); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${storeFilter || showStorePicker
                                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Store className="w-4 h-4" /> Magasin
                                </button>
                            </div>

                            {/* Category icon picker overlay */}
                            {showCategoryPicker && (
                                <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 animate-in fade-in slide-in-from-top-2">
                                    {pickerCategories.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-4">
                                            Aucune catégorie avec un produit scanné{storeFilter ? ' pour ce magasin' : ''}.
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-3">
                                            {pickerCategories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => { setCategoryFilter(cat.id); setShowCategoryPicker(false); }}
                                                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-orange-50 transition-colors"
                                                >
                                                    <span className="text-2xl">{cat.icon}</span>
                                                    <span className="text-[10px] text-gray-600 font-medium text-center leading-tight">{cat.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Store picker overlay */}
                            {showStorePicker && (
                                <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                    {scannedStores.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-4">Aucun magasin avec des prix enregistrés.</p>
                                    ) : (
                                        scannedStores.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => { setStoreFilter(s.id); setShowStorePicker(false); }}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 text-sm text-gray-700 transition-colors flex items-center gap-2"
                                            >
                                                <Store className="w-4 h-4 text-gray-400 flex-shrink-0" /> {s.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Active filter chips */}
                            {(categoryFilter || storeFilter) && (
                                <div className="flex flex-wrap gap-2">
                                    {categoryFilter && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                            <span className="text-base">{categories.find(c => c.id === categoryFilter)?.icon}</span>
                                            <span className="text-xs font-medium text-orange-800">
                                                {categories.find(c => c.id === categoryFilter)?.name}
                                            </span>
                                            <button
                                                onClick={() => setCategoryFilter(null)}
                                                className="p-0.5 hover:bg-orange-100 rounded-full text-orange-600 transition-colors"
                                                title="Réinitialiser le filtre de catégorie"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    {storeFilter && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                            <Store className="w-4 h-4 text-orange-600" />
                                            <span className="text-xs font-medium text-orange-800">
                                                {scannedStores.find(s => s.id === storeFilter)?.name}
                                            </span>
                                            <button
                                                onClick={() => setStoreFilter(null)}
                                                className="p-0.5 hover:bg-orange-100 rounded-full text-orange-600 transition-colors"
                                                title="Réinitialiser le filtre de magasin"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
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
                                                <div
                                                    key={price.id}
                                                    onClick={() => setSelectedProductId(price.productId)}
                                                    className={`bg-white border rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${isCurrentUser ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
                                                >
                                                    <div className="flex justify-between items-start">
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
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
                                                                    <TrendingDown className="inline w-3 h-3" /> Meilleur prix
                                                                </span>
                                                            )}
                                                            {(() => {
                                                                const mainland = mainlandByProduct[price.productId];
                                                                if (!mainland) {
                                                                    return (
                                                                        <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1 bg-gray-100 text-gray-400">
                                                                            <span>🇫🇷</span> Pas encore dispo
                                                                        </span>
                                                                    );
                                                                }
                                                                const diff = price.price - mainland.price;
                                                                const pct = (diff / mainland.price) * 100;
                                                                const isCheaper = diff < 0;
                                                                return (
                                                                    <span
                                                                        className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1 ${isCheaper ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                                            }`}
                                                                        title={`vs ${mainland.chain || 'France Hexagonale'} : ${mainland.price.toFixed(2)}€`}
                                                                    >
                                                                        <span>🇫🇷</span>
                                                                        {mainland.price.toFixed(2)}€ · {diff > 0 ? '+' : ''}{diff.toFixed(2)}€ ({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)
                                                                    </span>
                                                                );
                                                            })()}
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
                                                    {(price.productPhotoUrl || price.priceTagPhotoUrl) && (() => {
                                                        const photoEntries = [
                                                            price.productPhotoUrl && { url: price.productPhotoUrl, label: 'Produit' },
                                                            price.priceTagPhotoUrl && { url: price.priceTagPhotoUrl, label: 'Étiquette' },
                                                        ].filter(Boolean);

                                                        return (
                                                            <div className="flex gap-2 mt-0.5 mb-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar touch-pan-y overscroll-x-contain">
                                                                {photoEntries.map((entry, i) => (
                                                                    <div
                                                                        key={entry.label}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setImageViewer({
                                                                                images: photoEntries.map(e => e.url),
                                                                                labels: photoEntries.map(e => e.label),
                                                                                index: i,
                                                                            });
                                                                        }}
                                                                        className="relative flex-shrink-0 cursor-zoom-in group w-20 h-20"
                                                                    >
                                                                        <ImageWithSkeleton
                                                                            src={entry.url}
                                                                            alt={entry.label}
                                                                            className="rounded border border-gray-200 group-hover:opacity-90"
                                                                        />
                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded pointer-events-none">
                                                                            <Search className="w-5 h-5 text-white" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}

                                                    <div className="flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t">
                                                        <div className="flex items-center gap-4">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleToggleLike(price.id, price.isLikedByUser); }}
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
                        <Community onRequireAuth={() => setShowAuthModal(true)} />
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

            {/* Welcome overlay — shown once to first-time visitors */}
            {showWelcome && (
                <div className="fixed inset-0 z-[500] bg-black/60 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-400">
                        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-6 text-white">
                            <div className="text-4xl mb-2">🛒</div>
                            <h2 className="text-2xl font-bold">Vie chère en Martinique</h2>
                            <p className="text-orange-100 text-sm mt-1">Ensemble, rendons les prix transparents</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-700 font-medium">Comment ça marche ?</p>
                            <ul className="space-y-3">
                                {[
                                    { icon: '📷', text: 'Scannez un code-barres en magasin' },
                                    { icon: '💶', text: 'Saisissez le prix affiché sur l\'étiquette' },
                                    { icon: '📊', text: 'Comparez les prix entre supermarchés' },
                                    { icon: '🏆', text: 'Gagnez des points et montez dans le classement' },
                                ].map(({ icon, text }) => (
                                    <li key={text} className="flex items-center gap-3 text-sm text-gray-600">
                                        <span className="text-xl flex-shrink-0">{icon}</span>
                                        {text}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => {
                                    localStorage.setItem('welcome_v1_shown', '1');
                                    setShowWelcome(false);
                                }}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-colors mt-2"
                            >
                                Commencer !
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('welcome_v1_shown', '1');
                                    setShowWelcome(false);
                                }}
                                className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
                            >
                                Je connais déjà l'application
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notifications */}
            <ToastContainer toasts={toasts} />

            {/* Product Detail Modal ("wow" card) */}
            {selectedProductId && (
                <ProductDetailModal
                    productId={selectedProductId}
                    onClose={() => setSelectedProductId(null)}
                    onRequireAuth={() => setShowAuthModal(true)}
                />
            )}

            {/* Image Zoom Modal */}
            {
                imageViewer && (() => {
                    const { images, labels, index } = imageViewer;
                    const hasMultiple = images.length > 1;
                    const goTo = (newIndex) => {
                        if (newIndex < 0 || newIndex >= images.length) return;
                        setImageViewer(prev => prev && { ...prev, index: newIndex });
                    };

                    return (
                        <div
                            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200"
                            onClick={() => setImageViewer(null)}
                            onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                            onTouchEnd={(e) => {
                                const delta = e.changedTouches[0].clientX - touchStartXRef.current;
                                if (Math.abs(delta) < 50) return;
                                goTo(delta < 0 ? index + 1 : index - 1);
                            }}
                        >
                            <button
                                className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-10"
                                onClick={() => setImageViewer(null)}
                            >
                                <X className="w-8 h-8" />
                            </button>

                            {hasMultiple && labels?.[index] && (
                                <div className="absolute top-4 left-4 text-white/80 text-xs font-bold uppercase tracking-wider bg-white/10 px-3 py-1.5 rounded-full">
                                    {labels[index]}
                                </div>
                            )}

                            {hasMultiple && index > 0 && (
                                <button
                                    className="absolute left-2 sm:left-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-10"
                                    onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
                                >
                                    <ChevronLeft className="w-8 h-8" />
                                </button>
                            )}
                            {hasMultiple && index < images.length - 1 && (
                                <button
                                    className="absolute right-2 sm:right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-10"
                                    onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
                                >
                                    <ChevronRight className="w-8 h-8" />
                                </button>
                            )}

                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                <img
                                    src={images[index]}
                                    alt={labels?.[index] || 'Zoom'}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>

                            {hasMultiple && (
                                <div className="absolute bottom-6 flex gap-2">
                                    {images.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={(e) => { e.stopPropagation(); goTo(i); }}
                                            className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-white w-6' : 'bg-white/40'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()
            }
        </div>
    );
};

export default App10;
