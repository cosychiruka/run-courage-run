import axios from 'axios';
import PQueue from 'p-queue';
import pRetry from 'p-retry';

const DEXTOOLS_API_KEY = 'QA2MWclN829VYyqBuCNmg5ei4vqnxtyAaHaOOzch';
const BASE_URL = 'https://public-api.dextools.io/trial/v2';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 50000,
  headers: {
    'accept': 'application/json',
    'x-api-key': DEXTOOLS_API_KEY
  }
});

// Create queue for rate limiting
const queue = new PQueue({
  concurrency: 1,
  interval: 2000,
  intervalCap: 1
});

// Helper function to make API calls with retries and rate limiting
async function makeRequest(endpoint, params = {}) {
  return queue.add(() => 
    pRetry(
      async () => {
        const response = await axiosInstance.get(endpoint, { params });
        return response.data;
      },
      {
        retries: 3,
        onFailedAttempt: error => {
          console.log(`Request to ${endpoint} failed, retrying...`, error.message);
        }
      }
    )
  );
}

export async function fetchTrendingTokens(network) {
  const networkSegment = getNetworkSegment(network);
  if (!networkSegment) {
    throw new Error(`Unsupported network: ${network}`);
  }

  try {
    const data = await makeRequest(`/ranking/${networkSegment}/hotpools`);
    
    if (!data?.data) {
      throw new Error('Invalid response from DexTools API');
    }

    return data.data
      .filter(token => token.mainToken && token.mainToken.address)
      .slice(0, 10)
      .map(formatTrendingToken(networkSegment));
  } catch (error) {
    console.error(`Error fetching trending tokens for ${network}:`, error);
    throw error;
  }
}

export async function formatTokenAnalysis(network, tokenAddress) {
  const networkSegment = getNetworkSegment(network);
  
  try {
    // Get pools first
    const poolsData = await makeRequest(`/token/${networkSegment}/${tokenAddress}/pools`, {
      sort: 'creationTime',
      order: 'asc',
      from: '2022-10-01T00:00:00.000Z',
      to: new Date().toISOString()
    });

    console.log(poolsData)
    if (!poolsData?.data?.length) {
      return 'No liquidity pools found for this token.';
    }

    const poolAddress = poolsData.data[0].address;

    // Fetch all data sequentially
    const [score, audit, price, liquidity] = await Promise.all([
      makeRequest(`/token/${networkSegment}/${tokenAddress}/score`),
      makeRequest(`/token/${networkSegment}/${tokenAddress}/audit`),
      makeRequest(`/pool/${networkSegment}/${poolAddress}/price`),
      makeRequest(`/pool/${networkSegment}/${poolAddress}/liquidity`)
    ]);

    return formatAnalysisMessage(
      score,
      audit,
      price,
      liquidity,
      tokenAddress,
      networkSegment
    );
  } catch (error) {
    console.error('Error analyzing token:', error);
    throw new Error('Failed to analyze token. Please try again.');
  }
}

function formatTrendingToken(networkSegment) {
  return token => ({
    rank: token.rank,
    address: token.mainToken.address,
    symbol: token.mainToken.symbol || 'Unknown',
    name: token.mainToken.name || 'Unknown',
    dextoolsUrl: `https://www.dextools.io/app/en/${networkSegment}/pair-explorer/${token.mainToken.address}`
  });
}

function formatAnalysisMessage(score, audit, price, liquidity, address, network) {
  const message = `
*Token Analysis* 🔍

*Contract Address:*
\`${address}\`

*Security Score:*
• Total Score: ${score?.dextScore?.total || 0}/100
• Information: ${score?.dextScore?.information || 0}/100
• Pool: ${score?.dextScore?.pool || 0}/100
• Holders: ${score?.dextScore?.holders || 0}/100

*Security Audit:*
• Open Source: ${formatAuditValue(audit?.isOpenSource)}
• Honeypot Risk: ${formatAuditValue(audit?.isHoneypot)}
• Mintable: ${formatAuditValue(audit?.isMintable)}
• Buy Tax: ${formatTaxValue(audit?.buyTax)}
• Sell Tax: ${formatTaxValue(audit?.sellTax)}
• Contract Renounced: ${formatAuditValue(audit?.isContractRenounced)}

*Price Info (24h):*
• Current: $${formatNumber(price?.price)}
• Change: ${formatNumber(price?.variation24h)}%
• Volume: $${formatNumber(price?.volume24h)}
• Buys/Sells: ${price?.buys24h || 0}/${price?.sells24h || 0}

*Liquidity Info:*
• Total Value: $${formatNumber(liquidity?.liquidity)}
• Token Reserve: ${formatNumber(liquidity?.reserves?.mainToken)}
• Pair Reserve: ${formatNumber(liquidity?.reserves?.sideToken)}

*View on DexTools:*
[Open in DexTools](https://www.dextools.io/app/en/${network}/pair-explorer/${address})

_Last Updated: ${new Date().toLocaleString()}_
`.trim();

  return message;
}

function formatAuditValue(value) {
  if (!value) return '❓';
  return value.toLowerCase() === 'true' ? '✅' : '❌';
}

function formatTaxValue(tax) {
  if (!tax) return 'N/A';
  return `${tax.min || 0}-${tax.max || 0}%`;
}

function formatNumber(num) {
  if (!num) return '0.00';
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getNetworkSegment(network) {
  const networkMap = {
    ethereum: 'ether',
    base: 'base',
    solana: 'solana'
  };
  return networkMap[network.toLowerCase()];
}