import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { fileURLToPath } from 'url';
import imagemin from 'vite-plugin-imagemin';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  // Never expose server credentials (especially X OAuth values) to browser code.
  envPrefix: ['VITE_APP_', 'VITE_BACKEND_'],
  plugins: [
    react(),
    imagemin({
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.65, 0.8] },
      gifsicle: { optimizationLevel: 7 }
    })
  ],
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
          'utils': ['sweetalert2'],
          // Per-world chunks — makes initial load smaller on mobile
          'noon-world': ['./src/components/3d/NoonWorld3D'],
          'sunrise-world': ['./src/components/3d/SunriseWorld3D'],
          'evening-world': ['./src/components/3d/EveningWorld3D'],
          'disco-world': ['./src/components/3d/DiscoWorld3D'],
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'three') return 'assets/three-[hash].js';
          if (['noon-world','sunrise-world','evening-world','disco-world'].includes(chunkInfo.name)) {
            return `assets/${chunkInfo.name}-[hash].js`;
          }
          return 'assets/[name]-[hash].js';
        }
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@images': path.resolve(rootDir, './src/assets/images'),
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
