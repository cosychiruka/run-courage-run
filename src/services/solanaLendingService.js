import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import axios from 'axios';
import { Buffer } from 'buffer';
import { connection } from './quicknodeService';
import borsh from 'borsh';

// Program ID for the Solana lending program
export const LENDING_PROGRAM_ID = new PublicKey(process.env.REACT_APP_SOLANA_LENDING_PROGRAM_ID || '72u6a79ew5JawhUq4CqWH5sLRxfeKmmABUUFXw6MtJCK');

// Constants for PDA seeds (must match those in the Solana program)
const SEEDS = {
  PROGRAM_CONFIG: 'program-config',
  USER_PROFILE: 'user-profile',
  LOAN_REQUEST: 'loan-request',
  LOAN_FUNDING: 'loan-funding',
  COLLATERAL_ESCROW: 'collateral-escrow',
  REPAYMENT_ESCROW: 'repayment-escrow',
};

// Instruction indices (must match those in the Solana program)
const INSTRUCTION_INDEX = {
  CREATE_USER_PROFILE: 0,
  CREATE_LOAN_REQUEST: 1,
  FUND_LOAN: 2,
  CANCEL_LOAN_REQUEST: 3,
  ACCEPT_LOAN: 4,
  REPAY_LOAN: 5,
  LIQUIDATE_LOAN: 6,
  CLAIM_COLLATERAL: 7,
  WITHDRAW_REPAYMENT: 8,
  UPDATE_PROGRAM_CONFIG: 9,
};

// Loan status (must match those in the Solana program)
const LOAN_STATUS = {
  PENDING: 0,
  FUNDING: 1,
  FUNDED: 2,
  ACCEPTED: 3,
  REPAID: 4,
  LIQUIDATED: 5,
  CANCELLED: 6,
};

// Define borsh schema classes for deserialization
class UserProfile {
  constructor(fields) {
    Object.assign(this, fields);
  }
}

class LoanRequest {
  constructor(fields) {
    Object.assign(this, fields);
  }
}

class LoanFunding {
  constructor(fields) {
    Object.assign(this, fields);
  }
}

class ProgramConfig {
  constructor(fields) {
    Object.assign(this, fields);
  }
}

// Borsh schema for all account types
const SCHEMA = new Map([
  [
    UserProfile, {
      kind: 'struct',
      fields: [
        ['is_initialized', 'u8'],
        ['owner', [32]], // PublicKey is 32 bytes
        ['total_borrowed_native', 'u64'],
        ['total_borrowed_usdc', 'u64'],
        ['total_repaid_native', 'u64'],
        ['total_repaid_usdc', 'u64'],
        ['total_lent_native', 'u64'],
        ['total_lent_usdc', 'u64'],
        ['is_blacklisted', 'u8'],
      ],
    },
  ],
  [
    LoanRequest, {
      kind: 'struct',
      fields: [
        ['is_initialized', 'u8'],
        ['status', 'u8'],
        ['borrower', [32]], // PublicKey is 32 bytes
        ['collateral_token_mint', [32]], // PublicKey is 32 bytes
        ['collateral_amount', 'u64'],
        ['loan_amount', 'u64'],
        ['loan_token_is_native', 'u8'], // Boolean for SOL (true) or USDC (false)
        ['interest_rate_bps', 'u16'], // Basis points (e.g., 500 = 5%)
        ['duration_seconds', 'u64'],
        ['start_time', 'u64'], // Unix timestamp
        ['end_time', 'u64'], // Unix timestamp
        ['current_funded_amount', 'u64'],
        ['collateral_token_decimals', 'u8'],
      ],
    },
  ],
  [
    LoanFunding, {
      kind: 'struct',
      fields: [
        ['is_initialized', 'u8'],
        ['loan_request', [32]], // PublicKey is 32 bytes
        ['lender', [32]], // PublicKey is 32 bytes
        ['amount', 'u64'],
        ['has_withdrawn', 'u8'], // Boolean
      ],
    },
  ],
  [
    ProgramConfig, {
      kind: 'struct',
      fields: [
        ['is_initialized', 'u8'],
        ['fee_basis_points', 'u16'], // Basis points (e.g., 100 = 1%)
        ['fee_recipient', [32]], // PublicKey is 32 bytes
        ['last_fee_collection_time', 'u64'], // Unix timestamp
        ['authority', [32]], // PublicKey is 32 bytes
      ],
    },
  ],
]);




/**
 * Create a user profile
 * @param {PublicKey} userPublicKey - User's public key
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, userProfilePDA: PublicKey}>} Transaction signature and user profile PDA
 */
