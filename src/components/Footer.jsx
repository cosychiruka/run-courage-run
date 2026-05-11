import React, { useState } from 'react';
import { FaBolt, FaSync, FaShieldAlt, FaRocket } from 'react-icons/fa';

const API = import.meta.env.VITE_BACKEND_URL || '';

const Footer = () => {
  const [loading, setLoading] = useState(null);

  const triggerAction = async (endpoint, label) => {
    setLoading(label);
    try {
      await fetch(`${API}/api/autonomous/${endpoint}`, { method: 'POST' });
      alert(`${label} successful!`);
    } catch (e) {
      alert(`${label} failed.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <footer className="courage-footer">
      <div className="footer-actions glass-panel">
        <button 
          className="action-btn trigger" 
          onClick={() => triggerAction('trigger-now', 'Force Tick')}
          disabled={loading === 'Force Tick'}
        >
          <FaBolt /> {loading === 'Force Tick' ? 'Firing...' : 'Force Tick'}
        </button>
        <button 
          className="action-btn reset" 
          onClick={() => triggerAction('reset-circuit-breaker', 'Reset Breaker')}
          disabled={loading === 'Reset Breaker'}
        >
          <FaShieldAlt /> {loading === 'Reset Breaker' ? 'Resetting...' : 'Reset Breaker'}
        </button>
        <button 
          className="action-btn reload" 
          onClick={() => window.location.reload()}
        >
          <FaSync /> Refresh
        </button>
      </div>

      <div className="footer-content">
        <img 
          src="/web-app-manifest-192x192.png" 
          alt="Courage Icon" 
          className="footer-icon"
        />
        <div className="footer-outro">
          "The things I do for love... and for the pack. Keep running, nowhere!"
        </div>
      </div>

      <style>{`
        .courage-footer {
          margin-top: 4rem;
          background: linear-gradient(180deg, transparent 0%, rgba(10, 0, 20, 0.9) 100%);
          border-top: 1px solid rgba(235, 87, 193, 0.15);
          padding: 3rem 1rem 4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2.5rem;
          position: relative;
          z-index: 100;
        }
        .footer-actions {
          display: flex;
          gap: 1rem;
          padding: 1rem 2rem;
          border-radius: 50px;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .action-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 0.6rem 1.2rem;
          border-radius: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .action-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .action-btn.trigger { color: #ff00ff; border-color: rgba(255, 0, 255, 0.3); }
        .action-btn.trigger:hover { background: rgba(255, 0, 255, 0.1); }
        .action-btn.reset { color: #00ffaa; border-color: rgba(0, 255, 170, 0.3); }
        .action-btn.reset:hover { background: rgba(0, 255, 170, 0.1); }
        .action-btn.reload { color: #aaa; }
        
        .footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          max-width: 600px;
          text-align: center;
        }
        .footer-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 1.5px solid #eb57c1;
          box-shadow: 0 0 15px rgba(235, 87, 193, 0.4);
          transition: transform 0.3s;
        }
        .footer-icon:hover { transform: scale(1.1) rotate(5deg); }
        .footer-outro {
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem;
          color: #14F195;
          opacity: 0.8;
          line-height: 1.4;
          font-style: italic;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
