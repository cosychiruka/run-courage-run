use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_associated_token_account::instruction as associated_token_instruction;
use spl_token::{
    instruction as token_instruction,
    state::{Account as TokenAccount, Mint},
};
use borsh::{BorshDeserialize, BorshSerialize};

use crate::{
    error::LendingError,
    instruction::LendingInstruction,
    state::{
        LoanFunding, LoanRequest, LoanStatus, ProgramConfig, UserProfile, 
        ProgramStats, seeds, size as account_size
    },
    utils::{TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, transfer_sol, find_user_profile_address, 
           find_program_config_address, find_program_stats_address, find_loan_request_address,
           find_loan_funding_address, find_collateral_escrow_address, transfer_tokens,
           transfer_tokens_from_pda, calculate_interest, calculate_fee, is_loan_fully_funded,
           can_cancel_loan, can_repay_loan, can_liquidate_loan, is_loan_expired, 
           is_borrower_blacklisted, verify_account_owner, log_loan_request},
};

/// Program processor
pub struct Processor;

impl Processor {
    /// Process a Courage Meme Lending instruction
    pub fn process<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = LendingInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            LendingInstruction::InitializeProgram { fee_basis_points } => {
                Self::process_initialize_program(program_id, accounts, fee_basis_points)
            }
            LendingInstruction::CreateLoanRequest {
                loan_amount,
                interest_rate_bps,
                duration_seconds,
                collateral_amount,
            } => Self::process_create_loan_request(
                program_id,
                accounts,
                loan_amount,
                interest_rate_bps,
                duration_seconds,
                collateral_amount,
            ),
            LendingInstruction::FundLoan { funding_amount } => {
                Self::process_fund_loan(program_id, accounts, funding_amount)
            }
            LendingInstruction::CancelLoanRequest => {
                Self::process_cancel_loan_request(program_id, accounts)
            }
            LendingInstruction::AcceptLoan => Self::process_accept_loan(program_id, accounts),
            LendingInstruction::RepayLoan => Self::process_repay_loan(program_id, accounts),
            LendingInstruction::LiquidateLoan => Self::process_liquidate_loan(program_id, accounts),
            LendingInstruction::ClaimCollateral => Self::process_claim_collateral(program_id, accounts),
            LendingInstruction::WithdrawRepayment => Self::process_withdraw_repayment(program_id, accounts),
            LendingInstruction::UpdateProgramConfig {
                new_fee_basis_points,
                update_fee_recipient,
            } => Self::process_update_program_config(
                program_id,
                accounts,
                new_fee_basis_points,
                update_fee_recipient,
            ),
            LendingInstruction::BlacklistBorrower => {
                Self::process_blacklist_borrower(program_id, accounts)
            }
            LendingInstruction::CreateUserProfile => {
                Self::process_create_user_profile(program_id, accounts)
            }
        }
    }

    /// Process the initialize program instruction
    fn process_initialize_program<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
        fee_basis_points: u16,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let authority_info = next_account_info(account_info_iter)?;
        let config_account_info = next_account_info(account_info_iter)?;
        let fee_recipient_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !authority_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Check if fee rate is valid (max 10%)
        if fee_basis_points > 1000 {
            return Err(LendingError::InvalidProgramConfig.into());
        }

        // Create program config account if it doesn't exist
        let (config_pubkey, config_bump) = find_program_config_address(program_id);
        if config_pubkey != *config_account_info.key {
            return Err(LendingError::InvalidProgramConfig.into());
        }

        let rent = Rent::from_account_info(rent_info)?;
        let space = account_size::PROGRAM_CONFIG_SIZE;
        
        // Create the config account if it doesn't exist
        if config_account_info.data_is_empty() {
            let lamports = rent.minimum_balance(space);
            
            // Create account with PDA
            invoke_signed(
                &system_instruction::create_account(
                    authority_info.key,
                    config_account_info.key,
                    lamports,
                    space as u64,
                    program_id,
                ),
                &[
                    authority_info.clone(),
                    config_account_info.clone(),
                    system_program_info.clone(),
                ],
                &[&[seeds::PROGRAM_CONFIG, &[config_bump]]],
            )?;
        }

        // Initialize or update the config data
        let mut config_data = ProgramConfig::try_from_slice(&config_account_info.data.borrow())?;
        
        if config_data.is_initialized {
            return Err(LendingError::InvalidProgramConfig.into());
        }

        config_data.is_initialized = true;
        config_data.authority = *authority_info.key;
        config_data.fee_recipient = *fee_recipient_info.key;
        config_data.fee_basis_points = fee_basis_points;
        config_data.last_fee_withdrawal = Clock::get()?.unix_timestamp;

        config_data.serialize(&mut *config_account_info.data.borrow_mut())?;

        // Get program stats account
        let stats_info = next_account_info(account_info_iter)?;
        
        // Validate stats account PDA
        let (stats_pubkey, _) = find_program_stats_address(program_id);
        if *stats_info.key != stats_pubkey {
            return Err(LendingError::InvalidProgramConfig.into()); // Using existing error variant as workaround
        }
        
        // Initialize program stats account
        Self::initialize_program_stats(
            program_id,
            authority_info, // Use authority_info as payer
            system_program_info,
            rent_info,
            stats_info,
        )?;

        msg!("Program initialized with fee rate of {}bps", fee_basis_points);
        Ok(())
    }

    /// Initialize program stats account
    fn initialize_program_stats<'a>(
        program_id: &Pubkey,
        payer_info: &'a AccountInfo<'a>,
        system_program_info: &'a AccountInfo<'a>,
        rent_info: &'a AccountInfo<'a>,
        stats_info: &'a AccountInfo<'a>, // Add stats_info parameter
    ) -> ProgramResult {
        let (stats_pubkey, stats_bump) = find_program_stats_address(program_id);
        
        // Validate stats account address
        if *stats_info.key != stats_pubkey {
            return Err(LendingError::InvalidProgramConfig.into()); // Using existing error variant as workaround
        }
        
        // Validate rent and system program
        if *system_program_info.key != solana_program::system_program::id() {
            return Err(ProgramError::InvalidAccountData);
        }
        if *rent_info.key != solana_program::sysvar::rent::id() {
            return Err(ProgramError::InvalidAccountData);
        }

        let stats_seeds = &[seeds::PROGRAM_STATS, &[stats_bump]];
        
        // Create account with PDA (this will fail if account already exists)
        invoke_signed(
            &system_instruction::create_account(
                payer_info.key,
                stats_info.key,
                Rent::get()?.minimum_balance(ProgramStats::LEN),
                ProgramStats::LEN as u64,
                program_id,
            ),
            &[payer_info.clone(), stats_info.clone()],
            &[stats_seeds],
        )?;

        // Initialize stats data
        let stats_data = ProgramStats {
            is_initialized: true,
            total_lent: 0,
            total_repaid: 0,
            total_interest_earned: 0,
            total_fees_collected: 0,
            active_loan_count: 0,
            completed_loan_count: 0,
            liquidated_loan_count: 0,
            blacklisted_borrower_count: 0,
        };

        stats_data.serialize(&mut *stats_info.data.borrow_mut())?;

        msg!("Program stats account initialized");
        Ok(())
    }

    /// Process the create loan request instruction
    fn process_create_loan_request<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
        loan_amount: u64,
        interest_rate_bps: u16,
        duration_seconds: u64,
        collateral_amount: u64,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let borrower_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let borrower_token_account_info = next_account_info(account_info_iter)?;
        let collateral_escrow_info = next_account_info(account_info_iter)?;
        let collateral_mint_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let user_profile_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !borrower_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Verify user profile
        let user_profile_data = UserProfile::try_from_slice(&user_profile_info.data.borrow())?;
        if user_profile_data.is_blacklisted {
            return Err(LendingError::BorrowerBlacklisted.into());
        }

        // Validate loan parameters
        if loan_amount == 0 || collateral_amount == 0 {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        if interest_rate_bps == 0 || interest_rate_bps > 5000 { // Max 50% interest
            return Err(LendingError::InvalidInterestRate.into());
        }

        if duration_seconds < 86400 || duration_seconds > 31536000 { // 1 day to 1 year
            return Err(LendingError::InvalidLoanDuration.into());
        }

        // Create loan request account
        let rent = Rent::from_account_info(rent_info)?;
        let space = account_size::LOAN_REQUEST_SIZE;
        let lamports = rent.minimum_balance(space);
        
        // Create account with program as owner
        invoke(
            &system_instruction::create_account(
                borrower_info.key,
                loan_request_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                borrower_info.clone(),
                loan_request_info.clone(),
                system_program_info.clone(),
            ],
        )?;

        // Transfer collateral to escrow account
        // First, create the escrow account if it doesn't exist
        let (escrow_pubkey, escrow_bump) = find_collateral_escrow_address(loan_request_info.key, program_id);
        if escrow_pubkey != *collateral_escrow_info.key {
            return Err(LendingError::InvalidTokenAccount.into());
        }

        // Create associated token account for escrow
        invoke(
            &associated_token_instruction::create_associated_token_account(
                borrower_info.key,
                &escrow_pubkey,
                collateral_mint_info.key,
                token_program_info.key,
            ),
            &[
                borrower_info.clone(),
                collateral_escrow_info.clone(),
                collateral_mint_info.clone(),
                token_program_info.clone(),
                system_program_info.clone(),
                rent_info.clone(),
            ],
        )?;

        // Transfer collateral to escrow account
        invoke(
            &token_instruction::transfer(
                token_program_info.key,
                borrower_token_account_info.key,
                collateral_escrow_info.key,
                borrower_info.key,
                &[],
                collateral_amount,
            )?,
            &[
                borrower_token_account_info.clone(),
                collateral_escrow_info.clone(),
                borrower_info.clone(),
                token_program_info.clone(),
            ],
        )?;

        // Initialize loan request data
        let clock = Clock::get()?;
        let loan_request = LoanRequest {
            is_initialized: true,
            borrower: *borrower_info.key,
            collateral_mint: *collateral_mint_info.key,
            collateral_escrow: *collateral_escrow_info.key,
            collateral_amount,
            loan_amount,
            interest_rate_bps,
            duration_seconds,
            created_at: clock.unix_timestamp,
            funded_at: None,
            accepted_at: None,
            expires_at: None,
            closed_at: None,
            funded_amount: 0,
            lender_count: 0,
            status: LoanStatus::Pending,
            total_repaid: 0,
            collateral_distributed: false,
        };

        loan_request.serialize(&mut *loan_request_info.data.borrow_mut())?;

        // Update user profile
        let mut user_profile = user_profile_data;
        user_profile.active_loans_as_borrower += 1;
        user_profile.serialize(&mut *user_profile_info.data.borrow_mut())?;

        log_loan_request(&loan_request);
        msg!("Loan request created successfully");
        Ok(())
    }

    /// Process the fund loan instruction
    fn process_fund_loan<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
        funding_amount: u64,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let lender_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let loan_funding_info = next_account_info(account_info_iter)?;
        let lender_sol_account_info = next_account_info(account_info_iter)?;
        let user_profile_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !lender_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request
        let mut loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        
        // Verify loan can be funded
        if loan_request.status != LoanStatus::Pending {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Verify funding amount
        if funding_amount == 0 {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        let remaining = loan_request.loan_amount.checked_sub(loan_request.funded_amount)
            .ok_or(LendingError::MathOverflow)?;
        
        let actual_funding = if funding_amount > remaining {
            remaining
        } else {
            funding_amount
        };

        // Create loan funding account if it doesn't exist
        let (funding_pubkey, funding_bump) = find_loan_funding_address(
            lender_info.key,
            loan_request_info.key,
            program_id,
        );
        
        if funding_pubkey != *loan_funding_info.key {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Check if funding account exists, if not create it
        let rent = Rent::from_account_info(rent_info)?;
        let space = account_size::LOAN_FUNDING_SIZE;
        let lamports = rent.minimum_balance(space);
        
        // Create account with program as owner
        invoke_signed(
            &system_instruction::create_account(
                lender_info.key,
                loan_funding_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                lender_info.clone(),
                loan_funding_info.clone(),
                system_program_info.clone(),
            ],
            &[&[
                seeds::LOAN_FUNDING,
                lender_info.key.as_ref(),
                loan_request_info.key.as_ref(),
                &[funding_bump],
            ]],
        )?;

        // Transfer SOL from lender to program account (loan request)
        transfer_sol(
            lender_sol_account_info,
            loan_request_info,
            actual_funding,
        )?;

        // Initialize or update loan funding data
        let loan_funding = LoanFunding {
            is_initialized: true,
            lender: *lender_info.key,
            loan_request: *loan_request_info.key,
            amount: actual_funding,
            repayment_claimed: false,
            collateral_claimed: false,
        };

        loan_funding.serialize(&mut *loan_funding_info.data.borrow_mut())?;

        // Update loan request
        loan_request.funded_amount = loan_request.funded_amount.checked_add(actual_funding)
            .ok_or(LendingError::MathOverflow)?;
        loan_request.lender_count += 1;
        
        // Check if fully funded
        if loan_request.funded_amount >= loan_request.loan_amount {
            loan_request.status = LoanStatus::Funded;
            loan_request.funded_at = Some(Clock::get()?.unix_timestamp);
        }

        loan_request.serialize(&mut *loan_request_info.data.borrow_mut())?;

        // Update user profile
        let mut user_profile = UserProfile::try_from_slice(&user_profile_info.data.borrow())?;
        user_profile.active_loans_as_lender += 1;
        user_profile.total_lent = user_profile.total_lent.checked_add(actual_funding)
            .ok_or(LendingError::MathOverflow)?;
        user_profile.serialize(&mut *user_profile_info.data.borrow_mut())?;

        // Update program stats
        let (stats_pubkey, _) = find_program_stats_address(program_id);
        
        msg!("Loan funded with {} SOL", actual_funding);
        Ok(())
    }

    /// Process the cancel loan request instruction
    fn process_cancel_loan_request<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let borrower_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let collateral_escrow_info = next_account_info(account_info_iter)?;
        let borrower_token_account_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !borrower_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request
        let mut loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        
        // Verify loan can be cancelled
        if loan_request.borrower != *borrower_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        if !can_cancel_loan(&loan_request) {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Transfer collateral back to borrower
        let (escrow_pubkey, escrow_bump) = find_collateral_escrow_address(loan_request_info.key, program_id);
        if escrow_pubkey != *collateral_escrow_info.key {
            return Err(LendingError::InvalidTokenAccount.into());
        }

        let mut lamports = collateral_escrow_info.lamports();
        let mut data = collateral_escrow_info.data.borrow_mut();
        let escrow_seeds = &[
            seeds::COLLATERAL_ESCROW,
            loan_request_info.key.as_ref(),
            &[escrow_bump],
        ];
        
        // Transfer tokens from escrow to borrower
        transfer_tokens_from_pda(
            token_program_info,
            collateral_escrow_info,
            borrower_token_account_info,
            collateral_escrow_info,
            loan_request.collateral_amount,
            escrow_seeds,
            escrow_bump,
        )?;

        // Update loan request status
        loan_request.status = LoanStatus::Cancelled;
        loan_request.closed_at = Some(Clock::get()?.unix_timestamp);
        loan_request.serialize(&mut *loan_request_info.data.borrow_mut())?;

        msg!("Loan request cancelled");
        Ok(())
    }

    /// Process the accept loan instruction
    fn process_accept_loan<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let borrower_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let borrower_sol_account_info = next_account_info(account_info_iter)?;
        let fee_recipient_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !borrower_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request
        let mut loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        
        // Verify loan can be accepted
        if loan_request.borrower != *borrower_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        if loan_request.status != LoanStatus::Funded {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Load program config
        let config = ProgramConfig::try_from_slice(&config_info.data.borrow())?;
        if !config.is_initialized || config.fee_recipient != *fee_recipient_info.key {
            return Err(LendingError::InvalidProgramConfig.into());
        }

        // Calculate fee
        let fee = calculate_fee(loan_request.loan_amount, config.fee_basis_points)?;
        let amount_after_fee = loan_request.loan_amount.checked_sub(fee)
            .ok_or(LendingError::MathOverflow)?;

        // Transfer SOL to borrower (minus fee)
        transfer_sol(
            loan_request_info,
            borrower_sol_account_info,
            amount_after_fee,
        )?;

        // Transfer fee to fee recipient
        transfer_sol(
            loan_request_info,
            fee_recipient_info,
            fee,
        )?;

        // Update loan request
        let clock = Clock::get()?;
        loan_request.status = LoanStatus::Active;
        loan_request.accepted_at = Some(clock.unix_timestamp);
        loan_request.expires_at = Some(clock.unix_timestamp + loan_request.duration_seconds as i64);
        loan_request.serialize(&mut *loan_request_info.data.borrow_mut())?;

        // Update program stats
        // This would typically update stats about active loans

        msg!("Loan accepted: {} SOL transferred to borrower, {} SOL fee paid", 
             amount_after_fee, fee);
        Ok(())
    }

    /// Process the repay loan instruction
    fn process_repay_loan<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let borrower_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let borrower_sol_account_info = next_account_info(account_info_iter)?;
        let collateral_escrow_info = next_account_info(account_info_iter)?;
        let borrower_token_account_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !borrower_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request
        let mut loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        
        // Verify loan can be repaid
        if loan_request.borrower != *borrower_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        if !can_repay_loan(&loan_request) {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Calculate total repayment (principal + interest)
        let interest = calculate_interest(loan_request.loan_amount, loan_request.interest_rate_bps)?;
        let total_repayment = loan_request.loan_amount.checked_add(interest)
            .ok_or(LendingError::MathOverflow)?;

        // Transfer SOL from borrower to loan request account
        transfer_sol(
            borrower_sol_account_info,
            loan_request_info,
            total_repayment,
        )?;

        // Return collateral to borrower
        let (escrow_pubkey, escrow_bump) = find_collateral_escrow_address(loan_request_info.key, program_id);
        if escrow_pubkey != *collateral_escrow_info.key {
            return Err(LendingError::InvalidTokenAccount.into());
        }

        let mut lamports = collateral_escrow_info.lamports();
        let mut data = collateral_escrow_info.data.borrow_mut();
        let escrow_seeds = &[
            seeds::COLLATERAL_ESCROW,
            loan_request_info.key.as_ref(),
            &[escrow_bump],
        ];
        
        // Transfer tokens from escrow to borrower
        transfer_tokens_from_pda(
            token_program_info,
            collateral_escrow_info,
            borrower_token_account_info,
            collateral_escrow_info,
            loan_request.collateral_amount,
            escrow_seeds,
            escrow_bump,
        )?;

        // Update loan request
        loan_request.status = LoanStatus::Repaid;
        loan_request.closed_at = Some(Clock::get()?.unix_timestamp);
        loan_request.total_repaid = total_repayment;
        loan_request.serialize(&mut *loan_request_info.data.borrow_mut())?;

        // Update user profile
        // This would update user profile stats about repaid loans

        msg!("Loan repaid: {} SOL principal + {} SOL interest", 
             loan_request.loan_amount, interest);
        Ok(())
    }

    /// Process the liquidate loan instruction
    fn process_liquidate_loan<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let liquidator_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let collateral_escrow_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let clock_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !liquidator_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request
        let mut loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        
        // Verify loan can be liquidated
        let clock = Clock::from_account_info(clock_info)?;
        if !can_liquidate_loan(&loan_request, clock.unix_timestamp) {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Update loan request
        loan_request.status = LoanStatus::Liquidated;
        loan_request.closed_at = Some(clock.unix_timestamp);
        loan_request.serialize(&mut *loan_request_info.data.borrow_mut())?;

        // Blacklist borrower (in a real implementation, you would update the borrower's user profile)

        // Update program stats
        // This would update stats about liquidated loans

        msg!("Loan liquidated. Collateral can now be claimed by lenders.");
        Ok(())
    }

    /// Process the claim collateral instruction
    fn process_claim_collateral<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let lender_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let loan_funding_info = next_account_info(account_info_iter)?;
        let lender_token_account_info = next_account_info(account_info_iter)?;
        let collateral_escrow_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !lender_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request and funding data
        let loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        let mut loan_funding = LoanFunding::try_from_slice(&loan_funding_info.data.borrow())?;
        
        // Verify loan is liquidated
        if loan_request.status != LoanStatus::Liquidated {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Verify lender is the owner of this funding
        if loan_funding.lender != *lender_info.key || loan_funding.loan_request != *loan_request_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Verify collateral has not been claimed already
        if loan_funding.collateral_claimed {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Calculate lender's share of collateral
        let lender_share = loan_funding.amount
            .checked_mul(loan_request.collateral_amount)
            .ok_or(LendingError::MathOverflow)?
            .checked_div(loan_request.loan_amount)
            .ok_or(LendingError::MathOverflow)?;

        // Transfer tokens from escrow to lender
        let (escrow_pubkey, escrow_bump) = find_collateral_escrow_address(loan_request_info.key, program_id);
        if escrow_pubkey != *collateral_escrow_info.key {
            return Err(LendingError::InvalidTokenAccount.into());
        }

        let mut lamports = collateral_escrow_info.lamports();
        let mut data = collateral_escrow_info.data.borrow_mut();
        let escrow_seeds = &[
            seeds::COLLATERAL_ESCROW,
            loan_request_info.key.as_ref(),
            &[escrow_bump],
        ];
        
        // Transfer tokens from escrow to lender
        transfer_tokens_from_pda(
            token_program_info,
            collateral_escrow_info,
            lender_token_account_info,
            collateral_escrow_info, // Use the existing account info directly
            lender_share,
            escrow_seeds,
            escrow_bump,
        )?;

        // Update loan funding
        loan_funding.collateral_claimed = true;
        loan_funding.serialize(&mut *loan_funding_info.data.borrow_mut())?;

        msg!("Collateral claimed by lender: {} tokens", lender_share);
        Ok(())
    }

    /// Process the withdraw repayment instruction
    fn process_withdraw_repayment<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let lender_info = next_account_info(account_info_iter)?;
        let loan_request_info = next_account_info(account_info_iter)?;
        let loan_funding_info = next_account_info(account_info_iter)?;
        let lender_sol_account_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !lender_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load loan request and funding data
        let loan_request = LoanRequest::try_from_slice(&loan_request_info.data.borrow())?;
        let mut loan_funding = LoanFunding::try_from_slice(&loan_funding_info.data.borrow())?;
        
        // Verify loan is repaid
        if loan_request.status != LoanStatus::Repaid {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Verify lender is the owner of this funding
        if loan_funding.lender != *lender_info.key || loan_funding.loan_request != *loan_request_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Verify repayment has not been claimed already
        if loan_funding.repayment_claimed {
            return Err(LendingError::InvalidLoanRequest.into());
        }

        // Calculate lender's share of repayment (principal + interest)
        let lender_percent = loan_funding.amount
            .checked_mul(10000)
            .ok_or(LendingError::MathOverflow)?
            .checked_div(loan_request.loan_amount)
            .ok_or(LendingError::MathOverflow)?;

        let lender_repayment = loan_request.total_repaid
            .checked_mul(lender_percent)
            .ok_or(LendingError::MathOverflow)?
            .checked_div(10000)
            .ok_or(LendingError::MathOverflow)?;

        // Transfer SOL from loan request to lender
        transfer_sol(
            loan_request_info,
            lender_sol_account_info,
            lender_repayment,
        )?;

        // Update loan funding
        loan_funding.repayment_claimed = true;
        loan_funding.serialize(&mut *loan_funding_info.data.borrow_mut())?;

        // Calculate interest earned
        let principal = loan_funding.amount;
        let interest = lender_repayment.checked_sub(principal).ok_or(LendingError::MathOverflow)?;

        msg!("Repayment withdrawn: {} SOL principal + {} SOL interest", principal, interest);
        Ok(())
    }

    /// Process the update program config instruction
    fn process_update_program_config<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
        new_fee_basis_points: Option<u16>,
        update_fee_recipient: bool,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        
        // Validate authority
        if !authority_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load config
        let mut config = ProgramConfig::try_from_slice(&config_info.data.borrow())?;
        
        // Verify authority
        if config.authority != *authority_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Update fee basis points if provided
        if let Some(fee_basis_points) = new_fee_basis_points {
            // Check if fee rate is valid (max 10%)
            if fee_basis_points > 1000 {
                return Err(LendingError::InvalidProgramConfig.into());
            }
            config.fee_basis_points = fee_basis_points;
        }

        // Update fee recipient if requested
        if update_fee_recipient {
            let fee_recipient_info = next_account_info(account_info_iter)?;
            config.fee_recipient = *fee_recipient_info.key;
        }

        config.serialize(&mut *config_info.data.borrow_mut())?;

        msg!("Program config updated");
        Ok(())
    }

    /// Process the blacklist borrower instruction
    fn process_blacklist_borrower<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let authority_info = next_account_info(account_info_iter)?;
        let user_profile_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;

        // Validate authority
        if !authority_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Load config
        let config = ProgramConfig::try_from_slice(&config_info.data.borrow())?;
        
        // Verify authority
        if config.authority != *authority_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Update user profile
        let mut user_profile = UserProfile::try_from_slice(&user_profile_info.data.borrow())?;
        user_profile.is_blacklisted = true;
        user_profile.serialize(&mut *user_profile_info.data.borrow_mut())?;

        msg!("Borrower blacklisted");
        Ok(())
    }

    /// Process the create user profile instruction
    fn process_create_user_profile<'a: 'b, 'b>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'b>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let user_info = next_account_info(account_info_iter)?;
        let user_profile_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;

        // Validate accounts
        if !user_info.is_signer {
            return Err(LendingError::InvalidAuthority.into());
        }

        // Create user profile account
        let (profile_pubkey, profile_bump) = find_user_profile_address(user_info.key, program_id);
        if profile_pubkey != *user_profile_info.key {
            return Err(LendingError::InvalidAuthority.into());
        }

        let rent = Rent::from_account_info(rent_info)?;
        let space = account_size::USER_PROFILE_SIZE;
        let lamports = rent.minimum_balance(space);

        // Create account with PDA
        invoke_signed(
            &system_instruction::create_account(
                user_info.key,
                user_profile_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                user_info.clone(),
                user_profile_info.clone(),
                system_program_info.clone(),
            ],
            &[&[seeds::USER_PROFILE, user_info.key.as_ref(), &[profile_bump]]],
        )?;

        // Initialize user profile
        let user_profile = UserProfile {
            is_initialized: true,
            user: *user_info.key,
            is_blacklisted: false,
            total_borrowed: 0,
            total_lent: 0,
            total_repaid: 0,
            total_interest_paid: 0,
            total_interest_earned: 0,
            active_loans_as_borrower: 0,
            active_loans_as_lender: 0,
            completed_loans_as_borrower: 0,
            completed_loans_as_lender: 0,
            defaulted_loans_as_borrower: 0,
            defaulted_loans_as_lender: 0,
        };

        user_profile.serialize(&mut *user_profile_info.data.borrow_mut())?;

        msg!("User profile created");
        Ok(())
    }
} // End of impl Processor