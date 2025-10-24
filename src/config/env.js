/**
 * Environment configuration utility
 * Handles environment-specific settings and API keys
 */

// Determine the current environment
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';

// API Keys with fallbacks
export const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY || '';
export const DEXTOOLS_API_KEY = import.meta.env.VITE_DEXTOOLS_API_KEY || 'QA2MWclN829VYyqBuCNmg5ei4vqnxtyAaHaOOzch';
export const DEXSCREENER_API_KEY = import.meta.env.VITE_DEXSCREENER_API_KEY || '';
export const COINGECKO_API_KEY = import.meta.env.VITE_COINGECKO_API_KEY || 'CG-LFDubYkjAMbfAkjQ4NsNjVeV';

// Mainnet
export const MAINNET_SOLANA_RPC_URL = import.meta.env.VITE_MAINNET_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
export const MAINNET_SOLANA_CONTRACT_ADDRESS = import.meta.env.VITE_MAINNET_SOLANA_CONTRACT_ADDRESS;

// Devnet
export const DEVNET_SOLANA_RPC_URL = import.meta.env.VITE_DEVNET_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const DEVNET_SOLANA_CONTRACT_ADDRESS = import.meta.env.VITE_DEVNET_SOLANA_CONTRACT_ADDRESS;

// API URLs with environment-specific configuration
export const API_CONFIG = {
  dextools: {
    baseUrl: import.meta.env.VITE_DEXTOOLS_API_URL || 'https://public-api.dextools.io/trial/v2',
    timeout: 30000,
    proxyRequired: APP_ENV === 'development',
    // In production, we'd use a proxy server or serverless function to avoid CORS issues
    proxyUrl: APP_ENV === 'production' ? '/api/dextools' : ''
  },
  dexscreener: {
    baseUrl: import.meta.env.VITE_DEXSCREENER_API_URL || 'https://api.dexscreener.com',
    timeout: 30000,
    proxyRequired: APP_ENV === 'development',
    proxyUrl: APP_ENV === 'production' ? '/api/dexscreener' : ''
  },
  coingecko: {
    baseUrl: import.meta.env.VITE_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',
    timeout: 30000,
    proxyRequired: false // CoinGecko has proper CORS headers
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
