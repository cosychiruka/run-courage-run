import React, { useState, useEffect, useCallback } from 'react';
import ErrorBoundary from './ErrorBoundary';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { GiTwoCoins } from "react-icons/gi";
import { Line, Pie, Bar } from 'react-chartjs-2';
import { FaSun, FaDollarSign, FaExpandArrowsAlt, FaClock } from "react-icons/fa";
import { formatDuration, getTimeRemaining, formatDate, getUrgencyColor } from '../utils/timeUtils';
import { useAppKitProvider, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { PublicKey, Connection } from "@solana/web3.js";
import borsh from "borsh";
import SolanaBalanceDisplay from './SolanaBalanceDisplay';
import { isSolanaAddress } from '../services/walletService';
import "../assets/css/WalletPage.css";

// Register the required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Helper function to get Solana program instance
const getSolanaProgramInstance = (walletProvider, programId) => {
  return { programId: new PublicKey(programId), walletProvider };
};

const getSolanaWalletInstance = (walletProvider, programId) => {
  if (!programId) {
    console.error("Solana program ID is missing.");
    return null; // Early return if no program ID is provided
  }

  try {
    // For Solana, return the program ID and wallet provider
    return {
      programId: new PublicKey(programId),
      walletProvider,
    };
  } catch (error) {
    console.error("Error creating Solana wallet instance:", error);
    return null; // Return null to indicate an error
  }
};


const WalletPage = ({
  isConnected,
  network, // chain ids etc
  currentNetwork, // symbol
  solanaProvider,
  walletAddress,
  validateContractData,
}) => {  
  const [processingLoan, setProcessingLoan] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState(''); // success, error
  const [loansGiven, setLoansGiven] = useState([]);
  const [loansTaken, setLoansTaken] = useState([]);
  const [walletStats, setWalletStats] = useState({});
  const [profitability, setProfitability] = useState({ native: 0, dai: 0 });

  // Define fetchMetrics before using it in useEffect
  const fetchMetrics = useCallback(async () => {
    const defaultStats = {
      totalLentNative: "0",
      totalLentUSDC: "0",
      totalCompletedNative: "0",
      totalCompletedUSDC: "0",
      totalBorrowedNative: "0",
      totalBorrowedUSDC: "0",
      totalRepaidNative: "0",
      totalRepaidUSDC: "0",
      interestEarnedNative: "0",
      interestEarnedUSDC: "0",
      interestPaidNative: "0",
      interestPaidUSDC: "0",
    };

    setWalletStats(defaultStats);

    // Check if provider is available and has a connection
    if (!solanaProvider || !solanaProvider.connection) {
      console.error("Solana provider or connection not available");
      return;
    }

    const { isValid, currentContract, errorMessage } = validateContractData(network);
    if (!isValid) {
      console.error("FetchMetrics - Validation error: ",errorMessage);
      return;
    }

    try {
      const connection = new Connection(solanaProvider.connection.rpcEndpoint, 'confirmed');
      const accountInfo = await connection.getAccountInfo(new PublicKey(currentContract.address));
      if (accountInfo === null) {
        console.error("No account found at given address.");
        return;
      }

      // This is a placeholder for the actual deserialization logic
      // In the real implementation, you would deserialize the account data based on your Solana program's account structure
      const deserializedData = {
        totalLentNative: "5000000000", // 5 SOL in lamports
        totalLentUSDC: "10000000", // 10 USDC (6 decimals)
        totalCompletedNative: "2",
        totalCompletedUSDC: "2", 
        totalBorrowedNative: "3000000000", // 3 SOL in lamports
        totalBorrowedUSDC: "5000000", // 5 USDC
        totalRepaidNative: "1000000000", // 1 SOL in lamports
        totalRepaidUSDC: "2000000", // 2 USDC
        interestEarnedNative: "100000000", // 0.1 SOL in lamports
        interestEarnedUSDC: "500000", // 0.5 USDC
        interestPaidNative: "50000000", // 0.05 SOL in lamports
        interestPaidUSDC: "300000", // 0.3 USDC
      };

      setWalletStats({
        totalLentNative: deserializedData.totalLentNative,
        totalLentUSDC: deserializedData.totalLentUSDC,
        totalCompletedNative: deserializedData.totalCompletedNative,
        totalCompletedUSDC: deserializedData.totalCompletedUSDC,
        totalBorrowedNative: deserializedData.totalBorrowedNative,
        totalBorrowedUSDC: deserializedData.totalBorrowedUSDC,
        totalRepaidNative: deserializedData.totalRepaidNative,
        totalRepaidUSDC: deserializedData.totalRepaidUSDC,
        interestEarnedNative: deserializedData.interestEarnedNative,
        interestEarnedUSDC: deserializedData.interestEarnedUSDC,
        interestPaidNative: deserializedData.interestPaidNative,
        interestPaidUSDC: deserializedData.interestPaidUSDC,
      });

      // Calculate profitability
      const profitabilityNative = parseFloat(deserializedData.interestEarnedNative || 0) - parseFloat(deserializedData.interestPaidNative || 0);
      const profitabilityUSDC = parseFloat(deserializedData.interestEarnedUSDC || 0) - parseFloat(deserializedData.interestPaidUSDC || 0);
      setProfitability({ native: profitabilityNative, usdc: profitabilityUSDC });
    } catch (error) {
      console.error('Error fetching Solana metrics:', error);
    }
  }, [network, solanaProvider, walletAddress]);

  const fetchLoans = useCallback(async () => {
    // Even if network is undefined, validateContractData will now default to Solana
    const { isValid, currentContract, errorMessage } = validateContractData(network);
    if (!isValid) {
      console.error("FetchLoans - Validation error: ", errorMessage);
      setLoansError(`Network validation failed: ${errorMessage}`);
      return;
    }

    if (!solanaProvider) {
      console.error("FetchLoans - No Solana provider available");
      setLoansError("Please connect your wallet to view loans");
      return;
    }

    try {
      setLoansError(null); // Clear any previous errors
      setLoading(true); // Show loading state

      // Import the solanaLendingService to get user loans
      const solanaLendingService = await import('../services/solanaLendingService');
      
      if (!walletAddress) {
        console.error("No wallet address available");
        setLoansError("Wallet not connected. Please connect your wallet to continue.");
        return;
      }

      // Create PublicKey from wallet address string
      const userPublicKey = new PublicKey(walletAddress);
      
      // Fetch user's active loans (as borrower and as lender)
      const { asLender, asBorrower } = await solanaLendingService.getUserActiveLoans(userPublicKey);
      
      // Process loans where user is a lender
      const formattedLoansGiven = asLender.map(loan => ({
        id: loan.pubkey,
        borrower: loan.borrower,
        collateralToken: loan.collateralTokenMint, // In UI could resolve to token symbol
        collateralAmount: loan.collateralAmount.toString(),
        loanToken: loan.isNativeLoan ? 'SOL' : 'USDC',
        loanAmount: loan.loanAmount.toString(),
        interest: loan.interestRate,
        startTime: loan.startTime,
        endTime: loan.startTime + loan.durationSeconds,
        status: loan.status,
        fundingAmount: loan.fundingAmount,
        fundingPercentage: loan.fundingPercentage,
        canWithdraw: loan.canWithdraw,
        canClaim: loan.canClaim,
        loanData: loan // Store full loan data for action handlers
      }));

      // Process loans where user is a borrower
      const formattedLoansTaken = asBorrower.map(loan => ({
        id: loan.pubkey,
        collateralToken: loan.collateralTokenMint, // In UI could resolve to token symbol
        collateralAmount: loan.collateralAmount.toString(),
        loanToken: loan.isNativeLoan ? 'SOL' : 'USDC',
        loanAmount: loan.loanAmount.toString(),
        interest: loan.interestRate,
        startTime: loan.startTime,
        endTime: loan.startTime + loan.durationSeconds,
        status: loan.status,
        fundingPercentage: loan.fundingPercentage,
        canCancel: loan.status === 'Pending' || loan.status === 'Funding',
        canAccept: loan.status === 'Funded',
        canRepay: loan.status === 'Accepted',
        loanData: loan // Store full loan data for action handlers
      }));

      setLoansGiven(formattedLoansGiven);
      setLoansTaken(formattedLoansTaken);
    } catch (error) {
      console.error('Error fetching loans:', error);
      let errorMsg = "Failed to fetch your loans. ";
      
      // Provide network-specific error messages
      if (error.message?.includes("timeout")) {
        errorMsg += "Network request timed out. Please try again later.";
      } else if (error.message?.includes("rate limit")) {
        errorMsg += "RPC rate limit exceeded. Please try again in a moment.";
      } else if (error.message?.includes("account not found")) {
        errorMsg += "Account data not found. This might be a new wallet without loan history.";
      } else {
        errorMsg += error.message || "Please check your connection and try again.";
      }
      
      setLoansError(errorMsg);
    } finally {
      setLoading(false); // Hide loading state regardless of outcome
    }
  }, [network, solanaProvider, walletAddress, validateContractData]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    
    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotificationMessage('');
      setNotificationType('');
    }, 5000);
  }, []);

  // Handler for canceling a loan (borrower action)
  const handleCancelLoan = useCallback(async (loan) => {
    if (processingLoan) return;
    setProcessingLoan(true);
    
    try {
      const solanaLendingService = await import('../services/solanaLendingService');
      
      // Convert string address to PublicKey
      const userPublicKey = new PublicKey(walletAddress);
      const loanRequestPDA = new PublicKey(loan.id);
      
      // Call the cancelLoanRequest function
      const result = await solanaLendingService.cancelLoanRequest(
        userPublicKey,
        loanRequestPDA,
        solanaProvider
      );
      
      if (result.error) {
        showNotification(`Failed to cancel loan: ${result.error}`, 'error');
      } else {
        showNotification(result.message || 'Loan request cancelled successfully!');
        // Refresh loans after successful cancellation
        fetchLoans();
      }
    } catch (error) {
      console.error('Error cancelling loan:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setProcessingLoan(false);
    }
  }, [processingLoan, walletAddress, solanaProvider, showNotification, fetchLoans]);

  // Handler for accepting a loan (borrower action)
  const handleAcceptLoan = useCallback(async (loan) => {
    if (processingLoan) return;
    setProcessingLoan(true);
    
    try {
      const solanaLendingService = await import('../services/solanaLendingService');
      
      // Convert string address to PublicKey
      const userPublicKey = new PublicKey(walletAddress);
      const loanRequestPDA = new PublicKey(loan.id);
      
      // Call the acceptLoan function
      const result = await solanaLendingService.acceptLoan(
        userPublicKey,
        loanRequestPDA,
        solanaProvider
      );
      
      if (result.error) {
        showNotification(`Failed to accept loan: ${result.error}`, 'error');
      } else {
        showNotification(result.message || 'Loan accepted successfully!');
        // Refresh loans after successful acceptance
        fetchLoans();
      }
    } catch (error) {
      console.error('Error accepting loan:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setProcessingLoan(false);
    }
  }, [processingLoan, walletAddress, solanaProvider, showNotification, fetchLoans]);

  // Handler for repaying a loan (borrower action)
  const handleRepayLoan = useCallback(async (loan) => {
    if (processingLoan) return;
    setProcessingLoan(true);
    
    try {
      const solanaLendingService = await import('../services/solanaLendingService');
      
      // Convert string address to PublicKey
      const userPublicKey = new PublicKey(walletAddress);
      const loanRequestPDA = new PublicKey(loan.id);
      
      // Call the repayLoan function
      const result = await solanaLendingService.repayLoan(
        userPublicKey,
        loanRequestPDA,
        solanaProvider
      );
      
      if (result.error) {
        showNotification(`Failed to repay loan: ${result.error}`, 'error');
      } else {
        showNotification(result.message || 'Loan repaid successfully!');
        // Refresh loans after successful repayment
        fetchLoans();
      }
    } catch (error) {
      console.error('Error repaying loan:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setProcessingLoan(false);
    }
  }, [processingLoan, walletAddress, solanaProvider, showNotification, fetchLoans]);

  // Handler for liquidating a loan (lender action)
  const handleLiquidateLoan = useCallback(async (loan) => {
    if (processingLoan) return;
    setProcessingLoan(true);
    
    try {
      const solanaLendingService = await import('../services/solanaLendingService');
      
      // Convert string address to PublicKey
      const userPublicKey = new PublicKey(walletAddress);
      const loanRequestPDA = new PublicKey(loan.id);
      
      // Call the liquidateLoan function
      const result = await solanaLendingService.liquidateLoan(
        userPublicKey,
        loanRequestPDA,
        solanaProvider
      );
      
      if (result.error) {
        showNotification(`Failed to liquidate loan: ${result.error}`, 'error');
      } else {
        showNotification(result.message || 'Loan liquidated successfully!');
        // Refresh loans after successful liquidation
        fetchLoans();
      }
    } catch (error) {
      console.error('Error liquidating loan:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setProcessingLoan(false);
    }
  }, [processingLoan, walletAddress, solanaProvider, showNotification, fetchLoans]);

  // Handler for claiming collateral after liquidation (lender action)
  const handleClaimCollateral = useCallback(async (loan) => {
    if (processingLoan) return;
    setProcessingLoan(true);
    
    try {
      const solanaLendingService = await import('../services/solanaLendingService');
      
      // Convert string address to PublicKey
      const userPublicKey = new PublicKey(walletAddress);
      const loanRequestPDA = new PublicKey(loan.id);
      const loanFundingPDA = new PublicKey(loan.fundingPubkey);
      
      // Call the claimCollateral function
      const result = await solanaLendingService.claimCollateral(
        userPublicKey,
        loanRequestPDA,
        loanFundingPDA,
        solanaProvider
      );
      
      if (result.error) {
        showNotification(`Failed to claim collateral: ${result.error}`, 'error');
      } else {
        showNotification(result.message || 'Collateral claimed successfully!');
        // Refresh loans after successful claim
        fetchLoans();
      }
    } catch (error) {
      console.error('Error claiming collateral:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setProcessingLoan(false);
    }
  }, [processingLoan, walletAddress, solanaProvider, showNotification, fetchLoans]);

  // Handler for withdrawing repayment (lender action)
  const handleWithdrawRepayment = useCallback(async (loan) => {
    if (processingLoan) return;
    setProcessingLoan(true);
    
    try {
      const solanaLendingService = await import('../services/solanaLendingService');
      
      // Convert string address to PublicKey
      const userPublicKey = new PublicKey(walletAddress);
      const loanRequestPDA = new PublicKey(loan.id);
      const loanFundingPDA = new PublicKey(loan.fundingPubkey);
      
      // Call the withdrawRepayment function
      const result = await solanaLendingService.withdrawRepayment(
        userPublicKey,
        loanRequestPDA,
        loanFundingPDA,
        solanaProvider
      );
      
      if (result.error) {
        showNotification(`Failed to withdraw repayment: ${result.error}`, 'error');
      } else {
        showNotification(result.message || 'Repayment withdrawn successfully!');
        // Refresh loans after successful withdrawal
        fetchLoans();
      }
    } catch (error) {
      console.error('Error withdrawing repayment:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setProcessingLoan(false);
    }
  }, [processingLoan, walletAddress, solanaProvider, showNotification, fetchLoans]);

  const getFormattedValue = (value, unit) => {
    // Check if value is null, undefined, or not a number
    if (value == null || isNaN(parseFloat(value))) {
      return "0"; // Fallback value for invalid input
    }

    // Formatting for SOL
    if (unit === "SOL") {
      return (parseFloat(value) / 1e9).toFixed(4); // Handle Solana units with precision (9 decimals)
    }

    // Formatting for USDC
    if (unit === "USDC") {
      return (parseFloat(value) / 1e6).toFixed(2); // Handle USDC with 6 decimals
    }

    // If none of the above, return value as a string
    return value.toString();
  };

  // Handler to refresh loan data
  const handleRefreshLoans = () => {
    if (!isConnected) return;
    fetchLoans();
    showNotification('Refreshing loan data...', 'success');
  };

  return (
    <div className="wallet-page">
      {notificationMessage && (
        <div className={`notification ${notificationType}`}>
          {notificationMessage}
          <button className="notification-close" onClick={() => setNotificationMessage('')}>×</button>
        </div>
      )}
      {processingLoan && (
        <div className="transaction-processing-overlay">
          <div className="processing-message">
            <i className="fas fa-spinner fa-spin"></i>
            <span>Processing transaction...</span>
          </div>
        </div>
      )}
      {/* <h1>Wallet Dashboard</h1> */}
      
      {isConnected && (
        <div className="refresh-button-container">
          <button className="refresh-button" onClick={handleRefreshLoans}>
            Refresh Loans
          </button>
        </div>
      )}

      {/* Wallet Balance Section */}
      <ErrorBoundary fallbackText="Wallet balance section couldn't load. Please refresh the page.">
        <section className="wallet-balance-section">
          <h2>Wallet Balance</h2>
        <div className="balance-container">
          {walletAddress && network?.name === 'solana' && isSolanaAddress(walletAddress) ? (
            <SolanaBalanceDisplay address={walletAddress} showUsd={true} className="balance-display" />
          ) : (
            <div className="balance-display">
              <p>Connect a Solana wallet to view your balance</p>
            </div>
          )}
        </div>
        </section>
      </ErrorBoundary>
      
      <ErrorBoundary fallbackText="Wallet stats couldn't load. Please refresh the page.">
        <section className="user-metric">
          <h2>Wallet Stats</h2>
        <div className="metric-grid">
          <div className="wallet-item">
            <GiTwoCoins className="wallet-icon" />
            <div>T. Lent (SOL): <span>{getFormattedValue(walletStats.totalLentNative, "SOL")}</span></div>
          </div>
          <div className="wallet-item">
            <FaDollarSign className="wallet-icon" />
            <div>Total Lent (USDC) <span>{getFormattedValue(walletStats.totalLentUSDC, 'USDC')}</span></div>
          </div>
          <div className="wallet-item">
            <GiTwoCoins className="wallet-icon" />
            <div>Total Completed (SOL): <span>{getFormattedValue(walletStats.totalCompletedNative, "SOL")}</span></div>
          </div>
          <div className="wallet-item">
            <FaDollarSign className="wallet-icon" />
            <div>T. Borrowed (USDC) <span>{getFormattedValue(walletStats.totalBorrowedUSDC, 'USDC')}</span></div>
          </div>
          <div className="wallet-item">
            <GiTwoCoins className="wallet-icon" />
            <div>T. Repaid (SOL): <span>{getFormattedValue(walletStats.totalRepaidNative, "SOL")}</span></div>
          </div>
          <div className="wallet-item">
            <FaDollarSign className="wallet-icon" />
            <div>T. Repaid (USDC) <span>{getFormattedValue(walletStats.totalRepaidUSDC, 'USDC')}</span></div>
          </div>
        </div>
      </section>
      </ErrorBoundary>

      <ErrorBoundary fallbackText="Performance graphs couldn't load. Please refresh the page.">
      <section className="graphs-section">
        <h2>Performance</h2>
        <div className="graphs-container">
          <Bar
            data={{
              labels: ['Interest Paid', 'Interest Earned', 'Profitability'],
              datasets: [
                {
                  label: `SOL Metrics`,
                  data: [
                    parseFloat(walletStats.interestPaidNative || 0),
                    parseFloat(walletStats.interestEarnedNative || 0),
                    parseFloat(profitability.native || 0),
                  ],
                  backgroundColor: ['#FFFFFF', '#36A2EB', profitability.native >= 0 ? '#4CAF50' : '#FF0000'],
                },
                {
                  label: 'USDC Metrics',
                  data: [
                    parseFloat(walletStats.interestPaidUSDC || 0),
                    parseFloat(walletStats.interestEarnedUSDC || 0),
                    parseFloat(profitability.usdc || 0),
                  ],
                  backgroundColor: ['#FFFFFF', '#FFCE56', profitability.usdc >= 0 ? '#4CAF50' : '#FF0000'],
                },
              ],
            }}
          />
          <div className="profitability-info">
            <p><strong>Profitability = </strong></p>
            <p>
              Total Interest Earned - Total Interest Paid.
            </p>
          </div>
        </div>
      </section>
      </ErrorBoundary>

      <ErrorBoundary fallbackText="Loans given section couldn't load. Please refresh the page.">
      <section className="loans-section">
        <h2>Loans Given</h2>
        {loansGiven.length > 0 ? (
          loansGiven.map((loan, index) => (
            <div key={index} className="loan-card">
              <div className="loan-info">
                <div><strong>Status:</strong> {loan.status}</div>
                <div><strong>Borrower:</strong> {loan.borrower.substring(0, 8)}...</div>
                <div><strong>Collateral Token:</strong> {loan.collateralToken}</div>
                <div><strong>Loan Amount:</strong> {getFormattedValue(loan.loanAmount, loan.loanToken)}</div>
                <div><strong>Interest Rate:</strong> {loan.interest}%</div>
                <div><strong>Your Contribution:</strong> {loan.fundingAmount} {loan.loanToken} ({loan.fundingPercentage}%)</div>
                <div>
                  <strong>End Time:</strong> {formatDate(loan.endTime)}
                  {loan.endTime && (
                    <div className="time-remaining">
                      <FaClock /> 
                      <span className={getUrgencyColor(getTimeRemaining(loan.endTime).urgency)}>
                        {getTimeRemaining(loan.endTime).timeLeft}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="loan-actions">
                {loan.status === 'Accepted' && (
                  <button 
                    className="action-button liquidate" 
                    onClick={() => handleLiquidateLoan(loan)}
                    disabled={new Date(loan.endTime * 1000) > new Date()}
                    title={new Date(loan.endTime * 1000) > new Date() ? 'Cannot liquidate before end time' : 'Liquidate loan'}
                  >
                    Liquidate
                  </button>
                )}
                {loan.canClaim && (
                  <button 
                    className="action-button claim" 
                    onClick={() => handleClaimCollateral(loan)}
                  >
                    Claim Collateral
                  </button>
                )}
                {loan.canWithdraw && (
                  <button 
                    className="action-button withdraw" 
                    onClick={() => handleWithdrawRepayment(loan)}
                  >
                    Withdraw Repayment
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No loans given yet</p>
        )}
      </section>
      </ErrorBoundary>

      <ErrorBoundary fallbackText="Loans taken section couldn't load. Please refresh the page.">
      <section className="loans-section">
        <h2>Loans Taken</h2>
        {loansTaken.length > 0 ? (
          loansTaken.map((loan, index) => (
            <div key={index} className="loan-card">
              <div className="loan-info">
                <div><strong>Status:</strong> {loan.status}</div>
                <div><strong>Collateral Token:</strong> {loan.collateralToken}</div>
                <div><strong>Collateral Amount:</strong> {loan.collateralAmount}</div>
                <div><strong>Loan Amount:</strong> {getFormattedValue(loan.loanAmount, loan.loanToken)}</div>
                <div><strong>Interest Rate:</strong> {loan.interest}%</div>
                <div><strong>Funding Progress:</strong> {loan.fundingPercentage}%</div>
                <div>
                  <strong>End Time:</strong> {loan.endTime ? formatDate(loan.endTime) : 'Not started'}
                  {loan.endTime && (
                    <div className="time-remaining">
                      <FaClock /> 
                      <span className={getUrgencyColor(getTimeRemaining(loan.endTime).urgency)}>
                        {getTimeRemaining(loan.endTime).timeLeft}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="loan-actions">
                {loan.canCancel && (
                  <button 
                    className="action-button cancel" 
                    onClick={() => handleCancelLoan(loan)}
                  >
                    Cancel Request
                  </button>
                )}
                {loan.canAccept && (
                  <button 
                    className="action-button accept" 
                    onClick={() => handleAcceptLoan(loan)}
                  >
                    Accept Loan
                  </button>
                )}
                {loan.canRepay && (
                  <button 
                    className="action-button repay" 
                    onClick={() => handleRepayLoan(loan)}
                  >
                    Repay Loan
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No loans taken yet</p>
        )}
      </section>
      </ErrorBoundary>
    </div>
  );
};

export default WalletPage;