export const createUserProfile = async (userPublicKey, wallet) => {
  try {
    // The connection is now imported directly from quicknodeService

    // Check if user profile already exists
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    try {
      const accountInfo = await connection.getAccountInfo(userProfilePDA);
      if (accountInfo !== null) {
        // User profile already exists, return it
        return { 
          signature: null, // No transaction was sent
          userProfilePDA,
          exists: true,
          message: 'User profile already exists' 
        };
      }
    } catch (err) {
      // Account doesn't exist, continue with creation
    }

    // Create instruction with proper instruction index
    const instructionData = Buffer.alloc(1);
    instructionData.writeUInt8(INSTRUCTION_INDEX.CREATE_USER_PROFILE, 0);

    const createUserProfileIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_RENT_PUBKEY || new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(createUserProfileIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    return { 
      signature, 
      userProfilePDA,
      exists: false,
      message: 'User profile created successfully' 
    };
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new Error(`Failed to create user profile: ${error.message}`);
  }
};

/**
 * Create a loan request
 * @param {PublicKey} userPublicKey - User's public key
 * @param {PublicKey} tokenMint - Collateral token mint address
 * @param {number} collateralAmount - Amount of tokens to use as collateral
 * @param {number} loanAmount - Amount of SOL requested
 * @param {number} interestRateBps - Interest rate in basis points (e.g. 500 = 5%)
 * @param {number} durationSeconds - Loan duration in seconds
 * @param {boolean} isNativeCurrency - If true, loan is in SOL, otherwise in USDC
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, loanRequestPDA: PublicKey, error: string}>} Transaction signature, loan request PDA, and any error
 */
export const createLoanRequest = async (
  userPublicKey,
  tokenMint,
  collateralAmount,
  loanAmount,
  interestRateBps,
  durationSeconds,
  isNativeCurrency = true,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // Generate a unique seed for the loan request (current timestamp)
    const now = Math.floor(Date.now() / 1000);
    const uniqueSeed = Buffer.alloc(8);
    uniqueSeed.writeBigUInt64LE(BigInt(now));

    // Find the loan request PDA
    const [loanRequestPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.LOAN_REQUEST),
        userPublicKey.toBuffer(),
        uniqueSeed,
      ],
      LENDING_PROGRAM_ID
    );

    // Find the collateral escrow PDA
    const [collateralEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Get user's associated token account for the collateral token
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      userPublicKey
    );
    
    // Check if the token account exists
    const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
    if (!tokenAccountInfo) {
      // Create the associated token account if it doesn't exist
      const createTokenAccountIx = createAssociatedTokenAccountInstruction(
        userPublicKey, 
        userTokenAccount,
        userPublicKey,
        tokenMint
      );
      
      // Create and send transaction just for creating the token account
      const createAtaTx = new Transaction().add(createTokenAccountIx);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      createAtaTx.recentBlockhash = blockhash;
      createAtaTx.lastValidBlockHeight = lastValidBlockHeight;
      createAtaTx.feePayer = userPublicKey;
      
      const signedTx = await wallet.signTransaction(createAtaTx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight
      });
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );
    
    // Check if user profile exists
    const userProfileInfo = await connection.getAccountInfo(userProfilePDA);
    if (!userProfileInfo) {
      // Create user profile first
      await createUserProfile(userPublicKey, wallet);
    }

    // Get token metadata to determine decimals
    let collateralTokenDecimals = 9; // Default for most SPL tokens
    try {
      // Try to query token decimal information
      const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
      if (tokenAccountInfo?.value?.decimals !== undefined) {
        collateralTokenDecimals = tokenAccountInfo.value.decimals;
      }
    } catch (err) {
      console.warn('Could not determine token decimals, using default', err);
    }

    // Prepare instruction data
    const instructionData = Buffer.alloc(33);
    instructionData.writeUInt8(INSTRUCTION_INDEX.CREATE_LOAN_REQUEST, 0);
    instructionData.writeBigUInt64LE(BigInt(collateralAmount), 1); // 8 bytes for collateralAmount
    instructionData.writeBigUInt64LE(BigInt(loanAmount), 9); // 8 bytes for loanAmount
    instructionData.writeUInt16LE(interestRateBps, 17); // 2 bytes for interestRateBps
    instructionData.writeBigUInt64LE(BigInt(durationSeconds), 19); // 8 bytes for durationSeconds
    instructionData.writeUInt8(isNativeCurrency ? 1 : 0, 27); // 1 byte for isNativeToken (1 = true = SOL)
    instructionData.writeUInt8(collateralTokenDecimals, 28); // 1 byte for collateralTokenDecimals
    
    // Get token info for more accurate error messages
    let tokenSymbol = "SPL Token";
    try {
      // Use cached token metadata or fetch from on-chain if needed
      tokenSymbol = tokenMint.toString().slice(0, 4) + '...' + tokenMint.toString().slice(-4);
    } catch (err) {}
    
    // Create the create loan request instruction
    const createLoanRequestIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: collateralEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_RENT_PUBKEY || new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(createLoanRequestIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    return { 
      signature, 
      loanRequestPDA, 
      message: `Successfully created loan request using ${collateralAmount} ${tokenSymbol} as collateral`
    };
  } catch (error) {
    console.error('Error creating loan request:', error);
    return {
      signature: null,
      loanRequestPDA: null,
      error: `Failed to create loan request: ${error.message}`
    };
  }
};

