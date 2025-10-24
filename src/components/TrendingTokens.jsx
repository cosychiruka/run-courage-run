import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

// Import styles and images
import '../assets/css/TrendingTokens.css';
import ShitcoinLogo from '@images/erc20-shitcoin.webp';

// Define placeholder image
const placeholderImage = ShitcoinLogo;

// Import components
import ErrorBoundary from './ErrorBoundary';

// Import icons
import { FaFire, FaChevronDown, FaChevronUp, FaExchangeAlt } from 'react-icons/fa';

// Import services
import { fetchSolanaTokenMetadata, isPumpFunToken } from '../services/alchemyService';
import dexscreenerService from '../services/dexscreener';
import coinGeckoService from '../services/coingecko';

// Import environment utilities
import { envLog, envError, envWarn } from '../config/env';

// Import URL utilities
import { generateDexToolsUrl, generateDexscreenerUrl, generateCoinGeckoUrl } from '../utils/urlUtils';

// Data source options
const DATA_SOURCES = {
  DEXTOOLS: 'dextools',
  COINGECKO: 'coingecko',
  DEXSCREENER: 'dexscreener'
};

// Solana burn address constant
const SOLANA_BURN_ADDRESS = '11111111111111111111111111111111';

// Placeholder token data for Solana tokens
const placeholderTokens = {
  Solana: [
    { rank: 1, mainToken: { address: '1731922793906', symbol: 'RIZO', name: 'HahaYes' }, sideToken: { address: '6nmiCc4QSXqjsNYWgPRBVtij7GdHfDTud71eEGqApqav', symbol: 'SOL', name: 'Solana' } },
    { rank: 2, mainToken: { address: '1731924952413', symbol: 'BARSIK', name: 'Hasbullas Cat' }, sideToken: { address: 'HobaNfHNrDcFP8z8T9n3j6K4UF5jSDmdpdxXQpyC83o', symbol: 'SOL', name: 'Solana' } },
    { rank: 3, mainToken: { address: '1731924900261', symbol: 'LUCE', name: 'Official Maskot of the Holy Ye' }, sideToken: { address: 'HQWsAXxH3dGy9DQbryJyDrquKt2eDY6MMHWmpUEKfgZq', symbol: 'SOL', name: 'Solana' } },
    { rank: 4, mainToken: { address: '1731925082510', symbol: 'PEPE', name: 'PEPE' }, sideToken: { address: 'FCEnSxyJfRSKsz6tASUENCsfGwKgkH6YuRn1AMmyHhZn', symbol: 'SOL', name: 'Solana' } },
    { rank: 5, mainToken: { address: '1731925020043', symbol: 'ACT', name: 'ACT 1: The AI prophecy' }, sideToken: { address: 'B4PHSkL6CeZbxVqm1aUPQuVpc5ERFcaZj7u9dhtphmVX', symbol: 'SOL', name: 'Solana' } },
    { rank: 6, mainToken: { address: '1731925130645', symbol: 'SHADOW', name: 'SHADOW' }, sideToken: { address: 'C3QtzuypnAeoiuodAWFjYFsXfdUQnWAu88cHLMzDGDbM', symbol: 'SOL', name: 'Solana' } },
    { rank: 7, mainToken: { address: '1731925205770', symbol: 'PESTO', name: 'Pesto the Baby King Penguin' }, sideToken: { address: 'A9KLSS9modWzMc1A189c6HXwy1QkgUupun9TPJZkhmaw', symbol: 'SOL', name: 'Solana' } },
    { rank: 8, mainToken: { address: '1731925211714', symbol: 'POPDOG', name: 'PopDog' }, sideToken: { address: 'FmLmM2C3svyMmRwzTmnEjGnA5cD4YBLuPoQPixqZJG15', symbol: 'SOL', name: 'Solana' } },
    { rank: 9, mainToken: { address: '1731925234534', symbol: 'CATE', name: 'cate' }, sideToken: { address: 'HWpJCxqQEiQF6CKGM1gQ5w3pmKJqnRuCfGZEKMHHVDo2', symbol: 'SOL', name: 'Solana' } },
    { rank: 10, mainToken: { address: '1731925246107', symbol: 'tooker', name: 'tooker kurlson' }, sideToken: { address: '3vGHsKVKNapB4hSapzKNwtiJ6DA8Ytd9SsMFSoAk154B', symbol: 'SOL', name: 'Solana' } },
  ],
};

