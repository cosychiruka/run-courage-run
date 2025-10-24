import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@images': path.resolve(__dirname, './src/assets/images'),
    },
  },
  // Make all environment variables available to client code
  define: {
    // Explicitly expose environment variables that should be available to the client
    'process.env.REACT_APP_ALCHEMY_API_KEY': JSON.stringify(process.env.REACT_APP_ALCHEMY_API_KEY),
    'process.env.VITE_ALCHEMY_API_KEY': JSON.stringify(process.env.VITE_ALCHEMY_API_KEY),
    'import.meta.env.VITE_ALCHEMY_API_KEY': JSON.stringify(process.env.VITE_ALCHEMY_API_KEY),
    // Fix for __DEFINES__ reference error
    '__DEFINES__': '{}',
  },
});
