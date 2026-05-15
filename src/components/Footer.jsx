import React from 'react';

const Footer = () => {
  return (
    <footer className="courage-footer">
      <div className="footer-content">
        <img 
          src="/web-app-manifest-192x192.png" 
          alt="Courage Icon" 
          className="footer-icon"
        />
        <div className="footer-outro">
          "When someone says the world is too much for them, tell them they need some Courage. Download the App, wink!!"
        </div>
      </div>
      <style>{`
        .courage-footer {
          margin-top: auto;
          background: linear-gradient(180deg, transparent 0%, rgba(10, 0, 20, 0.6) 100%);
          border-top: 1px solid rgba(235, 87, 193, 0.2);
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
        .footer-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid #eb57c1;
          box-shadow: 0 0 15px rgba(235, 87, 193, 0.5), inset 0 0 10px rgba(235, 87, 193, 0.3);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }
        .footer-icon:hover {
          transform: scale(1.15) rotate(10deg);
        }
        .footer-outro {
          font-family: 'Comic Sans MS', 'Chalkboard SE', cursive;
          font-size: 0.95rem;
          color: #14F195;
          text-shadow: 0 0 10px rgba(20, 241, 149, 0.5);
          line-height: 1.4;
          font-weight: bold;
          font-style: italic;
        }
        @keyframes floatFooter {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-5px); }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
