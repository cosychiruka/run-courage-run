// Import the required modules
import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from 'react-dom';
import { createAppKit, useAppKitTheme, useAppKitProvider, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana } from '@reown/appkit/networks';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as borsh from 'borsh';
import Swal from "sweetalert2";
import "./App.css";
import "./styles/LoanForm.css";
import { FaHome, FaSun, FaDollarSign, FaBookmark, FaExternalLinkAlt, FaCoins, FaMoneyBillWave, FaFileInvoiceDollar, FaHandHoldingUsd, FaPercent, FaCalendarAlt, FaRobot } from "react-icons/fa";
import { GiTwoCoins } from "react-icons/gi";
import TrendingTokens from './components/TrendingTokens';
import FloatingMenu from "./components/FloatingMenu";
import HomePage from "./components/HomePage";
import WalletPage from "./components/WalletPage";
import TelegramPage from "./components/TelegramPage";
import DextoolsPage from "./components/DextoolsPage";
import FeedbackPage from "./components/FeedbackPage";
import DashboardPage from "./components/DashboardPage";
import CourageRunning from "./scenes/CourageRunning";
import CourageScared from "./scenes/CourageScared";
import CourageExcited from "./scenes/CourageExcited";
import Newspaper from './components/Newspaper';
import Trenchbot from './components/Trenchbot';
import ErrorBoundary from './components/ErrorBoundary';
import AdminSection from './components/AdminSection';

// APIs
import { getProgramAccounts, getSolanaConnection } from './services/quicknodeService';
import { MAINNET_SOLANA_RPC_URL, DEVNET_SOLANA_RPC_URL, APP_ENV, envLog } from './config/env';
import { contractData } from './config/contractData';
import { fetchSolanaBalance, isSolanaAddress } from './services/walletService';
import { verifyProgramExists } from './utils/solanaProgramUtils';

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// 1. Get projectId
const projectId = '188337722d39befd5d7802d864830377';

// 2. Set Solana as the only network with dynamic RPC URL based on environment
// Determine if we're using devnet or mainnet based on environment configuration
const isDevnet = APP_ENV === 'development' || import.meta.env.VITE_SOLANA_NETWORK === 'devnet';
const solanaRpcUrl = isDevnet ? DEVNET_SOLANA_RPC_URL : MAINNET_SOLANA_RPC_URL;
const currentNetwork = isDevnet ? 'devnet' : 'mainnet-beta';
const solanaContractAddress = contractData[currentNetwork]?.address || '';

// Create custom Solana network with our specific RPC URL
const networks = [
  {
    ...solana, // Keep all the base solana network config
    rpcUrl: solanaRpcUrl, // Override with our environment-specific RPC URL
    id: solana.id, // Ensure we keep the correct network ID
  }
];

// Log the active network configuration for debugging
envLog('Using Solana network:', isDevnet ? 'devnet' : 'mainnet-beta', 'with RPC URL:', solanaRpcUrl);

// validateContractData moved to be merged with the one at line 190

// Add a note about network availability
const NETWORK_NOTES = {
  solana: "Fully functional - Solana network is fully supported"
};

// 3. Create a metadata object - optional
const metadata = {
  name: 'Courage the Trench Doggo',
  description: 'Meme Loans',
  url: 'https://courage-meme-lending.com',
  icons: ['https://avatars.courage.com/']
};

// 4. Create an AppKit instance with Solana
createAppKit({
  defaultChain: 'solana',
  adapters: [
    new SolanaAdapter({  // Solana Adapter for Solana networks
      wallets: [
        new PhantomWalletAdapter()
      ]
    })
  ],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#eb57c1', // Courage's pink color for buttons, icons, etc.
    '--w3m-color-mix': '#eb57c1', // pink
    '--w3m-background-color': '#222',
    '--w3m-text-color': '#ffffff',
    '--w3m-font-family': 'Comic Sans MS, Arial, sans-serif',
    '--w3m-font-size-master': '11px',
    '--w3m-balance-font-size': '10px',
  }
});

// Contract addresses and ABIs for each network - imported from './config/contractData'

// Helper function to get current contract data based on network
const getCurrentContractData = (network) => {
  return contractData[network] || null;
};

// Helper function to validate contract data and verify program exists
const validateContractData = async (network) => {
  const currentContract = getCurrentContractData(network);

  if (!currentContract || !currentContract.address || currentContract.address.includes('YOUR_')) {
    const networkName = network || 'the current network';
    const errorMessage = `Contract address for ${networkName} is not configured. Please check your .env file.`;
    return {
      isValid: false,
      currentContract: null,
      errorMessage: errorMessage,
      programVerified: false
    };
  }

  if (!isSolanaAddress(currentContract.address)) {
    const networkName = network || 'the current network';
    const errorMessage = `Invalid Solana contract address for ${networkName}: ${currentContract.address}`;
    console.error(errorMessage);
    
    Swal.fire({
      icon: 'error',
      title: 'Invalid Address',
      text: errorMessage,
    });

    return {
      isValid: false,
      currentContract: null,
      errorMessage: errorMessage,
      programVerified: false
    };
  }

  // Verify if the program exists on the blockchain
  try {
    console.log(`Verifying program existence: ${currentContract.address}`);
    const verificationResult = await verifyProgramExists(currentContract.address);
    
    if (!verificationResult.exists) {
      const networkName = network || 'the current network';
      const errorMessage = `Program not found on ${networkName}: ${currentContract.address}. ${verificationResult.error || ''}`;
      console.error(errorMessage);
      
      // Don't show error dialog here - just return the error info
      // We'll let the calling function decide how to handle this
      return {
        isValid: true, // Address format is valid
        currentContract: currentContract,
        errorMessage: errorMessage,
        programVerified: false,
        verificationResult
      };
    }
    
    console.log(`Program verified successfully:`, verificationResult);
    return {
      isValid: true,
      currentContract: currentContract,
      errorMessage: '',
      programVerified: true,
      verificationResult
    };
  } catch (error) {
    console.error(`Error verifying program: ${error.message}`);
    return {
      isValid: true, // Address format is still valid
      currentContract: currentContract,
      errorMessage: `Unable to verify program: ${error.message}`,
      programVerified: false
    };
  }
};



