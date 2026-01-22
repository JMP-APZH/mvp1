/**
 * ZXing WASM Barcode Scanner Component
 *
 * Uses native Barcode Detection API on Android (hardware-accelerated)
 * Uses ZXing-WASM polyfill on iOS Safari
 *
 * Features:
 * - Automatic platform detection
 * - Canvas-based image processing with contrast enhancement
 * - Centered scan region for optimal detection
 * - Manual entry fallback
 */

import { useState, useRef, useEffect } from 'react';
import { initBarcodeDetector, isBarcodeDetectorSupported } from '../utils/scannerInit';
import {
  calculateScanRegion,
  createOffscreenCanvas,
  applyContrastEnhancement,
  OPTIMAL_CAMERA_CONSTRAINTS
} from '../utils/scannerOptimizations';

const ZXingBarcodeScanner = ({ onDetected, onClose }) => {
  // State
  const [scannerType, setScannerType] = useState(''); // 'native' or 'polyfill'
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const scanRegionRef = useRef(null);

  // Initialize barcode detector on mount
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        console.log('🔧 Initializing barcode detector...');
        const type = await initBarcodeDetector();
        if (mounted) {
          setScannerType(type);
          setIsInitialized(true);
          console.log(`✅ Barcode detector initialized: ${type}`);
          // Auto-start scanning after init
          startScanning();
        }
      } catch (err) {
        console.error('❌ Failed to initialize barcode detector:', err);
        if (mounted) {
          setError('Échec de l\'initialisation du scanner. Veuillez rafraîchir la page.');
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      stopScanning();
    };
  }, []);

  // Start camera and scanning
  const startScanning = async () => {
    try {
      setError('');

      // Check support
      if (!isBarcodeDetectorSupported()) {
        throw new Error('La détection de code-barres n\'est pas supportée sur ce navigateur');
      }

      console.log('📷 Requesting camera access...');

      // Request camera access with optimal constraints
      const stream = await navigator.mediaDevices.getUserMedia(OPTIMAL_CAMERA_CONSTRAINTS);
      streamRef.current = stream;

      console.log('📷 Camera access granted');

      // Wait for video element to be available
      await new Promise((resolve) => {
        const checkVideo = () => {
          if (videoRef.current) {
            resolve();
          } else {
            setTimeout(checkVideo, 50);
          }
        };
        checkVideo();
      });

      // Attach stream to video
      videoRef.current.srcObject = stream;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          console.log('📷 Video metadata loaded');
          resolve();
        };
        videoRef.current.onerror = (e) => {
          console.error('📷 Video error:', e);
          reject(e);
        };
        setTimeout(() => reject(new Error('Video load timeout')), 10000);
      });

      await videoRef.current.play();
      console.log('📷 Video playing');

      // Create barcode detector
      detectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
      });

      // Create offscreen canvas for cropping/preprocessing
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      console.log(`📷 Video dimensions: ${videoWidth}x${videoHeight}`);

      scanRegionRef.current = calculateScanRegion(videoWidth, videoHeight, 300);
      offscreenCanvasRef.current = createOffscreenCanvas(
        scanRegionRef.current.width,
        scanRegionRef.current.height
      );

      setIsScanning(true);
      console.log('✅ Scanner ready, starting detection loop');

      // Start detection loop
      scanLoop();

    } catch (err) {
      console.error('Error starting scanner:', err);
      if (err.name === 'NotAllowedError') {
        setError('Permission caméra refusée. Veuillez autoriser l\'accès à la caméra.');
      } else if (err.name === 'NotFoundError') {
        setError('Aucune caméra trouvée sur cet appareil.');
      } else {
        setError(`Erreur scanner: ${err.message}`);
      }
      // Don't stop, allow manual entry
    }
  };

  // Main scanning loop with optimizations
  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current || !offscreenCanvasRef.current || !scanRegionRef.current) {
      return;
    }

    try {
      const { canvas, ctx } = offscreenCanvasRef.current;
      const scanRegion = scanRegionRef.current;

      // Apply contrast enhancement and crop to scan region
      applyContrastEnhancement(ctx, videoRef.current, scanRegion);

      // Detect barcodes from the processed canvas
      const barcodes = await detectorRef.current.detect(canvas);

      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        console.log('📷 Barcode detected:', code);

        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }

        // Stop scanning and report result
        stopScanning();
        onDetected(code);
        return;
      }

      // Continue scanning
      animationFrameRef.current = requestAnimationFrame(scanLoop);

    } catch (err) {
      console.error('Error during detection:', err);
      // Continue scanning even if one frame fails
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    }
  };

  // Stop scanning and cleanup
  const stopScanning = () => {
    setIsScanning(false);

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Handle manual code submission
  const handleManualSubmit = () => {
    const trimmedCode = manualCode.trim();
    if (trimmedCode.length >= 8 && trimmedCode.length <= 13) {
      stopScanning();
      onDetected(trimmedCode);
    } else {
      alert('Le code-barres doit contenir entre 8 et 13 chiffres');
    }
  };

  // Handle close
  const handleClose = () => {
    stopScanning();
    onClose();
  };

  // Manual entry UI
  if (showManualEntry) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 flex justify-between items-center">
          <h3 className="text-white font-medium">Saisie manuelle</h3>
          <button
            onClick={handleClose}
            className="text-white p-2"
            aria-label="Fermer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-900">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center space-y-4">
            <div className="text-4xl mb-2">⌨️</div>
            <h4 className="font-medium text-lg text-gray-900">Entrez le code-barres</h4>
            <p className="text-gray-600 text-sm">
              Saisissez les chiffres sous le code-barres
            </p>

            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Code-barres (8-13 chiffres)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-center text-xl font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength="13"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowManualEntry(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Retour
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualCode.length < 8}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:opacity-90"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main scanner UI
  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />

      {/* Scan region overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Semi-transparent overlays around scan region */}
        <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50" style={{ height: '25%' }} />
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50" style={{ height: '25%' }} />
        <div className="absolute left-0 bg-black bg-opacity-50" style={{ top: '25%', bottom: '25%', width: '10%' }} />
        <div className="absolute right-0 bg-black bg-opacity-50" style={{ top: '25%', bottom: '25%', width: '10%' }} />

        {/* Scan region border */}
        <div
          className="absolute border-2 border-green-400"
          style={{ top: '25%', left: '10%', right: '10%', bottom: '25%' }}
        >
          {/* Corner markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400" />
        </div>
      </div>

      {/* Header text */}
      <div className="absolute top-8 left-0 right-0 text-center px-4 pointer-events-none">
        <p className="text-white text-lg font-medium drop-shadow-lg">
          {!isInitialized ? 'Initialisation...' : 'Alignez le code-barres dans le cadre'}
        </p>
        {/* Scanner type badge */}
        {isInitialized && (
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
            scannerType === 'native'
              ? 'bg-green-500 bg-opacity-80 text-white'
              : 'bg-blue-500 bg-opacity-80 text-white'
          }`}>
            {scannerType === 'native' ? '🤖 API Native' : '🍎 ZXing WASM'}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="absolute top-24 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-center text-sm">
          {error}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 bg-white bg-opacity-20 backdrop-blur-sm text-white p-3 rounded-full pointer-events-auto z-10"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Manual entry button */}
      <button
        onClick={() => setShowManualEntry(true)}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 text-gray-800 px-6 py-2 rounded-full text-sm font-medium pointer-events-auto"
      >
        Saisir manuellement
      </button>

      {/* Loading spinner */}
      {!isInitialized && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center">
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ZXingBarcodeScanner;
