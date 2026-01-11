import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, TrendingDown, BarChart3, Users, Package, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';
import Quagga from 'quagga';

const PriceScannerApp = () => {
  const [activeTab, setActiveTab] = useState('scan');
  const [scanning, setScanning] = useState(false);
  const [scanMethod, setScanMethod] = useState(null); // 'quagga' or 'barcode-api'
  const [searchQuery, setSearchQuery] = useState('');
  const [recentPrices, setRecentPrices] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    productName: '',
    barcode: '',
    price: '',
    storeId: '',
    userName: ''
  });
  const videoRef = useRef(null);
  const scannerContainerRef = useRef(null);

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    
    setDeferredPrompt(null);
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

  const loadStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      
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
          created_at,
          products (name, barcode),
          stores (name, location)
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
        location: item.stores?.location,
        userName: item.user_name || 'Anonyme',
        date: new Date(item.created_at).toLocaleDateString('fr-FR')
      }));

      setRecentPrices(transformedPrices);
      setLoading(false);
    } catch (err) {
      console.error('Error loading prices:', err);
      setError('Erreur lors du chargement des prix');
      setLoading(false);
    }
  };

  const startScanning = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert('Accès caméra refusé. Veuillez utiliser la saisie manuelle.');
      setScanning(false);
    }
  };

  const startQuaggaScan = () => {
    setScanMethod('quagga');
    setScanning(true);
    
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerContainerRef.current,
        constraints: {
          facingMode: "environment"
        },
      },
      decoder: {
        readers: [
          "ean_reader",
          "ean_8_reader",
          "upc_reader",
          "upc_e_reader",
          "code_128_reader",
          "code_39_reader"
        ]
      },
      locate: true
    }, (err) => {
      if (err) {
        console.error('Quagga init error:', err);
        alert('Erreur d\'initialisation du scanner. Veuillez utiliser la saisie manuelle.');
        setScanning(false);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      console.log('Barcode detected:', code);
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      setManualEntry({ ...manualEntry, barcode: code });
      stopScanning();
      alert(`Code-barres détecté: ${code}\nVeuillez saisir le nom du produit, le prix et sélectionner le magasin.`);
    });
  };

  const startBarcodeAPIScan = async () => {
    // Check if Barcode Detection API is supported
    if (!('BarcodeDetector' in window)) {
      alert('L\'API Barcode Detection n\'est pas supportée par votre navigateur. Essayez QuaggaJS ou utilisez Chrome/Edge.');
      return;
    }

    setScanMethod('barcode-api');
    setScanning(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        });
        
        const detectBarcode = async () => {
          if (!scanning) return;
          
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              console.log('Barcode detected:', code);
              
              // Vibrate if supported
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
              
              setManualEntry({ ...manualEntry, barcode: code });
              stopScanning();
              alert(`Code-barres détecté: ${code}\nVeuillez saisir le nom du produit, le prix et sélectionner le magasin.`);
              return;
            }
          } catch (err) {
            console.error('Detection error:', err);
          }
          
          // Continue scanning
          requestAnimationFrame(detectBarcode);
        };
        
        detectBarcode();
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Accès caméra refusé. Veuillez utiliser la saisie manuelle.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scanMethod === 'quagga') {
      Quagga.stop();
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    
    setScanning(false);
    setScanMethod(null);
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

      // Step 2: Insert price
      const { error: priceError } = await supabase
        .from('prices')
        .insert([{
          product_id: productId,
          store_id: manualEntry.storeId,
          price: parseFloat(manualEntry.price),
          user_name: manualEntry.userName || 'Anonyme'
        }]);

      if (priceError) throw priceError;

      // Success!
      alert('Prix enregistré avec succès! Merci pour votre contribution. 🎉');
      
      // Reset form
      setManualEntry({
        productName: '',
        barcode: '',
        price: '',
        storeId: '',
        userName: manualEntry.userName // Keep username for next entry
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Prix Martinique</h1>
        <p className="text-blue-100 text-sm">Ensemble contre la vie chère</p>
      </div>

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

      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              📱 Installer l'application
            </p>
            <p className="text-xs text-blue-700 mb-3">
              Ajoutez Prix Martinique à votre écran d'accueil pour un accès rapide !
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Installer
              </button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="text-xs text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex border-b bg-white sticky top-0 shadow-sm z-10">
        <button 
          onClick={() => setActiveTab('scan')}
          className={`flex-1 py-3 px-4 font-medium transition-colors ${
            activeTab === 'scan' 
              ? 'border-b-2 border-blue-600 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Camera className="inline w-5 h-5 mr-2" />
          Scanner
        </button>
        <button 
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-3 px-4 font-medium transition-colors ${
            activeTab === 'search' 
              ? 'border-b-2 border-blue-600 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="inline w-5 h-5 mr-2" />
          Comparer
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-3 px-4 font-medium transition-colors ${
            activeTab === 'stats' 
              ? 'border-b-2 border-blue-600 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="inline w-5 h-5 mr-2" />
          Stats
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Scan Tab */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <Users className="inline w-4 h-4 mr-1" />
                <strong>{recentPrices.length}</strong> prix partagés par la communauté
              </p>
            </div>

            {!scanning ? (
              <div>
                <div className="space-y-3 mb-4">
                  <button
                    onClick={startQuaggaScan}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
                  >
                    <Camera className="inline w-5 h-5 mr-2" />
                    Scanner avec QuaggaJS
                  </button>
                  
                  <button
                    onClick={startBarcodeAPIScan}
                    className="w-full bg-purple-600 text-white py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors shadow-md"
                  >
                    <Camera className="inline w-5 h-5 mr-2" />
                    Scanner avec Barcode API
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    Testez les deux méthodes pour voir laquelle fonctionne le mieux sur votre appareil
                  </p>
                </div>
                <p className="text-center text-gray-500 text-sm mb-4">ou</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scanMethod === 'quagga' ? (
                  <div>
                    <div 
                      ref={scannerContainerRef}
                      className="relative bg-black rounded-lg overflow-hidden"
                      style={{ height: '300px' }}
                    >
                      <div className="absolute inset-0 border-2 border-green-400 m-8 rounded-lg pointer-events-none z-10">
                        <div className="absolute top-0 left-0 right-0 bg-green-400 text-black text-xs py-1 px-2 text-center font-semibold">
                          QuaggaJS Scanner - Alignez le code-barres
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '300px' }}>
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-purple-400 m-8 rounded-lg pointer-events-none">
                      <div className="absolute top-0 left-0 right-0 bg-purple-400 text-white text-xs py-1 px-2 text-center font-semibold">
                        Barcode Detection API - Alignez le code-barres
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={stopScanning}
                  className="w-full bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700"
                >
                  Annuler le scan
                </button>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={manualEntry.price}
                  onChange={(e) => setManualEntry({ ...manualEntry, price: e.target.value })}
                  placeholder="Ex: 2.45"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Magasin *
                </label>
                <select
                  value={manualEntry.storeId}
                  onChange={(e) => setManualEntry({ ...manualEntry, storeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner un magasin</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name} - {store.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre nom (optionnel)
                </label>
                <input
                  type="text"
                  value={manualEntry.userName}
                  onChange={(e) => setManualEntry({ ...manualEntry, userName: e.target.value })}
                  placeholder="Ex: Marie L."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={submitPrice}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-medium transition-colors shadow-md ${
                  loading 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer le prix'}
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
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
                    
                    return (
                      <div key={price.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
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
                        <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t">
                          <span>Par {price.userName}</span>
                          <span>{price.date}</span>
                        </div>
                        {stats && stats.count > 1 && (
                          <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                            <span>Prix moyen: {stats.avg.toFixed(2)}€</span>
                            <span className="mx-2">•</span>
                            <span>De {stats.min.toFixed(2)}€ à {stats.max.toFixed(2)}€</span>
                            <span className="mx-2">•</span>
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
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4">Statistiques communautaires</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-3xl font-bold">{recentPrices.length}</div>
                  <div className="text-blue-100 text-sm">Prix partagés</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {new Set(recentPrices.map(p => p.product)).size}
                  </div>
                  <div className="text-blue-100 text-sm">Produits suivis</div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">🚧 Prochainement</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Graphiques d'évolution des prix</li>
                <li>• Comparaison Martinique vs France métropolitaine</li>
                <li>• Alertes sur vos produits favoris</li>
                <li>• Classement des magasins les moins chers</li>
                <li>• Actions collectives et pétitions</li>
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
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t p-4 text-center text-sm text-gray-600 mt-8">
        <p className="mb-2">Ensemble, nous créons la transparence sur les prix 💪</p>
        <p className="text-xs text-gray-500">
          Données crowdsourcées • Gratuit et ouvert à tous
        </p>
      </div>
    </div>
  );
};

export default PriceScannerApp;