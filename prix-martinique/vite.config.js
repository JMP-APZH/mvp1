import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure WASM files are treated as static assets
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['zxing-wasm']
  },
  server: {
    headers: {
      // Required for WASM to work in development
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-recharts': ['recharts'],
          'vendor-scanner': ['@undecaf/barcode-detector-polyfill', 'zxing-wasm'],
        }
      }
    }
  }
})
