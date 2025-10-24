import axios from "axios";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import ShitcoinLogo from '@images/erc20-shitcoin.webp';

// Hardcoded API keys with .env fallback as a last resort
// These will be replaced by environment variables when available
const HARDCODED_ALCHEMY_KEY = "ip7ONCr6sDycSojM_PZoWawrVM_2c0RW";
const HARDCODED_SOLANA_KEY = "ip7ONCr6sDycSojM_PZoWawrVM_2c0RW";

// Get Alchemy API key using multiple fallback methods
const getAlchemyApiKey = () => {
  
  const key = import.meta?.env?.VITE_ALCHEMY_API_KEY || 
              process.env?.REACT_APP_ALCHEMY_API_KEY || 
              process.env?.VITE_ALCHEMY_API_KEY || 
              HARDCODED_ALCHEMY_KEY || 
              "";
              
  console.log('Using Alchemy key:', key ? key.substring(0, 5) + '...' : 'None');
  return key;
};

// Get Solana API key using multiple fallback methods
const getSolanaApiKey = () => {
  console.log('VITE ENV SOLANA KEY:', import.meta?.env?.VITE_SOLANA_API_KEY ? 'Found' : 'Not found');
  
  const key = import.meta?.env?.VITE_SOLANA_API_KEY || 
              process.env?.VITE_SOLANA_API_KEY || 
              HARDCODED_SOLANA_KEY || 
              "";
              
  console.log('Using Solana key:', key ? key.substring(0, 5) + '...' : 'None');
  return key;
};

// Export for legacy compatibility
export const ALCHEMY_API_KEY = getAlchemyApiKey();
export const SOLANA_API_KEY = getSolanaApiKey();

// Rate limiting to prevent 429 errors
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms between requests

const rateLimitedDelay = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delayTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${delayTime}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, delayTime));
  }
  
  lastRequestTime = Date.now();
};

// Create Alchemy instance for RPC operations
export const createAlchemyInstance = (network) => {
  const apiKey = network?.name === 'solana' ? getSolanaApiKey() : getAlchemyApiKey();
  
  return {
    core: {
      // Wrapper for Solana RPC calls
      call: async (method, params) => {
        return await callSolanaRPC(method, params, apiKey);
      },
      // Get program accounts
      getProgramAccounts: async (programId, encoding = "base64") => {
        return await getProgramAccountsHelper(programId, apiKey, encoding);
      },
      // Get account info
      getAccountInfo: async (accountId, encoding = "base64") => {
        return await getAccountInfoHelper(accountId, apiKey, encoding);
      }
    }
  };
};

