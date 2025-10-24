import { Connection } from '@solana/web3.js';
import { MAINNET_SOLANA_RPC_URL, DEVNET_SOLANA_RPC_URL } from '../config/env';

// A map of network names to their RPC URLs
const rpcUrls = {
  'mainnet-beta': MAINNET_SOLANA_RPC_URL,
  'devnet': DEVNET_SOLANA_RPC_URL,
};

/**
 * Creates a new Solana connection based on the specified network.
 * @param {string} network - The desired network ('mainnet-beta' or 'devnet').
 * @returns {Connection} - A new Connection object.
 */
export const getSolanaConnection = (network = 'devnet') => {
  const rpcUrl = rpcUrls[network];
  if (!rpcUrl) {
    throw new Error(`Invalid network specified: ${network}. Please use 'mainnet-beta' or 'devnet'.`);
  }
  return new Connection(rpcUrl, 'confirmed');
};

/**
 * Fetches all accounts owned by a given program ID using a specific connection.
 * @param {Connection} connection - The Solana connection object to use.
 * @param {import('@solana/web3.js').PublicKey} programId - The program ID to query.
 * @param {string} encoding - The desired encoding for the account data.
 * @returns {Promise<any>} - A list of program accounts.
 */
export const getProgramAccounts = async (connection, programId, encoding = 'base64') => {
  return await connection.getProgramAccounts(programId, { encoding });
};

/**
 * Fetches information for a given account ID using a specific connection.
 * @param {Connection} connection - The Solana connection object to use.
 * @param {import('@solana/web3.js').PublicKey} accountId - The account ID to query.
 * @param {string} encoding - The desired encoding for the account data.
 * @returns {Promise<any>} - The account information.
 */
export const getAccountInfo = async (connection, accountId, encoding = 'base64') => {
  return await connection.getAccountInfo(accountId, { encoding });
};

// Default connection export for use in other services
export const connection = getSolanaConnection('devnet');