// Placeholder data for fallbacks
const placeholderTokensSolana = [
  {
    rank: 1,
    mainToken: {
      name: "Solana Meme Token",
      symbol: "MEME",
      address: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac"
    }
  },
  {
    rank: 2,
    mainToken: {
      name: "PumpFun Token",
      symbol: "PUMP",
      address: "4QV4iiZGNEkqGHcGmXvEzKRwLsXkZwHNnNS8DNNCgVdX"
    }
  },
  {
    rank: 3,
    mainToken: {
      name: "Bonk",
      symbol: "BONK",
      address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
    }
  }
];

// Component for trending tokens display
// Create a wrapped version of TrendingTokens with ErrorBoundary
const TrendingTokensWithErrorBoundary = ({ network = "Solana" }) => {
  return (
    <ErrorBoundary fallbackText="Unable to load trending tokens" resetOnError={true}>
      <TrendingTokensContent network={network} />
    </ErrorBoundary>
  );
};

// Token metadata cache - persists between renders
const tokenMetadataCache = {
  logos: {}, // address -> logo URL
  symbols: {}, // address -> symbol
  lastFetch: {}, // address -> timestamp of last fetch
  // Rate limit: only fetch once every 10 minutes for each token
  RATE_LIMIT_MS: 10 * 60 * 1000
};

