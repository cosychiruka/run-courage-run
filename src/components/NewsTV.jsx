import React, { useRef, useCallback } from 'react';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import Newspaper from './Newspaper';
import '../assets/css/NewsTV.css';

const EMOTION_MAP = {
  happy:   { emoji: '🚀', label: 'WAGMI',   color: '#14F195' },
  scared:  { emoji: '😱', label: 'NGMI',    color: '#ff4545' },
  neutral: { emoji: '🐕', label: "chillin'", color: '#eb57c1' },
};

const NewsTV = ({
  articles,
  articleIndex,
  onPrev,
  onNext,
  onClose,
  onFetch,
  newsEmotion,
  loading,
  country,
  setCountry,
  category,
  setCategory,
}) => {
  const article = articles[articleIndex] || null;
  const em = EMOTION_MAP[newsEmotion] || EMOTION_MAP.neutral;

  // ── Swipe-to-navigate (mobile) ─────────────────────────────────────────
  const touchStartX = useRef(null);
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) onNext();
      else onPrev();
    }
    touchStartX.current = null;
  }, [onNext, onPrev]);

  return (
    <div className="news-tv-overlay" onClick={onClose}>
      <div className="news-tv-wrapper" onClick={e => e.stopPropagation()}>

        {/* CRT scan-line effect */}
        <div className="news-tv-scanlines" aria-hidden="true" />

        {/* Header bar */}
        <div className="news-tv-topbar">
          <span className="news-tv-brand">COURAGE NEWS NET</span>
          <span className="news-emotion-chip" style={{ background: em.color }}>
            {em.emoji} {em.label}
          </span>
          <button className="news-tv-close" onClick={onClose} title="Close">
            <FaTimes />
          </button>
        </div>

        {/* Scrollable screen area with swipe support */}
        <div
          className="news-tv-screen-area"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {loading ? (
            <div className="news-loading">
              <FaSpinner className="news-spinner" />
              <p>Courage is checking the trenches...</p>
            </div>
          ) : (
            <Newspaper
              key={articleIndex}
              article={article}
              articleIndex={articleIndex}
              totalArticles={articles.length}
              onPrev={onPrev}
              onNext={onNext}
              onFetch={onFetch}
              loading={loading}
              country={country}
              setCountry={setCountry}
              category={category}
              setCategory={setCategory}
              newsEmotion={newsEmotion}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsTV;