export function AppKit() {
  const [currentSolanaNetwork, setCurrentSolanaNetwork] = useState('devnet'); // 'devnet' or 'mainnet-beta'
  const [modal, setModal] = useState(null); // need this to detect wallet modal changes: account change, network change etc
  const [showTrenchbot, setShowTrenchbot] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  
  // Use Solana provider with enhanced debugging and robust Phantom detection
  const appkitProviderResult = useAppKitProvider('solana');
  
  // Track direct Phantom detection separately from AppKit
  const [directPhantomDetected, setDirectPhantomDetected] = useState(false);
  
  // Enhanced provider extraction with explicit Phantom detection
  const solanaProvider = useMemo(() => {
    // First check AppKit provider
    if (appkitProviderResult?.provider) {
      console.log('Using AppKit Solana provider');
      return appkitProviderResult.provider;
    }
    
    // Then check for direct Phantom extension
    if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
      console.log('Direct Phantom wallet extension detected');
      return window.solana;
    }
    
    // No provider available
    return null;
  }, [appkitProviderResult]);
  
  // Handle Phantom detection in a separate effect to avoid render loops
  useEffect(() => {
    // Check for direct Phantom extension
    const isPhantomAvailable = typeof window !== 'undefined' && 
                            window.solana && 
                            window.solana.isPhantom;
                            
    setDirectPhantomDetected(isPhantomAvailable);
  }, []);
  
  // Log provider info to diagnose connection issues
  useEffect(() => {
    console.log('Wallet provider state:', { 
      appkitAvailable: !!appkitProviderResult?.provider,
      directPhantomDetected: directPhantomDetected,
      finalProvider: !!solanaProvider
    });
    
    // Auto-detect if Phantom is installed but not captured by AppKit
    if (!appkitProviderResult?.provider && typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
      console.log('Found Phantom extension but not captured by AppKit - will use direct integration');
      setDirectPhantomDetected(true);
    }
  }, [appkitProviderResult, solanaProvider, directPhantomDetected]);
  
  
  
  // Get account and network info with enhanced logging
  const accountInfo = useAppKitAccount() || {};
  const { address, isConnected, caipAddress, status } = accountInfo;
  
  // Add debugging for account status
  useEffect(() => {
    console.log('Wallet connection status:', { 
      address, 
      isConnected, 
      status,
      // Check if provider's publicKey is available when account claims to be connected
      providerAvailable: isConnected && solanaProvider ? !!solanaProvider.publicKey : 'N/A'
    });
  }, [address, isConnected, status, solanaProvider]);
  
  const networkInfo = useAppKitNetwork() || {};
  const { network } = networkInfo;
  
  // Add network debugging
  useEffect(() => {
    console.log('Network info:', network ? 
      { available: true, name: network.name, chainId: network.chainId } : 
      { available: false });
  }, [network]);
  
  // Set default network to Solana on component mount
  useEffect(() => {
    console.log('Setting Solana network...');
    setCurrentNetwork({ unit: 'SOL', currencySymbol: '◎' });
  }, []);
  
  // Reset wallet connecting state when connection status changes
  useEffect(() => {
    if (isConnected) {
      // If wallet is connected, ensure connecting state is reset
      setIsWalletConnecting(false);
    }
  }, [isConnected]);

  const { themeMode, themeVariables } = useAppKitTheme();
  const [userAddress, setUserAddress] = useState(null);
  const [loanList, setLoanList] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [filterAddress, setContractAddress] = useState("");
  const [scene, setScene] = useState("");
  const [helperVisible, setHelperVisible] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fundingStats, setFundingStats] = useState({
    totalGiven: "0",
    totalReceived: "0",
    totalGivenUSDC: "0",
    totalReceivedUSDC: "0",
    unit: "SOL"
  });
  const [currentNetwork, setCurrentNetwork] = useState({
    unit: 'SOL',
    currencySymbol: '◎'
  });
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Initialize modal state for wallet connection UI
  useEffect(() => {
    // Set modal state for Solana wallet connections
    setModal({ ready: true });
  }, []);

  // Memoize resize handler to prevent recreation on each render
  const handleResize = useCallback(() => {
    setIsSmallScreen(window.innerWidth <= 768); // Tablet breakpoint
  }, []);
  
  useEffect(() => {
    // Add event listener and check initial size
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    // Cleanup event listener on component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]); // Include memoized handler in dependencies

  // Memoize scene update function to prevent recreation on each render
  const updateScene = useCallback(() => {
    const currentTime = new Date().getHours();
    const nightThemeH1 = document.querySelector("h1.couragesign");
    let currentScene = "";

    if (currentTime >= 12 && currentTime < 18) {
      currentScene = "noon";
      document.body.className = "noon";
    } else if (currentTime >= 18 && currentTime < 24) {
      currentScene = "evening";
      document.body.className = "evening";
    } else if (currentTime >= 0 && currentTime < 6) {
      currentScene = "midnight";
      document.body.className = "midnight";
    } else if (currentTime >= 6 && currentTime < 12) {
      currentScene = "sunrise";
      document.body.className = "sunrise";
    }
    setScene(currentScene);
    const isDaytime = currentTime >= 6 && currentTime < 18;
    if (nightThemeH1) {
      if (isDaytime) {
        nightThemeH1.classList.remove("typo");
      } else {          
        nightThemeH1.classList.add("typo");
      }
    }
  }, []);
  
  useEffect(() => {
    updateScene(); // Initial scene setup
    
    // Set up an interval to check and update the scene every hour
    const intervalId = setInterval(updateScene, 60 * 60 * 1000); // Every hour
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [updateScene]); // Include memoized handler in dependencies

  const handleConnect = useCallback(async () => {
    if (isWalletConnecting) return;
    
    setIsWalletConnecting(true);
    try {
      // First check if we have direct Phantom detection
      if (directPhantomDetected && window.solana && window.solana.isPhantom) {
        console.log('Using direct Phantom connection...');
        
        try {
          // Request connection directly from Phantom extension
          await window.solana.connect();
          const publicKey = window.solana.publicKey;
          
          if (publicKey) {
            console.log('Successfully connected to Phantom directly:', publicKey.toString());
            
            // Update necessary state after successful direct connection
            setUserAddress(publicKey.toString());
            setCurrentNetwork({ unit: 'SOL', currencySymbol: '◎' });
            
            // Skip modal as we're directly connected
            setIsWalletConnecting(false);
            return;
          }
        } catch (phantomError) {
          console.error('Error connecting directly to Phantom:', phantomError);
          // If direct connection fails, fall back to modal approach
        }
      }
      
      // Fallback to AppKit modal if direct connection failed or isn't available
      console.log('Using AppKit wallet modal...');
      const modal = await web3ModalRef.current?.openModal({
        chains: ['solana'],
        projectId: projectId,
        theme: 'dark',
        accentColor: 'pink',
        walletImages: {
          phantom: 'https://cryptologos.cc/logos/phantom-crypto-logo.png'
        },
        // Add explicit wallet filters to ensure Phantom is available
        explorerRecommendedWalletIds: [
          'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // Phantom
          'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18'  // Phantom mobile
        ],
        explorerExcludedWalletIds: [] // Don't exclude any wallets
      });
      
      setModal(modal);
      console.log('Wallet modal opened, waiting for connection...');
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setIsWalletConnecting(false);
      
      // Show user-friendly error message
      Swal.fire({
        title: 'Connection Error',
        text: 'Failed to connect wallet. Please try again or use a different wallet.',
        icon: 'error',
        confirmButtonColor: '#eb57c1'
      });
    }
  }, [isWalletConnecting, directPhantomDetected, setUserAddress]);

  const initializeSolanaProvider = useCallback(async () => {
    try {
      // Enhanced connection checks with direct Phantom support
      let isReallyConnected = isConnected && !!address;
      
      // For direct Phantom connections
      if (directPhantomDetected && window.solana && window.solana.isPhantom && window.solana.isConnected) {
        isReallyConnected = true;
      }
      
      if (!isReallyConnected) {
        console.log("Wallet shows as not connected or no address available");
        return;
      }

      console.log("Attempting to initialize Solana provider. Status:", { isConnected, address, directPhantomDetected });
      
      // Comprehensive provider check
      if (!solanaProvider && !directPhantomDetected) {
        console.log("No Solana provider available - check if Phantom extension is installed");
        return;
      }
      
      // Determine current wallet address
      let currentAddress = null;
      
      // For direct Phantom connection
      if (directPhantomDetected && window.solana && window.solana.isPhantom && window.solana.publicKey) {
        currentAddress = window.solana.publicKey.toString();
      } 
      // For AppKit connection
      else if (address) {
        currentAddress = address;
      }
      
      // Check if we already have the provider initialized with this address
      if (userAddress && userAddress === currentAddress) {
        console.log("Solana provider already initialized with address:", userAddress);
        return;
      }
      
      // Extract public key with comprehensive fallbacks
      let solanaPublicKey = null;
      
      // Direct extraction logic with expanded provider support
      if (directPhantomDetected && window.solana && window.solana.publicKey) {
        // Direct Phantom extension
        solanaPublicKey = window.solana.publicKey;
      } else if (solanaProvider?.publicKey) {
        // Standard provider publicKey
        solanaPublicKey = solanaProvider.publicKey;
      } else if (solanaProvider?.address) {
        // Some providers use address instead of publicKey
        solanaPublicKey = new PublicKey(solanaProvider.address);
      } else if (currentAddress) {
        // Use the determined address as fallback
        try {
          solanaPublicKey = new PublicKey(currentAddress);
        } catch (e) {
          console.error("Invalid address format:", currentAddress, e);
        }
      }
      
      if (solanaPublicKey) {
        const solanaAddress = solanaPublicKey.toString();
        console.log("✓ Successfully initialized Solana provider with address:", solanaAddress);
        
        // Set wallet state
        setUserAddress(solanaAddress);
        setCurrentNetwork({ unit: 'SOL', currencySymbol: '◎' });
        
        // Note: fetchFundingStats and fetchLoans will be called by useEffect when userAddress updates
      } else {
        console.error("Failed to extract Solana public key from provider or address");
      }
    } catch (error) {
      console.error("Unexpected error during Solana wallet initialization:", error);
    }
  }, [isConnected, address, solanaProvider, userAddress, directPhantomDetected]);

  // Effect to initialize the provider when connection status changes
  useEffect(() => {
    console.log("Connection status change:", { isConnected, address, directPhantomDetected });
    
    // Enhanced connection detection logic
    const phantomDirectlyConnected = directPhantomDetected && window.solana?.isPhantom && window.solana?.isConnected;
    const appkitConnected = isConnected && address && solanaProvider;
    
    if (appkitConnected || phantomDirectlyConnected) {
      console.log("Wallet is connected, initializing provider:", { 
        address, 
        phantomDirect: phantomDirectlyConnected,
        appkitConnected
      });
      initializeSolanaProvider();
    } else if (!isConnected && !phantomDirectlyConnected) {
      console.log("Wallet disconnected, resetting user address");
      setUserAddress(null);
    }
    
    // Reset connecting state when connection status changes
    if (isWalletConnecting && (isConnected || phantomDirectlyConnected || !address)) {
      setIsWalletConnecting(false);
    }
  }, [isConnected, address, solanaProvider, isWalletConnecting, directPhantomDetected, initializeSolanaProvider]);

  // Effect to clean up user state when disconnected
  useEffect(() => {
    if (!isConnected) {
      setUserAddress(null);
      setCurrentNetwork({ unit: '', currencySymbol: '' });
    }
  }, [isConnected]);  

  // No EVM-specific wallet account change handler needed

  // Handle account change for Solana - define callback outside useEffect
  const handlePublicKeyChange = useCallback((publicKey) => {
    if (publicKey) {
      setUserAddress(publicKey.toString());
      setCurrentNetwork({ unit: 'SOL', currencySymbol: '◎' });
      console.log("Solana account switched to:", publicKey.toString());
    } else {
      setUserAddress(null);
    }
  }, []);

  useEffect(() => {
    if (solanaProvider && typeof solanaProvider.on === 'function') {

      // Attach the event listener if solanaProvider is available
      if (solanaProvider) {
        solanaProvider.on('publicKeyChanged', handlePublicKeyChange);

        // Cleanup function to remove the listener when the component unmounts
        return () => {
          solanaProvider.off('publicKeyChanged', handlePublicKeyChange);
        };
      }
    }
  }, [solanaProvider]);

  // Watch for userAddress changes and fetch data when address is set
  useEffect(() => {
    if (userAddress && solanaProvider) {
      console.log("User address set, fetching data for:", userAddress);
      fetchFundingStats();
      fetchLoans();
    }
  }, [userAddress, solanaProvider]);

  // Fetch funding stats on wallet connect or change
  const handleSetActiveSection = (section) => {
    setActiveSection(section);
    // Additional logic for when section changes can be added here
  };

  // Define the ProgramStats class to match the Rust struct
  class ProgramStats {
    constructor({
      is_initialized,
      total_lent,
      total_repaid,
      total_interest_earned,
      total_fees_collected,
      active_loan_count,
      completed_loan_count,
      liquidated_loan_count,
      blacklisted_borrower_count
    }) {
      this.is_initialized = is_initialized;
      this.total_lent = total_lent;
      this.total_repaid = total_repaid;
      this.total_interest_earned = total_interest_earned;
      this.total_fees_collected = total_fees_collected;
      this.active_loan_count = active_loan_count;
      this.completed_loan_count = completed_loan_count;
      this.liquidated_loan_count = liquidated_loan_count;
      this.blacklisted_borrower_count = blacklisted_borrower_count;
    }
  }

  // Define the schema for borsh deserialization to match the ProgramStats struct
  const ProgramStatsSchema = new Map([
    [ProgramStats, {
      kind: 'struct',
      fields: [
        ['is_initialized', 'u8'], // bool is stored as u8 in Borsh
        ['total_lent', 'u64'],
        ['total_repaid', 'u64'],
        ['total_interest_earned', 'u64'],
        ['total_fees_collected', 'u64'],
        ['active_loan_count', 'u32'],
        ['completed_loan_count', 'u32'],
        ['liquidated_loan_count', 'u32'],
        ['blacklisted_borrower_count', 'u32'],
      ],
    }],
  ]);

  const fetchFundingStats = useCallback(async () => {
    const unit = "SOL";
    const defaultStats = { totalGiven: "0", totalReceived: "0", totalGivenDAI: "0", totalReceivedDAI: "0", unit };
    setFundingStats(defaultStats);

    const walletReady = isConnected && userAddress && solanaProvider;
    if (!walletReady) return;

    const { isValid, currentContract, errorMessage } = await validateContractData(currentSolanaNetwork);
    if (!isValid) {
      console.error("Funding stats fetch failed validation:", errorMessage);
      return;
    }

    try {
      const connection = getSolanaConnection(currentSolanaNetwork);
      const programId = new PublicKey(currentContract.address);

      // Find program stats account PDA address
      const [programStatsAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('program_stats')],
        programId
      );
      
      const accountInfo = await connection.getAccountInfo(programStatsAddress);
      if (accountInfo) {
        const programStatsData = borsh.deserialize(ProgramStatsSchema, ProgramStats, accountInfo.data);
        
        setFundingStats({
          totalGiven: (parseFloat(programStatsData.total_lent) / LAMPORTS_PER_SOL).toFixed(4) || "0",
          totalReceived: (parseFloat(programStatsData.total_repaid) / LAMPORTS_PER_SOL).toFixed(4) || "0",
          totalGivenDAI: "0", // No DAI in Solana program
          totalReceivedDAI: "0", // No DAI in Solana program
          unit: "SOL",
          activeLoans: programStatsData.active_loan_count || 0,
          completedLoans: programStatsData.completed_loan_count || 0,
          liquidatedLoans: programStatsData.liquidated_loan_count || 0,
        });
      } else {
        console.log("Program stats account not initialized yet for program:", currentContract.address);
        // Set empty stats but indicate program is new/uninitialized
        setFundingStats({
          ...defaultStats,
          isNewProgram: true,
          programAddress: currentContract.address,
          network: currentSolanaNetwork
        });
      }
    } catch (error) {
      console.error("Error fetching funding stats:", error);
      setFundingStats(defaultStats);
    }
  }, [currentSolanaNetwork, solanaProvider, isConnected, userAddress, setFundingStats]);

  const fetchLoans = useCallback(async () => {
    console.log('[DEV] 📋 fetchLoans: Starting loan fetch process');
    setLoading(true);
    setLoadFailed(false);
    
    // Debug user and provider state
    console.log(`[DEV] 📋 fetchLoans: User address: ${userAddress || 'none'}, Provider available: ${!!solanaProvider}`);
    console.log(`[DEV] 📋 fetchLoans: Current network: ${currentSolanaNetwork || 'none'}`);
    
    // Validate contract data first - Must await since validateContractData is async
    const { isValid, currentContract, errorMessage } = await validateContractData(currentSolanaNetwork);
    console.log(`[DEV] 📋 fetchLoans: Contract validation - isValid: ${isValid}, address: ${currentContract?.address || 'none'}`);
    
    if (!isValid) {
      console.error("Loan fetch failed validation:", errorMessage);
      setLoadFailed(true);
      setLoanList([]);
      setLoading(false);
      return;
    }

    try {
      const connection = getSolanaConnection(currentSolanaNetwork);
      const programId = currentContract.address;
      console.log(`[DEV] 📋 fetchLoans: Using connection for network: ${currentSolanaNetwork}, programId: ${programId}`);

      console.log('[DEV] 📋 fetchLoans: Fetching program accounts...');
      const accountInfoArray = await getProgramAccounts(connection, new PublicKey(programId));
      console.log(`[DEV] 📋 fetchLoans: Received ${accountInfoArray?.length || 0} account(s) from blockchain`);

      if (!accountInfoArray || accountInfoArray.length === 0) {
        console.log('[DEV] 📋 fetchLoans: No loan accounts found for the given program ID');
        setLoanList([]);
        displayLoanList([]);
        setLoading(false);
        return;
      }
      
      console.log('[DEV] 📋 fetchLoans: Account data received successfully:', {
        accountCount: accountInfoArray.length,
        firstAccountPubkey: accountInfoArray[0]?.pubkey?.toString().substring(0, 8) + '...',
        dataSize: accountInfoArray[0]?.account?.data?.length
      });

      const loans = [];
      console.log('[DEV] 📋 fetchLoans: Starting to deserialize loan accounts...');

      for (const { pubkey, account } of accountInfoArray) {
        try {
          console.log(`[DEV] 📋 fetchLoans: Processing account ${pubkey.toString().substring(0, 8)}...`);
          // Try to deserialize the account data as a Loan
          const loanData = borsh.deserialize(
            LoanSchema,
            Loan,
            account.data
          );
          console.log(`[DEV] 📋 fetchLoans: Successfully deserialized loan data for ${pubkey.toString().substring(0, 8)}`, {
            borrower: loanData.borrower.toString().substring(0, 8) + '...',
            loanAmount: loanData.loan_amount.toString(),
            collateralAmount: loanData.collateral_amount.toString()
          });

          // Add the loan with its public key to our list
          loans.push({
            pubkey: pubkey.toString(),
            collateralToken: loanData.collateral_token.toString(),
            collateralAmount: loanData.collateral_amount.toString(),
            loanToken: loanData.loan_token.toString(),
            loanAmount: loanData.loan_amount.toString(),
            interestRate: loanData.interest_rate,
            endTime: loanData.end_time,
            borrower: loanData.borrower.toString(),
            lender: loanData.lender.toString(),
            isRepaid: loanData.is_repaid
          });
        } catch (err) {
          // This account is not a loan, just skip it
          console.log(`Account at ${pubkey.toString()} is not a valid loan account:`, err.message);
        }
      }

      // Set loan list and update display
      setLoanList(loans);
      displayLoanList(loans);
    } catch (error) {
      console.error('Error fetching loans:', error);
      setLoanList([]);
      displayLoanList([]);
    } finally {
      setLoading(false);
    }
  }, [currentSolanaNetwork, solanaProvider, validateContractData, getSolanaConnection, getProgramAccounts]);

  const handleNetworkChange = useCallback((event) => {
    const newNetwork = event.target.value;
    const previousNetwork = currentSolanaNetwork;
    
    // Show loading state during network change
    setLoading(true);
    
    // Update network state
    setCurrentSolanaNetwork(newNetwork);
    
    // Provide visual feedback for network change
    Swal.fire({
      title: 'Network Switching',
      text: `Switching to Solana ${newNetwork}...`,
      icon: 'info',
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    }).then(() => {
      // After the notification disappears, indicate success
      Swal.fire({
        title: 'Network Changed',
        text: `Successfully connected to Solana ${newNetwork}`,
        icon: 'success',
        showConfirmButton: false,
        timer: 1500
      });
    });
    
    // Refresh loan data after a short delay to allow network switch to complete
    setTimeout(() => {
      try {
        // Trigger data refresh
        fetchLoans();
        
        // Additional refreshes as needed
        if (userAddress) {
          // If wallet is connected, refresh wallet-specific data
          console.log(`Refreshing wallet data for ${userAddress} on ${newNetwork}`);
          // Add any other data refresh calls here
        }
        
        console.log(`Network switched from ${previousNetwork} to ${newNetwork}`);
      } catch (error) {
        console.error(`Error refreshing data after network switch: ${error.message}`);
        Swal.fire({
          title: 'Refresh Error',
          text: 'Failed to load some data after network switch. Please try refreshing manually.',
          icon: 'warning',
          showConfirmButton: true
        });
      } finally {
        // Hide loading state
        setLoading(false);
      }
    }, 2500); // Delay refresh to ensure network switch has time to complete
  }, [currentSolanaNetwork, fetchLoans, userAddress]);

  const disconnectWallet = () => {
    setUserAddress(null);
  };
  
  // Define setup function outside useEffect to avoid recreation
  const setupSolanaEventListeners = useCallback(async () => {
    try {
      // First check if Solana provider is available
      if (!solanaProvider) {
        console.log("Solana provider not ready for event listeners, skipping setup");
        return;
      }
        
      // Set up event listeners
      solanaProvider.on('connect', () => {
        console.log('Phantom connected!');
      });
        
      // Disconnect events
      solanaProvider.on('disconnect', () => {
        console.log('Phantom disconnected!');
      });
    } catch (error) {
      console.error("Error setting up Solana wallet event listeners:", error);
    }
  }, [solanaProvider]);
  
  // Fetch loans and set up event listeners
  useEffect(() => {

    // Create a local function for immediate data fetching that doesn't depend on memoized functions
    const initialFetch = async () => {
      // Call the functions directly instead of through fetchData to avoid dependency issues
      if (fetchLoans) fetchLoans();
      if (fetchFundingStats) fetchFundingStats();
    };
    
    if (solanaProvider) {
      console.log("Solana provider available, setting up listeners and fetching data...");
      setupSolanaEventListeners();
      // Use the local function that doesn't create dependencies
      initialFetch();
    }
    
    // Return cleanup function
    return () => {
      if (solanaProvider) {
        try {
          console.log('Cleaning up Solana event listeners...');
          solanaProvider.removeAllListeners('connect');
          solanaProvider.removeAllListeners('disconnect');
        } catch (error) {
          console.error("Error cleaning up Solana event listeners:", error);
        }
      }
    };
  }, [solanaProvider, setupSolanaEventListeners]);

  useEffect(() => {
    if (solanaProvider && isConnected) {
      console.log(`Network changed to ${currentSolanaNetwork}, refreshing data...`);
      fetchLoans();
      fetchFundingStats();
    }
  }, [currentSolanaNetwork, solanaProvider, isConnected, fetchLoans, fetchFundingStats]);

  // Fetch Solana Wallet Tokens  
  const getUserTokens = async (network, address) => {
    console.log("Fetching Solana tokens for address:", address);
  
    if (!address) {
      console.error("Wallet address is missing");
      return [];
    }
  
    try {
      // Fetch Solana token balances using connection
      const connection = new Connection(network.rpcUrl, "confirmed");
      const publicKey = new PublicKey(address);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const tokens = await Promise.all(
        tokenAccounts.value.map(async (tokenAccount) => {
          try {
            const tokenInfo = tokenAccount.account.data.parsed.info;
            const tokenAddress = tokenInfo.mint;

            const metadata = await fetchSolanaTokenMetadata(tokenAddress);

            const balance = tokenInfo.tokenAmount.uiAmount;

            return {
              address: tokenAddress,
              name: metadata.name || "Unknown",
              symbol: metadata.symbol || "Unknown",
              balance: balance.toFixed(2),
              avatar: metadata.logo || "../assets/images/solana-token.webp",
            };
          } catch (error) {
            console.error(`Failed to fetch metadata for token:`, error);
            return null; // Skip invalid tokens
          }
        })
      );

      return tokens.filter(Boolean); // Filter out any null values
    } catch (error) {
      console.error("Error fetching Solana token data:", error);
      return []; // Gracefully return an empty array on error
    }
  };   

  // Token metadata cache for loan request form
  const tokenMetadataCache = {
    logos: {}, // address -> logo URL
    symbols: {}, // address -> symbol
    names: {}, // address -> name
    prices: {}, // address -> price in USD
    lastFetch: {}, // address -> timestamp of last fetch
    // Rate limit: only fetch once every 5 minutes for each token
    RATE_LIMIT_MS: 5 * 60 * 1000
  };

  const showLoanRequestPopup = async () => {
    // Check wallet connection
    if (!isConnected) {
      console.error("Wallet not connected!");
      Swal.fire({
        title: 'Wallet Not Connected',
        text: 'Please connect your wallet first to request a loan.',
        icon: 'warning'
      });
      return;
    }
  
    // Enhanced function to validate Solana address with detailed feedback
    const validateSolanaAddress = (address, showFeedback = false, feedbackElement = null) => {
      try {
        if (!address) {
          if (showFeedback && feedbackElement) {
            feedbackElement.innerHTML = '<span class="error-text">Address is required</span>';
          }
          return false;
        }
        
        // Attempt to create PublicKey to validate
        new PublicKey(address);
        
        if (showFeedback && feedbackElement) {
          feedbackElement.innerHTML = '<span class="success-text">✓ Valid Solana address</span>';
        }
        return true;
      } catch (error) {
        if (showFeedback && feedbackElement) {
          feedbackElement.innerHTML = `<span class="error-text">Invalid Solana address: ${error.message}</span>`;
        }
        return false;
      }
    };

    // Define a reusable function to validate input fields with specific validation
    const validateFields = (fields) => {
      // First check for required fields
      for (const [field, value] of Object.entries(fields)) {
        if (field === 'ReservedAddress' && !document.getElementById("reservedAddressCheckbox").checked) {
          continue; // Skip ReservedAddress validation if checkbox is not checked
        }
        
        if (!value) {
          Swal.showValidationMessage(`${field} is required.`);
          return false;
        }
      }
      
      // Check if LoanToken is a valid Solana address
      if (fields.LoanToken && !validateSolanaAddress(fields.LoanToken)) {
        Swal.showValidationMessage(`Invalid Solana token address for borrow token.`);
        return false;
      }

      // Validate numeric fields
      if (isNaN(parseFloat(fields.CollateralAmount)) || parseFloat(fields.CollateralAmount) <= 0) {
        Swal.showValidationMessage(`Collateral amount must be a positive number.`);
        return false;
      }
      
      if (isNaN(parseFloat(fields.LoanAmount)) || parseFloat(fields.LoanAmount) <= 0) {
        Swal.showValidationMessage(`Loan amount must be a positive number.`);
        return false;
      }
      
      if (isNaN(parseFloat(fields.InterestRate)) || parseFloat(fields.InterestRate) <= 0) {
        Swal.showValidationMessage(`Repayment amount must be a positive number.`);
        return false;
      }
      
      // Validate reserved address if checkbox is checked
      if (document.getElementById("reservedAddressCheckbox").checked) {
        if (!validateSolanaAddress(fields.ReservedAddress)) {
          Swal.showValidationMessage(`Invalid Solana address for reserved lender.`);
          return false;
        }
      }
      
      return true;
    };
  
    // Function to fetch token metadata with caching
    const fetchTokenMetadata = async (tokenAddress) => {
      try {
        // Check cache first
        const now = Date.now();
        const lastFetch = tokenMetadataCache.lastFetch[tokenAddress] || 0;
        
        // If cached data exists and is not expired
        if (lastFetch && (now - lastFetch < tokenMetadataCache.RATE_LIMIT_MS)) {
          // If we have all required metadata, return from cache
          if (tokenMetadataCache.logos[tokenAddress] && 
              tokenMetadataCache.symbols[tokenAddress]) {
            return {
              logo: tokenMetadataCache.logos[tokenAddress],
              symbol: tokenMetadataCache.symbols[tokenAddress],
              name: tokenMetadataCache.names[tokenAddress] || 'Unknown',
              price: tokenMetadataCache.prices[tokenAddress] || 'N/A'
            };
          }
        }
        
        console.log(`Fetching metadata for token: ${tokenAddress}`);
        // Use the existing token metadata function from alchemyService
        const metadata = await fetchSolanaTokenMetadata(tokenAddress);
        
        // Update cache
        if (metadata) {
          tokenMetadataCache.logos[tokenAddress] = metadata.logoURI || ShitcoinLogo;
          tokenMetadataCache.symbols[tokenAddress] = metadata.symbol || 'UNKNOWN';
          tokenMetadataCache.names[tokenAddress] = metadata.name || 'Unknown Token';
          // Attempt to get price from QuickNode or another service if available
          try {
            const priceData = await axios.get(`https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${tokenAddress}&vs_currencies=usd`);
            const price = priceData.data && priceData.data[tokenAddress.toLowerCase()] ? 
                        priceData.data[tokenAddress.toLowerCase()].usd : 'N/A';
            tokenMetadataCache.prices[tokenAddress] = price;
          } catch (error) {
            console.warn(`Could not fetch price for ${tokenAddress}:`, error);
            tokenMetadataCache.prices[tokenAddress] = 'N/A';
          }
          tokenMetadataCache.lastFetch[tokenAddress] = now;
          
          return {
            logo: metadata.logoURI || ShitcoinLogo,
            symbol: metadata.symbol || 'UNKNOWN',
            name: metadata.name || 'Unknown Token',
            price: tokenMetadataCache.prices[tokenAddress] || 'N/A'
          };
        }
        
        // Return default values if metadata fetch failed
        return {
          logo: ShitcoinLogo,
          symbol: 'UNKNOWN',
          name: 'Unknown Token',
          price: 'N/A'
        };
      } catch (error) {
        console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
        return {
          logo: ShitcoinLogo,
          symbol: 'UNKNOWN',
          name: 'Unknown Token',
          price: 'N/A'
        };
      }
    };

    // Centralized function to fetch user tokens
    const fetchTokens = async () => {
      try {
        console.log("Fetching tokens...");
        const tokens = await getUserTokens(network, address);
        console.log("Tokens fetched successfully:", tokens);
        return tokens;
      } catch (error) {
        console.error("Error fetching tokens:", error);
        return [];
      }
    };
  
    // Define the loan form HTML with side-by-side layout and meme styling
    const loanFormHTML = `
      <div id="loan-form" class="loan-form">
        <div class="form-section">
          <h3>🍽️ Beg for Coins 🐕</h3>
          <div class="input-group">
            <label for="collateralTokenDropdown">
              <i class="fas fa-coins"></i> Your Meme Token:
            </label>
            <div class="collateral-token-dropdown">
              <div class="dropdown-current" id="dropdownCurrentValue">
                <span>Select your shitcoin...</span>
              </div>
              <div class="dropdown-menu" id="collateralTokenDropdown">
                <input id="collateralSearchInput" class="dropdown-search-input" placeholder="Search or paste meme address..." />
                <div id="collateralTokenList" class="dropdown-list">
                  <p>Loading your bags...</p>
                </div>
              </div>
            </div>
          </div>
          <div class="input-group">
            <label for="collateralAmount">
              <i class="fas fa-money-bill-wave"></i> Amount to Offer:
            </label>
            <input type="number" id="collateralAmount" class="swal2-input" placeholder="How much you got?" required />
          </div>
          <div class="input-group">
            <label for="loanToken" title="The token you want to borrow">
              <i class="fas fa-coins"></i> Borrow Token:
            </label>
            <select id="loanToken" class="swal2-input" required>
              <option value="">Select token to borrow...</option>
              <option value="So11111111111111111111111111111111111111112">SOL</option>
              <option value="EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o">DAI</option>
            </select>
          </div>
          <div class="input-group">
            <label for="loanAmount">
              <i class="fas fa-hand-holding-usd"></i> Amount to Borrow:
            </label>
            <input type="number" id="loanAmount" class="swal2-input" placeholder="How much you need?" required />
          </div>
          <div class="input-group">
            <label for="loanDuration">
              <i class="fas fa-clock"></i> Duration (Hours):
            </label>
            <input type="number" id="loanDuration" class="swal2-input" placeholder="How many hours?" min="1" max="168" required />
          </div>
          <div class="input-group">
            <label for="interestRate" title="loan amount + interest amount">
              <i class="fas fa-percent"></i> Repayment Amount:
            </label>
            <input type="number" id="interestRate" class="swal2-input" placeholder="What you'll pay back" required />
            <div class="reserved-option">
              <input type="checkbox" id="reservedAddressCheckbox" />
              <label for="reservedAddressCheckbox">🎯 Reserve for specific lender</label>
            </div>
            <div id="reservedAddressInput" style="display: none;">
              <div class="input-with-validation">
                <input id="reservedAddress" class="swal2-input" placeholder="Enter lender address" />
                <div id="reservedAddressFeedback" class="validation-feedback"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="order-summary">
          <h3>💰 Your Beg Summary 💰</h3>
          <div id="summary-content">
            <p class="summary-placeholder">Fill out the form to see your pathetic request...</p>
          </div>
          <div class="explainer-section">
            <h4>🎪 How Meme Coins Became Cash! 🎪</h4>
            <p><strong>You don't have to be poor anymore!</strong> Beg, get funded in SOL, go trench more, come settle & get your meme coins back.</p>
            
            <div class="how-to-beg">
              <h5>📋 To Beg:</h5>
              <ol>
                <li><strong>Deposit your meme coins.</strong><br><span class="test-mode">🧪 TEST MODE: max $2 worth of tokens allowed currently.</span></li>
                <li><strong>Beg!</strong> Offer a lucrative interest rate, amount you're begging, & duration in hours.<br><em>Interest is simple eg 10% for 168 hours (7 days), 5% for 72 hours (3 days) etc - not P/A calculations, we are not a real bank! 😂</em></li>
                <li><strong>Trenchers will see your plate & fund you.</strong> Multiple funders allowed per loan.</li>
                <li><strong>Go trench & remember to pay back</strong> or lose your memes! 💀</li>
              </ol>
            </div>
          </div>
          <div class="meme-quote">"Stupid dog! You made me look bad!"</div>
        </div>
      </div>
      <div class="courage-decoration">🐕</div>
      <div class="courage-decoration">💀</div>
      <div class="courage-decoration">👻</div>
      <div class="courage-decoration">🎪</div>
    `;
  
    // Show the Swal popup immediately with meme styling
    const { value: formValues } = await Swal.fire({
      html: loanFormHTML,
      focusConfirm: false,
      showCancelButton: true,
      allowOutsideClick: false, // Prevents closing by clicking the backdrop, which was causing issues. Use buttons or Esc key.
      allowEscapeKey: true,
      confirmButtonText: "🚀 Submit Beg Request",
      cancelButtonText: "😱 Chicken Out",
      customClass: {
        popup: 'meme-bank-modal',
        content: 'meme-bank-content',
        container: 'meme-bank-container'
      },
      didOpen: async () => {
        console.log("Swal opened, setting up dynamic UI logic...");
        // Get reserved checkbox and add event listener for toggling reserved address input visibility
        const reservedCheckbox = document.getElementById("reservedAddressCheckbox");
        const reservedAddressInput = document.getElementById("reservedAddressInput");
        const reservedAddressFeedback = document.getElementById("reservedAddressFeedback");
        
        // Add null checks to prevent errors with missing elements
        if (reservedCheckbox && reservedAddressInput && reservedAddressFeedback) {
          reservedCheckbox.addEventListener("change", () => {
            if (reservedAddressInput) {
              reservedAddressInput.style.display = reservedCheckbox.checked ? "block" : "none";
              // Clear any validation feedback when hiding the input
              if (!reservedCheckbox.checked && reservedAddressFeedback) {
                reservedAddressFeedback.innerHTML = '';
              }
            }
          });
        } else {
          console.warn("Loan form UI elements not found, skipping event listener setup");
        }

        // Ensure Chicken Out button fully closes the modal
        const cancelBtn = document.querySelector('.swal2-cancel');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            Swal.close();
          });
        }
        
        // Add real-time validation for reserved address input when it's visible
        const reservedAddressField = document.getElementById("reservedAddress");
        let reservedAddressValidationTimeout;
        
        if (reservedAddressField && reservedAddressFeedback) {
          reservedAddressField.addEventListener("input", (e) => {
            const value = e.target.value.trim();
            
            // Clear previous timeout to prevent excessive validation calls
            clearTimeout(reservedAddressValidationTimeout);
            
            // Show checking status if there's input
            if (value && reservedAddressFeedback) {
              reservedAddressFeedback.innerHTML = '<span class="info-text">Checking address...</span>';
            } else if (reservedAddressFeedback) {
              reservedAddressFeedback.innerHTML = '';
            }
            
            // Debounce validation to improve performance
            reservedAddressValidationTimeout = setTimeout(() => {
              if (value && reservedAddressFeedback) {
                validateSolanaAddress(value, true, reservedAddressFeedback);
              } else if (reservedAddressFeedback) {
                reservedAddressFeedback.innerHTML = '';
              }
            }, 500);
          });
        } else {
          console.warn("Reserved address field or feedback element not found, skipping validation setup");
        } // 500ms delay for debouncing
  
        const dropdownCurrent = document.getElementById("dropdownCurrentValue");
        const dropdownMenu = document.getElementById("collateralTokenDropdown");
        const tokenList = document.getElementById("collateralTokenList");
        const searchInput = document.getElementById("collateralSearchInput");
        const loanTokenInput = document.getElementById("loanToken");
        const loanTokenFeedback = document.getElementById("loanTokenFeedback");
        
        // Set up real-time Solana address validation for borrow token
        let loanTokenValidationTimeout;
        loanTokenInput.addEventListener("input", (e) => {
          const value = e.target.value.trim();
          
          // Clear previous timeout to prevent excessive validation calls
          clearTimeout(loanTokenValidationTimeout);
          
          // Show checking status
          loanTokenFeedback.innerHTML = '<span class="info-text">Checking address...</span>';
          
          // Debounce validation to improve performance
          loanTokenValidationTimeout = setTimeout(async () => {
            if (value) {
              // Validate the address
              const isValid = validateSolanaAddress(value, true, loanTokenFeedback);
              
              // If valid, attempt to fetch token metadata
              if (isValid) {
                try {
                  loanTokenFeedback.innerHTML = '<span class="info-text">Fetching token info...</span>';
                  const metadata = await fetchTokenMetadata(value);
                  loanTokenFeedback.innerHTML = `
                    <div class="token-preview">
                      <img src="${metadata.logo}" class="mini-token-logo" alt="${metadata.symbol}" />
                      <div class="token-preview-info">
                        <span class="token-preview-symbol">${metadata.symbol}</span>
                        <span class="token-preview-name">${metadata.name}</span>
                      </div>
                      ${metadata.price !== 'N/A' ? `<span class="token-preview-price">$${metadata.price}</span>` : ''}
                    </div>
                  `;
                } catch (error) {
                  console.error("Error fetching token metadata:", error);
                }
              }
            } else {
              loanTokenFeedback.innerHTML = '';
            }
          }, 500); // 500ms delay for debouncing
        });
  
        dropdownCurrent.addEventListener("click", () => {
          dropdownMenu.classList.toggle("open");
        });
  
        searchInput.addEventListener("input", () => {
          const searchValue = searchInput.value.toLowerCase();
          Array.from(tokenList.children).forEach((item) => {
            const tokenSymbol = item.dataset.tokenSymbol?.toLowerCase();
            const tokenAddress = item.dataset.tokenAddress?.toLowerCase();
            item.style.display =
              tokenSymbol?.includes(searchValue) || tokenAddress?.includes(searchValue) ? "block" : "none";
          });
        });
        
        // Function to update the order summary in real-time
        const updateOrderSummary = () => {
          const summaryContent = document.getElementById("summary-content");
          
          // Get all input values
          const selectedToken = dropdownCurrent.textContent.trim();
          const collateralAmount = document.getElementById("collateralAmount").value;
          const loanTokenSelect = document.getElementById("loanToken");
          const loanTokenValue = loanTokenSelect.value;
          const loanTokenText = loanTokenSelect.options[loanTokenSelect.selectedIndex]?.text || "Unknown";
          const loanAmount = document.getElementById("loanAmount").value;
          const interestRate = document.getElementById("interestRate").value;
          const loanDuration = document.getElementById("loanDuration").value;
          const isReservedAddress = document.getElementById("reservedAddressCheckbox")?.checked || false;
          const reservedAddress = isReservedAddress ? document.getElementById("reservedAddress")?.value : null;
          
          // Check if form is empty
          if (!selectedToken.includes("Select your shitcoin") && collateralAmount && loanTokenValue && loanAmount && interestRate && loanDuration) {
            // Format values for display
            const formattedCollateralValue = selectedToken.split('-')[0].trim();
            const durationText = `${loanDuration} hours (${Math.round(loanDuration / 24 * 10) / 10} days)`;
            
            // Generate summary HTML
            summaryContent.innerHTML = `
              <div class="summary-item">
                <span class="summary-label">You're offering:</span>
                <span class="summary-value">${collateralAmount} ${formattedCollateralValue}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">You'll borrow:</span>
                <span class="summary-value">${loanAmount} ${loanTokenText}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">You'll repay:</span>
                <span class="summary-value">${interestRate} ${loanTokenText}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Duration:</span>
                <span class="summary-value">${durationText}</span>
              </div>
              ${isReservedAddress && reservedAddress ? `
              <div class="summary-item">
                <span class="summary-label">Reserved for:</span>
                <span class="summary-value">${reservedAddress.substring(0, 6)}...${reservedAddress.substring(reservedAddress.length - 4)}</span>
              </div>
              ` : ''}
              <div class="summary-note">
                * Collateral will be locked until loan is repaid or liquidated
              </div>
            `;
          } else {
            summaryContent.innerHTML = `<p class="summary-placeholder">Complete the form to see your order summary</p>`;
          }
        };
        
        // Add event listeners to all form inputs to update the summary
        const formInputs = [
          document.getElementById("collateralAmount"),
          document.getElementById("loanToken"),
          document.getElementById("loanAmount"),
          document.getElementById("interestRate"),
          document.getElementById("loanDuration")
        ];
        
        formInputs.forEach(input => {
          input.addEventListener("input", updateOrderSummary);
        });
        
        // Add order summary update listener to reserved address checkbox (reusing the variable declared earlier)
        // Add the update order summary listener to the checkbox we already defined
        reservedCheckbox.addEventListener("change", updateOrderSummary);
        
        // Also add listener to the reserved address input for real-time summary updates
        if (reservedAddressField) {
          reservedAddressField.addEventListener("input", updateOrderSummary);
        }
  
        tokenList.addEventListener("click", (e) => {
          const item = e.target.closest(".dropdown-item");
          if (item) {
            const tokenSymbol = item.dataset.tokenSymbol;
            const tokenAvatar = item.querySelector(".token-avatar").src;
            const tokenBalance = item.dataset.tokenBalance;
  
            dropdownCurrent.innerHTML = `
              <img src="${tokenAvatar}" className="token-avatar" alt="${tokenSymbol} avatar" />
              <span>${tokenSymbol} - ${tokenBalance} Tokens</span>
            `;
            dropdownMenu.classList.remove("open");
          }
        });
  
        // Populate the token list with enhanced metadata
        const tokens = await fetchTokens();
        
        // Create token list HTML with loading state
        tokenList.innerHTML = '<p>Loading token metadata...</p>';
        
        if (!tokens.length) {
          tokenList.innerHTML = `<p>No tokens found.</p>`;
          return;
        }
        
        // Fetch metadata for all tokens asynchronously for better UX
        const tokenListHTML = [];
        
        // Process tokens sequentially to avoid rate limiting
        for (const token of tokens) {
          try {
            // Get enhanced metadata
            const metadata = await fetchTokenMetadata(token.address);
            
            // Create enhanced token display with metadata
            tokenListHTML.push(`
              <div className="dropdown-item enhanced-token-item" data-token-address="${token.address}" data-token-symbol="${metadata.symbol}" data-token-balance="${token.balance}">
                <div class="token-item-container">
                  <div class="token-item-left">
                    <img src="${metadata.logo}" className="token-avatar" alt="${metadata.symbol} avatar" />
                    <div class="token-info">
                      <span className="token-symbol">${metadata.symbol}</span>
                      <span className="token-name">${metadata.name}</span>
                    </div>
                  </div>
                  <div class="token-item-right">
                    <span className="token-balance">${token.balance}</span>
                    ${metadata.price !== 'N/A' ? `<span className="token-price">$${metadata.price}</span>` : ''}
                  </div>
                </div>
                <span className="token-address">${token.address.substring(0, 6)}...${token.address.substring(token.address.length - 4)}</span>
              </div>
            `);
            
            // Update the list as we go for better UX
            tokenList.innerHTML = tokenListHTML.join("");
          } catch (error) {
            console.error(`Error processing token ${token.address}:`, error);
          }
        }
      },
      preConfirm: () => {
        const fields = {
          CollateralToken: document.querySelector("#dropdownCurrentValue span")?.innerText.split(" ")[0],
          CollateralAmount: document.getElementById("collateralAmount").value,
          LoanToken: document.getElementById("loanToken").value,
          LoanAmount: document.getElementById("loanAmount").value,
          InterestRate: document.getElementById("interestRate").value,
          LoanDuration: document.getElementById("loanDuration").value,
          ReservedAddress: document.getElementById("reservedAddressCheckbox").checked
            ? document.getElementById("reservedAddress").value
            : null,
        };
        return validateFields(fields) && fields;
      },
    });
  
    if (formValues) {
      console.log("Loan form submitted with values:", formValues);
      try {
        Swal.showLoading();
        await requestLoan(formValues);
        Swal.hideLoading();
        Swal.fire("Success!", "Loan request submitted successfully!", "success");
      } catch (error) {
        console.error("Error requesting loan:", error);
        Swal.fire("Error!", "Loan request failed. See console for details.", "error");
      }
    }
  };  

  const requestLoan = async (formData) => {
    const { CollateralToken, CollateralAmount, LoanToken, LoanAmount, InterestRate, LoanDuration, ReservedAddress } = formData;
    
    // Convert duration from hours to seconds for the smart contract
    const durationSeconds = parseInt(LoanDuration) * 3600;
    if (!isConnected) {
      console.error("Signer not initialized.");
      Swal.fire("Error!", "Signer is not initialized. Please connect your wallet.", "error");
      return;
    }

    // Validate contract data
    const { isValid, currentContract, errorMessage } = validateContractData(network);  
    if (!isValid) {
      Swal.fire("Error!", errorMessage, "error");
      return;
    }

    try {
      if (network?.name === 'solana') {
        // Handle Solana Loan Request using Alchemy and axios
      
        try {
          const PROGRAM_ID = new PublicKey(currentContract.address);
          const borrowerAccount = solanaProvider.publicKey;
          const collateralAccount = new PublicKey(collateralToken);
      
          // Prepare data for the transaction (using Borsh serialization for structured data)
          const loanRequestData = {
            collateralToken: CollateralToken,
            collateralAmount: new borsh.BN(parseFloat(CollateralAmount) * LAMPORTS_PER_SOL),
            loanToken: LoanToken,
            loanAmount: new borsh.BN(parseFloat(LoanAmount) * LAMPORTS_PER_SOL),
            interestRate: parseFloat(InterestRate),
            loanDuration: durationSeconds,
            reservedAddress: ReservedAddress,
          };
      
          // Serialize data using Borsh
          const serializedData = Buffer.from(borsh.serialize(LoanStatsSchema, loanRequestData));
      
          // Create a transaction instruction to request a loan
          const requestLoanInstruction = {
            programId: PROGRAM_ID.toBase58(),
            keys: [
              { pubkey: borrowerAccount.toBase58(), isSigner: true, isWritable: true },
              { pubkey: collateralAccount.toBase58(), isSigner: false, isWritable: false },
            ],
            data: serializedData.toString('base64'),
          };
      
          // Prepare payload for the axios request to send the transaction via Alchemy
          const solanaTransactionPayload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sendTransaction',
            params: [
              {
                programId: requestLoanInstruction.programId,
                keys: requestLoanInstruction.keys,
                data: requestLoanInstruction.data,
              }
            ],
          };
      
          // Define Alchemy URL
          // Send the transaction using the QuickNode connection
          const instruction = new TransactionInstruction({
            keys: requestLoanInstruction.keys.map(key => ({...key, pubkey: new PublicKey(key.pubkey)})),
            programId: new PublicKey(requestLoanInstruction.programId),
            data: Buffer.from(requestLoanInstruction.data, 'base64'),
          });

          const transaction = new Transaction().add(instruction);
          transaction.feePayer = solanaProvider.publicKey;
          transaction.recentBlockhash = (await quicknodeConnection.getLatestBlockhash()).blockhash;

          const signedTransaction = await solanaProvider.signTransaction(transaction);
          const txId = await quicknodeConnection.sendRawTransaction(signedTransaction.serialize());

          // Confirm the transaction
          await quicknodeConnection.confirmTransaction(txId, 'confirmed');
      
          // Success message
          console.log('Transaction ID:', txId);
          Swal.fire('Success!', 'Loan request on Solana was successful!', 'success');
          refreshLoanList();
        } catch (error) {
          console.error('Error during Solana loan request:', error);
          Swal.fire('Error!', 'There was an error while requesting a loan on Solana. Please try again later.', 'error');
        }
      } else {
        // This section is now handled by the Solana implementation above
        console.error("Only Solana network is supported");
        Swal.fire("Network Error", "Only Solana network is currently supported.", "error");
        return;
      }     
    } catch (error) {
      console.error("Error requesting loan: ", error);
      Swal.fire('Error!', 'Loan request failed. See console for details.', 'error');
    }
  };

  // Define Loan class and LoanSchema
  class Loan {
    constructor({ collateral_token, collateral_amount, loan_token, loan_amount, interest_rate, end_time, borrower, lender, reserved_address, is_repaid }) {
      this.collateral_token = new PublicKey(collateral_token);
      this.collateral_amount = collateral_amount;
      this.loan_token = new PublicKey(loan_token);
      this.loan_amount = loan_amount;
      this.interest_rate = interest_rate;
      this.end_time = end_time;
      this.borrower = new PublicKey(borrower);
      this.lender = new PublicKey(lender);
      this.reserved_address = new PublicKey(reserved_address);
      this.is_repaid = is_repaid === 1; // Convert 'u8' to boolean (1 -> true, 0 -> false)
    }
  }

  const LoanSchema = new Map([
    [Loan, {
      kind: 'struct',
      fields: [
        ['collateral_token', [32]], // PublicKey is 32 bytes
        ['collateral_amount', 'u64'],
        ['loan_token', [32]], // PublicKey is 32 bytes
        ['loan_amount', 'u64'],
        ['interest_rate', 'u8'],
        ['end_time', 'u64'], // Unix timestamp
        ['borrower', [32]], // PublicKey is 32 bytes
        ['lender', [32]], // PublicKey is 32 bytes
        ['reserved_address', [32]], // PublicKey is 32 bytes
        ['is_repaid', 'u8'], // Boolean represented as 0 or 1
      ],
    }],
  ]);


  const refreshLoanList = useCallback(() => {
    fetchLoans();
  }, [fetchLoans]);
  
  const displayLoanList = (loans) => {
    try {
      // stop filtering animation
      const element = document.querySelector('.filter-options');
      if (element) {
        element.style.animation = "none";
      }
    } catch (error) {
      console.warn('Could not modify filter animation:', error);
    }
    
    setLoanList(
      loans.map((loan, index) => {
        // Helper function to estimate the value based on interest rate
        const getEstimatedValue = (loanAmount, interestRate, loanToken) => {
          const interestMultiplier = 1 + interestRate / 100;
          const estimatedValue = loanAmount * interestMultiplier;
  
          return getFormattedValue(estimatedValue, loanToken);
        };
  
        return (
          <div className="loan-strip" key={index}>
            {/* Collateral Token Icon */}
            <div className="loan-icon">
              <img src="/path/to/meme-coin-placeholder.svg" alt="Collateral Token" className="collateral-token-icon" />
            </div>
  
            {/* Collateral Token Symbol and Address */}
            <div className="collateral-address">
              <div className="collateral-symbol">
                <strong>{getCollateralSymbol(loan.collateral_token)}</strong>
              </div>
              <a
                href={getExplorerUrl(loan.collateral_token)}
                target="_blank"
                rel="noopener noreferrer"
                className="collateral-link"
              >
                {loan.collateral_token && loan.collateral_token.substring(0, 6)}...{loan.collateral_token && loan.collateral_token.substring(loan.collateral_token.length - 4)}
                <FaExternalLinkAlt className="external-link-icon" />
              </a>
            </div>
  
            {/* Collateral Amount */}
            <div className="collateral-amount">
              <strong>{getCollateralAmount(loan.collateral_amount, currentNetwork.unit)}</strong> Tokens
            </div>
  
            {/* Loan Amount and Token */}
            <div className="loan-amount-section">
              <div className="loan-token">
                {loan.loan_token === "SOL" ? (
                  <GiTwoCoins className="token-icon-small" />
                ) : loan.loan_token === "DAI" ? (
                  <FaDollarSign className="token-icon-small" />
                ) : (
                  <img src="/solana-logo.png" alt="SOL" className="token-icon-small" />
                )}
                <span>{loan.loan_token}</span>
              </div>
              <div className="loan-amount">
                {getFormattedValue(loan.loan_amount, loan.loan_token)} {loan.loan_token}
              </div>
            </div>
  
            {/* Interest Rate Section */}
            <div className="interest-rate-section">
              <span>Interest Rate: {loan.interest_rate}%</span>
              <span>
                ~ {getEstimatedValue(loan.loan_amount, loan.interest_rate, loan.loan_token)} {loan.loan_token}
              </span>
            </div>
  
            {/* Expiry Date, Repaid Status, Reserved Lender, and Action Buttons */}
            <div className="expiry-actions-section">
              {/* Expiry Date */}
              <div className="expiry-date">
                <span className="expiry-label">Expiry:</span>
                <span className="expiry-value">{new Date(loan.end_time * 1000).toLocaleDateString()}</span>
              </div>
  
              {/* Reserved Lender and Repaid Status */}
              <div className="status-indicators">
                <span className="reserved-indicator">
                  Reserved: {loan.reserved_address.toBase58()} {/* Convert PublicKey to Base58 string */}
                </span>
                {loan.is_repaid ? (
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
          </div>
        );
      })
    );
  };  

  const handleFilterChange = (type) => {
    setFilterType(type);
    filterLoans();
  };

  const handleContractAddressSearch = (e) => {
    setContractAddress(e.target.value);
  };

  // Removed validateContractData from here - moved outside component

  // TV Time
  const CryptoTv = () => {
    const cnv = document.getElementById("static");
    const c = cnv?.getContext("2d");
    if (!cnv || !c) {
      console.error("Canvas element not found or unsupported context.");
      return;
    }
  
    const cw = cnv.offsetWidth || 500; // Default width if not set
    const ch = cnv.offsetHeight || 300; // Default height if not set
    const staticScrn = c.createImageData(cw, ch);
    const staticFPS = 30;
    let isStatic = false;
    let staticTO;
  
    const gifData = [
      { file: "https://imgur.com/G9JSL7t.mp4", desc: "Meet Courage :)", type: "video" },
      { file: "https://assets.codepen.io/416221/willie.gif", desc: "Steamboat Willie (Mickey Mouse) steering a ship", type: "image" },
      { file: "https://imgur.com/AogvbkL.mp4", desc: "Raining", type: "video" },
      { file: "https://assets.codepen.io/416221/skeletons.gif", desc: "Spooky scary skeletons sending shivers down your spine", type: "image" },
      { file: "https://imgur.com/lpZ7sD7.mp4", desc: "Imperfect Courage", type: "video" },
      { file: "https://assets.codepen.io/416221/kingkong.gif", desc: "King Kong waving on Empire State Building", type: "image" },
      { file: "https://imgur.com/FQFIVTo.gif", desc: "Its my cake day!", type: "image" },
      { file: "https://imgur.com/szKw3OX.mp4", desc: "Courage Cleaning", type: "video" },
      { file: "https://assets.codepen.io/416221/tracks.gif", desc: "Looking at train tracks from behind a train", type: "image" },
      { file: "https://imgur.com/SiUhyoq.mp4", desc: "Frog Gang", type: "video" },
      { file: "https://assets.codepen.io/416221/nuke.gif", desc: "Nuclear explosion at sea", type: "image" },
      { file: "https://imgur.com/kyvQVzu.png", desc: "Courage The Memish Dog", type: "image" },      
      { file: "https://imgur.com/XhCBo5v.mp4", desc: "Pie Eustas", type: "video" },
      { file: "https://imgur.com/M6UJsWs.jpeg", desc: "Courage The Memish Dog", type: "image" },
      { file: "https://imgur.com/pfadmDi.gif", desc: "CTO Courage", type: "image" },
    ];  
  
    let channel = 0;
  
    const runStatic = () => {
      isStatic = true;
      c.clearRect(0, 0, cw, ch);
  
      for (let i = 0; i < staticScrn.data.length; i += 4) {
        const shade = 127 + Math.round(Math.random() * 128);
        staticScrn.data[i] = shade; // Red
        staticScrn.data[i + 1] = shade; // Green
        staticScrn.data[i + 2] = shade; // Blue
        staticScrn.data[i + 3] = 255; // Alpha
      }
      c.putImageData(staticScrn, 0, 0);
      staticTO = setTimeout(runStatic, 1200 / staticFPS);
    };
  
    runStatic();
  
    const changeChannel = function () {
      const displayedImg = document.getElementById("displayed");
      const displayedVideo = document.getElementById("displayedVideo");
      const IntroText = document.getElementById("introText");
  
      if (!displayedImg || !displayedVideo || !IntroText) {
        console.error("Image, video element, or IntroText not found.");
        return;
      }
  
      // Pause and reset the video if it's playing
      displayedVideo.pause();
      displayedVideo.src = ""; // Clear the current video source to stop playback
  
      channel++;
      if (channel > gifData.length) channel = 1;
  
      const currentItem = gifData[channel - 1];
  
      cnv.classList.remove("hide");
      displayedImg.classList.add("hide");
      displayedVideo.classList.add("hide");
  
      // Hide the info text when switching channels
      IntroText.classList.add("hide");
  
      if (!isStatic) runStatic();
  
      setTimeout(() => {
        cnv.classList.add("hide");
  
        if (currentItem.type === "image") {
          displayedImg.src = currentItem.file;
          displayedImg.alt = currentItem.desc;
          displayedImg.classList.remove("hide");

          // Estimate GIF duration and run the animation
          /*
          const estimatedDuration = 5000;
          setTimeout(() => {
            if (channel === 1) {
              IntroText.classList.remove("hide");
              animation();
            }
          }, estimatedDuration);
          */
        } else if (currentItem.type === "video") {
          displayedVideo.src = currentItem.file;
          displayedVideo.alt = currentItem.desc;
          displayedVideo.classList.remove("hide");
          displayedVideo.controls = false; // Disable controls
          displayedVideo.play();

           // Run animation after the video ends
          displayedVideo.onended = () => {
            IntroText.classList.remove("hide");
            animation();
          };
        }
        isStatic = false;
        clearTimeout(staticTO);
      }, 400);
    };     
  
    const channelButton = document.getElementById("channel");
    const newsButton = document.getElementById("trenchnews");

    if (!channelButton || !newsButton) {
      console.error("TV Buttons not found.");
      return;
    }

    // Properly handle the click event
    channelButton.addEventListener("click", changeChannel);
    newsButton.addEventListener("click", showNewsModal);
  };
  
  const showNewsModal = () => {
    Swal.fire({
      title: "Trench News", // Optional title
      html: '<div id="newspaper-container"></div>', // Placeholder for Newspaper
      background: "black",
      color: "white",
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: "swal-newspaper-popup", // Custom styling class
      },
      didOpen: () => {
        const container = document.getElementById("newspaper-container");
        if (container) {
          const root = ReactDOM.createRoot(container);
          root.render(<Newspaper />);
        }
      },
    });
  };

  const animation = () => {
    const titleText = document.querySelector('.intro-text h1');
  
    // Get all the spans inside the h1
    const spans = titleText.querySelectorAll('span');
  
    spans.forEach((span) => {
      // Split the text inside each span into individual letters
      const letters = span.textContent.split('');
      span.innerHTML = '';
  
      // Wrap each letter in a <span> inside the original span
      letters.forEach((letter) => {
        const letterSpan = document.createElement('span');
        letterSpan.textContent = letter;
        letterSpan.style.opacity = 0; // Start hidden
        letterSpan.style.position = 'relative'; // For "bottom" animation
        letterSpan.style.bottom = '-80px'; // Start below final position
        span.appendChild(letterSpan);
      });
    });
  
    // Animate the individual letters
    const letterSpans = titleText.querySelectorAll('h1 span span');
    letterSpans.forEach((letter, index) => {
      // Staggered animations with bounce-like easing
      setTimeout(() => {
        letter.style.opacity = 1;
        letter.style.bottom = '0'; // Animate upwards
        letter.style.transition = `all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 0.05}s`; // Back.easeOut equivalent
      }, index * 50); // Delay for each letter
    });
  };

  // Helper Section Toggle
  const toggleHelperSection = () => {
    const helperSection = document.getElementById("helper-section");

    if (helperVisible) {
      helperSection.classList.remove("active");
    } else {
      helperSection.classList.add("active");
    }

    setHelperVisible(!helperVisible);
  };


  const renderActiveSection = () => {

    switch (activeSection) {
      case "home":
        return (
          <ErrorBoundary fallbackText="Home section crashed. Please refresh the page." resetOnError={true}>
            <HomePage
              currentNetwork={currentNetwork}
              isConnected={isConnected}
              showLoanRequestPopup={showLoanRequestPopup}
              toggleHelperSection={toggleHelperSection}
              handleContractAddressSearch={handleContractAddressSearch}
              handleFilterChange={handleFilterChange}
              filterType={filterType}
              filterAddress={filterAddress}
              loanList={loanList} // Pass the loan list to HomeSection for output
              helperVisible={helperVisible}
              fundingStats={fundingStats} // Pass funding stats to HomeSection for output
              CryptoTv={CryptoTv}
            />
          </ErrorBoundary>
        );
      case "wallet":
        return (
          <ErrorBoundary fallbackText="Wallet section encountered an error. Try again or refresh." resetOnError={true}>
            <WalletPage
              isConnected={isConnected}
              network={network}
              currentNetwork={currentNetwork}
              solanaProvider={solanaProvider}
              walletAddress={userAddress}
              validateContractData={validateContractData}
            />
          </ErrorBoundary>
        );
      case "telegram":
        return (
          <ErrorBoundary fallbackText="Community section crashed. Please refresh." resetOnError={true}>
            <TelegramPage />
          </ErrorBoundary>
        );
      case "dextools":
        return (
          <ErrorBoundary fallbackText="DexTools section crashed. Please refresh." resetOnError={true}>
            <DextoolsPage />
          </ErrorBoundary>
        );
      case "feedback":
        return (
          <ErrorBoundary fallbackText="Feedback section crashed. Please refresh." resetOnError={true}>
            <FeedbackPage />
          </ErrorBoundary>
        );
      case "dashboard":
        // Only render DashboardPage if a Solana provider is available
        if (solanaProvider) {
          return (
            <ErrorBoundary fallbackText="Dashboard encountered a Solana connection error." resetOnError={true}>
              <DashboardPage
                isConnected={isConnected}
                solanaProvider={solanaProvider}
                network={network}
                currentNetwork={currentNetwork}
                validateContractData={validateContractData}
              />
            </ErrorBoundary>
          );
        } else {
          return <p>Connect wallet to spy on courage...</p>;
        }
      default:
        return (
          <ErrorBoundary fallbackText="Home section crashed. Please refresh the page." resetOnError={true}>
            <HomePage />
          </ErrorBoundary>
        );
    }    
  };

  return (
    <div className="app-container" data-theme={themeMode}>
      {/* Loading Spinner Overlay */}
      {loading && (
        <div className="loading-spinner">
          <div className="neon-circle">
            <span title="Loading..." className="spinning-bone" role="img" aria-label="bone">
              🦴
            </span>
          </div>
        </div>
      )}
      
      {/* Constant Navigation Bar */}
      <nav className="bone-nav">
        <div className="circle left top"></div>
        <div className="circle left bottom"></div>
        <FaHome className="home-icon" onClick={() => handleSetActiveSection("home")} />
        <div className="halloctober__banner p-flex">
          <h1 className="couragesign shiny-glass">Courage's Meme Bank</h1>
          <div className="fog p-circle"></div>
        </div>
        
        <div className="network-switcher-container">
          <select onChange={handleNetworkChange} value={currentSolanaNetwork} className="network-switcher">
            <option value="devnet">Devnet</option>
            <option value="mainnet-beta">Mainnet</option>
          </select>
        </div>

        <div>
          <w3m-button
            label={isSmallScreen ? "Connect" : "scared to connect?"}
            loadingLabel="courageous.."
            className="connect-button"
            style={{ marginLeft: "10px", color: "white" }}
          ></w3m-button>
        </div>
        <div className="circle right top"></div>
        <div className="circle right bottom"></div>
      </nav>

      {/* Render trending tokens using Portal with ErrorBoundary */}
      {ReactDOM.createPortal(
        <ErrorBoundary fallbackText="Trending tokens unavailable" resetOnError={true}>
          <TrendingTokens network={network}/>
        </ErrorBoundary>,
        document.getElementById('trending-strip-container')
      )}

      <FloatingMenu setActiveSection={handleSetActiveSection} />
      {/* Floating Menu and Header 
      <header className="header-section">
        <h1 className="night-theme-h1">Courage's Meme Bank</h1>
      </header>
      */}

      {/* Dynamic Scene Rendering */}
      {scene === "sunrise" && <CourageRunning />}
      {scene === "evening" && <CourageScared />}
      {scene === "midnight" && <CourageRunning />}
      {scene === "noon"}

      {/* Main Content */}
      <main className="content-area">
        {renderActiveSection()}
        <ErrorBoundary fallbackText="Admin controls unavailable">
          <AdminSection />
        </ErrorBoundary>
      </main>
      
      {/* Trenchbot FAB */}
      <button 
        className="trenchbot-fab"
        onClick={() => setShowTrenchbot(!showTrenchbot)}
        title="Talk to Courage AI"
      >
        <FaRobot className="fab-icon" />
        {showTrenchbot ? (
          <span className="fab-close">×</span>
        ) : (
          <span className="fab-text">AI</span>
        )}
      </button>
      
      {/* Trenchbot Chat Interface */}
      {showTrenchbot && (
        <div className="trenchbot-wrapper">
          <Trenchbot />
        </div>
      )}
    </div>
  );
};
