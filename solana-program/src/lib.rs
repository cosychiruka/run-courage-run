// For Solana Playground: This program requires the following dependencies:
// - solana-program = "1.17.0"
// - thiserror = "1.0.50"
// - spl-token = { version = "4.0.0", features = ["no-entrypoint"] }
// - spl-associated-token-account = { version = "2.2.0", features = ["no-entrypoint"] }
// - borsh = "0.10.3"
// - bytemuck = { version = "1.14.0", features = ["derive"] }

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
    clock::Clock,
};
use spl_token::{
    instruction as token_instruction,
    state::{Account as TokenAccount, Mint},
};
use spl_associated_token_account::instruction as associated_token_instruction;
use borsh::{BorshDeserialize, BorshSerialize};
use bytemuck::{Pod, Zeroable};

mod error;
mod instruction;
mod processor;
mod state;
mod utils;

use crate::{
    processor::Processor,
    state::*,
};

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction<'a: 'b, 'b>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'b>],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Courage Meme Lending: Processing instruction");
    
    // Process the instruction data directly
    Processor::process(program_id, accounts, instruction_data)
}
