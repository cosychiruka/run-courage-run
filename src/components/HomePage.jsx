import React, { useState, useEffect, useMemo } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { FaSearch, FaDollarSign, FaScroll, FaPaw, FaLightbulb, FaBroadcastTower, FaTv, FaNewspaper, FaExchangeAlt, FaBookmark, FaExternalLinkAlt, FaClock } from "react-icons/fa";
import { GiTwoCoins } from "react-icons/gi"; // For SOL icon
import { formatDuration, getTimeRemaining, formatDate, getUrgencyColor } from '../utils/timeUtils';

const HomePage = ({
    showLoanRequestPopup,
    toggleHelperSection,
    contractAddress,
    handleContractAddressSearch,
    handleFilterChange,
    filterLoans,
    filterType,
    loanList,
    helperVisible,
    fundingStats,
    isConnected,
    currentNetwork,
    CryptoTv,
    showNews,
  }) => {
      
    // Memoized helper functions for value formatting
    // Helper function to format USDC values (6 decimals)
    const formatUSDC = useMemo(() => {
        return (value) => {
            if (!value || isNaN(value)) return "0"; // Default to "0" if value is undefined or NaN
            try {
              return (parseFloat(value) / 1e6).toFixed(2); // USDC uses 6 decimals
            } catch {
              return "0";
            }
        };
    }, []);

    // Helper function to format SOL values
    const formatSOL = useMemo(() => {
        return (value) => {
            if (!value || isNaN(value)) return "0"; // Default to "0" if value is undefined or NaN
            return (parseFloat(value) / 1e9).toFixed(4); // Display up to 4 decimal places
        };
    }, []);

    // Determine the correct unit and format function
    const getFormattedValue = useMemo(() => {
        return (value, unit) => {
            if (!value || isNaN(value)) return "0"; // Default to "0" if value is undefined or NaN
            if (unit === "SOL") {
              return formatSOL(value);
            } else if (unit === "USDC") {
              return formatUSDC(value);
            }
            return value; // Default fallback
        };
    }, [formatSOL, formatUSDC]);

    // Helper function to format collateral token amounts
    const getCollateralAmount = useMemo(() => {
        return (value, tokenDecimals = 9) => {
            if (!value || isNaN(value)) return "0"; // Default to "0" if value is undefined or NaN
            // Most Solana tokens use 9 decimals, but some may use different decimals
            return (parseFloat(value) / Math.pow(10, tokenDecimals)).toFixed(4);
        };
    }, []);

    // Helper function to render stat items - memoized since it's a pure render function
    const renderStatItem = useMemo(() => {
        return (icon, label, value) => (
            <div className="stat-item">
            {icon}
            <div className="stat-info">
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
            </div>
        );
    }, []);

    // Helper function to calculate total value in SOL - memoized with fundingStats dependency
    const calculateTotalInNativeCurrency = useMemo(() => {
        return () => {
            const totalGiven = parseFloat(getFormattedValue(fundingStats?.totalGiven, "SOL")) || 0;
            const totalReceived = parseFloat(getFormattedValue(fundingStats?.totalReceived, "SOL")) || 0;
            return (totalGiven + totalReceived).toFixed(4);
        };
    }, [fundingStats, getFormattedValue]);

    // Helper function to calculate total value in USDC ($) - memoized with fundingStats dependency
    const calculateTotalInUSDC = useMemo(() => {
        return () => {
            const totalGivenUSDC = parseFloat(fundingStats?.totalGivenUSDC) || 0;
            const totalReceivedUSDC = parseFloat(fundingStats?.totalReceivedUSDC) || 0;
            return (totalGivenUSDC + totalReceivedUSDC).toFixed(2);
        };
    }, [fundingStats]);

    // Helper function to get the Solana block explorer URL - memoized since it's a pure function
    const getExplorerUrl = useMemo(() => {
        return (address) => {
            return `https://solscan.io/account/${address}`;
        };
    }, []);

    // Tab state to track the selected tab in the Helper Section
    const [activeTab, setActiveTab] = useState(isConnected ? "fundingStats" : "tips");

    // Update active tab when the connection status changes
    useEffect(() => {
        if (isConnected) {
          setActiveTab("fundingStats");
        } else {
          setActiveTab("tips");
        }
    }, [isConnected]);

    // Trigger CryptoTv only when "tips" tab is active
    useEffect(() => {
        if (activeTab === "tips" && typeof CryptoTv === "function") {
            CryptoTv();
        }
    }, [activeTab, CryptoTv]);

  return (
    <div>
      {/* Request Loan and Toggle Helper Icons */}
      <div className="icon-with-text request-loan" onClick={showLoanRequestPopup} style={{ cursor: "pointer" }}>
        <FaScroll className="request-loan-icon" style={{ marginRight: "5px" }} />
        <span>Beg?</span>
      </div>
      <div className="icon-with-text toggle-helper" onClick={toggleHelperSection} style={{ cursor: "pointer" }}>
        <FaPaw className="toggle-helper-icon" style={{ marginRight: "5px" }} />
        <span>Info</span>
      </div>

      {/* Loan and Helper Section */}
      <section id="loan-and-bone-center">
        <ErrorBoundary fallbackText="Loan listing couldn't load. Please refresh the page.">
        <div id="loan-list-section">
          <h2>Explore...</h2>
          <div className="filter-section">
            {/* Search Bar */}
            <div className="search-bar">
              <input
                type="text"
                className="search-input"
                placeholder="filter address"
                value={contractAddress}
                onChange={handleContractAddressSearch}
              />
              <button className="search-button" onClick={() => handleFilterChange("all")}>
                <FaSearch />
              </button>
            </div>

            {/* Filter Buttons */}
            <div className="filter-options">
              <label>
                <input
                  type="radio"
                  value="all"
                  checked={filterType === "all"}
                  onChange={() => handleFilterChange("all")}
                />
                All Loans
              </label>
              <label>
                <input
                  type="radio"
                  value="loansGiven"
                  checked={filterType === "loansGiven"}
                  onChange={() => handleFilterChange("loansGiven")}
                />
                Approved
              </label>
              <label>
                <input
                  type="radio"
                  value="myLoans"
                  checked={filterType === "myLoans"}
                  onChange={() => handleFilterChange("myLoans")}
                />
                My Loans
              </label>
            </div>
          </div>

          {/* Loan List */}
          <div id="loan-list">
            {loanList.length > 0 ? (
              loanList.map((loan, index) => (
                <div className="loan-strip" key={index}>
                  {/* Collateral Token Icon */}
                  <div className="loan-icon">
                    <img src="/path/to/meme-coin-placeholder.svg" alt="Collateral Token" className="collateral-token-icon" />
                  </div>

                  {/* Collateral Token Symbol and Address */}
                  <div className="collateral-address">
                    <div className="collateral-symbol">
                      <strong>{loan.collateralSymbol}</strong>
                    </div>
                    <a
                      href={getExplorerUrl(loan.collateralToken)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="collateral-link"
                    >
                      {loan.collateralToken && loan.collateralToken.substring(0, 6)}...{loan.collateralToken && loan.collateralToken.substring(loan.collateralToken.length - 4)}
                      <FaExternalLinkAlt className="external-link-icon" />
                    </a>
                  </div>

                  {/* Collateral Amount */}
                  <div className="collateral-amount">
                    <strong>{getCollateralAmount(loan.collateralAmount, currentNetwork.unit)}</strong> Tokens
                  </div>

                  {/* Loan Amount and Token */}
                  <div className="loan-amount-section">
                    <div className="loan-token">
                      {loan.loanToken === "SOL" ? (
                        <GiTwoCoins className="token-icon-small" />
                      ) : loan.loanToken === "DAI" ? (
                        <FaDollarSign className="token-icon-small" />
                      ) : (
                        <FaEthereum className="token-icon-small" />
                      )}
                      <span>{loan.loanToken}</span>
                    </div>
                    <div className="loan-amount">
                      {getFormattedValue(loan.loanAmount, loan.loanToken)} {loan.loanToken}
                    </div>
                  </div>

                  {/* Interest Rate Section */}
                  <div className="interest-rate-section">
                    <span>Interest Rate: {loan.interestRate}%</span>
                    <span>
                      ~ {getFormattedValue(loan.loanAmount * (1 + loan.interestRate / 100), loan.loanToken)} {loan.loanToken}
                    </span>
                  </div>

                  {/* End Date and Time Remaining */}
                  <div className="end-date-section">
                    <div>
                      <span>End Date:</span>
                      <span>{formatDate(loan.endTime)}</span>
                    </div>
                    <div className="time-remaining">
                      <FaClock /> 
                      <span className={getUrgencyColor(getTimeRemaining(loan.endTime).urgency)}>
                        {getTimeRemaining(loan.endTime).timeLeft}
                      </span>
                    </div>
                  </div>

                  {/* Reserved Lender */}
                  <div className="reserved-lender-section">
                    <span>Reserved: {loan.reservedLender}</span>
                  </div>

                  {/* Repaid Status */}
                  <div className="repaid-status">
                    {loan.isRepaid ? (
                      <span className="repaid-indicator">✔️</span>
                    ) : (
                      <span className="not-repaid-indicator">❌</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="loan-actions">
                    <button className="bookmark-button">
                      <FaBookmark />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p>No loans available</p>
            )}
          </div>
        </div>
        </ErrorBoundary>

        {/* Helper Section */}
        <ErrorBoundary fallbackText="Helper section couldn't load. Please refresh the page.">
        <div id="helper-section">
          {/* Tabs for Tips and Funding Stats */}
          <div className="helper-tabs">
            {isConnected && (
              <button
                className={`tab ${activeTab === "fundingStats" ? "active" : ""}`}
                onClick={() => setActiveTab("fundingStats")}
              >
                Account
              </button>
            )}

            {/* Switch icon in between the tabs */}
            <div className="switch-icon">
              <FaExchangeAlt className="switch-icon-style" />
            </div>

            <button
              className={`tab ${activeTab === "tips" ? "active" : ""}`}
              onClick={() => setActiveTab("tips")}
            >
              <FaBroadcastTower /> Station
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === "fundingStats" && isConnected && (
              <div>
                <small className="funding-stats-heading">Your wallet stats</small>
                <div className="funding-stats-content">
                  <div className="funding-stats-grid">
                    {renderStatItem(
                      <GiTwoCoins className="stat-icon" />,
                      "Total Given (SOL)",
                      getFormattedValue(fundingStats?.totalGiven, "SOL")
                    )}
                    {renderStatItem(
                      <FaDollarSign className="stat-icon" />,
                      "Total Given (USDC)",
                      fundingStats?.totalGivenUSDC || "0"
                    )}
                    {renderStatItem(
                      <GiTwoCoins className="stat-icon" />,
                      "Total Received (SOL)",
                      getFormattedValue(fundingStats?.totalReceived, "SOL")
                    )}
                    {renderStatItem(
                      <FaDollarSign className="stat-icon" />,
                      "Total Received (USDC)",
                      fundingStats?.totalReceivedUSDC || "0"
                    )}
                    {/* Updated Combined Total Bar */}
                    <div className="stat-item total">
                      <div className="stat-info">
                        <strong>{calculateTotalInNativeCurrency()} SOL</strong>
                      </div>
                      <div className="stat-info">
                        <strong>{calculateTotalInUSDC()} USDC</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tips" && (
              <div>
                <div className="tips-content">
                  <main>
                    <div className="tv-body">
                    <div id="introText" className="intro-text hide">
                      <h1>
                        <span className="TVtitle">Meet Courage</span>
                        <span className="TVtitle">the Trench</span>
                        <span className="TVtitle">Doggo <FaPaw className="toggle-helper-icon" style={{ marginLeft: "5px" }} /></span>
                      </h1>
                    </div>

                      <div className="screen-container">
                        <canvas id="static" width="380" height="280"></canvas>
                        <img id="displayed" className="hide" src="" alt="Nothing" width="380" height="280"></img>
                        <video id="displayedVideo" className="hide" controls></video>
                        <div className="screen">
                          <div className="screen-frame"></div>
                          <div className="screen-inset"></div>
                        </div>
                      </div>
                      <div className="logo-badge">
                        <div className="logo-text">Bush</div>
                      </div>
                      <div className="controls">
                        <div className="panel">
                          <div className="screw"></div>
                          <div className="dial">
                            <button id="channel" className="dial-label pristine">Channel</button>
                          </div>
                        </div>
                        <div className="vents">
                          <div className="vent"></div>
                          <div className="vent"></div>
                          <div className="vent"></div>
                          <div className="vent"></div>
                          <div className="vent"></div>
                          <div className="vent"></div>
                        </div>
                        <div className="panel">
                          <div className="screw"></div>
                          <div className="dial">
                            <button id="trenchnews" className="dial-label pristine">Trenches</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="legs">
                      <div className="leg"></div>
                      <div className="leg"></div>
                    </div>
                  </main>
                </div>
              </div>
            )}
          </div>
        </div>
        </ErrorBoundary>
      </section>
    </div>
  );
};

export default HomePage;
