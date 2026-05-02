import React, { useEffect, useState } from 'react';

/**
 * WorldEventBanner — displays LLM-generated world events as a themed overlay.
 *
 * Each world has its own styling and position:
 *   disco   → bottom center DJ shoutout banner (pink neon)
 *   evening → top-left ghost whisper (spooky green)
 *   sunrise → center thought bubble (sky blue, Courage inner voice)
 *   noon    → bottom-right narrator caption (warm amber)
 *
 * @prop {object|null} event  — from useWorldEvents(). null = nothing showing
 * @prop {string}      world  — 'disco' | 'evening' | 'sunrise' | 'noon'
 * @prop {function}   onDismiss — clears the event
 */

// Z-index high enough to always be above the WebGL canvas and all overlays
const Z = 10000;

const WORLD_STYLES = {
  disco: {
    position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, rgba(20,0,40,0.97) 0%, rgba(60,0,80,0.97) 100%)',
    border: '2px solid #ff00cc', borderRadius: '50px',
    padding: '10px 22px', color: '#fff', zIndex: Z,
    boxShadow: '0 0 40px rgba(255,0,200,0.6)',
    fontFamily: '"Comic Sans MS", cursive', fontWeight: 900, fontSize: 'clamp(0.8rem, 2.5vw, 1.1rem)',
    textAlign: 'center', maxWidth: '90vw', whiteSpace: 'nowrap',
    textShadow: '0 0 20px rgba(255,0,200,1)',
    pointerEvents: 'all',
  },
  evening: {
    position: 'fixed', top: '80px', left: '16px',
    background: 'rgba(0,18,10,0.95)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(0,255,80,0.4)', borderRadius: '12px',
    padding: '10px 16px', color: '#aaffcc', zIndex: Z,
    boxShadow: '0 0 25px rgba(0,255,80,0.25)',
    fontFamily: '"Courier New", monospace', fontSize: 'clamp(0.75rem, 2vw, 0.95rem)', fontStyle: 'italic',
    maxWidth: 'min(280px, 85vw)', lineHeight: 1.5,
    textShadow: '0 0 12px rgba(0,255,80,0.8)',
    pointerEvents: 'all',
  },
  sunrise: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -55%)',
    background: 'rgba(10, 60, 120, 0.95)', backdropFilter: 'blur(10px)',
    border: '2px solid rgba(100,200,255,0.5)', borderRadius: '20px',
    padding: '14px 24px', color: '#e0f4ff', zIndex: Z,
    boxShadow: '0 8px 40px rgba(50,150,255,0.35)',
    fontFamily: '"Comic Sans MS", cursive', fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', fontStyle: 'italic',
    maxWidth: 'min(340px, 88vw)', textAlign: 'center', lineHeight: 1.5,
    pointerEvents: 'all',
  },
  noon: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -55%)',
    background: 'rgba(20, 70, 140, 0.95)', backdropFilter: 'blur(10px)',
    border: '2px solid rgba(100,210,255,0.6)', borderRadius: '20px',
    padding: '14px 24px', color: '#e0faff', zIndex: Z,
    boxShadow: '0 8px 40px rgba(40,140,255,0.4)',
    fontFamily: '"Comic Sans MS", cursive', fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', fontStyle: 'italic',
    maxWidth: 'min(340px, 88vw)', textAlign: 'center', lineHeight: 1.5,
    pointerEvents: 'all',
  },
};

const WORLD_EMOJI = {
  disco:   '🎵',
  evening: '👻',
  sunrise: '💭',
  noon:    '📖',
};

const ACTION_EMOJI = {
  // Disco
  speed_up:      '⚡',
  slow_down:     '🌊',
  color_shift:   '🌈',
  ghost_frenzy:  '👻',
  freeze_frame:  '❄️',
  lights_out:    '🌑',
  dj_shoutout:   '🎤',
  // Evening
  retreat:       '💨',
  advance:       '😈',
  hide:          '🫥',
  call_friends:  '📣',
  taunt:         '😂',
  disappear:     '✨',
  // Sunrise
  thought_bubble: '💭',
  // Noon
  courage_sniff:  '🐕',
  courage_bark:   '🔊',
  leaf_blows:     '🍂',
  bird_lands:     '🐦',
  cloud_shadow:   '☁️',
};

export default function WorldEventBanner({ event, world, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [event]);

  if (!event || !visible) return null;

  const styles = WORLD_STYLES[world] || WORLD_STYLES.noon;
  const worldEmoji = WORLD_EMOJI[world] || '✨';
  const actionEmoji = ACTION_EMOJI[event.action] || worldEmoji;

  return (
    <div
      style={{
        ...styles,
        animation: 'worldEventIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      }}
      onClick={onDismiss}
      title="Click to dismiss"
    >
      {world === 'sunrise' && (
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🐕</div>
      )}
      {world === 'evening' && (
        <div style={{ fontSize: '1.8rem', marginBottom: '8px', filter: 'drop-shadow(0 0 8px rgba(0,255,80,0.6))' }}>👻</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '8px', fontSize: '1.2rem' }}>{actionEmoji}</span>
        <span>{event.message}</span>
      </div>
      {world === 'disco' && event.action === 'dj_shoutout' && (
        <span style={{ marginLeft: '8px', opacity: 0.7 }}>— DJ Courage</span>
      )}
      <div style={{
        position: 'absolute', top: '6px', right: '10px',
        fontSize: '0.7rem', opacity: 0.5, cursor: 'pointer',
      }}>✕</div>
    </div>
  );
}
