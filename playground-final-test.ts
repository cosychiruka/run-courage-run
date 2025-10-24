describe("Solana Lending Program Initialization", () => {
  it("initializes program config and stats accounts", async () => {
    // Program details - you can edit these values
    const PROGRAM_ID = new web3.PublicKey('72u6a79ew5JawhUq4CqWH5sLRxfeKmmABUUFXw6MtJCK');
    const FEE_BASIS_POINTS = 50; // 0.5% - change as needed (0-10000)
    
    // Configure fee recipient address here (IMPORTANT)
    const FEE_RECIPIENT = new web3.PublicKey(''); // Add your fee recipient address
    
    // Check if fee recipient is set
    if (FEE_RECIPIENT.toString() === 'pubkey(11111111111111111111111111111111)') {
      console.error("❌ Please set the FEE_RECIPIENT address at the top of the script");
      return;
    }

    console.log(`\n--- Program Initialization ---`);
    console.log(`Wallet address: ${pg.wallet.publicKey.toString()}`);
    const balance = await pg.connection.getBalance(pg.wallet.publicKey);
    console.log(`Wallet balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

    // 1. Derive PDAs
    const [configAddress] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('program_config')],
      PROGRAM_ID
    );
    console.log(`Config PDA: ${configAddress.toString()}`);

    const [statsAddress] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('program_stats')],
      PROGRAM_ID
    );
    console.log(`Stats PDA: ${statsAddress.toString()}`);

    // 2. Create Instruction Data
    const instructionData = Buffer.from([
      0, // Variant index for InitializeProgram
      FEE_BASIS_POINTS & 0xff,
      (FEE_BASIS_POINTS >> 8) & 0xff,
    ]);

    // 3. Create Instructions
    const initializeConfigIx = new web3.TransactionInstruction({
      keys: [
        { pubkey: pg.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: configAddress, isSigner: false, isWritable: true },
        { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: false },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    const initializeStatsIx = new web3.TransactionInstruction({
      keys: [
        { pubkey: pg.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: statsAddress, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: Buffer.from([0]), // Custom instruction for stats initialization
    });

    // 4. Create and Send Transaction
    const transaction = new web3.Transaction()
      .add(initializeConfigIx)
      .add(initializeStatsIx);

    console.log('Sending initialization transaction...');
    
    // Note the important difference: using keypair property for signing
    const txHash = await web3.sendAndConfirmTransaction(
      pg.connection,
      transaction,
      [pg.wallet.keypair] // This is the key difference!
    );
    
    console.log(`\n✅ Program initialization successful!`);
    console.log(`Transaction signature: ${txHash}`);
    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // 5. Verify PDAs were created
    try {
      const configAccount = await pg.connection.getAccountInfo(configAddress);
      console.log(`\nConfig account created: ${configAccount !== null}`);
      if (configAccount) {
        console.log(`Config account size: ${configAccount.data.length} bytes`);
      }
      
      const statsAccount = await pg.connection.getAccountInfo(statsAddress);
      console.log(`Stats account created: ${statsAccount !== null}`);
      if (statsAccount) {
        console.log(`Stats account size: ${statsAccount.data.length} bytes`);
      }
    } catch (err) {
      console.error("Error verifying accounts:", err);
    }
  });
});