// Configure Solana connection with API key if available
const getSolanaRpcUrl = () => {
  const apiKey = getSolanaApiKey();
  if (apiKey) {
    return `https://solana-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
  
  // Fallback to public endpoints if no API key
  return 'https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}';
};

// Solana connection for fallback token info
const solanaConnection = new Connection(getSolanaRpcUrl(), 'confirmed');
console.log('Solana RPC URL:', getSolanaRpcUrl().replace(/\/[a-zA-Z0-9_-]{10,}/, '/[API-KEY-HIDDEN]'));

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
      logo: ShitcoinLogo, // Use placeholder for logo
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
 * Fetch Token Metadata using multiple sources
 * @param {string} tokenAddress - The Solana token address
 * @param {string} apiKey - Optional API key, will use environment variable if not provided
 * @returns {Promise<Object>} - Token metadata including name, symbol, logo, and decimals
 */
export const fetchSolanaTokenMetadata = async (tokenAddress, apiKey = null) => {
  try {
    // Check if the token address ends with 'pump' to identify Pump.fun tokens
    const isPumpToken = isPumpFunToken(tokenAddress);
    
    // Get API key directly from .env variables
    const validApiKey = apiKey || getAlchemyApiKey();
    
    if (!validApiKey || validApiKey.length < 10) {
      console.warn('No valid Alchemy API key found. Trying to get data from Solana directly.');
      
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

    // Try to use token image based on known patterns first - this is our best bet for logos
    try {
      // For well-known tokens, try common logo locations
      const knownLogoUrl = await tryGetKnownTokenLogo(tokenAddress);
      if (knownLogoUrl) {
        // If we found a logo URL, return it with basic token info
        return {
          logo: knownLogoUrl,
          // We'll still need to get the name/symbol from on-chain data
          ...(await getTokenInfoFromSolana(tokenAddress) || {
            name: isPumpToken ? `Pump ${tokenAddress.substring(0, 4)}` : `Token ${tokenAddress.substring(0, 6)}`,
            symbol: isPumpToken ? "PUMP" : tokenAddress.substring(0, 4).toUpperCase(),
            decimals: 9
          })
        };
      }
    } catch (logoError) {
      console.warn(`Logo lookup failed for ${tokenAddress}:`, logoError);
    }

    // Try CoinGecko if available (less likely to have CORS issues)
    try {
      const coinGeckoData = await fetchCoinGeckoTokenData(tokenAddress);
      if (coinGeckoData && coinGeckoData.image) {
        console.log(`Got logo from CoinGecko for ${tokenAddress}:`, coinGeckoData.image);
        return {
          name: coinGeckoData.name || (isPumpToken ? `Pump ${tokenAddress.substring(0, 4)}` : "Unknown"),
          symbol: coinGeckoData.symbol || (isPumpToken ? "PUMP" : "???"),
          logo: coinGeckoData.image,
          decimals: 9, // CoinGecko doesn't provide decimals, so we use standard Solana default
        };
      }
    } catch (coinGeckoError) {
      console.warn(`CoinGecko lookup failed for ${tokenAddress}:`, coinGeckoError);
    }
    
    // For Solana tokens, now try using Alchemy's JSON-RPC API instead of REST
    // This is more reliable and has fewer CORS issues than the getTokenMetadata endpoint
    try {
      // Using alchemyjs to handle RPC calls would be better, but for simplicity we'll use axios
      const rpcUrl = `https://solana-mainnet.g.alchemy.com/v2/${validApiKey}`;
      const rpcRequest = {
        method: 'POST',
        url: rpcUrl,
        headers: { 'Content-Type': 'application/json' },
        data: {
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getTokenMetadata',
          params: [tokenAddress]
        }
      };
      
      console.log(`Trying Alchemy RPC for token metadata: ${tokenAddress}`);
      const rpcResponse = await axios.request(rpcRequest);
      
      if (rpcResponse.data?.result) {
        const metadata = rpcResponse.data.result;
        
        // Debug log the full response to see what's available
        console.log(`Got RPC token metadata for ${tokenAddress}:`, JSON.stringify(metadata, null, 2));
        
        // Look for logo in metadata.logo or in metadata.extensions.image
        const logoUrl = (() => {
          // Check if we have a direct logo property
          if (metadata.logo && typeof metadata.logo === 'string' && metadata.logo.startsWith('http')) {
            console.log(`Using logo directly from metadata for ${tokenAddress}: ${metadata.logo}`);
            return metadata.logo;
          }
          
          // Check if we have a logoURI property
          if (metadata.logoURI && typeof metadata.logoURI === 'string' && metadata.logoURI.startsWith('http')) {
            console.log(`Using logoURI from metadata for ${tokenAddress}: ${metadata.logoURI}`);
            return metadata.logoURI;
          }
          
          // Check for image in extensions
          if (metadata.extensions?.image && typeof metadata.extensions.image === 'string' && 
              metadata.extensions.image.startsWith('http')) {
            console.log(`Using image from extensions for ${tokenAddress}: ${metadata.extensions.image}`);
            return metadata.extensions.image;
          }

          // Check for imageUrl in extensions
          if (metadata.extensions?.imageUrl && typeof metadata.extensions.imageUrl === 'string' && 
              metadata.extensions.imageUrl.startsWith('http')) {
            console.log(`Using imageUrl from extensions for ${tokenAddress}: ${metadata.extensions.imageUrl}`);
            return metadata.extensions.imageUrl;
          }
          
          // No valid logo in metadata, try fallback methods
          return null;
        })();
        
        return {
          name: metadata.name || (isPumpToken ? `Pump ${tokenAddress.substring(0, 4)}` : "Unknown"),
          symbol: metadata.symbol || (isPumpToken ? "PUMP" : "???"),
          logo: logoUrl || (await tryGetKnownTokenLogo(tokenAddress)) || ShitcoinLogo,
          decimals: parseInt(metadata.decimals || "9", 10),
          // Additional metadata if available
          ...(metadata.extensions && { extensions: metadata.extensions }),
          ...(metadata.totalSupply && { totalSupply: metadata.totalSupply }),
        };
      }
    } catch (rpcError) {
      console.error(`RPC token metadata failed for ${tokenAddress}:`, rpcError);
    }
    
    // Fall back to on-chain data as the last resort
    const onChainData = await getTokenInfoFromSolana(tokenAddress);
    if (onChainData) return onChainData;
    
    // Final fallback with generic data
    throw new Error(`No metadata sources succeeded for token: ${tokenAddress}`);
  } catch (error) {
    console.error(`All token metadata methods failed for ${tokenAddress}:`, error);
    
    // Final fallback with minimal data
    const isPumpToken = isPumpFunToken(tokenAddress);
    return {
      name: isPumpToken ? `Pump ${tokenAddress.substring(0, 4)}` : `Token ${tokenAddress.substring(0, 6)}...`,
      symbol: isPumpToken ? "PUMP" : tokenAddress.substring(0, 4).toUpperCase(),
      logo: ShitcoinLogo,
      decimals: 9
    };
  }
};

