import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../assets/css/DashboardPage.css';
import ErrorBoundary from './ErrorBoundary';
import { formatDuration, getTimeRemaining, formatDate, getUrgencyColor } from '../utils/timeUtils';
import { PublicKey, Connection } from "@solana/web3.js";
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
import { FaSun, FaDollarSign, FaExpandArrowsAlt } from "react-icons/fa";
import "../assets/css/DashboardPage.css";
import borsh from "borsh";
import { useAppKitProvider, useAppKitAccount } from '@reown/appkit/react';

// Register the required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Helper function to get Solana connection
const getSolanaConnection = (walletProvider, programId) => {
  if (!walletProvider?.connection?.rpcEndpoint) return null;
  return {
    connection: new Connection(walletProvider.connection.rpcEndpoint, 'confirmed'),
    programId: new PublicKey(programId)
  };
};

// Define LoanStats class for deserializing Solana contract data
class LoanStats {
  constructor({
    total_given_native,
    total_given_dai,
    total_repaid_native,
    total_repaid_dai,
    interest_earned_native,
    interest_earned_dai,
    interest_paid_native,
    interest_paid_dai,
    active_loan_count,
    completed_loan_count,
    liquidated_loan_count
  }) {
    this.total_given_native = total_given_native;
    this.total_given_dai = total_given_dai;
    this.total_repaid_native = total_repaid_native;
    this.total_repaid_dai = total_repaid_dai;
    this.interest_earned_native = interest_earned_native;
    this.interest_earned_dai = interest_earned_dai;
    this.interest_paid_native = interest_paid_native;
    this.interest_paid_dai = interest_paid_dai;
    this.active_loan_count = active_loan_count;
    this.completed_loan_count = completed_loan_count;
    this.liquidated_loan_count = liquidated_loan_count;
  }
}

const LoanStatsSchema = new Map([
  [LoanStats, {
    kind: 'struct',
    fields: [
      ['total_given_native', 'u64'],
      ['total_given_dai', 'u64'],
      ['total_repaid_native', 'u64'],
      ['total_repaid_dai', 'u64'],
      ['interest_earned_native', 'u64'],
      ['interest_earned_dai', 'u64'],
      ['interest_paid_native', 'u64'],
      ['interest_paid_dai', 'u64'],
      ['active_loan_count', 'u64'],
      ['completed_loan_count', 'u64'],
      ['liquidated_loan_count', 'u64'],
    ],
  }],
]);

