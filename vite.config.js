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
});
