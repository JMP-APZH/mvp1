import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill';

/**
 * Initialize barcode detector with automatic platform detection
 * - Android Chrome/Edge: Uses native Barcode Detection API
 * - iOS Safari: Uses ZXing-WASM polyfill
 */
export async function initBarcodeDetector() {
  if (!('BarcodeDetector' in window)) {
    // iOS Safari or browsers without native support
    window.BarcodeDetector = BarcodeDetectorPolyfill;
    console.log('🍎 iOS/Safari detected: Using ZXing-WASM Polyfill');
    return 'polyfill';
  } else {
    // Android Chrome/Edge with native support
    console.log('🤖 Android/Native API detected: Using Hardware-Accelerated Scanner');
    return 'native';
  }
}

/**
 * Check if BarcodeDetector is supported (native or polyfill)
 */
export function isBarcodeDetectorSupported() {
  return 'BarcodeDetector' in window || typeof BarcodeDetectorPolyfill !== 'undefined';
}
