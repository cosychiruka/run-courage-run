import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Keypair
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as borsh from 'borsh';
import { APP_ENV } from '../config/env';

// Load admin wallet from keypair file - ONLY FOR DEVNET
const loadAdminKeypair = async () => {
  try {
    const response = await fetch('/src/utils/wallet-keypair.json');
    const keypairData = await response.json();
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading admin keypair:', error);
    throw error;
  }
};

// Schema for instruction data
class InitializeProgramInstruction {
  constructor({ feeBasisPoints }) {
    this.feeBasisPoints = feeBasisPoints;
  }
}

const InitializeSchema = new Map([
  [
    InitializeProgramInstruction,
    {
      kind: 'struct',
      fields: [
        ['variant', 'u8'],
        ['feeBasisPoints', 'u16'],
      ],
    },
  ],
]);

// Find program config PDA
const findProgramConfigAddress = (programId) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('program_config')],
    programId
  );
};

// Find program stats PDA
const findProgramStatsAddress = (programId) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('program_stats')],
    programId
  );
};

// Hardcoded admin address from Solana Playground that deployed the program
const ADMIN_ADDRESS = 'Qe7DtDwXcNAgcov8xTz8a4k2yJmnk21PvvdFan3hD23';

// Special proxy initialization function that uses a helper program to initialize
export const initializeProgram = async (programId, feeRecipient, feeBasisPoints) => {
  try {
    // Only allow on devnet, localhost, or URLs containing 'devnet'
    const isDev = APP_ENV === 'development';
    const isDevnetInUrl = typeof window !== 'undefined' && window.location && window.location.href.includes('devnet');
    const isLocalhost = typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost';
    
    if (!isDev && !isDevnetInUrl && !isLocalhost) {
      throw new Error('Program initialization is only available on devnet');
    }
    
    // Show 'not implemented yet' message with instructions
    return { 
      success: false, 
      error: `Cannot initialize from frontend without admin wallet access.\n\nTo initialize the program, run this command in Solana Playground or CLI:\n\n1. Create a file with this command:\n\nconst { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');\nconst programId = new PublicKey('72u6a79ew5JawhUq4CqWH5sLRxfeKmmABUUFXw6MtJCK');\nconst feeRecipient = new PublicKey('YOUR_WALLET_ADDRESS');\nconst feeBasisPoints = 50;\n\n// Find program config PDA\nconst [configAddress] = PublicKey.findProgramAddressSync([Buffer.from('program_config')], programId);\nconst [statsAddress] = PublicKey.findProgramAddressSync([Buffer.from('program_stats')], programId);\n\n// Create instruction data\nconst instructionData = Buffer.from([0, feeBasisPoints & 0xff, (feeBasisPoints >> 8) & 0xff]);\n\n// Create config instruction\nconst initializeConfigIx = new TransactionInstruction({\n  keys: [\n    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },\n    { pubkey: configAddress, isSigner: false, isWritable: true },\n    { pubkey: feeRecipient, isSigner: false, isWritable: false },\n    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },\n    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },\n  ],\n  programId: programId,\n  data: instructionData,\n});\n\n// Create stats instruction\nconst initializeStatsIx = new TransactionInstruction({\n  keys: [\n    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },\n    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },\n    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },\n    { pubkey: statsAddress, isSigner: false, isWritable: true },\n  ],\n  programId: programId,\n  data: Buffer.from([0]),\n});\n\n// Send transaction\nconst connection = new Connection('https://api.devnet.solana.com', 'confirmed');\nconst tx = new Transaction().add(initializeConfigIx).add(initializeStatsIx);\nawait sendAndConfirmTransaction(connection, tx, [wallet]);\nconsole.log('Program initialized!')` 
    };

    // BACKUP METHOD - Keep this code in case we need to return to a client-side approach
    /*
    // Make sure wallet is connected
    if (!window.solana) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    // Hard-code the admin pubkey that deployed the contract
    const adminPubkey = new PublicKey(ADMIN_ADDRESS);

    // Get the current wallet public key
    await window.solana.connect();
    const walletPubkey = new PublicKey(window.solana.publicKey.toString());
    
    // Connect to devnet
    const connection = new Connection(
      'https://api.devnet.solana.com',
      'confirmed'
    );

    // Find program config PDA
    const [configAddress] = findProgramConfigAddress(new PublicKey(programId));
    
    // Find program stats PDA
    const [statsAddress] = findProgramStatsAddress(new PublicKey(programId));

    // Create instruction data for initialize program
    const instructionData = Buffer.from([
      0, // Variant index for InitializeProgram
      feeBasisPoints & 0xff, // Lower byte of feeBasisPoints
      (feeBasisPoints >> 8) & 0xff, // Upper byte of feeBasisPoints
    ]);

    // Create the instruction to initialize program config
    const initializeConfigIx = new TransactionInstruction({
      keys: [
        { pubkey: adminPubkey, isSigner: true, isWritable: false },
        { pubkey: configAddress, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(feeRecipient), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey(programId),
      data: instructionData,
    });
    
    // Create instruction to initialize program stats
    const initializeStatsIx = new TransactionInstruction({
      keys: [
        { pubkey: adminPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: statsAddress, isSigner: false, isWritable: true },
      ],
      programId: new PublicKey(programId),
      data: Buffer.from([0]), // We'll use 0 as a custom instruction for stats initialization
    });

    // Create transaction
    const transaction = new Transaction()
      .add(initializeConfigIx)
      .add(initializeStatsIx);
    
    transaction.feePayer = walletPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    */
  } catch (error) {
    console.error('Error initializing program:', error);
    return { success: false, error: error.message };
  }
};