/**
 * Fund a loan request
 * @param {PublicKey} userPublicKey - Lender's public key
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {number} fundingAmount - Amount of SOL to fund
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, loanFundingPDA: PublicKey, error: string}>} Transaction signature, loan funding PDA, and any error
 */
export const fundLoanRequest = async (
  userPublicKey,
  loanRequestPDA,
  fundingAmount,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        loanFundingPDA: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check loan status - can only fund loans in PENDING or FUNDING state
    if (loanRequestData.status !== LOAN_STATUS.PENDING && loanRequestData.status !== LOAN_STATUS.FUNDING) {
      return {
        signature: null,
        loanFundingPDA: null,
        error: 'Loan cannot be funded: not in pending or funding state.'
      };
    }

    // Find the loan funding PDA - unique per lender/loan request combination
    const [loanFundingPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.LOAN_FUNDING),
        loanRequestPDA.toBuffer(),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Get the borrower's public key from loan request data
    const borrowerPubkey = new PublicKey(loanRequestData.borrower);
    
    // Find borrower profile PDA
    const [borrowerProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        borrowerPubkey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Find the lender's user profile PDA or create it if it doesn't exist
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );
    
    // Check if user profile exists
    const userProfileInfo = await connection.getAccountInfo(userProfilePDA);
    if (!userProfileInfo) {
      // Create user profile first
      await createUserProfile(userPublicKey, wallet);
    }

    // Prepare instruction data
    const instructionData = Buffer.alloc(9);
    instructionData.writeUInt8(INSTRUCTION_INDEX.FUND_LOAN, 0); // Instruction index for FundLoan
    instructionData.writeBigUInt64LE(BigInt(fundingAmount), 1); // 8 bytes for fundingAmount

    // Create the fund loan request instruction
    const fundLoanRequestIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: borrowerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: loanFundingPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_RENT_PUBKEY || new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(fundLoanRequestIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    // Calculate and format information for UI feedback
    let loanCurrency = loanRequestData.loan_token_is_native === 1 ? "SOL" : "USDC";
    let loanAmountFormatted = loanRequestData.loan_token_is_native === 1 ?
      (Number(loanRequestData.loan_amount) / 1e9).toFixed(4) :
      (Number(loanRequestData.loan_amount) / 1e6).toFixed(2);
    
    // Format percentage of funding
    let totalFunded = Number(loanRequestData.current_funded_amount) + fundingAmount;
    let percentFunded = ((totalFunded / Number(loanRequestData.loan_amount)) * 100).toFixed(0);
    
    return { 
      signature, 
      loanFundingPDA,
      loanRequest: loanRequestPDA,
      message: `Successfully funded loan with ${(fundingAmount / 1e9).toFixed(4)} SOL (${percentFunded}% of requested ${loanAmountFormatted} ${loanCurrency})`
    };
  } catch (error) {
    console.error('Error funding loan request:', error);
    return {
      signature: null,
      loanFundingPDA: null,
      error: `Failed to fund loan: ${error.message}`
    };
  }
};

/**
 * Cancel a loan request
 * @param {PublicKey} userPublicKey - Borrower's public key
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, error: string}>} Transaction signature and any error
 */
