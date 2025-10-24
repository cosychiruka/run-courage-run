import axios from 'axios';
import ShitcoinLogo from '@images/erc20-shitcoin.webp';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

// Get API key from environment variables (supports both Vite and React env vars)
const getMoralisApiKey = () => {
  // Debug output to help troubleshoot API key issues
  console.log('VITE ENV API KEY:', import.meta?.env?.VITE_MORALIS_API_KEY ? 'Found' : 'Not found');
  console.log('REACT ENV API KEY:', process.env?.REACT_APP_MORALIS_API_KEY ? 'Found' : 'Not found');
  
  return import.meta?.env?.VITE_MORALIS_API_KEY || process.env?.REACT_APP_MORALIS_API_KEY || '';
};

// Solana connection for fallback token info
const solanaConnection = new Connection('https://api.mainnet-beta.solana.com');

/**
 * Try to get token metadata directly from Solana blockchain
 * @param {string} tokenAddress - The Solana token address
 * @returns {Promise<Object|null>} - Token metadata or null if not found
 */
const getTokenInfoFromSolana = async (tokenAddress) => {
  try {
    // Try to parse the token address
    const mintAddress = new PublicKey(tokenAddress);
    
    // Get token mint info
    const mintInfo = await getMint(solanaConnection, mintAddress);
    
    // We don't get a symbol from on-chain data directly
    // But we can return decimals and create a generic name
    return {
      name: `Solana Token ${tokenAddress.substring(0, 6)}...`,
      symbol: tokenAddress.substring(0, 4).toUpperCase(),
      logo: ShitcoinLogo, // Still use placeholder for logo
      decimals: mintInfo.decimals,
      mintAuthority: mintInfo.mintAuthority?.toString(),
      supply: mintInfo.supply.toString(),
    };
  } catch (error) {
    console.error('Error fetching on-chain token info:', error);
    return null;
  }
};

/**
 * Check if a string is an API key format (basic validation)
 * @param {string} key - The API key to validate
 * @returns {boolean} - Whether it looks like a valid API key
 */
const isValidApiKey = (key) => {
  // Basic check - API keys should be at least 20 chars
  return typeof key === 'string' && key.length >= 20;
};

/**
 * Fetch Solana token metadata using Moralis API
 * @param {string} tokenAddress - The Solana token address
 * @returns {Promise<Object>} - Token metadata including name, symbol, logo, and decimals
 */
export const fetchSolanaTokenMetadata = async (tokenAddress) => {
  try {
    // Check if the token address ends with 'pump' to identify Pump.fun tokens
    const isPumpToken = tokenAddress.toLowerCase().endsWith('pump');
    
    // Get API key directly from .env variables and validate it looks reasonable
    const apiKey = getMoralisApiKey();
    
    if (!isValidApiKey(apiKey)) {
      console.warn('No valid Moralis API key found. Trying to get data from Solana directly.');
      
      // Try to get token info directly from Solana blockchain
      const onChainData = await getTokenInfoFromSolana(tokenAddress);
      if (onChainData) return onChainData;
      
      // Fallback if on-chain lookup fails
      return {
        name: isPumpToken ? `Pump ${tokenAddress.substring(0, 4)}` : "Unknown Token",
        symbol: isPumpToken ? "PUMP" : "???",
        logo: ShitcoinLogo,
        decimals: 9,
      };
    }

    const options = {
      method: 'GET',
      url: `https://solana-gateway.moralis.io/token/mainnet/${tokenAddress}/metadata`,
      headers: {
        'accept': 'application/json',
        'X-API-Key': apiKey
      }
    };

    const response = await axios.request(options);
    const metadata = response.data;
    
    // Log the metadata for debugging
    console.log('Moralis metadata for token:', tokenAddress, metadata);
    
    // Check if we need to fetch an image URL separately
    let logoUrl = metadata.logo;
    
    // If no logo in Moralis response, try to fetch from token metadata URI if available
    if (!logoUrl && metadata?.metaplex?.metadataUri) {
      try {
        const metadataResponse = await axios.get(metadata.metaplex.metadataUri);
        if (metadataResponse.data?.image) {
          logoUrl = metadataResponse.data.image;
          console.log('Found logo in token metadata URI:', logoUrl);
        }
      } catch (metadataError) {
        console.warn('Error fetching token metadata URI:', metadataError);
      }
    }

    return {
      name: metadata.name || "Unknown",
      symbol: metadata.symbol || "Unknown",
      logo: logoUrl || ShitcoinLogo,
      decimals: parseInt(metadata.decimals || "9", 10),
      totalSupply: metadata.totalSupplyFormatted,
      fullyDilutedValue: metadata.fullyDilutedValue,
      metaplex: metadata.metaplex
    };
  } catch (error) {
    console.error(`Error fetching Solana token metadata from Moralis for ${tokenAddress}:`, error);
    
    // Try to get token info directly from Solana blockchain
    const onChainData = await getTokenInfoFromSolana(tokenAddress);
    if (onChainData) return onChainData;
    
    // Return placeholder data on error
    return {
      name: tokenAddress.substring(0, 8) + "...",
      symbol: "???",
      logo: ShitcoinLogo,
      decimals: 9,
    };
  }
};

/**
 * Check if a token address is likely a Pump.fun token
 * @param {string} tokenAddress - The token address to check
 * @returns {boolean} - True if it's likely a Pump.fun token
 */
export const isPumpFunToken = (tokenAddress) => {
  if (!tokenAddress) return false;
  
  // Check if the address ends with 'pump' or 'moon' which are common for Pump.fun tokens
  return tokenAddress.toLowerCase().endsWith('pump') || 
         tokenAddress.toLowerCase().endsWith('moon');
};
