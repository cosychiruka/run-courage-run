import axios from 'axios';
import { API_CONFIG, DEXSCREENER_API_KEY, envLog, envError } from '../../config/env';

// Cache implementation
const cache = {
  data: new Map(),
  get: function(key) {
    const item = this.data.get(key);
    if (!item) return null;
    
    // Check if the cached item has expired
    if (Date.now() > item.expiry) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  },
  set: function(key, value, ttl = 600000) { // Default 10 min TTL
    const expiry = Date.now() + ttl;
    this.data.set(key, { value, expiry });
  }
};

/**
 * Service for interacting with DexScreener API
 */
class DexScreenerService {
  constructor() {
    const { baseUrl, timeout, proxyRequired, proxyUrl } = API_CONFIG.dexscreener;
    
    // Use the proxy URL in production, direct URL in development
    this.baseURL = proxyRequired ? baseUrl : (proxyUrl || baseUrl);
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => this.handleApiError(error)
    );
    
    // Rate limiting
    this.rateLimit = {
      windowMs: 900000, // 15 minutes
      maxRequests: 100,  // Maximum requests per 15 minutes
      requestCount: 0,
      windowStart: Date.now()
    };
  }

  /**
   * Check if we're rate limited and reset the counter if window expired
   */
  isRateLimited(endpoint) {
    // Reset counter if window expired
    if (Date.now() - this.rateLimit.windowStart > this.rateLimit.windowMs) {
      this.rateLimit.requestCount = 0;
      this.rateLimit.windowStart = Date.now();
      return false;
    }
    
    // Check if we've exceeded the limit
    if (this.rateLimit.requestCount >= this.rateLimit.maxRequests) {
      envError(`Rate limit exceeded for DexScreener API endpoint: ${endpoint}`);
      return true;
    }
    
    // Increment the counter
    this.rateLimit.requestCount++;
    return false;
  }

  /**
   * Fetch with cache support
   */
  async fetchWithCache(endpoint, params = {}, cacheKey) {
    // Check rate limits first
    if (this.isRateLimited(endpoint)) {
      throw new Error('Rate limit exceeded for DexScreener API');
    }

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      envLog('📦 Using cached DexScreener data for:', cacheKey);
      return cached;
    }

    try {
      envLog(`🔄 Fetching from DexScreener API: ${endpoint}`);
      const response = await this.api.get(endpoint, { params });
      const data = response.data;

      // Cache valid responses
      cache.set(cacheKey, data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle API errors with detailed logging
   */
  async handleApiError(error) {
    const errorData = {
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
      endpoint: error.config?.url
    };

    // Log error
    envError('DexScreener API error:', errorData);

    // Handle specific error cases
    switch (errorData.status) {
      case 429:
        throw new Error('DexScreener rate limit exceeded');
      case 404:
        throw new Error('Pair or token not found');
      default:
        throw new Error(`DexScreener API error: ${errorData.message}`);
    }
  }

  /**
   * Format pair data into a standardized structure
   */
  formatPairData(pair) {
    if (!pair) return null;
  
    // Extract socials (Twitter and Telegram only)
    const socials = (pair.info?.socials || []).reduce((acc, social) => {
      if (social.type === "twitter") acc.twitter = social.url;
      if (social.type === "telegram") acc.telegram = social.url;
      return acc;
    }, {});
  
    // Extract website
    const website = (pair.info?.websites || []).find(site => site.label === "Website")?.url;
  
    // Format creation date
    const createdAt = pair.pairCreatedAt
      ? new Date(pair.pairCreatedAt).toLocaleString()
      : "Unknown";
  
    // Safely extract buys and sells for the last 24 hours
    const buys24h = pair.txns?.h24?.buys || 0;
    const sells24h = pair.txns?.h24?.sells || 0;
  
    // Safely access liquidity metrics
    const liquidityUsd = pair.liquidity?.usd || 0;
    const liquidityBase = pair.liquidity?.base || 0;
    const liquidityQuote = pair.liquidity?.quote || 0;
  
    // Safely access price metrics
    const priceUsd = pair.priceUsd || "N/A";
    const priceChange = pair.priceChange || {};
  
    // Safely access market metrics
    const marketCap = pair.marketCap || "N/A";
    const fdv = pair.fdv || "N/A";
  
    // Extract images
    const imageUrl = pair.info?.imageUrl || null;
    const headerImage = pair.info?.header || null;
  
    return {
      chainId: pair.chainId,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      baseToken: {
        address: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
      },
      price: {
        usd: priceUsd,
        change: priceChange,
      },
      marketMetrics: {
        marketCap: marketCap,
        fdv: fdv,
      },
      liquidity: {
        usd: liquidityUsd,
        base: liquidityBase,
        quote: liquidityQuote,
      },
      volume: {
        h24: pair.volume?.h24 || 0,
      },
      transactions: {
        buys24h: buys24h,
        sells24h: sells24h,
      },
      socials: {
        twitter: socials.twitter || null,
        telegram: socials.telegram || null,
      },
      website: website || null,
      images: {
        thumbnail: imageUrl,
        header: headerImage,
      },
      pairUrl: pair.url,
      pairCreatedAt: createdAt,
    };
  }

  /**
   * Format boosted data into a consistent structure
   */
  formatBoostedData(pair) {
    const { 
      url, 
      tokenAddress, 
      description = "No description available.", 
      links = [], 
      totalAmount, 
      amount 
    } = pair;
  
    // Extract key links
    const website = links.find((link) => link.type === "website")?.url || null;
    const twitter = links.find((link) => link.type === "twitter")?.url || null;
    const telegram = links.find((link) => link.type === "telegram")?.url || null;
  
    // Truncate description to 32 characters
    const truncatedDescription = description.length > 32 
      ? description.slice(0, 32).trim() + "..." 
      : description;
  
    // Extract symbol using regex or fallback to "SYMBOL"
    const symbol = this.extractSymbol(description);
  
    // Return formatted pair data without unnecessary fields
    return {
      url,
      tokenAddress,
      description: truncatedDescription,
      symbol,
      links: {
        website,
        twitter,
        telegram,
      },
      totalAmount: totalAmount || 0,
      amount: amount || 0,
    };
  }
  
  /**
   * Helper to extract symbol from description
   */
  extractSymbol(description) {
    const cashtagMatch = description.match(/\$[A-Za-z0-9]+/); // Look for $CASHTAG
    if (cashtagMatch) return cashtagMatch[0].slice(1); // Remove the "$"
  
    const hashtagMatch = description.match(/#[A-Za-z0-9]+/); // Look for #HASHTAG
    if (hashtagMatch) return hashtagMatch[0].slice(1); // Remove the "#"
  
    const capsMatch = description.match(/\b[A-Z]{2,}\b/); // Look for ALL CAPS words
    if (capsMatch) return capsMatch[0]; // Return the first all-caps word
  
    return "SYMBOL"; // Fallback if no matches found
  }

  /**
   * Get token pairs by address(es)
   */
  async getPairsByToken(tokenAddresses) {
    if (!Array.isArray(tokenAddresses)) {
      tokenAddresses = [tokenAddresses];
    }
  
    const rawResponse = await this.fetchWithCache(
      `/dex/tokens/${tokenAddresses.join(',')}`,
      {},
      `dexscreener:tokens:${tokenAddresses.join('-')}`
    );
  
    // Format each pair in the response
    const formattedPairs = rawResponse.pairs?.map(pair => this.formatPairData(pair)) || [];
  
    // If no pairs, return empty array
    if (!formattedPairs.length) return [];
    
    return formattedPairs;
  }
  
  /**
   * Get boosted pairs/tokens (featured tokens)
   */
  async getBoostedPairs() {
    try {
        // Fetch the latest boosted pairs data with caching
        const rawResponse = await this.fetchWithCache(
            '/token-boosts/latest/v1',
            {},
            'dexscreener:boosted'
        );

        // Ensure rawResponse is an array
        if (!Array.isArray(rawResponse)) {
            envWarn("Boosted token data is not an array.");
            return [];
        }

        // Format each boosted pair using the formatBoostedData function
        const formattedPairs = rawResponse.map((item) => {
            try {
                const formatted = this.formatBoostedData(item);
                return formatted;
            } catch (error) {
                envError("Error formatting pair:", item, error);
                return null; // Skip this pair if formatting fails
            }
        }).filter(Boolean); // Remove any null entries
        
        // Check if there are any valid formatted pairs
        if (formattedPairs.length === 0) {
            envWarn("No valid formatted pairs found after processing.");
            return [];
        }

        // Deduplicate based on tokenAddress
        const uniquePairsMap = new Map();
        formattedPairs.forEach(pair => {
            if (!uniquePairsMap.has(pair.tokenAddress)) {
                uniquePairsMap.set(pair.tokenAddress, pair);
            }
        });
        const uniquePairs = Array.from(uniquePairsMap.values());

        if (uniquePairs.length === 0) {
            envWarn("No unique formatted pairs found after deduplication.");
            return [];
        }

        // Return all unique formatted pairs
        return uniquePairs;
    } catch (error) {
        envError("Error in getBoostedPairs:", error);
        return [];
    }
  }
  
  /**
   * Get token info by symbol
   */
  async getTokenInfoBySymbol(query) {
    try {
      const rawResponse = await this.fetchWithCache(
        `/latest/dex/search?q=${query}`,
        {},
        `dexscreener:tokenInfo:${query}`
      );
    
      // Format each pair in the response
      const formattedPairs = rawResponse.pairs?.map(pair => this.formatPairData(pair)) || [];
    
      // If no pairs, return empty array
      if (!formattedPairs.length) return [];
    
      // Select the "main" LP based on the highest liquidity or other metric
      const mainPair = formattedPairs.reduce((best, current) => {
        return current.liquidity.usd > (best?.liquidity.usd || 0) ? current : best;
      }, null);
    
      return mainPair ? [mainPair] : [];
    } catch (error) {
      envError("Error in getTokenInfoBySymbol:", error);
      return {baseToken:{symbol:"NONE"}};
    }
  }
  
  /**
   * Get token info by address
   */
  async getTokenInfoByAddress(query) {
    try {
      const rawResponse = await this.fetchWithCache(
        `/latest/dex/search?q=${query}`,
        {},
        `dexscreener:tokenInfo:${query}`
      );
    
      // Format each pair in the response
      const formattedPairs = rawResponse.pairs?.map(pair => this.formatPairData(pair)) || [];      
    
      // If no pairs, return empty array
      if (!formattedPairs.length) return [];
    
      // Select the "main" LP based on the highest liquidity
      const mainPair = formattedPairs.reduce((best, current) => {
        return current.liquidity.usd > (best?.liquidity.usd || 0) ? current : best;
      }, null);
    
      return mainPair ? [mainPair] : [];
    } catch (error) {
      envError("Error in getTokenInfoByAddress:", error);
      return {baseToken:{symbol:"NONE"}};
    }
  }

  /**
   * Get full token info by address
   */
  async getTokenInfoByAddressBig(query) {
    try {
      const rawResponse = await this.fetchWithCache(
        `/latest/dex/search?q=${query}`,
        {},
        `dexscreener:tokenInfo:${query}`
      );
    
      return rawResponse || {};
    } catch (error) {
      envError("Error in getTokenInfoByAddressBig:", error);
      return {baseToken:{symbol:"NONE"}};
    }
  }

  /**
   * Get token price by address
   */
  async getTokenPriceByAddress(query) {
    try {
      const rawResponse = await this.fetchWithCache(
        `/latest/dex/search?q=${query}`,
        {},
        `dexscreener:tokenInfo:${query}`
      );
      
      if (rawResponse?.pairs?.length > 0) {
        const tokenData = rawResponse.pairs[0];
        const priceUsd = parseFloat(tokenData.priceUsd);
        if (!isNaN(priceUsd) && priceUsd > 0) {
          envLog(`✅ Found price on DexScreener for ${query}: $${priceUsd}`);
          return priceUsd;
        }
      }
      return 0;
    } catch (error) {
      envError('Error fetching token price:', error);
      return 0;
    }
  }
}

// Export as a singleton
const dexscreenerService = new DexScreenerService();
export default dexscreenerService;
