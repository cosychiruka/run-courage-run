import { Connection, PublicKey } from '@solana/web3.js';
import { getSolanaConnection, connection as defaultConnection } from '../services/quicknodeService';

/**
 * Verify if a Solana program exists
 * @param {string} programId - The program ID to verify
 * @returns {Promise<{exists: boolean, deployedSlot: number|null, executableData: object|null, error: string|null}>}
 */
export const verifyProgramExists = async (programId) => {
  try {
    // Use the defaultConnection or create a new one for devnet
    const connection = defaultConnection;
    
    const publicKey = new PublicKey(programId);
    console.log(`Verifying program: ${programId}`);
    
    const accountInfo = await connection.getAccountInfo(publicKey);
    
    if (!accountInfo) {
      return {
        exists: false,
        deployedSlot: null,
        executableData: null,
        error: "Program account not found"
      };
    }
    
    console.log("Program account found:", {
      executable: accountInfo.executable,
      lamports: accountInfo.lamports,
      dataLength: accountInfo.data.length,
      owner: accountInfo.owner.toString()
    });
    
    if (!accountInfo.executable) {
      return {
        exists: true,
        deployedSlot: null,
        executableData: null,
        error: "Account exists but is not executable (not a program)"
      };
    }
    
    // Get program deployment info
    const programInfo = await connection.getProgramAccounts(publicKey, {
      commitment: 'confirmed',
      dataSlice: { offset: 0, length: 0 }, // We only need the pubkey
    });
    
    return {
      exists: true,
      deployedSlot: accountInfo.deployedSlot,
      executableData: {
        programCount: programInfo.length,
        owner: accountInfo.owner.toString(),
      },
      error: null
    };
  } catch (error) {
    console.error("Error verifying program:", error);
    return {
      exists: false, 
      deployedSlot: null,
      executableData: null,
      error: error.message
    };
  }
};

/**
 * Fetch all accounts owned by a program
 * @param {string} programId - The program ID
 * @returns {Promise<Array>} - Array of account info objects
 */
export const fetchProgramAccounts = async (programId) => {
  try {
    // Use the defaultConnection or create a new one for devnet
    const connection = defaultConnection;
    
    const publicKey = new PublicKey(programId);
    console.log(`Fetching accounts for program: ${programId}`);
    
    const accounts = await connection.getProgramAccounts(publicKey);
    
    return accounts.map(account => ({
      pubkey: account.pubkey.toString(),
      dataLength: account.account.data.length,
      lamports: account.account.lamports,
    }));
  } catch (error) {
    console.error("Error fetching program accounts:", error);
    return [];
  }
};
