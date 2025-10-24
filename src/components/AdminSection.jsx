import React, { useState, useEffect } from 'react';
import { initializeProgram } from '../services/adminService';
import { APP_ENV } from '../config/env';
import { contractData } from '../config/contractData';
import Swal from 'sweetalert2';
import '../styles/AdminSection.css';

const AdminSection = () => {
  const [isDevnet, setIsDevnet] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [feeRecipient, setFeeRecipient] = useState('');
  const [feeBasisPoints, setFeeBasisPoints] = useState(100); // Default 1%
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    // Show in devnet, localhost, or development env
    const isDev = APP_ENV === 'development';
    const isDevnetInUrl = window.location.href.includes('devnet');
    const isLocalhost = window.location.hostname === 'localhost';
    setIsDevnet(isDev || isDevnetInUrl || isLocalhost);

    // Listen for global event dispatched by FloatingMenu
    const handleOpenModal = () => {
      setShowModal(true);
    };
    window.addEventListener('open-admin-modal', handleOpenModal);

    // Cleanup
    return () => {
      window.removeEventListener('open-admin-modal', handleOpenModal);
    };
  }, []);

  const openModal = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleInitializeProgram = async (e) => {
    e.preventDefault();
    
    if (!feeRecipient) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Input',
        text: 'Please enter a fee recipient address',
      });
      return;
    }

    setIsInitializing(true);

    try {
      // Get program ID from contract data (using devnet since this is only for devnet)
      const programId = contractData['devnet'].address;
      
      // Call initialization function
      const result = await initializeProgram(
        programId, 
        feeRecipient, 
        feeBasisPoints
      );

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Program Initialized!',
          text: `Transaction signature: ${result.signature}`,
        });
        closeModal();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Initialization Failed',
          text: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      console.error('Program initialization error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Initialization Failed',
        text: error.message || 'Unknown error occurred',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Don't render admin controls unless devnet-like env detected
  if (!isDevnet) return null;

  return (
    <div className="admin-section">
      <div className="admin-header">
        <h3>Admin Controls</h3>
        <span className="devnet-badge">DEVNET ONLY</span>
      </div>

      <button 
        className="admin-button"
        onClick={openModal}
      >
        Initialize Program
      </button>

      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Initialize Program</h3>
              <button className="admin-close-button" onClick={closeModal}>×</button>
            </div>
            <div className="admin-modal-content">
              <p>This will initialize the program configuration and stats accounts on Solana devnet.</p>
              
              <form onSubmit={handleInitializeProgram}>
                <div className="form-group">
                  <label htmlFor="feeRecipient">Fee Recipient Address:</label>
                  <input
                    type="text"
                    id="feeRecipient"
                    value={feeRecipient}
                    onChange={(e) => setFeeRecipient(e.target.value)}
                    placeholder="Enter Solana address"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="feeBasisPoints">Fee (basis points):</label>
                  <input
                    type="number"
                    id="feeBasisPoints"
                    value={feeBasisPoints || ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value);
                      setFeeBasisPoints(val === '' ? 0 : val);
                    }}
                    min="0"
                    max="10000"
                    step="1"
                    required
                  />
                  <small>{(feeBasisPoints / 100).toFixed(2)}%</small>
                </div>

                <div className="form-group">
                  <button 
                    type="submit" 
                    className="admin-submit-button"
                    disabled={isInitializing}
                  >
                    {isInitializing ? 'Initializing...' : 'Initialize Program'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSection;
