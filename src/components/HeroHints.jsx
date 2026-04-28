import React, { useState, useEffect, useRef } from 'react';
import '../assets/css/HeroHints.css';

const HINTS = {
  midnight: [
    '👻 Click Courage to blast the ghosts away!',
    '💜 Repulse the ghosts — Courage needs you!',
    '👆 Tap Courage to unleash energy pulse!',
    '🌙 The ghosts are coming... do something!',
  ],
  evening: [
    '✨ Watch the fireflies glow in the dark...',
    '📰 Read the News to see how Courage feels!',
    '💥 Open News and let Courage explode from fear!',
  ],
  sunrise: [
    '🪰 Click the flies to squash them for Courage!',
    '🪰 Those flies are terrorising him — squash them!',
    '📺 Watch TV — Courage has meme content for you',
    '☀️ Hit the flies before they land on Courage!',
  ],
  noon: [
    '🪰 Squash the flies — they\'re bugging Courage!',
    '😌 Courage is relaxed... for now. Read the news!',
    '🪰 Click those flies! Each one drives him crazy!',
    '📺 Watch TV and see what Courage watches at noon',
  ],
};

const SHOW_DELAY_MIN = 18000; // 18s
const SHOW_DELAY_MAX = 32000; // 32s
const SHOW_DURATION  = 5500;  // visible time before typing out

const HeroHints = ({ scene }) => {
  const [visible,    setVisible]    = useState(false);
  const [typed,      setTyped]      = useState('');
  const [fullText,   setFullText]   = useState('');
  const [fading,     setFading]     = useState(false);
  const timerRef  = useRef(null);
  const typeRef   = useRef(null);
  const indexRef  = useRef(0);

  const pickHint = (sc) => {
    const pool = HINTS[sc] || HINTS.sunrise;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const typeWriter = (text, onDone) => {
    let i = 0;
    setTyped('');
    const tick = () => {
      i++;
      setTyped(text.slice(0, i));
      if (i < text.length) typeRef.current = setTimeout(tick, 38);
      else onDone?.();
    };
    typeRef.current = setTimeout(tick, 80);
  };

  const showHint = (sc) => {
    const text = pickHint(sc);
    setFullText(text);
    setFading(false);
    setVisible(true);
    typeWriter(text, () => {
      // Hold then fade out
      timerRef.current = setTimeout(() => {
        setFading(true);
        timerRef.current = setTimeout(() => {
          setVisible(false);
          setTyped('');
          scheduleNext(sc);
        }, 600);
      }, SHOW_DURATION);
    });
  };

  const scheduleNext = (sc) => {
    const delay = SHOW_DELAY_MIN + Math.random() * (SHOW_DELAY_MAX - SHOW_DELAY_MIN);
    timerRef.current = setTimeout(() => showHint(sc), delay);
  };

  useEffect(() => {
    // First hint after 6s, then random intervals
    timerRef.current = setTimeout(() => showHint(scene), 6000);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(typeRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  if (!visible) return null;

  return (
    <div className={`hero-hint-banner${fading ? ' fading' : ''}`}>
      <span className="hero-hint-cursor" aria-hidden="true" />
      <span className="hero-hint-text">{typed}</span>
      <span className={`hero-hint-caret${typed.length === fullText.length ? ' blink' : ''}`}>|</span>
    </div>
  );
};

export default HeroHints;
