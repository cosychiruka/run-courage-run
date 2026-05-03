import React, { useState, useEffect, useRef } from 'react';
import './TweetCardHologram.css';

const X_LOGO = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="tweet-card-x-logo" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
  </svg>
);

export default function TweetCardHologram({ tweets = [], visible = false, query = '' }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const cycleRef = useRef(null);

  // Mount/unmount with a frame delay for CSS transition
  useEffect(() => {
    if (visible && tweets.length > 0) {
      setActiveIdx(0);
      setMounted(true);
    } else {
      setMounted(false);
    }
  }, [visible, tweets]);

  // Cycle through multiple tweets every 5s
  useEffect(() => {
    if (!mounted || tweets.length <= 1) return;
    cycleRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % tweets.length);
    }, 5000);
    return () => clearInterval(cycleRef.current);
  }, [mounted, tweets.length]);

  if (!mounted || tweets.length === 0) return null;

  const tweet = tweets[activeIdx];

  return (
    <div className={`tweet-hologram${mounted ? ' tweet-hologram--visible' : ''}`} aria-live="polite">
      <div className="tweet-hologram-card">
        {/* Scanline overlay */}
        <div className="tweet-hologram-scanlines" aria-hidden="true" />

        {/* Header */}
        <div className="tweet-card-header">
          {X_LOGO}
          <div className="tweet-card-identity">
            <span className="tweet-card-name">{tweet.author}</span>
            <span className="tweet-card-handle">{tweet.handle}</span>
          </div>
        </div>

        {/* Body */}
        <p className="tweet-card-text">{tweet.text}</p>

        {/* Footer */}
        <div className="tweet-card-footer">
          <span className="tweet-card-metric">❤️ {tweet.likes.toLocaleString()}</span>
          <span className="tweet-card-metric">🔁 {tweet.retweets.toLocaleString()}</span>
          {query && <span className="tweet-card-query">"{query.slice(0, 30)}"</span>}
        </div>

        {/* Dot indicator for multiple tweets */}
        {tweets.length > 1 && (
          <div className="tweet-card-dots" aria-label={`Tweet ${activeIdx + 1} of ${tweets.length}`}>
            {tweets.map((_, i) => (
              <button
                key={i}
                className={`tweet-card-dot${i === activeIdx ? ' tweet-card-dot--active' : ''}`}
                onClick={() => setActiveIdx(i)}
                aria-label={`Show tweet ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