// Main component content separated for error boundary
const TrendingTokensContent = ({ network = "Solana" }) => {
  const [tokens, setTokens] = useState([]);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [animation, setAnimation] = useState(false);
  const [dataSource, setDataSource] = useState(DATA_SOURCES.DEXTOOLS); // Default to Dextools
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logos, setLogos] = useState({}); // Track logos for each token

  // Default values for Solana network
  const currentNetwork = typeof network.name === 'string' ? network.name : "Solana";

  // Fetch trending tokens from the selected data source
  const fetchTrendingTokens = async (source = null) => {
    try {
      setLoading(true);
      // Clear any previous tokens to prevent UI from showing outdated data
      setTokens([]); 
      setLogos({});
      
      // Use provided source if given, otherwise use state
      const activeSource = source || dataSource;
      console.log(`🔎 Actually fetching tokens for source: ${activeSource}`);
      
      let trendingTokens = [];

      switch(activeSource) {
        case DATA_SOURCES.DEXTOOLS:
          trendingTokens = await fetchDextoolsTrendingTokens();
          break;
        case DATA_SOURCES.COINGECKO:
          trendingTokens = await fetchCoinGeckoTrendingTokens();
          break;
        case DATA_SOURCES.DEXSCREENER:
          trendingTokens = await fetchDexscreenerBoostedTokens();
          break;
        default:
          trendingTokens = [];
      }

      if (trendingTokens && trendingTokens.length > 0) {
        setTokens(trendingTokens);
      } else {
        // Fallback to placeholder tokens in case of empty results
        envWarn(`No trending tokens found for ${dataSource}. Using fallback data.`);
        setTokens(placeholderTokensSolana);
      }
    } catch (error) {
      envError(`Error fetching tokens for network ${currentNetwork} from ${dataSource}:`, error);
      // Fallback to placeholder tokens in case of an error
      setTokens(placeholderTokensSolana);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trending tokens from Dextools
  const fetchDextoolsTrendingTokens = async () => {
    try {
      // Get the API key from environment variables
      const apiKey = import.meta.env.VITE_DEXTOOLS_API_KEY || process.env.REACT_APP_DEXTOOLS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Dextools API key not found in environment variables');
      }
      
      const baseUrl = 'https://public-api.dextools.io/trial/v2';
      const endpoint = '/ranking/solana/hotpools';
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Dextools API call failed with status: ${response.status}`);
      }

      const responseData = await response.json();
      const { data } = responseData;
      
      // Debug log the raw DexTools API response to check for logo fields
      console.log('DexTools API response:', responseData);
      console.log('First token from DexTools:', data && data[0] ? data[0] : 'No tokens found');
      console.log('First token mainToken:', data && data[0] && data[0].mainToken ? data[0].mainToken : 'No mainToken found');

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format: expected an array of tokens.');
      }

      return data
        .filter((token) => {
          return (
            token.mainToken &&
            typeof token.mainToken.address === 'string' &&
            token.rank !== 0
          );
        })
        .slice(0, 10)
        .map((token) => {
          // Simplified mapping - we'll fetch logos separately
          return {
            rank: token.rank,
            mainToken: {
              name: token.mainToken.name || 'Unknown Token',
              symbol: token.mainToken.symbol || 'TOKEN',
              address: token.mainToken.address
            },
            contractAddress: token.mainToken.address,
            source: 'dextools'
            // No logo URL here - will be fetched separately
          };
        });
    } catch (error) {
      envError('Error fetching Dextools trending tokens:', error);
      return [];
    }
  };

  // Fetch trending tokens from CoinGecko
  const fetchCoinGeckoTrendingTokens = async () => {
    try {
      const apiUrl = 'https://api.coingecko.com/api/v3/search/trending';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          // Add API key if you have a CoinGecko Pro account
          // 'x-cg-pro-api-key': import.meta.env.VITE_COINGECKO_API_KEY || process.env.REACT_APP_COINGECKO_API_KEY,
        }
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API call failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.coins || !Array.isArray(data.coins)) {
        throw new Error('Invalid data format from CoinGecko API');
      }
      
      // Transform CoinGecko data to our format
      return data.coins
        .map((item, index) => {
          const token = item.item;
          return {
            rank: index + 1,
            mainToken: {
              name: token.name,
              symbol: token.symbol,
              address: token.id // CoinGecko uses 'id' instead of address
            },
            contractAddress: token.id,
            source: 'coingecko',
            // Save the image URL directly for easy access
            imageUrl: token.large || token.thumb
          };
        })
        .slice(0, 10); // Limit to 10 tokens
    } catch (error) {
      envError('Error fetching CoinGecko trending tokens:', error);
      return [];
    }
  };

  // Fetch boosted tokens from Dexscreener
  const fetchDexscreenerBoostedTokens = async () => {
    try {
      // Get the API key from environment variables
      const apiKey = import.meta.env.VITE_DEXSCREENER_API_KEY || process.env.REACT_APP_DEXSCREENER_API_KEY;
      
      if (!apiKey) {
        throw new Error('Dexscreener API key not found in environment variables');
      }
      
      const apiUrl = 'https://api.dexscreener.com/token-boosts/top/v1';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Dexscreener API call failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // New API returns a different format than before
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format from Dexscreener API');
      }
      
      return data
        .filter(token => token.tokenAddress) // Ensure token address exists
        .map((token, index) => ({
          rank: index + 1,
          mainToken: {
            // Preserve original token name if present in the token response
            name: token.description || 'Unknown Token',
            // For DexScreener, we need to extract the token symbol from context
            // Try first from token name, then from URL parts
            symbol: (() => {
              // Try to extract symbol from description with various patterns
              if (token.description) {
                // First look for $CASHTAG format
                const cashtagMatch = token.description.match(/\$(\w+)/i);
                if (cashtagMatch && cashtagMatch[1]) {
                  console.log(`Found $CASHTAG symbol ${cashtagMatch[1].toUpperCase()} in description`);
                  return cashtagMatch[1].toUpperCase();
                }
                
                // Next try to extract symbol from description like "Token Name (SYMBOL)"
                const parenthesesMatch = token.description.match(/\(([^)]+)\)/);
                if (parenthesesMatch && parenthesesMatch[1]) {
                  console.log(`Found (SYMBOL) format: ${parenthesesMatch[1].toUpperCase()} in description`);
                  return parenthesesMatch[1].toUpperCase();
                }
                
                // If description is short (likely just the symbol)
                if (token.description.length <= 10) {
                  console.log(`Using short description as symbol: ${token.description.toUpperCase()}`);
                  return token.description.toUpperCase();
                }
              }
              
              // If URL contains a path with the token symbol
              if (token.url) {
                const urlParts = token.url.split('/');
                const potentialSymbol = urlParts[urlParts.length - 1];
                if (potentialSymbol && potentialSymbol.length <= 10) return potentialSymbol.toUpperCase();
              }
              
              // If nothing works, use first characters of address
              return token.tokenAddress.substring(0, 4).toUpperCase();
            })(),
            address: token.tokenAddress
          },
          contractAddress: token.tokenAddress,
          source: 'dexscreener',
          description: token.description || 'Boosted Token',
          // Save the logo URL for easy access
          imageUrl: token.icon
        }))
        .slice(0, 10); // Limit to 10 tokens
    } catch (error) {
      envError('Error fetching Dexscreener boosted tokens:', error);
      return [];
    }
  };

  // Handle source change from dropdown
  const handleSourceChange = (newSource) => {
    console.log('🔔 Changing trending source to:', newSource);
    // Update state first
    setDataSource(newSource);
    setDropdownOpen(false);
    // Clear tokens immediately to prevent UI showing outdated data
    setTokens([]);
    setLogos({});
    // Trigger immediate fetch with new source
    console.log('🕐 Initiating immediate data fetch for new source...');
    fetchTrendingTokens(newSource);
  };
  
  // Toggle dropdown menu
  const toggleDropdown = () => {
    console.log('Toggle dropdown:', !dropdownOpen);
    setDropdownOpen(!dropdownOpen);
  };

  // Animation effect
  useEffect(() => {
    // Skip animation if no tokens or only one token
    if (tokens.length <= 1) return;
    
    // Add animation class to create the sliding effect
    const animationInterval = setInterval(() => {
      setAnimation(true);
      setTimeout(() => {
        setSelectedItemIndex((prevIndex) => (prevIndex + 1) % tokens.length);
        setAnimation(false);
      }, 500); // Duration of the animation
    }, 5000); // Change token every 5 seconds

    return () => clearInterval(animationInterval);
  }, [tokens.length]);

  // Function to fetch token details from Dextools for a specific token
  const fetchDextoolsTokenDetails = async (tokenAddress) => {
    try {
      const apiKey = import.meta.env.VITE_DEXTOOLS_API_KEY || process.env.REACT_APP_DEXTOOLS_API_KEY;
      
      if (!apiKey) {
       // console.error('⚠️ Dextools API key not found in environment variables');
        throw new Error('Dextools API key not found in environment variables');
      }
      
      //console.log(`🔑 Using DexTools API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
      
      const baseUrl = 'https://public-api.dextools.io/trial/v2';
      const endpoint = `/token/solana/${tokenAddress}`;
      
      //console.log(`🔍 Fetching Dextools token details for: ${tokenAddress}`);
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      });
      
      if (!response.ok) {
        //console.error(`❌ Dextools token API call failed with status: ${response.status}`);
        throw new Error(`Dextools token API call failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      //console.log(`✅ Got Dextools token details for ${tokenAddress}:`, data);
      
      // Logo is nested under data.data.logo
      if (data?.data?.logo) {
        //console.log(`🖼️ LOGO FOUND in DexTools metadata: ${data.data.logo} for token ${tokenAddress}`);
        // Return an object with logo in the expected format
        return { logo: data.data.logo, ...data.data };
      } else {
        //console.log(`⚠️ NO LOGO found in DexTools metadata for token ${tokenAddress}`);
        return data;
      }
    } catch (error) {
      console.warn(`❌ Failed to fetch Dextools token details for ${tokenAddress}:`, error);
      return null;
    }
  };

  // Fetch trending tokens on component mount, data source change, or network change
  useEffect(() => {
    console.log(`Fetching trending tokens from ${dataSource} for ${currentNetwork}`);
    fetchTrendingTokens();
    
    // Set up periodic refresh every 60 seconds
    const interval = setInterval(() => {
      console.log(`Auto-refreshing trending tokens from ${dataSource}`);
      fetchTrendingTokens();
    }, 60000); // Refresh every 60 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [dataSource, currentNetwork]);

// Fetch logos for tokens
useEffect(() => {
  const fetchLogos = async () => {
    // Only proceed if we actually have tokens to process
    if (!tokens || tokens.length === 0) {
      console.log('No tokens available yet for logo enrichment. Waiting for tokens to load...');
      return;
    }

    try {
      // Log all tokens and their sources for debugging
      console.log('All tokens with sources:', tokens.map(t => ({
        symbol: t.mainToken?.symbol,
        address: t.mainToken?.address,
        source: t.source,
        hasLogo: t.mainToken?.address ? (!!logos[t.mainToken.address] || !!t.imageUrl) : false
      })));
      
      // Check cache first, then filter tokens needing logos
      const now = Date.now();
      const tokensNeedingLogos = tokens.filter(token => {
        // First, make sure we have a valid token address
        if (!token?.mainToken?.address) return false;
        
        const tokenAddress = token.mainToken.address;
        
        // Check if we have this logo in our persistent cache AND it's not too old
        const cachedLogo = tokenMetadataCache.logos[tokenAddress];
        const lastFetchTime = tokenMetadataCache.lastFetch[tokenAddress] || 0;
        const isWithinRateLimit = (now - lastFetchTime) < tokenMetadataCache.RATE_LIMIT_MS;
        
        // If we have a cached logo and we're within rate limit, use it
        if (cachedLogo && isWithinRateLimit) {
          console.log(`💾 USING CACHED LOGO for ${token.mainToken.symbol}: ${cachedLogo.substring(0, 30)}...`);
          // Update component state from cache
          setLogos(prev => ({ ...prev, [tokenAddress]: cachedLogo }));
          return false; // Don't fetch again
        }
        
        // For DexTools tokens, fetch from DexTools API unless we've recently fetched
        if (token.source === 'dextools') {
          if (isWithinRateLimit) {
            console.log(`⏱️ RATE LIMITED: Skipping fetch for DexTools token ${token.mainToken.symbol} (fetched ${Math.floor((now - lastFetchTime)/1000)}s ago)`);
            return false;
          }
          console.log(`🔑 Fetching logo for DexTools token ${token.mainToken.symbol} via DexTools API`);
          return true; // Include for logo fetching
        }

        // For non-DexTools tokens, check if we already have a logo in component state
        const hasLogoInState = !!logos[tokenAddress];
        if (hasLogoInState) {
          console.log(`Token ${token.mainToken.symbol} already has logo in component state`);
          return false;
        }

        // Check if the token already has a valid image URL from the API
        // Make sure imageUrl is actually a valid URL, not just an empty string or undefined
        const hasValidImageUrl = token.imageUrl && 
          typeof token.imageUrl === 'string' && 
          (token.imageUrl.startsWith('http') || token.imageUrl.startsWith('data:'));
        if (hasValidImageUrl) {
          console.log(`Token ${token.mainToken.symbol} has direct imageUrl: ${token.imageUrl}`);
          
          // Store in both component state and cache
          setLogos(prev => ({ ...prev, [tokenAddress]: token.imageUrl }));
          tokenMetadataCache.logos[tokenAddress] = token.imageUrl;
          tokenMetadataCache.lastFetch[tokenAddress] = now;
          return false;
        }
        
        // For debugging - log tokens that need logo enrichment
        console.log(`Token ${token.mainToken.symbol || 'unknown'} (${token.mainToken.address}) from ${token.source} needs logo enrichment`);

        // This token needs a logo
        return true;
      });
      
      console.log(`Fetching logos for ${tokensNeedingLogos.length} tokens`);
      
      const logoPromises = tokensNeedingLogos.map(async (token) => {
        //console.log(`🌐 Fetching logo for ${token.source} token: ${token.mainToken.symbol || 'unknown'} (${token.mainToken.address})`);
        
        // For Dextools tokens, ONLY use the dedicated DexTools API
        if (token.source === 'dextools') {
          try {
            //console.log(`🔎 Using DEXTOOLS API for token ${token.mainToken.symbol} (${token.mainToken.address})`);
            const tokenDetails = await fetchDextoolsTokenDetails(token.mainToken.address);
            
            // Log the full details received from DexTools
            //console.log(`📝 FULL DEXTOOLS RESPONSE for ${token.mainToken.symbol}:`, JSON.stringify(tokenDetails));
            
            if (tokenDetails?.logo) {
              //console.log(`💾 FOUND LOGO for ${token.mainToken.symbol} from Dextools API: ${tokenDetails.logo}`);
              setLogos(prev => ({ ...prev, [token.mainToken.address]: tokenDetails.logo }));
              return { address: token.mainToken.address, logo: tokenDetails.logo };
            } else {
              //console.warn(`⚠️ NO LOGO found in DexTools API for ${token.mainToken.symbol}`);
              // No fallback for DexTools - use placeholder directly if no logo found
              //console.log(`🖼 Using placeholder image for ${token.mainToken.symbol} from DexTools (no logo found)`);
              setLogos(prev => ({ ...prev, [token.mainToken.address]: placeholderImage }));
              return { address: token.mainToken.address, logo: placeholderImage };
            }
          } catch (error) {
            console.warn(`❌ DexTools token details API failed for ${token.mainToken.symbol}:`, error);
            //console.log(`🖼 Using placeholder image for ${token.mainToken.symbol} after DexTools API error`);
            setLogos(prev => ({ ...prev, [token.mainToken.address]: placeholderImage }));
            return { address: token.mainToken.address, logo: placeholderImage };
          }
        }
        
        // For non-DexTools tokens, try Alchemy first
        try {
          //console.log(`🔎 Using ALCHEMY API for ${token.source} token: ${token.mainToken.symbol || 'unknown'} (${token.mainToken.address})`);
          const metadata = await fetchSolanaTokenMetadata(token.mainToken.address);
          
          if (metadata?.logo) {
            //console.log(`💾 FOUND LOGO for ${token.mainToken.symbol} from Alchemy: ${metadata.logo}`);
            setLogos(prev => ({ ...prev, [token.mainToken.address]: metadata.logo }));
            return { address: token.mainToken.address, logo: metadata.logo };
          }
        } catch (error) {
          console.error(`❌ Error fetching Alchemy metadata for ${token.mainToken.symbol}:`, error);
        }
        
        // If Alchemy fails or doesn't have a logo, try CoinGecko
        try {
          //console.log(`🔎 Using COINGECKO for ${token.mainToken.symbol || 'unknown'} (${token.mainToken.address})`);
          const cgData = await fetchCoinGeckoTokenData(token.mainToken.address);
          
          // Log the full CoinGecko response
          //console.log(`📝 FULL COINGECKO RESPONSE for ${token.mainToken.symbol}:`, JSON.stringify(cgData));
          
          if (cgData?.image) {
            //console.log(`💾 FOUND LOGO for ${token.mainToken.symbol} from CoinGecko: ${cgData.image}`);
            setLogos(prev => ({ ...prev, [token.mainToken.address]: cgData.image }));
            return { address: token.mainToken.address, logo: cgData.image };
          } else {
            //console.warn(`⚠️ NO LOGO found in CoinGecko API for ${token.mainToken.symbol}`);
          }
        } catch (error) {
          console.warn(`❌ CoinGecko failed for ${token.mainToken.symbol}:`, error);
        }
        
        // If all else fails, use a placeholder
        //console.log(`🖼 Using placeholder for ${token.mainToken.symbol} - no logo found from any source`);
        setLogos(prev => ({ ...prev, [token.mainToken.address]: placeholderImage }));
        return { address: token.mainToken.address, logo: placeholderImage };
      });
      
      //console.log(`📢 Waiting for all ${logoPromises.length} logo fetches to complete...`);
      const results = await Promise.all(logoPromises);
      console.log(`✅ Completed fetching logos:`, results.length);
      
      // Final summary of logos found
      const logosFound = Object.keys(logos).length;
      //console.log(`📊 FINAL LOGO COUNT: ${logosFound}/${tokens.length} tokens have logos`);
    } catch (error) {
      envError('Error fetching logos:', error);
    }
  };
  
  fetchLogos();
}, [tokens, currentNetwork]); // Only re-run when tokens or network change
  // Generate Dextools URL for Solana tokens
  const DATA_SOURCE_NAMES = {
    [DATA_SOURCES.DEXTOOLS]: 'Dextools',
    [DATA_SOURCES.COINGECKO]: 'CoinGecko',
    [DATA_SOURCES.DEXSCREENER]: 'Dexscreener Boosted'
  };

  const formatAddress = (address) => {
    if (!address || address.length < 10) return address || "Unknown";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Reset animation when tokens change
  useEffect(() => {
    setSelectedItemIndex(0);
    setAnimation(false);
  }, [tokens]);

  if (!tokens || tokens.length === 0) {
    return (
      <div className="trending-strip">
        <div className="token-card">
          <div className="token-info">
            <div className="token-icon-wrapper">
              <FaFire className="trending-icon" />
            </div>
            <div className="token-name">
              Loading trending tokens...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const token = tokens[selectedItemIndex] || {};

  return (
    <div className="trending-strip" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* Source selector dropdown */}
      <div className="source-selector">
        <div className="dropdown-header" onClick={toggleDropdown}>
          <FaExchangeAlt className="source-icon" />
          <span>{DATA_SOURCE_NAMES[dataSource]}</span>
          {dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        
        {dropdownOpen && (
          <div className="dropdown-menu">
            {Object.entries(DATA_SOURCE_NAMES).map(([key, name]) => (
              <div 
                key={key}
                className={`dropdown-item ${dataSource === key ? 'active' : ''}`}
                onClick={() => handleSourceChange(key)}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Token card */}
      <div className="inner-trending-strip">
        {/* First set of tokens */}
        {tokens.map((token, index) => {
          const { mainToken } = token;

          // Check for token address (ensure it's not burn address)
          const mainAddress =
            mainToken.address !== SOLANA_BURN_ADDRESS
              ? mainToken.address
              : "";

          // Get the logo from token data (if provided by API) or from state or fallback to placeholder
          const logo = token.imageUrl || logos[mainToken.address] || placeholderImage;

          // Generate the URL for Dextools
          const dexToolsUrl = generateDexToolsUrl("Solana", mainToken.address);

          return (
            <a
              key={`${mainToken.symbol}-${index}`}
              className="token-card"
              href={dexToolsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={logo}
                alt={mainToken.symbol}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = placeholderImage; // Fallback on error
                }}
              />
              <span>
                #{token.rank} {mainToken.symbol}
              </span>
            </a>
          );
        })}
        
        {/* Duplicate set of tokens for seamless looping */}
        {tokens.map((token, index) => {
          const { mainToken } = token;

          // Check for token address (ensure it's not burn address)
          const mainAddress =
            mainToken.address !== SOLANA_BURN_ADDRESS
              ? mainToken.address
              : "";

          // Get the logo from token data (if provided by API) or from state or fallback to placeholder
          const logo = token.imageUrl || logos[mainToken.address] || placeholderImage;

          // Generate the URL for Dextools
          const dexToolsUrl = generateDexToolsUrl("Solana", mainToken.address);

          return (
            <a
              key={`${mainToken.symbol}-dup-${index}`}
              className="token-card"
              href={dexToolsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={logo}
                alt={mainToken.symbol}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = placeholderImage; // Fallback on error
                }}
              />
              <span>
                #{token.rank} {mainToken.symbol}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
};

// Export the wrapped component with error boundary
export default TrendingTokensWithErrorBoundary;
