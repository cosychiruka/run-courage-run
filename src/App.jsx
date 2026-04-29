import React, { useState, useEffect, Suspense } from "react";
import "./App.css";
import Roadmap from "./components/ui/Roadmap";
import TeaserGrid from "./components/ui/TeaserGrid";
import { FaTv, FaNewspaper, FaTwitter, FaTelegramPlane } from "react-icons/fa";

const EveningWorld3D = React.lazy(() => import('./components/3d/EveningWorld3D'));
const CourageRunning = React.lazy(() => import('./scenes/CourageRunning'));

function App() {
  const [world3DMounted, setWorld3DMounted] = useState(false);
  const [world3DVisible, setWorld3DVisible] = useState(false);

  return (
    <div className="app-wrapper">
      {/* ── Navigation ── */}
      <nav className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem 0' }}>
        <h1 style={{ fontSize: '2.5rem', textShadow: '4px 4px 0px var(--courage-pink)' }}>COURAGE.FUN</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="#" className="brutal-btn" style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>BUY $RCR</a>
        </div>
      </nav>

      {/* ── Hero / 3D Section ── */}
      <section className="container">
        <div className="comic-banner">
          <h2 style={{ fontSize: '3rem' }}>RUN COURAGE RUN!</h2>
        </div>
        
        <p style={{ fontSize: '1.2rem', maxWidth: '600px', margin: '1rem auto 2rem', fontWeight: '500' }}>
          The first self-aware AI meme on Solana. He's scared, he's fast, and he's living in your browser.
        </p>

        {/* 3D Viewfinder Frame */}
        <div className="brutal-card" style={{ 
          height: '600px', 
          padding: 0, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000'
        }}>
          <Suspense fallback={<div className="loading-screen"><h3>LOADING REALITY...</h3></div>}>
            {!world3DVisible ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <CourageRunning />
                <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <button 
                    className="brutal-btn" 
                    onClick={() => setWorld3DMounted(true)}
                  >
                    ENTER 3D WORLD
                  </button>
                </div>
              </div>
            ) : null}
            
            {world3DMounted && (
              <EveningWorld3D 
                visible={world3DVisible} 
                onReady={() => setWorld3DVisible(true)} 
              />
            )}
          </Suspense>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <Roadmap />

      {/* ── Teasers ── */}
      <TeaserGrid />

      {/* ── Tokenomics ── */}
      <section className="container" style={{ padding: '4rem 0' }}>
        <div className="comic-banner" style={{ transform: 'rotate(1deg)', background: 'white' }}>
          <h2 style={{ fontSize: '2.5rem' }}>DOG-NOMICS</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginTop: '3rem' }}>
          {[
            { label: 'SUPPLY', val: '1 BILLION' },
            { label: 'TAX', val: '0%' },
            { label: 'LIQUIDITY', val: 'BURNED' },
            { label: 'DEV', val: 'SCARDY CAT' }
          ].map((stat, i) => (
            <div key={i} className="brutal-card" style={{ background: i % 2 === 0 ? 'var(--courage-pink)' : 'var(--nowhere-yellow)' }}>
              <h4 style={{ fontSize: '0.8rem', opacity: 0.7 }}>{stat.label}</h4>
              <p style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stat.val}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Community ── */}
      <footer style={{ padding: '6rem 0', background: 'var(--courage-purple)', color: 'white', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: '3rem', marginBottom: '2rem' }}>JOIN THE PACK</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
            <a href="#" className="brutal-btn" style={{ background: '#1DA1F2', color: 'white' }}><FaTwitter /> TWITTER</a>
            <a href="#" className="brutal-btn" style={{ background: '#0088cc', color: 'white' }}><FaTelegramPlane /> TELEGRAM</a>
          </div>
          <p style={{ marginTop: '4rem', opacity: 0.5 }}>© 1999 - 2026 Middle of Nowhere. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
