/**
 * Environment configuration utility
 * Handles environment-specific settings and API keys
 */

// Determine the current environment
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';

// API Keys with fallbacks
export const DEXSCREENER_API_KEY = import.meta.env.VITE_DEXSCREENER_API_KEY || '';

// Mainnet
export const MAINNET_SOLANA_RPC_URL = import.meta.env.VITE_MAINNET_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
export const MAINNET_SOLANA_CONTRACT_ADDRESS = import.meta.env.VITE_MAINNET_SOLANA_CONTRACT_ADDRESS;

// Devnet
export const DEVNET_SOLANA_RPC_URL = import.meta.env.VITE_DEVNET_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const DEVNET_SOLANA_CONTRACT_ADDRESS = import.meta.env.VITE_DEVNET_SOLANA_CONTRACT_ADDRESS;

// API URLs with environment-specific configuration
export const API_CONFIG = {
  dexscreener: {
    baseUrl: import.meta.env.VITE_DEXSCREENER_API_URL || 'https://api.dexscreener.com',
    timeout: 30000,
    proxyRequired: APP_ENV === 'development',
    proxyUrl: APP_ENV === 'production' ? '/api/dexscreener' : ''
  }
};

// Environment-specific settings
export const ENV_CONFIG = {
  development: {
    enableLogging: true,
    apiCacheTTL: 5 * 60 * 1000, // 5 minutes
    fallbackToPlaceholderData: true
  },
  production: {
    enableLogging: false,
    apiCacheTTL: 15 * 60 * 1000, // 15 minutes
    fallbackToPlaceholderData: true
  }
};

// Export current environment config
export const CURRENT_ENV_CONFIG = ENV_CONFIG[APP_ENV] || ENV_CONFIG.development;

// Helper to determine if we're in production
export const isProd = APP_ENV === 'production';
export const isDev = APP_ENV === 'development';

// Logging utility that respects environment setting
export const envLog = (...args) => {
  if (CURRENT_ENV_CONFIG.enableLogging) {
    console.log(`[${APP_ENV}]`, ...args);
  }
};

export const envWarn = (...args) => {
  if (CURRENT_ENV_CONFIG.enableLogging) {
    console.warn(`[${APP_ENV}]`, ...args);
  }
};

export const envError = (...args) => {
  // Always log errors, but with environment tag
  console.error(`[${APP_ENV}]`, ...args);
};