/**
 * Try to get token logo from known patterns and sources
 * @param {string} tokenAddress - Solana token address
 * @returns {Promise<string|null>} - Logo URL if found, null otherwise
 */
async function tryGetKnownTokenLogo(tokenAddress) {
  try {
    // Common patterns for token logos
    const possibleUrls = [
      // Solscan format
      `https://solscan.io/token/${tokenAddress}.png`,
      // Solana FM format
      `https://raw.githubusercontent.com/solana-fm/token-list/main/assets/mainnet/${tokenAddress}/logo.png`,
      // Jupiter format
      `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${tokenAddress}/logo.png`,
      // Pump.fun format (if applicable)
      isPumpFunToken(tokenAddress) ? `https://pump.fun/i/token/${tokenAddress}` : null,
    ].filter(Boolean);
    
    // Try each URL until one works
    for (const url of possibleUrls) {
      try {
        // Just check if the URL is valid - we'll catch 404s
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        if (response) {
          console.log(`Found working logo URL for ${tokenAddress}: ${url}`);
          return url;
        }
      } catch (e) {
        // Skip failed URLs
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Error in logo lookup for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Attempt to get token data from CoinGecko
 * @param {string} tokenAddress - Solana token address
 * @returns {Promise<Object|null>} - Token data or null if not found
 */
async function fetchCoinGeckoTokenData(tokenAddress) {
  try {
    // CoinGecko uses contract addresses for lookup
    const apiKey = import.meta.env?.VITE_COINGECKO_API_KEY || process.env?.VITE_COINGECKO_API_KEY || '';
    const apiUrl = apiKey 
      ? `https://pro-api.coingecko.com/api/v3/coins/solana/contract/${tokenAddress}?x_cg_pro_api_key=${apiKey}` 
      : `https://api.coingecko.com/api/v3/coins/solana/contract/${tokenAddress}`;
      
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    // CoinGecko often returns 404 for unknown tokens, which is fine
    return null;
  }
}

/**
 * Send Transaction for Solana
 * @param {Object} transactionPayload - The transaction payload (e.g., encoded transaction).
 * @param {String} apiKey - Your Alchemy API key for Solana.
 */

export const sendSolanaTransaction = async (transactionPayload, apiKey = ALCHEMY_API_KEY) => {
  try {
    // Ensure we have a valid API key - use the module constant if not provided
    const validApiKey = apiKey || ALCHEMY_API_KEY;
    
    if (!validApiKey) {
      console.error('No Alchemy API key available for Solana transaction');
      throw new Error('Missing Alchemy API key for Solana transaction');
    }
    
    console.log('Using API key for Solana transaction:', validApiKey);
    
    const options = {
      method: 'POST',
      url: `https://solana-mainnet.g.alchemy.com/v2/${validApiKey}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: {
        id: 1,
        jsonrpc: '2.0',
        method: 'sendTransaction',
        params: [transactionPayload], // Pass transactionPayload
      },
    };

    const response = await axios.request(options);

    console.log('Solana Transaction sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending Solana transaction:', error);
    throw error;
  }
};

// Helper function to call Solana RPC methods using Alchemy with rate limiting
export const callSolanaRPC = async (methodName, params, apiKey = ALCHEMY_API_KEY, retries = 3) => {
    // Ensure we have a valid API key
    const validApiKey = apiKey || ALCHEMY_API_KEY;
    
    if (!validApiKey) {
        console.error('No Alchemy API key available for Solana RPC call');
        throw new Error('Missing Alchemy API key for Solana RPC call');
    }
    
    const url = `https://solana-mainnet.g.alchemy.com/v2/${validApiKey}`;
    
    // Apply rate limiting before making the request
    await rateLimitedDelay();
    
    try {
        const response = await axios.post(url, {
            jsonrpc: '2.0',
            id: 1,
            method: methodName,
            params: params,
        }, {
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            }
        });

        // Check the response for data
        const result = response.data?.result;

        if (!result) {
            throw new Error(`No data returned from the Solana RPC call using method: ${methodName}`);
        }

        console.log(`${methodName} result:`, result);
        return result;
    } catch (error) {
        // Handle 429 rate limit errors with exponential backoff
        if (error.response?.status === 429 && retries > 0) {
            const backoffTime = (4 - retries) * 1000; // 1s, 2s, 3s backoff
            console.log(`Rate limited (429). Retrying in ${backoffTime}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return callSolanaRPC(methodName, params, apiKey, retries - 1);
        }
        
        console.error(`Error calling Solana RPC method ${methodName}:`, error);
        throw error;
    }
};

// Helper function for getting program accounts
export const getProgramAccountsHelper = async (programId, apiKey = ALCHEMY_API_KEY, encoding = "base64") => {
    return await callSolanaRPC("getProgramAccounts", [programId, { encoding }], apiKey);
};

// Helper function for getting account information
// To Check the Status of a Specific Loan: If you needed to get detailed information about a single loan and knew the specific account address, you could use getAccountInfoHelper to directly query that account.
// To Validate Account Details: For example, you could use getAccountInfoHelper to check whether an account associated with a particular loan request is still active, or to verify other metadata (e.g., account owner, rent status).
export const getAccountInfoHelper = async (accountId, apiKey = ALCHEMY_API_KEY, encoding = "base64") => {
    return await callSolanaRPC("getAccountInfo", [accountId, { encoding }], apiKey);
};
/* In Solana, an account is a structure used to store data, and each account has an associated owner. The owner is typically the program that has the authority to manipulate the account's data. However, the actual process of creating or updating accounts can involve multiple participants, including the person who initializes the loan, the wallet that funds it, and the program that manages the logic. Let's clarify this further in the context of loans:

    Owner of the Account (Program Ownership)
        In the case of loans stored as accounts, the owner of the loan data (i.e., the account) is usually the smart contract (program) that governs the loan functionality.
        In Solana, this means that the program (or smart contract) is the only entity that has the authority to modify or change the data within that account.
        The owner, in this context, is defined by the public key of the smart contract that created and controls the account. This ensures that only the smart contract can change the state or data stored in the account.

    Example: If a loan program manages loans as individual accounts, all those accounts are "owned" by the loan program itself, meaning only the program can modify the loan data stored in those accounts (such as updating the repayment schedule or loan status).

    Account Creator or Initiator (Borrower)
        The borrower, who is the person creating the loan request, will typically initiate the creation of the account (i.e., they will interact with the loan program to create a new loan account).
        Although the program owns the account, the borrower’s public key is often saved within the data of the account as a field (e.g., a borrower field or similar). This allows the program to track which account (i.e., which loan) is associated with which borrower.
        The borrower is not the owner of the account in the Solana protocol sense, but their public key is an important piece of the account’s metadata, indicating who requested the loan.

    The Wallet’s Role in Funding and Interaction
        The borrower’s wallet is used to fund the transaction fee for account creation and pay for the rent of that account (Solana requires accounts to maintain a minimum balance, which is referred to as "rent").
        The borrower’s wallet can also sign and authorize transactions that create or close the loan account, but does not directly own the account in the Solana system — rather, the program does.

Example of How Loans Are Created as Accounts

Let's consider a scenario where a borrower wants to create a loan request:

    Borrower initiates a transaction to create a new loan.
    The loan program (smart contract) is responsible for creating a new account to store the loan details (e.g., borrower address, loan amount, interest rate, etc.).
    The new account's owner is set to be the program’s public key, meaning that the program has full control over the account and its data.
    In the account data, there is a field that stores the borrower's public key. This allows the program to identify which loans are associated with each borrower.

Ownership vs. Access in Solana

    The program (smart contract) is the true owner of the account, which means only it has the authority to modify the data.
    However, the borrower (who created the loan) is identified in the account's data as the initiator or creator.
    The borrower may interact with the account by calling specific functions in the program (such as repaying a loan), but they cannot directly change the account's data — only the program can do that.
    */


/*
To make calls to a Solana smart contract using Alchemy's SDK, you can follow the recommended approach for interacting with Solana smart contracts through JSON-RPC calls. Since Alchemy for Solana doesn’t have a direct SDK method similar to the Ethereum SDK for calling smart contract functions, you typically interact with Solana programs using the JSON-RPC API provided by Alchemy.

Here's how you can use axios to interact with your Solana contract, utilizing Alchemy's infrastructure:
1. JSON-RPC API for Solana

The Solana JSON-RPC API is used to interact with on-chain programs. It allows you to make direct calls to read or interact with a deployed smart contract. Alchemy provides this API with their endpoints, enabling better reliability and scalability.
2. Setup with Axios

Using axios for HTTP requests gives you a flexible way to handle REST API calls, including JSON-RPC. You can make JSON-RPC requests to Alchemy to interact with your Solana smart contract.
Example: Calling a Smart Contract Function with Alchemy's Solana Endpoint

Below is an example of how you could use axios to make a JSON-RPC request to a Solana contract function deployed via Alchemy's endpoint.
Step 1: Install Axios

First, install axios if you haven't done so:

npm install axios

Step 2: Implement a Call to Your Smart Contract

Let's assume you want to make a call to a specific function on your Solana program.

Here's a generic example of how to use axios to interact with your smart contract through Alchemy's Solana endpoint:

import axios from 'axios';

// Function to make a call to the Solana contract
export const callSolanaContract = async (programId, methodName, params, apiKey) => {
  try {
    // Set the correct URL for Alchemy's Solana endpoint
    // Ensure we have a valid API key - use the module constant if not provided
  const validApiKey = apiKey || ALCHEMY_API_KEY;
  
  if (!validApiKey) {
    console.error('No Alchemy API key available for Solana transaction');
    throw new Error('Missing Alchemy API key for Solana transaction');
  }
  
  const url = `https://solana-mainnet.g.alchemy.com/v2/${validApiKey}`;
    
    // Define the JSON-RPC payload
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: methodName, // e.g., 'getProgramAccounts' or your custom Solana function
      params: [
        programId,    // The public key of the smart contract (program) you want to call
        ...params     // Additional parameters required by your method
      ],
    };
    
    // Make the POST request using axios
    const response = await axios.post(url, payload, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json'
      }
    });

    // Check the response for data
    const result = response.data?.result;

    if (!result) {
      throw new Error('No data returned from the Solana RPC call');
    }

    console.log('Contract call result:', result);
    return result;
  } catch (error) {
    console.error('Error calling Solana contract:', error);
    throw error;
  }
};

// Example usage of the function
const apiKey = 'YOUR_ALCHEMY_API_KEY';
const programId = 'YOUR_PROGRAM_ID'; // The public key of your Solana program
const methodName = 'getProgramAccounts'; // Example method; replace with the method you need
const params = [ Add any required parameters here ];

callSolanaContract(programId, methodName, params, apiKey)
  .then(result => {
    console.log('Call successful:', result);
  })
  .catch(err => {
    console.error('Call failed:', err);
  });

Key Steps Explained:

    Specify the URL:
        The URL for Alchemy's Solana endpoint is typically formatted as:

    https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

    Set Up the JSON-RPC Payload:
        The payload object contains:
            "jsonrpc": "2.0": Specifies the JSON-RPC version.
            "id": 1: An identifier for the request (could be any unique number).
            "method": methodName: The method to call, which could be something like getProgramAccounts or sendTransaction.
            "params": Any parameters needed for the specific contract function. These parameters are specific to your contract and its structure.

    Make the HTTP Request:
        You use axios.post(url, payload) to send the request to the Alchemy Solana endpoint.
        The response should be parsed from response.data.

Some Common Solana Methods You Might Use

    getProgramAccounts: To get accounts owned by the program.
        Method: "getProgramAccounts"
        Params: [programId]

    getAccountInfo: To get detailed information about a specific account.
        Method: "getAccountInfo"
        Params: [accountId]

    sendTransaction: To send a transaction to Solana.
        Method: "sendTransaction"
        Params: [signedTransaction]

Example Use Case - Sending a Transaction to Solana Using Alchemy

Here's an example of sending a transaction using axios to the Alchemy endpoint for Solana:

export const sendSolanaTransaction = async (signedTransaction, apiKey) => {
  try {
    // Ensure we have a valid API key - use the module constant if not provided
  const validApiKey = apiKey || ALCHEMY_API_KEY;
  
  if (!validApiKey) {
    console.error('No Alchemy API key available for Solana transaction');
    throw new Error('Missing Alchemy API key for Solana transaction');
  }
  
  const url = `https://solana-mainnet.g.alchemy.com/v2/${validApiKey}`;

    const response = await axios.post(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [signedTransaction], // Signed transaction as a parameter
    }, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json'
      }
    });

    const txId = response.data?.result;

    if (!txId) {
      throw new Error('Transaction was not processed successfully');
    }

    console.log('Transaction ID:', txId);
    return txId;
  } catch (error) {
    console.error('Error sending Solana transaction:', error);
    throw error;
  }
};

Summary:

    Alchemy for Solana doesn't have a direct SDK method to call smart contract functions like Ethereum, so you use JSON-RPC with axios to interact with Solana programs.
    The URL endpoint for Alchemy mu

    st include your API key.
    Axios is used to make POST requests, setting up a JSON-RPC payload to call a specific contract function.
    Methods such as "getProgramAccounts", "getAccountInfo", or "sendTransaction" are used to interact with the blockchain.

This approach allows you to use Alchemy's reliable infrastructure while maintaining flexibility in calling Solana programs.
*/
