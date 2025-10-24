import axios from 'axios';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { APP_ENV, MAINNET_SOLANA_RPC_URL, DEVNET_SOLANA_RPC_URL, envLog } from '../config/env';
import { getSolanaConnection } from './quicknodeService';

/**
 * Fetch Solana account balance using direct RPC calls instead of WalletConnect
 * @param {string} address - Solana account address
 * @returns {Promise<Object>} - Balance information
 */
export const fetchSolanaBalance = async (address) => {
  try {
    if (!address) {
      throw new Error('No address provided');
    }

    // Determine network based on environment
    const isDevnet = APP_ENV === 'development' || import.meta.env?.VITE_SOLANA_NETWORK === 'devnet';
    const rpcUrl = isDevnet ? DEVNET_SOLANA_RPC_URL : MAINNET_SOLANA_RPC_URL;
    
    // Use the getSolanaConnection utility which includes proper error handling
    const connection = getSolanaConnection(isDevnet ? 'devnet' : 'mainnet-beta');
    
    // Log the network being used for debugging
    envLog('Fetching Solana balance using:', isDevnet ? 'devnet' : 'mainnet-beta', 'network');
    
    // Convert address string to PublicKey
    const publicKey = new PublicKey(address);
    
    // Get account balance in lamports
    const balance = await connection.getBalance(publicKey);
    
    // Convert lamports to SOL
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    // Get SOL/USD price for conversion with retry logic and API key
    // In production, you would use a reliable price oracle
    let usdPrice = 0;
    const fetchPrice = async (retries = 3) => {
      try {
        // Add a cache busting parameter and proper user agent to avoid rate limits
        const timestamp = new Date().getTime();
        const priceResponse = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&_cache=${timestamp}`,
          {
            headers: {
              'User-Agent': 'Courage Lending App/1.0',
              'Accept': 'application/json'
            },
            timeout: 5000 // 5 second timeout
          }
        );
        return priceResponse.data.solana.usd;
      } catch (error) {
        if (retries > 0 && (error.response?.status === 429 || error.response?.status === 400)) {
          // If we get rate limited or bad request, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchPrice(retries - 1);
        }
        throw error;
      }
    };
    
    try {
      usdPrice = await fetchPrice();
    } catch (priceError) {
      console.warn('Failed to fetch SOL price after retries, using default value', priceError);
      usdPrice = 60; // Default fallback price if API fails completely
    }
    
    // Calculate USD value
    const usdBalance = solBalance * usdPrice;
    
    return {
      balance: solBalance.toString(),
      balanceFormatted: `${solBalance.toFixed(4)} SOL`,
      usdBalance: usdBalance.toString(),
      usdBalanceFormatted: `$${usdBalance.toFixed(2)}`,
      symbol: 'SOL',
      name: 'Solana',
      logo: 'https://solana.com/src/img/branding/solanaLogoMark.svg'
    };
  } catch (error) {
    console.error('Error fetching Solana balance:', error);
    return {
      balance: '0',
      balanceFormatted: '0 SOL',
      usdBalance: '0',
      usdBalanceFormatted: '$0.00',
      symbol: 'SOL',
      name: 'Solana',
      error: error.message
    };
  }
};

/**
 * Check if the address is a valid Solana address
 * @param {string} address - Address to check
 * @returns {boolean} - True if valid Solana address
 */
export const isSolanaAddress = (address) => {
  try {
    if (!address) return false;
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};
