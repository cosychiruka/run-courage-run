use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_token::{
    instruction as token_instruction,
    state::{Account as TokenAccount, Mint},
};
use spl_associated_token_account::instruction as associated_token_instruction;

// Constants for program IDs (replacing the id() functions)
// Token Program ID (equivalent to spl_token::id())
pub static TOKEN_PROGRAM_ID: Pubkey = solana_program::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Associated Token Account Program ID (equivalent to spl_associated_token_account::id())
pub static ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey = solana_program::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

use crate::{
    error::LendingError,
    state::{LoanRequest, LoanStatus, ProgramConfig, UserProfile, seeds},
};

/// Verifies that the account is owned by the expected program
pub fn verify_account_owner(account_info: &AccountInfo, owner: &Pubkey) -> ProgramResult {
    if account_info.owner != owner {
        msg!("Account owner mismatch");
        return Err(LendingError::IncorrectOwner.into());
    }
    Ok(())
}

/// Verifies that the account is rent exempt
pub fn verify_rent_exemption(account_info: &AccountInfo, rent: &Rent) -> ProgramResult {
    if !rent.is_exempt(account_info.lamports(), account_info.data_len()) {
        msg!("Account not rent exempt");
        return Err(LendingError::NotRentExempt.into());
    }
    Ok(())
}

/// Creates a PDA for the program config
pub fn find_program_config_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[seeds::PROGRAM_CONFIG], program_id)
}

/// Creates a PDA for a loan request
pub fn find_loan_request_address(
    borrower: &Pubkey,
    collateral_mint: &Pubkey,
    nonce: u64,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            seeds::LOAN_REQUEST,
            borrower.as_ref(),
            collateral_mint.as_ref(),
            &nonce.to_le_bytes(),
        ],
        program_id,
    )
}

/// Creates a PDA for a loan funding
pub fn find_loan_funding_address(
    lender: &Pubkey,
    loan_request: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            seeds::LOAN_FUNDING,
            lender.as_ref(),
            loan_request.as_ref(),
        ],
        program_id,
    )
}

/// Creates a PDA for a user profile
pub fn find_user_profile_address(user: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            seeds::USER_PROFILE,
            user.as_ref(),
        ],
        program_id,
    )
}

/// Creates a PDA for a collateral escrow
pub fn find_collateral_escrow_address(
    loan_request: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            seeds::COLLATERAL_ESCROW,
            loan_request.as_ref(),
        ],
        program_id,
    )
}

/// Creates a PDA for program stats
pub fn find_program_stats_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[seeds::PROGRAM_STATS], program_id)
}

/// Transfers SOL from one account to another
pub fn transfer_sol<'a>(
    from: &'a AccountInfo<'a>,
    to: &'a AccountInfo<'a>,
    amount: u64,
) -> ProgramResult {
    let instruction = system_instruction::transfer(
        from.key,
        to.key,
        amount,
    );
    
    invoke(
        &instruction,
        &[from.clone(), to.clone()],
    )
}

/// Transfers SOL from a PDA to another account
pub fn transfer_sol_from_pda<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    amount: u64,
    seeds: &[&[u8]],
    bump_seed: u8,
    system_program: &AccountInfo<'a>,
) -> ProgramResult {
    let instruction = system_instruction::transfer(
        from.key,
        to.key,
        amount,
    );
    
    let mut all_seeds = seeds.to_vec();
    let bump = &[bump_seed];
    all_seeds.push(bump);
    
    invoke_signed(
        &instruction,
        &[from.clone(), to.clone(), system_program.clone()],
        &[&all_seeds[..]],
    )
}

/// Transfers tokens from one account to another
pub fn transfer_tokens<'a>(
    token_program: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    amount: u64,
) -> ProgramResult {
    let transfer_instruction = spl_token::instruction::transfer(
        token_program.key,
        from.key,
        to.key,
        authority.key,
        &[],
        amount,
    )?;
    invoke(
        &transfer_instruction,
        &[from.clone(), to.clone(), authority.clone(), token_program.clone()],
    )
}

/// Transfers tokens from a PDA to another account
pub fn transfer_tokens_from_pda<'a>(
    token_program: &AccountInfo<'a>,
    source: &AccountInfo<'a>,
    destination: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    amount: u64,
    seeds: &[&[u8]],
    bump_seed: u8,
) -> ProgramResult {
    let instruction = token_instruction::transfer(
        token_program.key,
        source.key,
        destination.key,
        authority.key,
        &[],
        amount,
    )?;
    
    let mut all_seeds = seeds.to_vec();
    let bump = &[bump_seed];
    all_seeds.push(bump);
    
    invoke_signed(
        &instruction,
        &[source.clone(), destination.clone(), authority.clone(), token_program.clone()],
        &[&all_seeds[..]],
    )
}

/// Calculates the interest amount based on principal and interest rate
pub fn calculate_interest(principal: u64, interest_rate_bps: u16) -> Result<u64, ProgramError> {
    let interest_rate = interest_rate_bps as u64;
    principal
        .checked_mul(interest_rate)
        .ok_or(LendingError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(LendingError::MathOverflow.into())
}

/// Calculates the fee amount based on principal and fee rate
pub fn calculate_fee(principal: u64, fee_basis_points: u16) -> Result<u64, ProgramError> {
    let fee_rate = fee_basis_points as u64;
    principal
        .checked_mul(fee_rate)
        .ok_or(LendingError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(LendingError::MathOverflow.into())
}

/// Checks if a borrower is blacklisted
pub fn is_borrower_blacklisted(user_profile: &UserProfile) -> bool {
    user_profile.is_blacklisted
}

/// Checks if a loan has expired
pub fn is_loan_expired(loan_request: &LoanRequest, current_time: i64) -> bool {
    if let Some(expires_at) = loan_request.expires_at {
        current_time >= expires_at
    } else {
        false
    }
}

/// Checks if a loan can be liquidated
pub fn can_liquidate_loan(loan_request: &LoanRequest, current_time: i64) -> bool {
    loan_request.status == LoanStatus::Active && is_loan_expired(loan_request, current_time)
}

/// Checks if a loan can be repaid
pub fn can_repay_loan(loan_request: &LoanRequest) -> bool {
    loan_request.status == LoanStatus::Active
}

/// Checks if a loan can be cancelled
pub fn can_cancel_loan(loan_request: &LoanRequest) -> bool {
    loan_request.status == LoanStatus::Pending
}

/// Checks if a loan is fully funded
pub fn is_loan_fully_funded(loan_request: &LoanRequest) -> bool {
    loan_request.funded_amount >= loan_request.loan_amount
}

/// Logs a loan request for debugging
pub fn log_loan_request(loan_request: &LoanRequest) {
    msg!("Loan Request:");
    msg!("  Borrower: {}", loan_request.borrower);
    msg!("  Collateral Mint: {}", loan_request.collateral_mint);
    msg!("  Collateral Amount: {}", loan_request.collateral_amount);
    msg!("  Loan Amount: {}", loan_request.loan_amount);
    msg!("  Interest Rate: {}bps", loan_request.interest_rate_bps);
    msg!("  Duration: {}s", loan_request.duration_seconds);
    msg!("  Status: {:?}", loan_request.status);
    msg!("  Funded Amount: {}", loan_request.funded_amount);
    msg!("  Lender Count: {}", loan_request.lender_count);
}