export const cancelLoanRequest = async (
  userPublicKey,
  loanRequestPDA,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check if user is the borrower of this loan request
    const borrowerPubkey = new PublicKey(loanRequestData.borrower);
    if (!borrowerPubkey.equals(userPublicKey)) {
      return {
        signature: null,
        error: 'Only the borrower can cancel this loan request.'
      };
    }

    // Check loan status - can only cancel loans in PENDING or FUNDING state
    if (loanRequestData.status !== LOAN_STATUS.PENDING && loanRequestData.status !== LOAN_STATUS.FUNDING) {
      return {
        signature: null,
        error: 'Loan cannot be cancelled: not in pending or funding state.'
      };
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Find the collateral escrow PDA
    const [collateralEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Get escrow token account
    const collateralTokenMint = new PublicKey(loanRequestData.collateral_token_mint);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      collateralTokenMint,
      collateralEscrowPDA,
      true
    );

    // Get user's token account for refund
    const userTokenAccount = await getAssociatedTokenAddress(
      collateralTokenMint,
      userPublicKey
    );

    // Prepare instruction data
    const instructionData = Buffer.alloc(1);
    instructionData.writeUInt8(INSTRUCTION_INDEX.CANCEL_LOAN_REQUEST, 0);

    // Create the cancel loan request instruction
    const cancelLoanRequestIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: collateralEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(cancelLoanRequestIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    // Get token info for better UI feedback
    let tokenSymbol = "tokens";
    try {
      // Use cached token metadata or fetch from on-chain if needed
      tokenSymbol = collateralTokenMint.toString().slice(0, 4) + '...' + collateralTokenMint.toString().slice(-4);
    } catch (err) {}
    
    const collateralAmount = (Number(loanRequestData.collateral_amount) / Math.pow(10, loanRequestData.collateral_token_decimals)).toFixed(4);
    
    return { 
      signature,
      message: `Successfully cancelled loan request and returned ${collateralAmount} ${tokenSymbol} to your wallet`
    };
  } catch (error) {
    console.error('Error cancelling loan request:', error);
    return {
      signature: null,
      error: `Failed to cancel loan request: ${error.message}`
    };
  }
};

/**
 * Accept a loan (for borrower to accept funded loan)
 * @param {PublicKey} userPublicKey - Borrower's public key
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, error: string}>} Transaction signature and any error
 */
export const acceptLoan = async (
  userPublicKey,
  loanRequestPDA,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check if user is the borrower of this loan request
    const borrowerPubkey = new PublicKey(loanRequestData.borrower);
    if (!borrowerPubkey.equals(userPublicKey)) {
      return {
        signature: null,
        error: 'Only the borrower can accept this loan.'
      };
    }

    // Check loan status - can only accept loans in FUNDED state
    if (loanRequestData.status !== LOAN_STATUS.FUNDED) {
      return {
        signature: null,
        error: 'Loan cannot be accepted: not fully funded.'
      };
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Prepare instruction data
    const instructionData = Buffer.alloc(1);
    instructionData.writeUInt8(INSTRUCTION_INDEX.ACCEPT_LOAN, 0);

    // Create the accept loan instruction
    const acceptLoanIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(acceptLoanIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    // Format loan amount for user feedback
    const loanCurrency = loanRequestData.loan_token_is_native === 1 ? "SOL" : "USDC";
    const loanAmount = loanRequestData.loan_token_is_native === 1 ?
      (Number(loanRequestData.loan_amount) / 1e9).toFixed(4) :
      (Number(loanRequestData.loan_amount) / 1e6).toFixed(2);
    
    // Calculate due date for repayment
    const now = Math.floor(Date.now() / 1000);
    const dueDate = new Date((now + Number(loanRequestData.duration_seconds)) * 1000);
    const formattedDueDate = dueDate.toLocaleDateString();
    
    return { 
      signature,
      message: `Successfully accepted loan for ${loanAmount} ${loanCurrency}. Repayment due by ${formattedDueDate}`
    };
  } catch (error) {
    console.error('Error accepting loan:', error);
    return {
      signature: null,
      error: `Failed to accept loan: ${error.message}`
    };
  }
};

/**
 * Repay a loan
 * @param {PublicKey} userPublicKey - Borrower's public key
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {number} repaymentAmount - Amount to repay (including interest)
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, error: string}>} Transaction signature and any error
 */
export const repayLoan = async (
  userPublicKey,
  loanRequestPDA,
  repaymentAmount,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check if user is the borrower of this loan request
    const borrowerPubkey = new PublicKey(loanRequestData.borrower);
    if (!borrowerPubkey.equals(userPublicKey)) {
      return {
        signature: null,
        error: 'Only the borrower can repay this loan.'
      };
    }

    // Check loan status - can only repay loans in ACCEPTED state
    if (loanRequestData.status !== LOAN_STATUS.ACCEPTED) {
      return {
        signature: null,
        error: 'Loan cannot be repaid: not in active state.'
      };
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Find the collateral escrow PDA
    const [collateralEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Find the repayment escrow PDA
    const [repaymentEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.REPAYMENT_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Get token accounts
    const collateralTokenMint = new PublicKey(loanRequestData.collateral_token_mint);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      collateralTokenMint,
      collateralEscrowPDA,
      true
    );

    // Get user's token account for returning collateral
    const userTokenAccount = await getAssociatedTokenAddress(
      collateralTokenMint,
      userPublicKey
    );

    // Prepare instruction data
    const instructionData = Buffer.alloc(9);
    instructionData.writeUInt8(INSTRUCTION_INDEX.REPAY_LOAN, 0);
    instructionData.writeBigUInt64LE(BigInt(repaymentAmount), 1); // 8 bytes for repaymentAmount

    // Create the repay loan instruction
    const repayLoanIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: collateralEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: repaymentEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_RENT_PUBKEY || new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(repayLoanIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    // Get token info for better UI feedback
    let tokenSymbol = "tokens";
    try {
      // Use cached token metadata or fetch from on-chain if needed
      tokenSymbol = collateralTokenMint.toString().slice(0, 4) + '...' + collateralTokenMint.toString().slice(-4);
    } catch (err) {}
    
    const collateralAmount = (Number(loanRequestData.collateral_amount) / Math.pow(10, loanRequestData.collateral_token_decimals)).toFixed(4);
    const repaymentFormatted = loanRequestData.loan_token_is_native === 1 ?
      (repaymentAmount / 1e9).toFixed(4) + " SOL" :
      (repaymentAmount / 1e6).toFixed(2) + " USDC";
    
    return { 
      signature,
      message: `Successfully repaid ${repaymentFormatted} and received back ${collateralAmount} ${tokenSymbol} collateral`
    };
  } catch (error) {
    console.error('Error repaying loan:', error);
    return {
      signature: null,
      error: `Failed to repay loan: ${error.message}`
    };
  }
};

/**
 * Get all loan requests
 * @param {string} status - Optional filter by status ('Pending', 'Funded', 'Accepted', 'Repaid', 'Liquidated', 'Cancelled')
 * @returns {Promise<Array>} Array of loan requests
 */
/**
 * Liquidate a loan (called by a lender or admin)
 * @param {PublicKey} userPublicKey - Liquidator's public key (lender or admin)
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, error: string}>} Transaction signature and any error
 */
export const liquidateLoan = async (
  userPublicKey,
  loanRequestPDA,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check loan status - can only liquidate loans in ACCEPTED state that are past due
    if (loanRequestData.status !== LOAN_STATUS.ACCEPTED) {
      return {
        signature: null,
        error: 'Loan cannot be liquidated: not in active state.'
      };
    }

    // Check if loan is eligible for liquidation (either past maturity or collateral value below threshold)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const loanMaturityTimestamp = Number(loanRequestData.start_time) + Number(loanRequestData.duration_seconds);
    
    if (currentTimestamp < loanMaturityTimestamp) {
      // If not past maturity, need to check if collateral value is below threshold (would need price oracle)
      // This is a simplified check, real implementation would use an oracle
      return {
        signature: null,
        error: 'Loan is not past due and collateral value is sufficient.'
      };
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );
    
    // Fetch borrower's public key from loan data
    const borrowerPubkey = new PublicKey(loanRequestData.borrower);
    
    // Find borrower's profile PDA
    const [borrowerProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        borrowerPubkey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Find the collateral escrow PDA
    const [collateralEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Prepare instruction data
    const instructionData = Buffer.alloc(1);
    instructionData.writeUInt8(INSTRUCTION_INDEX.LIQUIDATE_LOAN, 0);

    // Create the liquidate loan instruction
    const liquidateLoanIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: borrowerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: collateralEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(liquidateLoanIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }

    // Format loan amount for user feedback
    const loanCurrency = loanRequestData.loan_token_is_native === 1 ? "SOL" : "USDC";
    const loanAmount = loanRequestData.loan_token_is_native === 1 ?
      (Number(loanRequestData.loan_amount) / 1e9).toFixed(4) :
      (Number(loanRequestData.loan_amount) / 1e6).toFixed(2);
    
    return { 
      signature,
      message: `Successfully liquidated loan for ${loanAmount} ${loanCurrency}. Lenders can now claim their share of the collateral.`
    };
  } catch (error) {
    console.error('Error liquidating loan:', error);
    return {
      signature: null,
      error: `Failed to liquidate loan: ${error.message}`
    };
  }
};

/**
 * Claim collateral after loan liquidation (for lenders)
 * @param {PublicKey} userPublicKey - Lender's public key
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {PublicKey} loanFundingPDA - Loan funding PDA specific to this lender
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, error: string}>} Transaction signature and any error
 */
export const claimCollateral = async (
  userPublicKey,
  loanRequestPDA,
  loanFundingPDA,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check loan status - can only claim from LIQUIDATED loans
    if (loanRequestData.status !== LOAN_STATUS.LIQUIDATED) {
      return {
        signature: null,
        error: 'Cannot claim collateral: loan has not been liquidated.'
      };
    }

    // Verify the loan funding account exists and belongs to this lender
    const loanFundingInfo = await connection.getAccountInfo(loanFundingPDA);
    if (!loanFundingInfo) {
      return {
        signature: null,
        error: 'Loan funding record not found. You may not be a lender for this loan.'
      };
    }

    // Deserialize loan funding data to verify the lender
    const loanFundingData = borsh.deserialize(
      SCHEMA,
      LoanFunding,
      Buffer.from(loanFundingInfo.data)
    );

    // Check if the caller is the lender
    const funderPubkey = new PublicKey(loanFundingData.lender);
    if (!funderPubkey.equals(userPublicKey)) {
      return {
        signature: null,
        error: 'You are not the lender of this funding.'
      };
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Find the collateral escrow PDA
    const [collateralEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Get the token accounts
    const collateralTokenMint = new PublicKey(loanRequestData.collateral_token_mint);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      collateralTokenMint,
      collateralEscrowPDA,
      true
    );

    // Get user's token account for receiving collateral
    const userTokenAccount = await getAssociatedTokenAddress(
      collateralTokenMint,
      userPublicKey
    );

    // Create associated token account if it doesn't exist
    let createAtaIx;
    try {
      await connection.getTokenAccountBalance(userTokenAccount);
    } catch (e) {
      // Token account doesn't exist, create it
      createAtaIx = createAssociatedTokenAccountInstruction(
        userPublicKey,
        userTokenAccount,
        userPublicKey,
        collateralTokenMint
      );
    }

    // Prepare instruction data
    const instructionData = Buffer.alloc(1);
    instructionData.writeUInt8(INSTRUCTION_INDEX.CLAIM_COLLATERAL, 0);

    // Create the claim collateral instruction
    const claimCollateralIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: loanFundingPDA, isSigner: false, isWritable: true },
        { pubkey: collateralEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create transaction and add instructions
    const transaction = new Transaction();
    if (createAtaIx) {
      transaction.add(createAtaIx);
    }
    transaction.add(claimCollateralIx);
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    // Get token info for better UI feedback
    let tokenSymbol = "tokens";
    try {
      // Use cached token metadata or fetch from on-chain if needed
      tokenSymbol = collateralTokenMint.toString().slice(0, 4) + '...' + collateralTokenMint.toString().slice(-4);
    } catch (err) {}

    // Calculate the lender's share of collateral (simplified calculation)
    const fundingAmount = Number(loanFundingData.amount);
    const loanAmount = Number(loanRequestData.loan_amount);
    const collateralAmount = Number(loanRequestData.collateral_amount);
    
    const lenderShare = (fundingAmount / loanAmount) * collateralAmount;
    const formattedShare = (lenderShare / Math.pow(10, loanRequestData.collateral_token_decimals)).toFixed(4);
    
    return { 
      signature,
      message: `Successfully claimed ${formattedShare} ${tokenSymbol} as your share of the liquidated collateral`
    };
  } catch (error) {
    console.error('Error claiming collateral:', error);
    return {
      signature: null,
      error: `Failed to claim collateral: ${error.message}`
    };
  }
};

/**
 * Withdraw repayment after loan repayment (for lenders)
 * @param {PublicKey} userPublicKey - Lender's public key
 * @param {PublicKey} loanRequestPDA - Loan request PDA
 * @param {PublicKey} loanFundingPDA - Loan funding PDA specific to this lender
 * @param {object} wallet - Connected wallet instance
 * @returns {Promise<{signature: string, error: string}>} Transaction signature and any error
 */
export const withdrawRepayment = async (
  userPublicKey,
  loanRequestPDA,
  loanFundingPDA,
  wallet
) => {
  try {
    // The connection is now imported directly from quicknodeService

    // First, fetch and deserialize the loan request to ensure it exists and is valid
    const loanRequestInfo = await connection.getAccountInfo(loanRequestPDA);
    if (!loanRequestInfo) {
      return {
        signature: null,
        error: 'Loan request not found.'
      };
    }

    // Deserialize loan request data
    const loanRequestData = borsh.deserialize(
      SCHEMA,
      LoanRequest,
      Buffer.from(loanRequestInfo.data)
    );

    // Check loan status - can only withdraw from REPAID loans
    if (loanRequestData.status !== LOAN_STATUS.REPAID) {
      return {
        signature: null,
        error: 'Cannot withdraw repayment: loan has not been repaid.'
      };
    }

    // Verify the loan funding account exists and belongs to this lender
    const loanFundingInfo = await connection.getAccountInfo(loanFundingPDA);
    if (!loanFundingInfo) {
      return {
        signature: null,
        error: 'Loan funding record not found. You may not be a lender for this loan.'
      };
    }

    // Deserialize loan funding data to verify the lender
    const loanFundingData = borsh.deserialize(
      SCHEMA,
      LoanFunding,
      Buffer.from(loanFundingInfo.data)
    );

    // Check if the caller is the lender
    const funderPubkey = new PublicKey(loanFundingData.lender);
    if (!funderPubkey.equals(userPublicKey)) {
      return {
        signature: null,
        error: 'You are not the lender of this funding.'
      };
    }

    // Find the user profile PDA
    const [userProfilePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.USER_PROFILE),
        userPublicKey.toBuffer(),
      ],
      LENDING_PROGRAM_ID
    );

    // Find the repayment escrow PDA
    const [repaymentEscrowPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.REPAYMENT_ESCROW),
        loanRequestPDA.toBuffer()
      ],
      LENDING_PROGRAM_ID
    );

    // Prepare instruction data
    const instructionData = Buffer.alloc(1);
    instructionData.writeUInt8(INSTRUCTION_INDEX.WITHDRAW_REPAYMENT, 0);

    // Create the withdraw repayment instruction
    const withdrawRepaymentIx = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loanRequestPDA, isSigner: false, isWritable: true },
        { pubkey: loanFundingPDA, isSigner: false, isWritable: true },
        { pubkey: repaymentEscrowPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default.SYSVAR_CLOCK_PUBKEY || new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: LENDING_PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(withdrawRepaymentIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm with proper error handling
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
    } catch (confirmErr) {
      throw new Error(`Failed to confirm transaction: ${confirmErr.message}`);
    }
    
    // Calculate the lender's share of repayment (principal + interest)
    const fundingAmount = Number(loanFundingData.amount);
    const loanAmount = Number(loanRequestData.loan_amount);
    const interestRate = Number(loanRequestData.interest_rate) / 10000; // Convert basis points to percentage
    
    const principalShare = fundingAmount;
    const interestShare = (fundingAmount / loanAmount) * (loanAmount * interestRate);
    const totalShare = principalShare + interestShare;
    
    // Format for user feedback
    const repaymentFormatted = loanRequestData.loan_token_is_native === 1 ?
      (totalShare / 1e9).toFixed(4) + " SOL" :
      (totalShare / 1e6).toFixed(2) + " USDC";
    
    return { 
      signature,
      message: `Successfully withdrew ${repaymentFormatted} (principal + interest) from the repaid loan`
    };
  } catch (error) {
    console.error('Error withdrawing repayment:', error);
    return {
      signature: null,
      error: `Failed to withdraw repayment: ${error.message}`
    };
  }
};

export const getAllLoanRequests = async (status = null) => {
  try {
    // The connection is now imported directly from quicknodeService
    
    // Find all loan request accounts
    const accounts = await connection.getProgramAccounts(LENDING_PROGRAM_ID, {
      filters: [
        // Filter for accounts with the loan request seed
        {
          memcmp: {
            offset: 0,  // Discriminator is at the beginning of the account data
            bytes: bs58.encode(Buffer.from([DISCRIMINATOR.LOAN_REQUEST])) // Use base58 encoding for the filter
          }
        },
        // Optional: filter by data size if all loan requests have the same size
        // This helps efficiency by reducing RPC data transfer
        {
          dataSize: LoanRequest.byteSize + 8  // Add 8 bytes for the discriminator
        }
      ]
    });
    
    // Parse account data using borsh deserialization
    const loanRequests = accounts.map(account => {
      try {
        // Deserialize the account data
        const data = borsh.deserialize(
          SCHEMA,
          LoanRequest,
          Buffer.from(account.account.data)
        );
        
        // Convert status from numeric to string representation for UI
        let statusString;
        switch (data.status) {
          case LOAN_STATUS.PENDING: statusString = 'Pending'; break;
          case LOAN_STATUS.FUNDING: statusString = 'Funding'; break;
          case LOAN_STATUS.FUNDED: statusString = 'Funded'; break;
          case LOAN_STATUS.ACCEPTED: statusString = 'Accepted'; break;
          case LOAN_STATUS.REPAID: statusString = 'Repaid'; break;
          case LOAN_STATUS.LIQUIDATED: statusString = 'Liquidated'; break;
          case LOAN_STATUS.CANCELLED: statusString = 'Cancelled'; break;
          default: statusString = 'Unknown';
        }
        
        // Format amounts for display (converting from lamports/base units)
        const loanAmount = data.loan_token_is_native === 1 ?
          (Number(data.loan_amount) / 1e9) : // SOL
          (Number(data.loan_amount) / 1e6);  // USDC or other SPL tokens
          
        const collateralAmount = Number(data.collateral_amount) / 
          Math.pow(10, data.collateral_token_decimals);
          
        const currentFunded = data.loan_token_is_native === 1 ?
          (Number(data.current_funded_amount) / 1e9) : // SOL
          (Number(data.current_funded_amount) / 1e6);  // USDC or other SPL tokens
          
        // Calculate funding progress percentage
        const fundingPercentage = data.loan_amount > 0 ?
          (Number(data.current_funded_amount) / Number(data.loan_amount) * 100).toFixed(0) : 0;
        
        // Format interest rate from basis points to percentage
        const interestRate = (Number(data.interest_rate) / 100).toFixed(2); // Convert from basis points
        
        // Format dates
        const startDate = data.start_time > 0 ?
          new Date(Number(data.start_time) * 1000).toLocaleString() : null;
          
        const endDate = data.start_time > 0 && data.duration_seconds > 0 ?
          new Date((Number(data.start_time) + Number(data.duration_seconds)) * 1000).toLocaleString() : null;
        
        // Return formatted loan data with the public key
        return {
          pubkey: account.pubkey.toString(),
          address: account.pubkey,
          borrower: new PublicKey(data.borrower).toString(),
          borrowerPubkey: new PublicKey(data.borrower),
          status: statusString,
          statusCode: data.status,
          collateralAmount: collateralAmount,
          collateralDecimals: data.collateral_token_decimals,
          collateralTokenMint: new PublicKey(data.collateral_token_mint).toString(),
          loanAmount: loanAmount,
          loanAmountRaw: Number(data.loan_amount),
          currentFunded: currentFunded,
          currentFundedRaw: Number(data.current_funded_amount),
          fundingPercentage: fundingPercentage,
          isNativeLoan: data.loan_token_is_native === 1,
          interestRate: interestRate,
          interestRateBps: Number(data.interest_rate),
          durationSeconds: Number(data.duration_seconds),
          durationDays: (Number(data.duration_seconds) / (24 * 60 * 60)).toFixed(1),
          startTime: Number(data.start_time),
          startDate: startDate,
          endDate: endDate,
          created: new Date(Number(data.creation_time) * 1000).toLocaleString(),
          description: data.description ? Buffer.from(data.description).toString().replace(/\u0000/g, '') : ""
        };
      } catch (err) {
        console.error(`Error deserializing loan request at ${account.pubkey.toString()}:`, err);
        return null;
      }
    }).filter(loan => loan !== null);  // Remove any loans that failed to deserialize
    
    // Filter by status if provided
    if (status) {
      return loanRequests.filter(loan => loan.status === status);
    }
    
    return loanRequests;
  } catch (error) {
    console.error('Error getting loan requests:', error);
    throw error;
  }
};

/**
 * Get user's active loans (as borrower or lender)
 * @param {PublicKey} userPublicKey - User's public key
 * @returns {Promise<{asLender: Array, asBorrower: Array}>} User's active loans
 */
export const getUserActiveLoans = async (userPublicKey) => {
  try {
    // Get all loan requests
    const allLoanRequests = await getAllLoanRequests();
    
    // Filter for loans where user is borrower
    const asBorrower = allLoanRequests.filter(loan => 
      loan.borrower === userPublicKey.toString() && 
      ['Pending', 'Funding', 'Funded', 'Accepted'].includes(loan.status)
    );
    
    // For loans where user is lender, we need to check funding accounts
    // The connection is now imported directly from quicknodeService
    const asLender = [];
    
    // Find all LoanFunding accounts where the lender is the user
    const fundingAccounts = await connection.getProgramAccounts(LENDING_PROGRAM_ID, {
      filters: [
        // Filter for accounts with the loan funding seed
        {
          memcmp: {
            offset: 0, // Discriminator is at the beginning of the account data
            bytes: bs58.encode(Buffer.from([DISCRIMINATOR.LOAN_FUNDING])) // Use base58 encoding for the filter
          }
        },
        // Filter for accounts where the lender is the user
        {
          memcmp: {
            offset: 8, // Skip 8 bytes discriminator to get to lender field
            bytes: userPublicKey.toBase58()
          }
        }
      ]
    });
    
    // Process all funding accounts
    for (const account of fundingAccounts) {
      try {
        // Deserialize the funding account data
        const fundingData = borsh.deserialize(
          SCHEMA,
          LoanFunding,
          Buffer.from(account.account.data)
        );
        
        // Find the loan request PDA from the funding data
        const loanRequestPubkey = new PublicKey(fundingData.loan_request);
        
        // Find the matching loan request in our existing list
        const matchingLoanRequest = allLoanRequests.find(loan => 
          loan.address.toString() === loanRequestPubkey.toString()
        );
        
        if (matchingLoanRequest) {
          // Format funding amount
          const fundingAmount = matchingLoanRequest.isNativeLoan ?
            (Number(fundingData.amount) / 1e9) : // SOL
            (Number(fundingData.amount) / 1e6);  // USDC or other SPL tokens
            
          // Calculate percentage of total loan funded by this lender
          const fundingPercentage = matchingLoanRequest.loanAmountRaw > 0 ?
            (Number(fundingData.amount) * 100 / matchingLoanRequest.loanAmountRaw).toFixed(2) : 0;
          
          // Format withdrawal or claim status
          const hasWithdrawn = fundingData.has_withdrawn === 1;
          const hasClaimed = fundingData.has_claimed === 1;
          
          // Add additional lender-specific information to the loan request
          asLender.push({
            ...matchingLoanRequest,
            fundingPubkey: account.pubkey.toString(),
            fundingAddress: account.pubkey,
            fundingAmount: fundingAmount,
            fundingAmountRaw: Number(fundingData.amount),
            fundingPercentage: fundingPercentage,
            hasWithdrawn: hasWithdrawn,
            hasClaimed: hasClaimed,
            canWithdraw: matchingLoanRequest.status === 'Repaid' && !hasWithdrawn,
            canClaim: matchingLoanRequest.status === 'Liquidated' && !hasClaimed
          });
        }
      } catch (err) {
        console.error(`Error deserializing funding at ${account.pubkey.toString()}:`, err);
      }
    }
    
    return { asLender, asBorrower };
  } catch (error) {
    console.error('Error getting user active loans:', error);
    throw error;
  }
};

export default {
  createUserProfile,
  createLoanRequest,
  fundLoanRequest,
  getAllLoanRequests,
  getUserActiveLoans,
};
