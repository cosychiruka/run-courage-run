/**
 * Utility functions for URL generation and manipulation
 */

/**
 * Generates a URL to view a token on Dextools
 * @param {string} network - The network (e.g., "Solana", "Ethereum")
 * @param {string} tokenAddress - The token contract address
 * @returns {string} - The Dextools URL
 */
export const generateDexToolsUrl = (network, tokenAddress) => {
  if (!tokenAddress) return '#';
  
  // Handle different networks
  switch (network.toLowerCase()) {
    case 'solana':
      return `https://www.dextools.io/app/solana/pair-explorer/${tokenAddress}`;
    case 'ethereum':
      return `https://www.dextools.io/app/ether/pair-explorer/${tokenAddress}`;
    case 'bnb':
    case 'binance':
      return `https://www.dextools.io/app/bnb/pair-explorer/${tokenAddress}`;
    default:
      return `https://www.dextools.io/app/solana/pair-explorer/${tokenAddress}`;
  }
};

/**
 * Generates a URL to view a token on Dexscreener
 * @param {string} network - The network (e.g., "Solana", "Ethereum")
 * @param {string} tokenAddress - The token contract address
 * @returns {string} - The Dexscreener URL
 */
export const generateDexscreenerUrl = (network, tokenAddress) => {
  if (!tokenAddress) return '#';
  
  // Handle different networks
  switch (network.toLowerCase()) {
    case 'solana':
      return `https://dexscreener.com/solana/${tokenAddress}`;
    case 'ethereum':
      return `https://dexscreener.com/ethereum/${tokenAddress}`;
    case 'bnb':
    case 'binance':
      return `https://dexscreener.com/bsc/${tokenAddress}`;
    default:
      return `https://dexscreener.com/solana/${tokenAddress}`;
  }
};

/**
 * Generates a URL to view a token on CoinGecko
 * @param {string} tokenId - The CoinGecko token ID
 * @returns {string} - The CoinGecko URL
 */
export const generateCoinGeckoUrl = (tokenId) => {
  if (!tokenId) return '#';
  return `https://www.coingecko.com/en/coins/${tokenId}`;
};
