import { useState, useEffect } from 'react';
import '../assets/css/WelcomeTour.css';

const STORAGE_KEY = 'courage_toured';

const FEATURES = [
  {
    icon: '🌲',
    title: 'Enter Four Worlds',
    desc: 'Explore Sunrise, Noon, Evening, and Disco. Midnight opens the darker Evening route.',
    color: '#eb57c1',
  },
  {
    icon: '👀',
    title: 'Wake a Tickerling',
    desc: 'Click a short watching bush—or hold it in your gaze—to reveal an eligible live token signal.',
    color: '#ff4545',
  },
  {
    icon: '🟢',
    title: 'Read Live Signals',
    desc: 'The landing page and forest share one Robinhood Chain discovery snapshot from DexScreener.',
    color: '#14F195',
  },
  {
    icon: '📡',
    title: 'Follow the Dispatch',
    desc: 'Read sourced crypto news and follow @cowardlyhood for selective forest and market transmissions.',
    color: '#9945FF',
  },
  {
    icon: '🎙️',
    title: 'Talk to Courage',
    desc: 'Use the microphone on the landing page or inside a world for a context-aware voice conversation.',
    color: '#14F195',
  },
];

const WelcomeTour = ({ forceOpen, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceOpen) { setVisible(true); return; }
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    if (onClose) onClose();
  };

  if (!visible) return null;

  return (
    <div className="tour-backdrop" onClick={dismiss}>
      <div className="tour-card" onClick={e => e.stopPropagation()}>

        <div className="tour-header">
          <span className="tour-logo">📺</span>
          <div>
            <h2 className="tour-title">Welcome to Nowhere</h2>
            <p className="tour-subtitle">The meme escaped the forest. The forest followed.</p>
          </div>
        </div>

        <div className="tour-features">
          {FEATURES.map(f => (
            <div key={f.title} className="tour-feature" style={{ '--accent': f.color }}>
              <span className="tour-feature-icon">{f.icon}</span>
              <div>
                <strong className="tour-feature-title">{f.title}</strong>
                <p className="tour-feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="tour-outro-hint">
          “Self-aware doesn’t mean brave. It means I can’t look away anymore.”
        </p>

        <div className="tour-alive-banner">
          <span className="tour-alive-pulse" />
          <span className="tour-alive-text">
            He&rsquo;s Alive &mdash; Agentic Meme World
          </span>
          <span className="tour-alive-sub">Live voice • world-aware memory • autonomous X dispatches</span>
        </div>

        <button className="tour-cta" onClick={dismiss}>
          Let&apos;s Go!
        </button>

        <p className="tour-fine">This guide only appears on your first visit.</p>
      </div>
    </div>
  );
};

export default WelcomeTour;
