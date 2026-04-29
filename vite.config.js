import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // For serving from subdirectory on Sliplane
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
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
