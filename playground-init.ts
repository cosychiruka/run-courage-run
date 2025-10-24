// NOTE: This script is designed for Solana Playground.
// It uses the `pg` and `web3` objects provided by the Playground environment.

// --- Program details - EDIT THESE VALUES ---
const PROGRAM_ID = '72u6a79ew5JawhUq4CqWH5sLRxfeKmmABUUFXw6MtJCK';
const FEE_RECIPIENT = ''; // <-- IMPORTANT: Add the address where you want to receive fees
const FEE_BASIS_POINTS = 50; // 0.5% - change as needed (0-10000)
// -----------------------------------------

// Find program config PDA
function findProgramConfigAddress(programId) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('program_config')],
    programId
  );
}

// Find program stats PDA
function findProgramStatsAddress(programId) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('program_stats')],
    programId
  );
}

// Main function to initialize the lending program
async function initializeProgram() {
  console.log(`My address: ${pg.wallet.publicKey.toString()}`);
  const balance = await pg.connection.getBalance(pg.wallet.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

  if (!FEE_RECIPIENT) {
    throw new Error('Please set the FEE_RECIPIENT address at the top of the script');
  }

  const programId = new web3.PublicKey(PROGRAM_ID);
  const feeRecipientPubkey = new web3.PublicKey(FEE_RECIPIENT);

  console.log(`Program ID: ${programId.toString()}`);
  console.log(`Fee Recipient: ${feeRecipientPubkey.toString()}`);
  console.log(`Fee Basis Points: ${FEE_BASIS_POINTS} (${FEE_BASIS_POINTS / 100}%)`);

  const [configAddress] = findProgramConfigAddress(programId);
  console.log(`Config PDA: ${configAddress.toString()}`);

  const [statsAddress] = findProgramStatsAddress(programId);
  console.log(`Stats PDA: ${statsAddress.toString()}`);

  const instructionData = Buffer.from([
    0, // Variant index for InitializeProgram
    FEE_BASIS_POINTS & 0xff,
    (FEE_BASIS_POINTS >> 8) & 0xff,
  ]);

  const initializeConfigIx = new web3.TransactionInstruction({
    keys: [
      { pubkey: pg.wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: configAddress, isSigner: false, isWritable: true },
      { pubkey: feeRecipientPubkey, isSigner: false, isWritable: false },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: programId,
    data: instructionData,
  });

  const initializeStatsIx = new web3.TransactionInstruction({
    keys: [
      { pubkey: pg.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: statsAddress, isSigner: false, isWritable: true },
    ],
    programId: programId,
    data: Buffer.from([0]),
  });

  const transaction = new web3.Transaction()
    .add(initializeConfigIx)
    .add(initializeStatsIx);

  console.log('Sending initialization transaction...');

  // Send transaction and confirm
  const signature = await web3.sendAndConfirmTransaction(
    pg.connection,
    transaction,
    [pg.wallet] // The Playground wallet object acts as the signer
  );

  console.log('✅ Program initialization successful!');
  console.log(`Transaction signature: ${signature}`);
}

// Run the initialization
initializeProgram().catch(err => {
  console.error('❌ Initialization failed:', err);
});
