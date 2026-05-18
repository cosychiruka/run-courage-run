import React, { useState, useEffect } from 'react';

const Footer = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [showIOSHint, setShowIOSHint]       = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const handleLogoClick = async () => {
    if (isInstalled) return;

    if (isIOS) {
      setShowIOSHint(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <footer className="courage-footer">
      <div className="footer-content">
        <div className="footer-icon-wrap" onClick={handleLogoClick} title={isInstalled ? 'App installed!' : 'Tap to install the app'}>
          <img
            src="/web-app-manifest-192x192.png"
            alt="Courage Icon"
            className={`footer-icon ${isInstalled ? 'installed' : deferredPrompt || isIOS ? 'installable' : ''}`}
          />
          {!isInstalled && (deferredPrompt || isIOS) && (
            <span className="install-badge">Install</span>
          )}
          {isInstalled && (
            <span className="install-badge installed-badge">Installed ✓</span>
          )}
        </div>
        <div className="footer-outro">
          "When someone says the world is too much for them, tell them they need some Courage. Download the App, wink!!"
        </div>
      </div>

      {/* iOS "Add to Home Screen" instruction sheet */}
      {showIOSHint && (
        <div className="ios-hint-overlay" onClick={() => setShowIOSHint(false)}>
          <div className="ios-hint-card" onClick={e => e.stopPropagation()}>
            <button className="ios-hint-close" onClick={() => setShowIOSHint(false)}>✕</button>
            <p className="ios-hint-title">📲 Add to Home Screen</p>
            <ol className="ios-hint-steps">
              <li>Tap the <strong>Share</strong> button <span className="ios-share-icon">⬆</span> at the bottom of Safari</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>Add</strong> — Courage lives on your phone!</li>
            </ol>
          </div>
        </div>
      )}

      <style>{`
        .courage-footer {
          margin-top: auto;
          background: linear-gradient(180deg, transparent 0%, rgba(203, 156, 251, 0.6) 100%);
          border-top: 1px solid #eb57c1;
          padding: 2.5rem 1rem 3rem;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 10;
        }
        .footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          max-width: 600px;
          text-align: center;
          animation: floatFooter 4s ease-in-out infinite;
        }
        .footer-icon-wrap {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .footer-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid #eb57c1;
          box-shadow: 0 0 15px rgba(235, 87, 193, 0.5), inset 0 0 10px rgba(235, 87, 193, 0.3);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        }
        .footer-icon.installable {
          box-shadow: 0 0 22px rgba(235, 87, 193, 0.9), 0 0 8px rgba(255,255,255,0.4);
          animation: installPulse 2s ease-in-out infinite;
        }
        .footer-icon.installed {
          border-color: #14F195;
          box-shadow: 0 0 18px rgba(20, 241, 149, 0.6);
        }
        .footer-icon-wrap:hover .footer-icon {
          transform: scale(1.15) rotate(10deg);
        }
        .install-badge {
          font-family: 'Bangers', cursive;
          font-size: 0.8rem;
          letter-spacing: 1px;
          background: #eb57c1;
          color: white;
          padding: 2px 10px;
          border-radius: 20px;
          border: 1.5px solid black;
          box-shadow: 2px 2px 0 black;
          pointer-events: none;
        }
        .installed-badge {
          background: #14F195;
          color: black;
        }
        .footer-outro {
          font-family: 'Comic Sans MS', 'Chalkboard SE', cursive;
          font-size: 0.95rem;
          color: #eb57c1;
          text-shadow: 0 0 2px black;
          line-height: 1.4;
          font-weight: bold;
          font-style: italic;
        }
        @keyframes floatFooter {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-5px); }
        }
        @keyframes installPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(235,87,193,0.6); }
          50%       { box-shadow: 0 0 28px rgba(235,87,193,1), 0 0 10px rgba(255,255,255,0.5); }
        }

        /* iOS hint sheet */
        .ios-hint-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .ios-hint-card {
          background: #1a1a2e;
          border: 2px solid #eb57c1;
          border-radius: 24px 24px 0 0;
          padding: 2rem 1.5rem 2.5rem;
          width: 100%;
          max-width: 480px;
          position: relative;
          color: white;
        }
        .ios-hint-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 1rem;
          cursor: pointer;
        }
        .ios-hint-title {
          font-family: 'Bangers', cursive;
          font-size: 1.6rem;
          letter-spacing: 2px;
          color: #eb57c1;
          margin: 0 0 1rem;
          text-align: center;
        }
        .ios-hint-steps {
          padding-left: 1.2rem;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          line-height: 1.5;
        }
        .ios-share-icon {
          display: inline-block;
          background: #007AFF;
          color: white;
          padding: 0 5px;
          border-radius: 4px;
          font-size: 0.8rem;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
