import React, { useState, useEffect, useCallback } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { FaHome, FaWallet, FaTachometerAlt, FaTelegram, FaTools, FaComments, FaCog } from "react-icons/fa";
import { APP_ENV } from '../config/env';

const FloatingMenu = ({ setActiveSection }) => {
  const [isDevnet, setIsDevnet] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  useEffect(() => {
    // Check if we're on devnet environment - be more permissive to ensure visibility
    const isDev = APP_ENV === 'development';
    const isDevnetInUrl = window.location.href.includes('devnet');
    const isLocalhost = window.location.hostname === 'localhost';
    setIsDevnet(isDev || isDevnetInUrl || isLocalhost);
    
    console.log('FloatingMenu - Environment check:', {
      APP_ENV,
      isDev,
      isDevnetInUrl,
      isLocalhost,
      showingAdminButton: isDev || isDevnetInUrl || isLocalhost
    });
  }, []);

  // Memoize section selection handlers
  const handleHomeClick = useCallback(() => setActiveSection("home"), [setActiveSection]);
  const handleWalletClick = useCallback(() => setActiveSection("wallet"), [setActiveSection]);
  const handleDashboardClick = useCallback(() => setActiveSection("dashboard"), [setActiveSection]);
  const handleTelegramClick = useCallback(() => setActiveSection("telegram"), [setActiveSection]);
  const handleDextoolsClick = useCallback(() => setActiveSection("dextools"), [setActiveSection]);
  const handleFeedbackClick = useCallback(() => setActiveSection("feedback"), [setActiveSection]);
  const handleAdminClick = useCallback(() => {
    // Dispatch a global event that AdminSection listens for
    window.dispatchEvent(new Event('open-admin-modal'));
  }, []);
  return (
    <ErrorBoundary fallbackText="Navigation menu couldn't load. Please refresh the page.">
      <div className="floating-menu">
        <button onClick={handleHomeClick}>
          <FaHome /> Loans
        </button>
        <button onClick={handleWalletClick}>
          <FaWallet /> Wallet
        </button>
        <button onClick={handleDashboardClick}>
          <FaTachometerAlt  /> Dashboard
        </button>
        <button onClick={handleTelegramClick}>
          <FaTelegram /> Community
        </button>
        <button onClick={handleDextoolsClick}>
          <FaTools /> DexTools
        </button>
        <button onClick={handleFeedbackClick}>
          <FaComments /> Suggest
        </button>
        
        {/* Always show Admin button for now until we fix the environment detection */}
        <button 
          onClick={handleAdminClick}
          className="admin-init-button"
          style={{
            background: '#ff5722',
            color: 'white',
            fontWeight: 'bold',
            border: '2px solid yellow'
          }}
          title="Initialize Program (Admin Only)"
        >
          <FaCog /> Admin Init
        </button>
      </div>
    </ErrorBoundary>
  );
};

export default FloatingMenu;
