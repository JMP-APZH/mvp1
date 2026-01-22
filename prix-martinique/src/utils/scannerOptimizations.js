/**
 * Pro-level optimization utilities for barcode scanning
 */

/**
 * Calculate scan region (centered square) for cropping
 * @param {number} videoWidth - Video element width
 * @param {number} videoHeight - Video element height
 * @param {number} scanSize - Size of the scan square (default 300px)
 * @returns {object} Crop coordinates {x, y, width, height}
 */
export function calculateScanRegion(videoWidth, videoHeight, scanSize = 300) {
  const size = Math.min(scanSize, videoWidth, videoHeight);
  return {
    x: (videoWidth - size) / 2,
    y: (videoHeight - size) / 2,
    width: size,
    height: size
  };
}

/**
 * Create an offscreen canvas for cropping and preprocessing
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {object} Canvas and context {canvas, ctx}
 */
export function createOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return { canvas, ctx };
}

/**
 * Apply contrast and brightness enhancement for better barcode detection
 * Especially useful in low-light conditions
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLVideoElement} video - Video element
 * @param {object} cropRegion - Crop coordinates
 */
export function applyContrastEnhancement(ctx, video, cropRegion) {
  // Apply filters for sharper barcode lines
  ctx.filter = 'contrast(1.4) brightness(1.1) grayscale(1)';

  // Draw cropped region from video to canvas
  ctx.drawImage(
    video,
    cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height,
    0, 0, cropRegion.width, cropRegion.height
  );

  // Reset filter for next operations
  ctx.filter = 'none';
}

/**
 * Get optimal camera constraints for iOS performance
 * The "golden ratio" for WASM processing speed vs quality
 */
export const OPTIMAL_CAMERA_CONSTRAINTS = {
  video: {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16/9 }
  },
  audio: false
};
