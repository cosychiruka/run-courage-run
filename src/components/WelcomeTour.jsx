import React, { useState, useEffect } from 'react';
import '../assets/css/WelcomeTour.css';

const STORAGE_KEY = 'courage_toured';

const FEATURES = [
  {
    icon: '🐕',
    title: 'Click Courage',
    desc: 'Click his head to pet him. Click his body to poke him. He reacts every time.',
    color: '#eb57c1',
  },
  {
    icon: '💥',
    title: 'Explode Him',
    desc: 'Switch to night scene with the clock button, then hit Explode in the bar below.',
    color: '#ff4545',
  },
  {
    icon: '📰',
    title: 'Read the News',
    desc: 'Real world news lands here. Courage reads every headline and reacts emotionally.',
    color: '#14F195',
  },
  {
    icon: '☀️',
    title: 'Toggle Scenes',
    desc: 'Hit the clock icon in the nav bar to cycle between day, noon, evening and midnight.',
    color: '#9945FF',
  },
  {
    icon: '🤖',
    title: "He's Alive",
    desc: 'Courage runs a local AI. Hit the mic button above him to start a voice chat — no typing needed.',
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
            <h2 className="tour-title">Welcome to Courage's Corner</h2>
            <p className="tour-subtitle">Here's what you can do, fren</p>
          </div>
        </div>

        <div className="tour-features">
          {FEATURES.map(f => (
            <div key={f.title} className="tour-feature" style={{ '--accent': f.color }}>
              <span className="tour-feature-icon">{f.icon}</span>
              <strong className="tour-feature-title">{f.title}</strong>
              <p className="tour-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="tour-outro-hint">
          "When someone says the world is too much for them, tell them they need some Courage. Download the App, wink!!"
        </p>

        <div className="tour-alive-banner">
          <span className="tour-alive-pulse" />
          <span className="tour-alive-text">
            He&rsquo;s Alive &mdash; Animated Self Aware Meme
          </span>
          <span className="tour-alive-sub">AI Voice Chat powered by local LLM</span>
        </div>

        <button className="tour-cta" onClick={dismiss}>
          Let's Go!
        </button>

        <p className="tour-fine">This guide only appears on your first visit.</p>
      </div>
    </div>
  );
};

export default WelcomeTour;
