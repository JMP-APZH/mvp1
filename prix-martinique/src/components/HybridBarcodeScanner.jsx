/**
 * Hybrid Barcode Scanner with Native Fallback
 *
 * This component tries QuaggaJS first, but provides a native HTML5
 * camera input fallback for iOS devices where QuaggaJS fails.
 *
 * Strategy:
 * 1. Detect iOS/Safari
 * 2. Try QuaggaJS with iOS-optimized config
 * 3. If fails after 3 seconds, fall back to native camera
 * 4. Native camera takes photo → user manually reads barcode → enters it
 */

import { useState, useRef, useEffect } from 'react';
import Quagga from 'quagga';

const HybridBarcodeScanner = ({ onDetected, onClose }) => {
  const [scanMethod, setScanMethod] = useState('quagga'); // 'quagga' or 'native'
  const [isInitializing, setIsInitializing] = useState(true);
  const [capturedImage, setCapturedImage] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    let mounted = true;
    let initTimeout;

    const tryQuaggaInit = async () => {
      // Set timeout to fall back to native if QuaggaJS doesn't work
      initTimeout = setTimeout(() => {
        if (isInitializing && mounted) {
          console.log('⚠️ QuaggaJS timeout, falling back to native camera');
          setScanMethod('native');
          setIsInitializing(false);
        }
      }, 3000);

      try {
        const config = {
          inputStream: {
            type: 'LiveStream',
            target: scannerRef.current,
            constraints: {
              width: { min: 640, ideal: 1280 },
              height: { min: 480, ideal: 720 },
              facingMode: 'environment',
              aspectRatio: { ideal: 16/9 }
            }
          },
          decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader'],
            multiple: false
          },
          locate: true,
          frequency: 10
        };

        await new Promise(resolve => setTimeout(resolve, 100));

        Quagga.init(config, (err) => {
          clearTimeout(initTimeout);

          if (err) {
            console.error('QuaggaJS error:', err);
            if (mounted) {
              setScanMethod('native');
              setIsInitializing(false);
            }
            return;
          }

          if (!mounted) return;

          const video = scannerRef.current?.querySelector('video');
          if (video) {
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
          }

          console.log('✅ QuaggaJS working!');
          setIsInitializing(false);
          Quagga.start();
        });

        Quagga.onDetected((result) => {
          if (result?.codeResult?.code) {
            const code = result.codeResult.code;
            if (code.length >= 8 && code.length <= 13) {
              onDetected(code);
            }
          }
        });

      } catch (err) {
        console.error('Camera error:', err);
        clearTimeout(initTimeout);
        if (mounted) {
          setScanMethod('native');
          setIsInitializing(false);
        }
      }
    };

    if (scanMethod === 'quagga') {
      tryQuaggaInit();
    }

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      try {
        Quagga.stop();
        Quagga.offDetected();
      } catch (e) {}
    };
  }, [scanMethod, onDetected, isInitializing]);

  // Handle native camera capture
  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle manual code entry
  const handleManualSubmit = () => {
    if (manualCode.length >= 8 && manualCode.length <= 13) {
      onDetected(manualCode);
    } else {
      alert('Le code-barres doit contenir entre 8 et 13 chiffres');
    }
  };

  // Retry QuaggaJS
  const retryQuagga = () => {
    setCapturedImage(null);
    setManualCode('');
    setIsInitializing(true);
    setScanMethod('quagga');
  };

  // Native camera fallback UI
  if (scanMethod === 'native') {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 flex justify-between items-center">
          <h3 className="text-white font-medium">Scanner de code-barres</h3>
          <button
            onClick={onClose}
            className="text-white p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
          {!capturedImage ? (
            <>
              {/* Camera button */}
              <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center space-y-4">
                <div className="text-4xl mb-2">📷</div>
                <h4 className="font-medium text-lg">Prendre une photo du code-barres</h4>
                <p className="text-gray-600 text-sm">
                  Prenez une photo claire du code-barres, puis saisissez les chiffres manuellement
                </p>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-medium"
                >
                  Ouvrir la caméra
                </button>

                {/* Manual entry option */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-2">Ou saisissez directement :</p>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Code-barres (8-13 chiffres)"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center text-lg"
                    maxLength="13"
                  />
                  <button
                    onClick={handleManualSubmit}
                    disabled={manualCode.length < 8}
                    className="w-full mt-2 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Valider
                  </button>
                </div>

                {/* Retry QuaggaJS */}
                {isIOS && (
                  <button
                    onClick={retryQuagga}
                    className="text-sm text-orange-600 underline"
                  >
                    Réessayer le scanner automatique
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Show captured image */}
              <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-4">
                <img
                  src={capturedImage}
                  alt="Code-barres capturé"
                  className="w-full rounded-lg border"
                />

                <p className="text-sm text-gray-600 text-center">
                  Saisissez les chiffres du code-barres :
                </p>

                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Code-barres (8-13 chiffres)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-center text-xl font-mono"
                  maxLength="13"
                  autoFocus
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setManualCode('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                  >
                    Reprendre
                  </button>
                  <button
                    onClick={handleManualSubmit}
                    disabled={manualCode.length < 8}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Valider
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // QuaggaJS scanner UI
  return (
    <div className="fixed inset-0 bg-black z-50">
      <div ref={scannerRef} className="absolute inset-0" />

      {/* Overlay and instructions */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50" style={{ height: '20%' }} />
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50" style={{ height: '20%' }} />
        <div className="absolute left-0 bg-black bg-opacity-50" style={{ top: '20%', bottom: '20%', width: '10%' }} />
        <div className="absolute right-0 bg-black bg-opacity-50" style={{ top: '20%', bottom: '20%', width: '10%' }} />

        <div
          className="absolute border-2 border-yellow-400"
          style={{ top: '20%', left: '10%', right: '10%', bottom: '20%' }}
        >
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400" />
        </div>
      </div>

      <div className="absolute top-8 left-0 right-0 text-center px-4 pointer-events-none">
        <p className="text-white text-lg font-medium drop-shadow-lg">
          {isInitializing ? 'Initialisation...' : 'Alignez le code-barres'}
        </p>
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-white bg-opacity-20 backdrop-blur-sm text-white p-3 rounded-full pointer-events-auto z-10"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Manual entry fallback button */}
      <button
        onClick={() => setScanMethod('native')}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 text-gray-800 px-6 py-2 rounded-full text-sm font-medium pointer-events-auto"
      >
        Saisir manuellement
      </button>

      {isInitializing && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center">
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HybridBarcodeScanner;