const DashboardPage = ({
  isConnected,
  solanaProvider,
  network,
  currentNetwork, // native symbol SOL
  validateContractData
}) => {
  const defaultMetrics = {
    totalFundsGiven: { native: "0", dai: "0" },
    totalRepaid: { native: "0", dai: "0" },
    interestEarned: { native: "0", dai: "0" },
    interestPaid: { native: "0", dai: "0" },
    activeLoanCount: 0,
    completedLoanCount: 0,
    liquidatedLoanCount: 0
  };

  const [expandedChart, setExpandedChart] = useState(null);
  const [protocolMetrics, setProtocolMetrics] = useState(defaultMetrics);
  const [allLoanRequests, setAllLoanRequests] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [blockchainStatus, setBlockchainStatus] = useState('Connected');
  const [validationAttempted, setValidationAttempted] = useState(false);

  const handleExpand = useCallback((chart) => {
    setExpandedChart(expandedChart === chart ? null : chart);
  }, [expandedChart]);

  // Fetch all active loan requests
  const fetchAllLoanRequests = useCallback(async () => {
    try {
      if (!solanaProvider || !solanaProvider.connection) {
        console.warn("Solana provider not available or properly connected, skipping loan requests fetch");
        return;
      }
      
      const solanaLendingService = await import('../services/solanaLendingService');
      const loanRequests = await solanaLendingService.getAllLoanRequests(solanaProvider);
      
      if (loanRequests.error) {
        console.error('Error fetching loan requests:', loanRequests.error);
      } else {
        setAllLoanRequests(loanRequests);
      }
    } catch (error) {
      console.error('Error in fetchAllLoanRequests:', error);
    }
  }, [solanaProvider]);

  // Define setDefaults helper function once early to use in the fetchProtocolMetrics
  const setDefaults = useCallback(() => {
    setProtocolMetrics(defaultMetrics);
    setDashboardLoading(false);
    setBlockchainStatus('Fallback Mode');
  }, [defaultMetrics]);

  // Fetch Metrics
  const fetchProtocolMetrics = useCallback(async () => {
    setDashboardLoading(true);
    
    try {
      const { isValid, currentContract, errorMessage } = validateContractData(network);
      if (!isValid || !currentContract) {
        console.error("Validation error: ", errorMessage || "No valid contract available");
        setDefaults();
        return;
      }
      
      try {
      setBlockchainStatus('Connected');

      if (!solanaProvider?.connection?.rpcEndpoint) {
        console.warn("Solana provider not connected properly");
        setDefaults();
        return;
      }

      const connection = new Connection(solanaProvider.connection.rpcEndpoint, 'confirmed');
      const accountInfo = await connection.getAccountInfo(new PublicKey(currentContract.address));
      if (!accountInfo) {
        console.error("No account found at given address.");
        setDefaults();
        return;
      }

      let fundingStatsData;
      try {
        fundingStatsData = borsh.deserialize(LoanStatsSchema, LoanStats, accountInfo.data);
      } catch (error) {
        console.error("Error deserializing funding stats data:", error);
        setDefaults();
        return;
      }

      if (fundingStatsData) {
        setProtocolMetrics({
          totalFundsGiven: {
            native: (parseFloat(fundingStatsData.total_given_native) / 1e9).toFixed(4) || "0",
            dai: (parseFloat(fundingStatsData.total_given_dai) / 1e6).toFixed(2) || "0",
          },
          totalRepaid: {
            native: (parseFloat(fundingStatsData.total_repaid_native) / 1e9).toFixed(4) || "0",
            dai: (parseFloat(fundingStatsData.total_repaid_dai) / 1e6).toFixed(2) || "0",
          },
          interestEarned: {
            native: (parseFloat(fundingStatsData.interest_earned_native) / 1e9).toFixed(4) || "0",
            dai: (parseFloat(fundingStatsData.interest_earned_dai) / 1e6).toFixed(2) || "0",
          },
          interestPaid: {
            native: (parseFloat(fundingStatsData.interest_paid_native) / 1e9).toFixed(4) || "0",
            dai: (parseFloat(fundingStatsData.interest_paid_dai) / 1e6).toFixed(2) || "0",
          },
          activeLoanCount: parseInt(fundingStatsData.active_loan_count) || 0,
          completedLoanCount: parseInt(fundingStatsData.completed_loan_count) || 0,
          liquidatedLoanCount: parseInt(fundingStatsData.liquidated_loan_count) || 0,
        });
      }

        setDashboardLoading(false);
      } catch (error) {
        console.error("Error fetching protocol metrics: ", error);
        setDefaults();
      }
    } catch (error) {
      console.error("Validation error:", error);
      setDefaults();
    } finally {
      // Ensure loading state is cleared even if there's an error
      setDashboardLoading(false);
    }
  }, [network, solanaProvider, validateContractData, setDefaults]);

  useEffect(() => {
    if (isConnected && solanaProvider && !validationAttempted) {
      setValidationAttempted(true);
      fetchProtocolMetrics();
      fetchAllLoanRequests();
    }
  }, [isConnected, solanaProvider, fetchProtocolMetrics, fetchAllLoanRequests, validationAttempted]);

  // Add a button to manually retry validation/fetch when needed
  const handleManualRefresh = useCallback(() => {
    if (isConnected && solanaProvider) {
      fetchProtocolMetrics();
      fetchAllLoanRequests();
    }
  }, [isConnected, solanaProvider, fetchProtocolMetrics, fetchAllLoanRequests]);

  // setDefaults function moved above to fix declaration order

  // Memoize the formatting function since it's a pure calculation
  const getFormattedValue = useMemo(() => {
    return (value, unit) => {
      // Check if value is null, undefined, or not a number
      if (value == null || isNaN(parseFloat(value))) {
        return "0"; // Fallback value for invalid input
      }

      // Formatting for SOL
      if (unit === "SOL") {
        return (parseFloat(value) / 1e9).toFixed(4); // Handle Solana units with precision
      }

      // Formatting for DAI
      if (unit === "DAI") {
        return (parseFloat(value) / 1e6).toFixed(2);
      }

      // If none of the above, return value as a string
      return value.toString();
    };
  }, []);

  return (
    <div className="dashboard-page">
      <div className="blockchain-status">
        <span className={`status-indicator ${blockchainStatus.includes("Connected") ? "connected" : "disconnected"}`}></span>
        <p>{blockchainStatus}</p>
      </div>
      {dashboardLoading ? (
        <p>Loading Key Metrics...</p>
      ) : (
        protocolMetrics && (
          <>
            <ErrorBoundary fallbackText="Protocol metrics couldn't load. Please refresh the page.">
              <div className="metrics-overview">
              {/* Combined Loans Given & Loans Repaid */}
              <section className="combined-metrics">
                <div className="dashboard-metrics-card">
                  <h3>Total Funds Given <FaSun /></h3>
                  <p className="metric-value">
                    {protocolMetrics.totalFundsGiven.native} {currentNetwork?.nativeCurrency?.symbol}
                  </p>
                  <p className="metric-value-dai">
                    {protocolMetrics.totalFundsGiven.dai} USDC
                  </p>
                </div>
                <div className="dashboard-metrics-card">
                  <h3>Total Repaid <FaSun /></h3>
                  <p className="metric-value">
                    {protocolMetrics.totalRepaid.native} {currentNetwork?.nativeCurrency?.symbol}
                  </p>
                  <p className="metric-value-dai">
                    {protocolMetrics.totalRepaid.dai} USDC
                  </p>
                </div>
              </section>

              {/* Loans Status Overview - Positioned to the right */}
              <section className="loans-status-overview">
                <div className="dashboard-metrics-card">
                  <h3>Active Loans</h3>
                  <p>{protocolMetrics.activeLoanCount}</p>
                </div>
                <div className="dashboard-metrics-card">
                  <h3>Completed Loans</h3>
                  <p>{protocolMetrics.completedLoanCount}</p>
                </div>
                <div className="dashboard-metrics-card">
                  <h3>Liquidated Loans</h3>
                  <p>{protocolMetrics.liquidatedLoanCount}</p>
                </div>
                <div className="dashboard-metrics-card">
                  <h3>Interest Earned <FaSun /></h3>
                  <p className="metric-value">
                    {protocolMetrics.interestEarned.native} {currentNetwork?.nativeCurrency?.symbol}
                  </p>
                  <p className="metric-value-dai">
                    {protocolMetrics.interestEarned.dai} USDC
                  </p>
                </div>
                <div className="dashboard-metrics-card">
                  <h3>Interest Paid <FaSun /></h3>
                  <p className="metric-value">
                    {protocolMetrics.interestPaid.native} {currentNetwork?.nativeCurrency?.symbol}
                  </p>
                  <p className="metric-value-dai">
                    {protocolMetrics.interestPaid.dai} USDC
                  </p>
                </div>
              </section>
            </div>
            </ErrorBoundary>

            {/* Graphs Section */}
            <ErrorBoundary fallbackText="Performance charts couldn't load. Please refresh the page.">
            <section className="visual-section">
              <div className="visual-container">
                <div className={`chart-container ${expandedChart === 'loansGiven' ? 'expanded' : ''}`}>
                  <FaExpandArrowsAlt className="maximize-icon" onClick={() => handleExpand('loansGiven')} />
                  {protocolMetrics.totalFundsGiven && (
                    <Line
                      data={{
                        labels: ['Total Native Given', 'Total DAI Given'],
                        datasets: [
                          {
                            label: 'Loans Given Metrics',
                            data: [protocolMetrics.totalFundsGiven.native, protocolMetrics.totalFundsGiven.dai],
                            backgroundColor: ['#36A2EB', '#FFCE56'],
                            borderColor: ['#36A2EB'],
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: {
                            labels: {
                              color: '#b3b3b3', // Lighter legend text color
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                          tooltip: {
                            titleColor: '#b3b3b3', // Lighter tooltip title color
                            bodyColor: '#b3b3b3', // Lighter tooltip body color
                            footerColor: '#b3b3b3', // Lighter tooltip footer color
                            titleFont: {
                              family: 'Comic Sans MS', // Set font family
                            },
                            bodyFont: {
                              family: 'Comic Sans MS', // Set font family
                            },
                            footerFont: {
                              family: 'Comic Sans MS', // Set font family
                            },
                          },
                        },
                        scales: {
                          x: {
                            ticks: {
                              color: '#b3b3b3', // Lighter x-axis labels color
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                          y: {
                            ticks: {
                              color: '#b3b3b3', // Lighter y-axis labels color
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                        },
                      }}
                    />
                  )}
                </div>
                <div className={`chart-container ${expandedChart === 'interestEarned' ? 'expanded' : ''}`}>
                  <FaExpandArrowsAlt className="maximize-icon" onClick={() => handleExpand('interestEarned')} />
                  {protocolMetrics.interestEarned && (
                    <Pie
                      data={{
                        labels: ['Interest Earned Native', 'Interest Earned DAI'],
                        datasets: [
                          {
                            label: 'Interest Earned Distribution',
                            data: [protocolMetrics.interestEarned.native, protocolMetrics.interestEarned.dai],
                            backgroundColor: ['#4CAF50', '#FF0000'],
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: {
                            labels: {
                              color: '#b3b3b3', // Lighter legend text color
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                          tooltip: {
                            titleColor: '#b3b3b3',
                            bodyColor: '#b3b3b3',
                            footerColor: '#b3b3b3',
                            titleFont: {
                              family: 'Comic Sans MS',
                            },
                            bodyFont: {
                              family: 'Comic Sans MS',
                            },
                            footerFont: {
                              family: 'Comic Sans MS',
                            },
                          },
                        },
                      }}
                    />
                  )}
                </div>
                <div className={`chart-container ${expandedChart === 'repaymentMetrics' ? 'expanded' : ''}`}>
                  <FaExpandArrowsAlt className="maximize-icon" onClick={() => handleExpand('repaymentMetrics')} />
                  {(protocolMetrics.totalRepaid && protocolMetrics.liquidatedLoanCount != null) && (
                    <Bar
                      data={{
                        labels: [
                          `Total Repaid ${currentNetwork?.nativeCurrency?.symbol}`,
                          'Total Repaid USDC',
                          'Total Rekt'
                        ],
                        datasets: [
                          {
                            label: 'Repayment & Rekt Metrics',
                            data: [
                              protocolMetrics.totalRepaid.native,
                              protocolMetrics.totalRepaid.dai,
                              protocolMetrics.liquidatedLoanCount
                            ],
                            backgroundColor: ['#36A2EB', '#FFCE56', '#FF6F61'],
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: {
                            labels: {
                              color: '#b3b3b3', // Lighter legend text color
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                          tooltip: {
                            titleColor: '#b3b3b3',
                            bodyColor: '#b3b3b3',
                            footerColor: '#b3b3b3',
                            titleFont: {
                              family: 'Comic Sans MS',
                            },
                            bodyFont: {
                              family: 'Comic Sans MS',
                            },
                            footerFont: {
                              family: 'Comic Sans MS',
                            },
                          },
                        },
                        scales: {
                          x: {
                            ticks: {
                              color: '#b3b3b3',
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                          y: {
                            ticks: {
                              color: '#b3b3b3',
                              font: {
                                family: 'Comic Sans MS', // Set font family
                              },
                            },
                          },
                        },
                      }}
                    />
                  )}
                </div>
              </div>
            </section>
            </ErrorBoundary>

            {/* Active Loan Requests Section */}
            <ErrorBoundary fallbackText="Active loan requests couldn't load. Please refresh the page.">
            <section className="dashboard-section active-loans-section">
              <h2>Active Loan Requests</h2>
              {allLoanRequests.length > 0 ? (
                <div className="loan-requests-grid">
                  {allLoanRequests.map((loan, index) => (
                    <div key={index} className="loan-request-card">
                      <div className="loan-request-header">
                        <span className="loan-status">Status: {loan.status}</span>
                        <span className="funding-progress">{loan.fundingPercentage || 0}% Funded</span>
                      </div>
                      <div className="loan-request-body">
                        <div className="loan-detail">
                          <span className="detail-label">Borrower:</span>
                          <span className="detail-value">{loan.borrower.substring(0, 8)}...</span>
                        </div>
                        <div className="loan-detail">
                          <span className="detail-label">Collateral:</span>
                          <span className="detail-value">{loan.collateralAmount} {loan.collateralToken}</span>
                        </div>
                        <div className="loan-detail">
                          <span className="detail-label">Loan Amount:</span>
                          <span className="detail-value">{getFormattedValue(loan.loanAmount, loan.loanToken)}</span>
                        </div>
                        <div className="loan-detail">
                          <span className="detail-label">Interest:</span>
                          <span className="detail-value">{loan.interest}%</span>
                        </div>
                        <div className="loan-detail">
                          <span className="detail-label">Duration:</span>
                          <span className="detail-value duration-display">{formatDuration(loan.durationSeconds || loan.duration * 24 * 3600)}</span>
                        </div>
                        <div className="loan-detail">
                          <span className="detail-label">Time Left:</span>
                          <span className={`detail-value expiry-display ${getUrgencyColor(getTimeRemaining(loan.expiryTime).urgency)}`}>
                            {getTimeRemaining(loan.expiryTime).timeLeft}
                          </span>
                        </div>
                        <div className="loan-detail">
                          <span className="detail-label">Expires:</span>
                          <span className="detail-value">{formatDate(loan.expiryTime)}</span>
                        </div>
                      </div>
                      {isConnected && (
                        <div className="loan-request-footer">
                          <button 
                            className="fund-button"
                            onClick={() => window.location.href = `/fund/${loan.id}`}
                          >
                            Fund This Loan
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-loans-message">No active loan requests available at this time.</p>
              )}
            </section>
            </ErrorBoundary>
          </>
        )
      )}
    </div>
  );
};

export default DashboardPage;
