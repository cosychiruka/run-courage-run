use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_pack::{IsInitialized, Sealed},
    pubkey::Pubkey,
    clock::UnixTimestamp,
};

/// Program configuration account
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct ProgramConfig {
    /// Is the config initialized
    pub is_initialized: bool,
    /// Authority that can update the config
    pub authority: Pubkey,
    /// Fee recipient account
    pub fee_recipient: Pubkey,
    /// Fee percentage in basis points (e.g., 100 = 1%)
    pub fee_basis_points: u16,
    /// Last fee withdrawal timestamp
    pub last_fee_withdrawal: UnixTimestamp,
    /// Total fees collected
    pub total_fees_collected: u64,
}

impl Sealed for ProgramConfig {}

impl IsInitialized for ProgramConfig {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/// Status of a loan
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq, Clone, Copy)]
pub enum LoanStatus {
    /// Loan request is created but not fully funded
    Pending,
    /// Loan is fully funded but not accepted by borrower
    Funded,
    /// Loan is active (borrower has received funds)
    Active,
    /// Loan has been repaid
    Repaid,
    /// Loan has been liquidated due to default
    Liquidated,
    /// Loan request has been cancelled
    Cancelled,
}

impl Default for LoanStatus {
    fn default() -> Self {
        LoanStatus::Pending
    }
}

/// Loan request account
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct LoanRequest {
    /// Is the loan request initialized
    pub is_initialized: bool,
    /// Borrower's public key
    pub borrower: Pubkey,
    /// Collateral token mint
    pub collateral_mint: Pubkey,
    /// Collateral escrow account
    pub collateral_escrow: Pubkey,
    /// Amount of collateral tokens locked
    pub collateral_amount: u64,
    /// Amount of SOL requested as loan
    pub loan_amount: u64,
    /// Interest rate in basis points (e.g., 500 = 5%)
    pub interest_rate_bps: u16,
    /// Duration of the loan in seconds
    pub duration_seconds: u64,
    /// Timestamp when the loan was created
    pub created_at: UnixTimestamp,
    /// Timestamp when the loan was funded
    pub funded_at: Option<UnixTimestamp>,
    /// Timestamp when the loan was accepted
    pub accepted_at: Option<UnixTimestamp>,
    /// Timestamp when the loan expires
    pub expires_at: Option<UnixTimestamp>,
    /// Timestamp when the loan was repaid or liquidated
    pub closed_at: Option<UnixTimestamp>,
    /// Current amount funded
    pub funded_amount: u64,
    /// Number of lenders
    pub lender_count: u32,
    /// Current status of the loan
    pub status: LoanStatus,
    /// Total amount repaid (principal + interest)
    pub total_repaid: u64,
    /// Whether the collateral has been distributed after liquidation
    pub collateral_distributed: bool,
}

impl Sealed for LoanRequest {}

impl IsInitialized for LoanRequest {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/// Loan funding account (tracks individual lender contributions)
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct LoanFunding {
    /// Is the funding initialized
    pub is_initialized: bool,
    /// Lender's public key
    pub lender: Pubkey,
    /// Loan request this funding is for
    pub loan_request: Pubkey,
    /// Amount of SOL contributed
    pub amount: u64,
    /// Whether the lender has claimed their repayment
    pub repayment_claimed: bool,
    /// Whether the lender has claimed their collateral share
    pub collateral_claimed: bool,
}

impl Sealed for LoanFunding {}

impl IsInitialized for LoanFunding {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/// User profile account
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct UserProfile {
    /// Is the profile initialized
    pub is_initialized: bool,
    /// User's public key
    pub user: Pubkey,
    /// Whether the user is blacklisted (for borrowers who defaulted)
    pub is_blacklisted: bool,
    /// Total amount borrowed
    pub total_borrowed: u64,
    /// Total amount lent
    pub total_lent: u64,
    /// Total amount repaid
    pub total_repaid: u64,
    /// Total interest paid
    pub total_interest_paid: u64,
    /// Total interest earned
    pub total_interest_earned: u64,
    /// Number of active loans as borrower
    pub active_loans_as_borrower: u32,
    /// Number of active loans as lender
    pub active_loans_as_lender: u32,
    /// Number of completed loans as borrower
    pub completed_loans_as_borrower: u32,
    /// Number of completed loans as lender
    pub completed_loans_as_lender: u32,
    /// Number of defaulted loans as borrower
    pub defaulted_loans_as_borrower: u32,
    /// Number of defaulted loans as lender
    pub defaulted_loans_as_lender: u32,
}

impl Sealed for UserProfile {}

impl IsInitialized for UserProfile {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/// Program statistics
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct ProgramStats {
    /// Is the stats initialized
    pub is_initialized: bool,
    /// Total amount lent in SOL
    pub total_lent: u64,
    /// Total amount repaid in SOL
    pub total_repaid: u64,
    /// Total interest earned by lenders
    pub total_interest_earned: u64,
    /// Total fees collected
    pub total_fees_collected: u64,
    /// Number of active loans
    pub active_loan_count: u32,
    /// Number of completed loans
    pub completed_loan_count: u32,
    /// Number of liquidated loans
    pub liquidated_loan_count: u32,
    /// Number of blacklisted borrowers
    pub blacklisted_borrower_count: u32,
}

impl ProgramStats {
    /// Size of ProgramStats struct in bytes
    pub const LEN: usize = 1 + 8 + 8 + 8 + 8 + 4 + 4 + 4 + 4; // bool + 4*u64 + 4*u32
}

impl Sealed for ProgramStats {}

impl IsInitialized for ProgramStats {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/// Size constants for account data
pub mod size {
    pub const PROGRAM_CONFIG_SIZE: usize = 1 + 32 + 32 + 2 + 8 + 8; // 83 bytes
    pub const LOAN_REQUEST_SIZE: usize = 1 + 32 + 32 + 32 + 8 + 8 + 2 + 8 + 8 + 9 + 9 + 9 + 9 + 8 + 4 + 1 + 8 + 1; // 180 bytes
    pub const LOAN_FUNDING_SIZE: usize = 1 + 32 + 32 + 8 + 1 + 1; // 75 bytes
    pub const USER_PROFILE_SIZE: usize = 1 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 4 + 4 + 4 + 4 + 4 + 4; // 98 bytes
    pub const PROGRAM_STATS_SIZE: usize = 1 + 8 + 8 + 8 + 8 + 4 + 4 + 4 + 4; // 49 bytes
}

/// Seeds for PDAs
pub mod seeds {
    pub const PROGRAM_CONFIG: &[u8] = b"config";
    pub const LOAN_REQUEST: &[u8] = b"loan_request";
    pub const LOAN_FUNDING: &[u8] = b"loan_funding";
    pub const USER_PROFILE: &[u8] = b"user_profile";
    pub const COLLATERAL_ESCROW: &[u8] = b"collateral_escrow";
    pub const PROGRAM_STATS: &[u8] = b"program_stats";
}
