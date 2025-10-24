describe("Solana Lending Program Init", () => {
  it("init test", async () => {
    // Add your fee recipient address here
    const feeRecipient = new web3.PublicKey('');
    const programId = new web3.PublicKey('72u6a79ew5JawhUq4CqWH5sLRxfeKmmABUUFXw6MtJCK');
    const feeBasisPoints = 50;
    
    console.log(`Wallet: ${pg.wallet.publicKey.toString()}`);
    
    // Derive PDAs
    const [configAddress] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("program_config")], 
      programId
    );
    
    const [statsAddress] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("program_stats")], 
      programId
    );
    
    console.log(`Config PDA: ${configAddress.toString()}`);
    console.log(`Stats PDA: ${statsAddress.toString()}`);
    
    // Create instruction data
    const data = Buffer.from([
      0, // variant
      feeBasisPoints & 0xff,
      (feeBasisPoints >> 8) & 0xff,
    ]);
    
    // Create instructions
    const ix1 = new web3.TransactionInstruction({
      keys: [
        { pubkey: pg.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: configAddress, isSigner: false, isWritable: true },
        { pubkey: feeRecipient, isSigner: false, isWritable: false },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    });
    
    const ix2 = new web3.TransactionInstruction({
      keys: [
        { pubkey: pg.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: statsAddress, isSigner: false, isWritable: true },
      ],
      programId,
      data: Buffer.from([0]),
    });
    
    // Send transaction
    const tx = new web3.Transaction().add(ix1).add(ix2);
    const sig = await pg.wallet.signTransaction(tx);
    const txid = await pg.connection.sendRawTransaction(sig.serialize());
    await pg.connection.confirmTransaction(txid);
    
    console.log(`Success! Txid: ${txid}`);
  });
});
