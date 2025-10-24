import axios from 'axios';
import { API_CONFIG, COINGECKO_API_KEY, envLog, envError } from '../../config/env';

/**
 * Service for interacting with CoinGecko API
 */
class CoinGeckoService {
  constructor() {
    const { baseUrl, timeout } = API_CONFIG.coingecko;
    
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
      headers: {
        'accept': 'application/json',
        'x-cg-demo-api-key': COINGECKO_API_KEY
      }
    });
    
    this.marketDataCache = {
      data: null,
      timestamp: 0,
      ttl: 5 * 60 * 1000 // 5 minutes cache
    };

    this.categoryCache = {
      data: null,
      timestamp: 0,
      ttl: 10 * 60 * 1000 // 10 minutes cache for market categories
    };
  }

  /**
   * Fetch trending tokens from CoinGecko
   */
  async getTrendingTokens() {
    try {
      // Fetch trending tokens
      const { data } = await this.axiosInstance.get('/search/trending');
  
      // Fetch details for each token
      const trendingTokens = await Promise.all(
        data.coins.map(async (token) => {
          const { item } = token;
  
          try {
            // Fetch detailed token info
            const { data: tokenDetails } = await this.axiosInstance.get(`/coins/${item.id}`, {
              params: {
                localization: false,
                tickers: false,
                market_data: true,
                community_data: false,
                developer_data: false,
                sparkline: false,
              },
            });
  
            return {
              id: item.id,
              name: item.name,
              symbol: item.symbol.toUpperCase(),
              priceUsd: tokenDetails.market_data?.current_price?.usd || 0,
              volumeUsd: tokenDetails.market_data?.total_volume?.usd || 0,
              score: item.score,
              image: item.large || item.thumb,
              contractAddress: item.platforms?.solana || '',  // For Solana compatibility
              detailsUrl: `https://www.coingecko.com/en/coins/${item.id}`,
              rank: token.item.score,  // Use score for ranking
              // Format for compatibility with other services
              mainToken: {
                address: item.platforms?.solana || '',
                name: item.name,
                symbol: item.symbol.toUpperCase(),
              }
            };
          } catch (detailError) {
            // If details fetch fails, return basic info
            return {
              id: item.id,
              name: item.name,
              symbol: item.symbol.toUpperCase(),
              priceUsd: 0,
              volumeUsd: 0,
              score: item.score,
              image: item.thumb,
              contractAddress: item.platforms?.solana || '',  // For Solana compatibility
              detailsUrl: `https://www.coingecko.com/en/coins/${item.id}`,
              rank: token.item.score,  // Use score for ranking
              // Format for compatibility with other services
              mainToken: {
                address: item.platforms?.solana || '',
                name: item.name,
                symbol: item.symbol.toUpperCase(),
              }
            };
          }
        })
      );
  
      // Sort by score/rank and limit to 15
      return trendingTokens
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);
    } catch (error) {
      envError('Error fetching trending tokens from CoinGecko:', error.message);
      return [];
    }
  }
}

// Export as singleton
const coinGeckoService = new CoinGeckoService();
export default coinGeckoService;
