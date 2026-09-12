import { useState, useEffect } from 'react';

const Footer = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [showIOSHint, setShowIOSHint]       = useState(false);

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

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
          “When the world is too much, follow the signal until you find some <span className="highlight">Courage</span>.” Install the world and keep exploring.
        </div>

        <div className="footer-meta">
          <span>© {new Date().getFullYear()} Run Courage Run</span>
          <span className="footer-dot">•</span>
          <a href="https://x.com/cowardlyhood" target="_blank" rel="noopener noreferrer" className="footer-link">@cowardlyhood</a>
          <span className="footer-dot">•</span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="footer-link">Terms</a>
          <span className="footer-dot">•</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="footer-link">Privacy</a>
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
              <li>Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong></li>
              <li>Tap <strong>Add</strong> — Courage lives on your phone!</li>
            </ol>
          </div>
        </div>
      )}

      <style>{`
        .courage-footer {
          margin-top: auto;
          background: linear-gradient(180deg, rgba(10, 10, 16, 0.4) 0%, rgba(0, 200, 5, 0.07) 100%);
          border-top: 1px solid rgba(0, 200, 5, 0.25);
          padding: 3rem 1rem 4rem;
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
          gap: 1.2rem;
          max-width: 620px;
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
          border: 2px solid #00C805;
          box-shadow: 0 0 16px rgba(0, 200, 5, 0.4), inset 0 0 10px rgba(0, 200, 5, 0.2);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        }
        .footer-icon.installable {
          box-shadow: 0 0 24px rgba(0, 200, 5, 0.85), 0 0 8px rgba(255, 255, 255, 0.4);
          animation: installPulse 2s ease-in-out infinite;
        }
        .footer-icon.installed {
          border-color: #00E676;
          box-shadow: 0 0 18px rgba(0, 230, 118, 0.6);
        }
        .footer-icon-wrap:hover .footer-icon {
          transform: scale(1.15) rotate(8deg);
          box-shadow: 0 0 24px rgba(0, 200, 5, 0.7);
        }
        .install-badge {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-weight: 700;
          font-size: 0.78rem;
          letter-spacing: 0.5px;
          background: #00C805;
          color: #000000;
          padding: 3px 12px;
          border-radius: 20px;
          border: 1px solid #00E676;
          box-shadow: 0 2px 8px rgba(0, 200, 5, 0.3);
          pointer-events: none;
        }
        .installed-badge {
          background: #00E676;
          color: #000000;
        }
        .footer-outro {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 0.95rem;
          color: #a5a5bc;
          line-height: 1.5;
          font-weight: 400;
          font-style: italic;
        }
        .footer-outro .highlight {
          color: #00E676;
          font-weight: 600;
          font-style: normal;
        }
        .footer-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.7rem;
          flex-wrap: wrap;
          margin-top: 0.2rem;
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 0.85rem;
          color: #707085;
        }
        .footer-link {
          color: #a0a0b8;
          text-decoration: none;
          transition: color 0.2s ease;
          font-weight: 500;
        }
        .footer-link:hover {
          color: #00C805;
          text-decoration: underline;
        }
        .footer-dot {
          color: #404055;
          font-size: 0.75rem;
        }
        @keyframes floatFooter {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes installPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(0, 200, 5, 0.5); }
          50%       { box-shadow: 0 0 28px rgba(0, 200, 5, 1), 0 0 10px rgba(255,255,255,0.5); }
        }

        /* iOS hint sheet */
        .ios-hint-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .ios-hint-card {
          background: #12121c;
          border: 2px solid #00C805;
          border-radius: 24px 24px 0 0;
          padding: 2rem 1.5rem 2.5rem;
          width: 100%;
          max-width: 480px;
          position: relative;
          color: white;
          box-shadow: 0 -10px 30px rgba(0, 200, 5, 0.2);
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
          font-family: 'Outfit', sans-serif;
          font-weight: 800;
          font-size: 1.5rem;
          letter-spacing: 1px;
          color: #00C805;
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
          background: #00C805;
          color: black;
          padding: 0 6px;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: bold;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
