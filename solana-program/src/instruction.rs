use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    system_program,
    sysvar::rent,
    pubkey::Pubkey,
};

use crate::utils::{TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID};

/// Instructions supported by the Courage Meme Lending program
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub enum LendingInstruction {
    /// Initialize the program config
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Authority account (program admin)
    /// 1. `[writable]` Program config account
    /// 2. `[]` Fee recipient account
    /// 3. `[]` System program
    /// 4. `[]` Rent sysvar
    InitializeProgram {
        /// Fee percentage (in basis points, e.g., 100 = 1%)
        fee_basis_points: u16,
    },

    /// Create a new loan request
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Borrower account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Collateral token account (borrower)
    /// 3. `[writable]` Collateral escrow account (PDA)
    /// 4. `[]` Collateral mint
    /// 5. `[]` Program config account
    /// 6. `[]` User profile account (PDA)
    /// 7. `[]` Token program
    /// 8. `[]` System program
    /// 9. `[]` Rent sysvar
    CreateLoanRequest {
        /// Amount of SOL requested as loan
        loan_amount: u64,
        /// Interest rate offered (in basis points, e.g., 500 = 5%)
        interest_rate_bps: u16,
        /// Duration of the loan in seconds
        duration_seconds: u64,
        /// Amount of collateral tokens to lock
        collateral_amount: u64,
    },

    /// Fund a loan request (can be partial funding)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Lender account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Loan funding account (PDA)
    /// 3. `[writable]` Lender SOL account
    /// 4. `[]` User profile account (PDA)
    /// 5. `[]` Program config account
    /// 6. `[]` System program
    /// 7. `[]` Rent sysvar
    FundLoan {
        /// Amount of SOL to contribute to the loan
        funding_amount: u64,
    },

    /// Cancel a loan request (only borrower can cancel if not fully funded)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Borrower account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Collateral escrow account (PDA)
    /// 3. `[writable]` Borrower token account
    /// 4. `[]` Token program
    CancelLoanRequest,

    /// Accept funding and receive loan (only borrower can accept when fully funded)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Borrower account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Borrower SOL account
    /// 3. `[writable]` Fee recipient account
    /// 4. `[]` Program config account
    /// 5. `[]` System program
    AcceptLoan,

    /// Repay a loan
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Borrower account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Borrower SOL account
    /// 3. `[writable]` Collateral escrow account (PDA)
    /// 4. `[writable]` Borrower token account
    /// 5. `[]` Token program
    /// 6. `[]` System program
    RepayLoan,

    /// Liquidate a defaulted loan
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Any account (liquidator)
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Collateral escrow account (PDA)
    /// 3. `[]` Program config account
    /// 4. `[]` Clock sysvar
    /// 5. `[]` Token program
    LiquidateLoan,

    /// Claim liquidated collateral (for lenders)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Lender account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Loan funding account (PDA)
    /// 3. `[writable]` Lender token account
    /// 4. `[writable]` Collateral escrow account (PDA)
    /// 5. `[]` Token program
    ClaimCollateral,

    /// Withdraw loan repayment (for lenders)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Lender account
    /// 1. `[writable]` Loan request account (PDA)
    /// 2. `[writable]` Loan funding account (PDA)
    /// 3. `[writable]` Lender SOL account
    /// 4. `[]` System program
    WithdrawRepayment,

    /// Update program config (admin only)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Authority account (program admin)
    /// 1. `[writable]` Program config account
    /// 2. `[]` New fee recipient account (optional)
    UpdateProgramConfig {
        /// New fee percentage (in basis points, e.g., 100 = 1%)
        new_fee_basis_points: Option<u16>,
        /// Whether to update the fee recipient
        update_fee_recipient: bool,
    },

    /// Blacklist a borrower (admin only)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Authority account (program admin)
    /// 1. `[writable]` User profile account (PDA)
    /// 2. `[]` Program config account
    BlacklistBorrower,

    /// Create user profile
    /// 
    /// Accounts expected:
    /// 0. `[signer]` User account
    /// 1. `[writable]` User profile account (PDA)
    /// 2. `[]` System program
    /// 3. `[]` Rent sysvar
    CreateUserProfile,
}

/// Creates an 'initialize program' instruction
pub fn initialize_program(
    program_id: &Pubkey,
    authority: &Pubkey,
    config_account: &Pubkey,
    fee_recipient: &Pubkey,
    fee_basis_points: u16,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new_readonly(*authority, true),
        AccountMeta::new(*config_account, false),
        AccountMeta::new_readonly(*fee_recipient, false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new_readonly(rent::id(), false),
    ];

    Instruction::new_with_borsh(
        *program_id,
        &LendingInstruction::InitializeProgram { fee_basis_points },
        accounts,
    )
}

/// Creates a 'create loan request' instruction
pub fn create_loan_request(
    program_id: &Pubkey,
    borrower: &Pubkey,
    loan_request_account: &Pubkey,
    borrower_token_account: &Pubkey,
    collateral_escrow: &Pubkey,
    collateral_mint: &Pubkey,
    config_account: &Pubkey,
    user_profile: &Pubkey,
    loan_amount: u64,
    interest_rate_bps: u16,
    duration_seconds: u64,
    collateral_amount: u64,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new_readonly(*borrower, true),
        AccountMeta::new(*loan_request_account, false),
        AccountMeta::new(*borrower_token_account, false),
        AccountMeta::new(*collateral_escrow, false),
        AccountMeta::new_readonly(*collateral_mint, false),
        AccountMeta::new_readonly(*config_account, false),
        AccountMeta::new_readonly(*user_profile, false),
        AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new_readonly(rent::id(), false),
    ];

    Instruction::new_with_borsh(
        *program_id,
        &LendingInstruction::CreateLoanRequest {
            loan_amount,
            interest_rate_bps,
            duration_seconds,
            collateral_amount,
        },
        accounts,
    )
}

// Additional instruction creation functions would be implemented here
// for each instruction type in the LendingInstruction enum
