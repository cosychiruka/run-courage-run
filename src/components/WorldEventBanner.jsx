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
    position: 'fixed', bottom: '85px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(15, 10, 30, 0.95)', backdropFilter: 'blur(12px)',
    border: '2px solid #eb57c1', borderRadius: '50px',
    padding: '12px 28px', color: '#fff', zIndex: Z,
    boxShadow: '0 0 30px rgba(235, 87, 193, 0.4)',
    fontFamily: '"Outfit", sans-serif', fontWeight: 900, fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)',
    textAlign: 'center', maxWidth: '90vw', whiteSpace: 'nowrap',
    textShadow: '0 0 10px rgba(255,255,255,0.3)',
    pointerEvents: 'all',
  },
  evening: {
    position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(10, 20, 10, 0.95)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0,255,80,0.5)', borderRadius: '16px',
    padding: '12px 20px', color: '#aaffcc', zIndex: Z,
    boxShadow: '0 0 25px rgba(0,255,80,0.2)',
    fontFamily: '"Courier New", monospace', fontSize: 'clamp(0.75rem, 2vw, 0.95rem)', fontStyle: 'italic',
    maxWidth: 'min(320px, 85vw)', lineHeight: 1.5,
    textShadow: '0 0 8px rgba(0,255,80,0.6)',
    pointerEvents: 'all',
  },
  sunrise: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -60%)',
    background: 'rgba(15, 10, 30, 0.96)', backdropFilter: 'blur(15px)',
    border: '2px solid #eb57c1', borderRadius: '24px',
    padding: '18px 28px', color: '#ffffff', zIndex: Z,
    boxShadow: '0 10px 50px rgba(0,0,0,0.6), 0 0 20px rgba(235, 87, 193, 0.3)',
    fontFamily: '"Outfit", sans-serif', fontSize: 'clamp(0.9rem, 2.8vw, 1.1rem)', fontStyle: 'italic',
    maxWidth: 'min(420px, 90vw)', textAlign: 'center', lineHeight: 1.6,
    pointerEvents: 'all',
  },
  noon: {
    position: 'fixed', bottom: '180px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15, 10, 30, 0.96)', backdropFilter: 'blur(15px)',
    border: '2px solid #eb57c1', borderRadius: '24px',
    padding: '18px 28px', color: '#ffffff', zIndex: Z,
    boxShadow: '0 10px 50px rgba(0,0,0,0.6), 0 0 20px rgba(235, 87, 193, 0.3)',
    fontFamily: '"Outfit", sans-serif', fontSize: 'clamp(0.9rem, 2.8vw, 1.1rem)', fontStyle: 'italic',
    maxWidth: 'min(420px, 90vw)', textAlign: 'center', lineHeight: 1.6,
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
