import React, { useState, useEffect, useRef } from 'react';
import BQPVerifier from './components/BQPVerifier';

import { Camera, Search, TrendingDown, BarChart3, Users, Package, AlertCircle, Image as ImageIcon, X, Share, Star, Info, ShieldCheck, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import Leaderboard from './components/Leaderboard';
import AboutPage from './components/AboutPage';
import ZXingBarcodeScanner from './components/ZXingBarcodeScanner';
import StoreSelectionWizard from './components/StoreSelectionWizard';

const App9 = () => {
    const [activeTab, setActiveTab] = useState('scan');
    const [showScanner, setShowScanner] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [recentPrices, setRecentPrices] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [bqpCheckResult, setBqpCheckResult] = useState(null); // { status: 'loading' | 'found' | 'not_found', product: ..., category: ... }
    const [bqpVoteStats, setBqpVoteStats] = useState({ upvotes: 0, downvotes: 0, userVote: 0 }); // userVote: 1 (up), -1 (down), 0 (none)
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
        priceTagPhoto: null
    });
    const productPhotoInputRef = useRef(null);
    const priceTagPhotoInputRef = useRef(null);

    // Auth context
    const { user, userProfile, awardPoints, refreshProfile } = useAuth();

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
          products (name, barcode),
          stores (name, full_address)
        `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Transform data for display
            const transformedPrices = data.map(item => ({
                id: item.id,
                product: item.products?.name || 'Produit inconnu',
                barcode: item.products?.barcode,
                price: item.price,
                store: item.stores?.name || 'Magasin inconnu',
                location: item.stores?.full_address,
                userName: item.user_name || 'Anonyme',
                userId: item.user_id,
                date: new Date(item.created_at).toLocaleDateString('fr-FR'),
                productPhotoUrl: item.product_photo_url,
                priceTagPhotoUrl: item.price_tag_photo_url
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
                        associationId: association.id // Store association ID for voting
                    });
                    setActiveTab('scan'); // stay on scan

                    // Fetch existing votes
                    fetchBqpVotes(association.id);

                } else {
                    setBqpCheckResult({ status: 'not_found', product: product });
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
                    is_user_verified: true
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
        } catch (err) {
            console.error('Error fetching votes:', err);
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

    const submitPrice = async () => {
        if (!manualEntry.productName || !manualEntry.price || !manualEntry.storeId) {
            alert('Veuillez remplir tous les champs obligatoires (produit, prix, magasin)');
            return;
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
                        category: null // Can be added later
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
            const successMessage = user
                ? `Prix enregistré avec succès! +${pointsAwarded} points`
                : 'Prix enregistré avec succès! Merci pour votre contribution.';
            alert(successMessage);

            // Reset form
            setManualEntry({
                productName: '',
                barcode: '',
                price: '',
                storeId: '',
                userName: userProfile?.display_name || manualEntry.userName, // Keep username
                productPhoto: null,
                priceTagPhoto: null
            });

            // Reload prices
            loadRecentPrices();
            setLoading(false);

        } catch (err) {
            console.error('Error submitting price:', err);
            setError('Erreur lors de l\'enregistrement du prix. Veuillez réessayer.');
            setLoading(false);
        }
    };

    const filteredPrices = recentPrices.filter(p =>
        p.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.store.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getProductStats = (productName) => {
        const productPrices = recentPrices.filter(p => p.product === productName);
        if (productPrices.length === 0) return null;

        const prices = productPrices.map(p => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

        return { min, max, avg, count: productPrices.length };
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
            <div className="flex border-b bg-white sticky top-0 shadow-sm z-10">
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
                    onClick={() => setActiveTab('stats')}
                    className={`flex-1 py-3 px-2 font-medium transition-colors ${activeTab === 'stats'
                        ? 'border-b-2 border-orange-500 text-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-xs">Stats</span>
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
                        <span className="text-xs">À Propos</span>
                    </div>
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
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

                        {/* Scanner Button */}
                        <div>
                            {bqpCheckResult && bqpCheckResult.status === 'found' && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3">
                                    <ShieldCheck className="w-8 h-8 text-green-600" />
                                    <div>
                                        <h3 className="font-bold text-green-800">Produit BQP Vérifié !</h3>
                                        <p className="text-sm text-green-700">
                                            {bqpCheckResult.category.code} - {bqpCheckResult.category.label}
                                        </p>
                                    </div>
                                    <div className="ml-auto flex gap-2">
                                        <button
                                            onClick={() => handleVote(1)}
                                            className={`p-2 rounded-full border ${bqpVoteStats.userVote === 1 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}
                                        >
                                            <ThumbsUp className="w-5 h-5" />
                                            <span className="text-xs font-bold block text-center">{bqpVoteStats.upvotes}</span>
                                        </button>
                                        <button
                                            onClick={() => handleVote(-1)}
                                            className={`p-2 rounded-full border ${bqpVoteStats.userVote === -1 ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-400'}`}
                                        >
                                            <ThumbsDown className="w-5 h-5" />
                                            <span className="text-xs font-bold block text-center">{bqpVoteStats.downvotes}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {bqpCheckResult && bqpCheckResult.status === 'not_found' && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="w-5 h-5 text-blue-600" />
                                        <h3 className="font-bold text-blue-800">Produit non classé</h3>
                                    </div>
                                    <p className="text-sm text-blue-700 mb-3">
                                        Est-ce un produit du Bouclier Qualité Prix ?
                                    </p>
                                    <button
                                        onClick={() => setShowBqpSelector(true)}
                                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                                    >
                                        Oui, lier à une catégorie BQP
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => setShowScanner(true)}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-colors shadow-md mb-4"
                            >
                                <Camera className="inline w-5 h-5 mr-2" />
                                Scanner un code-barres
                            </button>
                            <p className="text-center text-gray-500 text-sm mb-4">ou</p>
                        </div>

                        {/* BQP Selector Modal */}
                        {showBqpSelector && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                        <h3 className="font-bold text-lg">Sélectionner la catégorie BQP</h3>
                                        <button onClick={() => setShowBqpSelector(false)} className="p-1 hover:bg-gray-200 rounded">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto p-4">
                                        <BQPVerifier onSelect={handleBqpSelect} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Manual Entry Form */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
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
                                            <p className="text-sm text-orange-600">Ajouter une photo de l'étiquette</p>
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Magasin *
                                </label>
                                <StoreSelectionWizard
                                    supabase={supabase}
                                    selectedStoreId={manualEntry.storeId}
                                    onStoreSelect={(storeId) => setManualEntry({ ...manualEntry, storeId })}
                                    className="mb-4"
                                />
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

                {/* Search/Compare Tab */}
                {activeTab === 'search' && (
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
                                                        <h3 className="font-semibold text-gray-900">{price.product}</h3>
                                                        <p className="text-sm text-gray-600">{price.store}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-2xl font-bold ${isLowest ? 'text-green-600' : 'text-gray-900'}`}>
                                                            {price.price.toFixed(2)}€
                                                        </div>
                                                        {isLowest && (
                                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                <TrendingDown className="inline w-3 h-3" /> Meilleur prix
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Photos display */}
                                                {(price.productPhotoUrl || price.priceTagPhotoUrl) && (
                                                    <div className="flex gap-2 mt-3 mb-2">
                                                        {price.productPhotoUrl && (
                                                            <img
                                                                src={price.productPhotoUrl}
                                                                alt="Produit"
                                                                className="w-20 h-20 object-cover rounded border border-gray-200"
                                                            />
                                                        )}
                                                        {price.priceTagPhotoUrl && (
                                                            <img
                                                                src={price.priceTagPhotoUrl}
                                                                alt="Etiquette"
                                                                className="w-20 h-20 object-cover rounded border border-gray-200"
                                                            />
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t">
                                                    <span>
                                                        Par {price.userName}
                                                        {isCurrentUser && <span className="text-orange-500 ml-1">(vous)</span>}
                                                    </span>
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
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white rounded-lg p-6 shadow-lg">
                            <h2 className="text-xl font-bold mb-4">Statistiques communautaires</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-3xl font-bold">{recentPrices.length}</div>
                                    <div className="text-orange-100 text-sm">Prix partagés</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold">
                                        {new Set(recentPrices.map(p => p.product)).size}
                                    </div>
                                    <div className="text-orange-100 text-sm">Produits suivis</div>
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard */}
                        <Leaderboard />

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="font-semibold text-yellow-900 mb-2">Prochainement</h3>
                            <ul className="text-sm text-yellow-800 space-y-1">
                                <li>- Graphiques d'évolution des prix</li>
                                <li>- Comparaison Martinique vs France métropolitaine</li>
                                <li>- Alertes sur vos produits favoris</li>
                                <li>- Classement des magasins les moins chers</li>
                                <li>- Actions collectives et pétitions</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-semibold text-gray-800">Produits les plus suivis</h3>
                            {Array.from(new Set(recentPrices.map(p => p.product)))
                                .slice(0, 5)
                                .map(productName => {
                                    const stats = getProductStats(productName);
                                    return (
                                        <div key={productName} className="bg-white border border-gray-200 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-medium text-gray-900">{productName}</h4>
                                                <span className="text-sm text-gray-500">{stats.count} prix</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-sm">
                                                <div>
                                                    <div className="text-gray-500 text-xs">Min</div>
                                                    <div className="font-semibold text-green-600">{stats.min.toFixed(2)}€</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 text-xs">Moyen</div>
                                                    <div className="font-semibold">{stats.avg.toFixed(2)}€</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 text-xs">Max</div>
                                                    <div className="font-semibold text-red-600">{stats.max.toFixed(2)}€</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs text-gray-600">
                                                Écart: {((stats.max - stats.min) / stats.min * 100).toFixed(0)}% de différence
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* BQP Tab (Live) */}
                {activeTab === 'bqp' && (
                    <div className="space-y-4">
                        <BQPVerifier />
                    </div>
                )}

                {/* À Propos Tab */}
                {activeTab === 'about' && <AboutPage />}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t p-4 text-center text-sm text-gray-600 mt-8">
                <p className="mb-2">Ensemble, nous créons la transparence sur les prix</p>
                <p className="text-xs text-gray-500">
                    Données crowdsourcées - Gratuit et ouvert à tous
                </p>
            </div>
        </div>
    );
};

export default App9;
