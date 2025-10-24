import React, { useState, useEffect, useCallback } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { fetchSolanaBalance } from '../services/walletService';
import { FaCoins, FaDollarSign, FaSpinner } from 'react-icons/fa';
import '../assets/css/SolanaBalanceDisplay.css';

/**
 * Component to display Solana account balance
 * @param {Object} props - Component props
 * @param {string} props.address - Solana account address
 * @param {boolean} props.showUsd - Whether to show USD value
 * @param {string} props.className - Additional CSS classes
 */
const SolanaBalanceDisplay = ({ address, showUsd = true, className = '' }) => {
  const [balanceInfo, setBalanceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize the fetchBalance function to prevent unnecessary re-creation on each render
  const fetchBalance = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }
    
    try {
      // Skip fetching if window.solana is not available (provider disconnected)
      if (typeof window !== 'undefined' && !window.solana) {
        console.log('Solana provider not available, skipping balance update');
        return;
      }
      
      setLoading(true);
      setError(null);
      const info = await fetchSolanaBalance(address);
      setBalanceInfo(info);
    } catch (err) {
      console.error('Error fetching Solana balance:', err);
      setError('Failed to load balance');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    // Initial fetch
    fetchBalance();

    // Refresh balance every 30 seconds
    const intervalId = setInterval(fetchBalance, 30000);
    return () => clearInterval(intervalId);
  }, [fetchBalance]);

  if (loading) {
    return (
      <div className={`solana-balance-display loading ${className}`}>
        <FaSpinner className="fa-spin" /> Loading balance...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`solana-balance-display error ${className}`}>
        <span className="error-message">{error}</span>
      </div>
    );
  }

  if (!balanceInfo) {
    return (
      <div className={`solana-balance-display empty ${className}`}>
        <span>No balance data</span>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackText="Solana balance couldn't load properly. Please refresh the page.">
      <div className={`solana-balance-display ${className}`}>
        <div className="balance-row">
          <FaCoins className="balance-icon" />
          <span className="balance-amount">{balanceInfo.balanceFormatted}</span>
        </div>
        
        {showUsd && (
          <div className="balance-row usd">
            <FaDollarSign className="balance-icon" />
            <span className="balance-amount">{balanceInfo.usdBalanceFormatted}</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default SolanaBalanceDisplay;
