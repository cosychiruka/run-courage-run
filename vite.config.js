import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { config } from 'dotenv';
import imagemin from 'vite-plugin-imagemin';

// Load environment variables from .env file
config();

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    imagemin({
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.65, 0.8] },
      gifsicle: { optimizationLevel: 7 }
    })
  ],
  define: {
    // WebSocket URL for different environments
    __VITE_BACKEND_WS__: JSON.stringify(
      process.env.VITE_BACKEND_WS || 
      (process.env.NODE_ENV === 'production' 
        ? 'wss://runcouragerun.fun/ws/voice' 
        : 'ws://localhost:8000/ws/voice')
    )
  },
  base: './', // For serving from subdirectory on Sliplane
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'react': ['react', 'react-dom'],
          'ui': ['react-icons'],
          'utils': ['sweetalert2']
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'three') return 'assets/three-[hash].js';
          return 'assets/[name]-[hash].js';
        }
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@images': path.resolve(__dirname, './src/assets/images'),
    },
    // Force a single copy of React and Three — R3F must share the same React
    // instance as the app, otherwise hooks fail with "dispatcher is null"
    dedupe: ['react', 'react-dom', 'three'],
  },
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      // R3F v8 ships its own CJS scheduler — pre-bundle it so esbuild
      // handles the CJS→ESM named-export conversion correctly
      '@react-three/fiber > scheduler',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
