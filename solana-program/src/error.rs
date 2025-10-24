use solana_program::{program_error::ProgramError, decode_error::DecodeError, msg};
use thiserror::Error;

/// Custom errors for the Courage Meme Lending program
#[derive(Error, Debug, Copy, Clone)]
pub enum LendingError {
    /// Invalid instruction data
    #[error("Invalid instruction data")]
    InvalidInstructionData,

    /// Not rent exempt
    #[error("Account not rent exempt")]
    NotRentExempt,

    /// Expected a different account owner
    #[error("Expected a different account owner")]
    IncorrectOwner,

    /// Math operation overflow
    #[error("Math operation overflow")]
    MathOverflow,

    /// Insufficient funds
    #[error("Insufficient funds")]
    InsufficientFunds,

    /// Invalid token account
    #[error("Invalid token account")]
    InvalidTokenAccount,

    /// Invalid loan request
    #[error("Invalid loan request")]
    InvalidLoanRequest,

    /// Loan already funded
    #[error("Loan already funded")]
    LoanAlreadyFunded,

    /// Loan not funded
    #[error("Loan not funded")]
    LoanNotFunded,

    /// Loan not active
    #[error("Loan not active")]
    LoanNotActive,

    /// Loan not expired
    #[error("Loan not expired")]
    LoanNotExpired,

    /// Loan already repaid
    #[error("Loan already repaid")]
    LoanAlreadyRepaid,

    /// Loan already liquidated
    #[error("Loan already liquidated")]
    LoanAlreadyLiquidated,

    /// Borrower blacklisted
    #[error("Borrower blacklisted")]
    BorrowerBlacklisted,

    /// Invalid authority
    #[error("Invalid authority")]
    InvalidAuthority,

    /// Invalid program configuration
    #[error("Invalid program configuration")]
    InvalidProgramConfig,

    /// Collateral value too low
    #[error("Collateral value too low")]
    CollateralValueTooLow,

    /// Invalid loan duration
    #[error("Invalid loan duration")]
    InvalidLoanDuration,

    /// Invalid interest rate
    #[error("Invalid interest rate")]
    InvalidInterestRate,

    /// Invalid fee recipient
    #[error("Invalid fee recipient")]
    InvalidFeeRecipient,

    /// Invalid program stats account
    #[error("Invalid program stats account")]
    InvalidProgramStatsAccount,
}

impl From<LendingError> for ProgramError {
    fn from(e: LendingError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for LendingError {
    fn type_of() -> &'static str {
        "LendingError"
    }
}
