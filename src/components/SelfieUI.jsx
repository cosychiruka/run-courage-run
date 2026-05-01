import React from 'react';

/**
 * SelfieUI — shared overlay for the Monster Selfie feature.
 * Drop this inside any World overlay div and pass the useSelfie() return value.
 *
 * @prop {object}  selfie       - return value from useSelfie()
 * @prop {boolean} visible      - world visibility flag (same as world)
 * @prop {string}  worldName    - e.g. "Nowhere High School Disco" or "Sunrise World"
 * @prop {string}  monsterName  - e.g. "Monster" | "Giant Fly"
 * @prop {string}  monsterEmoji - e.g. "👻" | "🪰"
 * @prop {string}  fabRight     - CSS right value for FAB button (default "110px")
 * @prop {function} onScreenshot - called when user wants to screenshot (canvas capture fn)
 */
export default function SelfieUI({
  selfie,
  visible,
  worldName = 'The Party',
  monsterName = 'Monster',
  monsterEmoji = '👻',
  fabRight = '110px',
  onScreenshot,
}) {
  const {
    phase, previewUrl, label, nameInput, setNameInput,
    fileInputRef, processFile, activate, remove, retake,
  } = selfie;

  if (!visible) return null;

  return (
    <>
      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
      />

      {/* ── FAB button (idle only) ─────────────────────────────────────────── */}
      {phase === 'idle' && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'fixed', bottom: '30px', right: fabRight,
            background: 'linear-gradient(135deg, #ff00cc 0%, #ff6600 100%)',
            border: '3px solid #fff', borderRadius: '50px',
            padding: '12px 22px', cursor: 'pointer', zIndex: 1000,
            fontFamily: '"Comic Sans MS", cursive', fontWeight: 900, fontSize: '1rem',
            color: '#fff', boxShadow: '0 6px 0 rgba(0,0,0,0.4), 0 0 25px rgba(255,0,200,0.7)',
            transition: 'transform 0.15s ease',
            animation: 'selfieButtonPulse 2.5s ease-in-out infinite',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        >
          {monsterEmoji} Become a {monsterName}!
        </button>
      )}

      {/* ── Processing spinner ────────────────────────────────────────────── */}
      {phase === 'processing' && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{ fontSize: '5rem', animation: 'selfieSpinner 0.6s linear infinite' }}>
            {monsterEmoji}
          </div>
          <div style={{
            color: '#fff', fontFamily: '"Comic Sans MS", cursive',
            fontSize: '1.4rem', marginTop: '1rem',
          }}>
            Haunting your face...
          </div>
        </div>
      )}

      {/* ── Confirm card ──────────────────────────────────────────────────── */}
      {phase === 'confirm' && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #1a0028 0%, #0d001f 100%)',
            border: '3px solid #ff00cc', borderRadius: '24px', padding: '32px 36px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            boxShadow: '0 0 60px rgba(255,0,200,0.4)', maxWidth: '340px', width: '90vw',
          }}>
            <div style={{
              fontSize: '1.8rem', fontFamily: '"Comic Sans MS", cursive',
              color: '#ff00cc', fontWeight: 900,
            }}>
              {monsterEmoji} {monsterName} Selfie!
            </div>

            {/* Selfie preview */}
            <div style={{ position: 'relative' }}>
              <img src={previewUrl} alt="Your selfie" style={{
                width: '150px', height: '150px', borderRadius: '50%',
                border: '4px solid #ff00cc', boxShadow: '0 0 30px rgba(255,0,200,0.7)',
              }} />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                background: '#ff00cc', borderRadius: '50%', width: '38px', height: '38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', border: '2px solid #fff',
              }}>{monsterEmoji}</div>
            </div>

            <div style={{ color: '#ccc', fontSize: '0.9rem', textAlign: 'center' }}>
              You'll appear as a {monsterName.toLowerCase()} at {worldName}!
            </div>

            <input
              type="text"
              placeholder={`Your ${monsterName.toLowerCase()} name (or emoji 🎃)`}
              value={nameInput}
              maxLength={20}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') activate(); }}
              style={{
                width: '100%', padding: '10px 16px', borderRadius: '12px',
                border: '2px solid #ff00cc', background: 'rgba(255,0,200,0.1)',
                color: '#fff', fontSize: '1rem', fontFamily: '"Comic Sans MS", cursive',
                outline: 'none', textAlign: 'center', boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                onClick={retake}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #666',
                  background: 'rgba(255,255,255,0.08)', color: '#ccc', cursor: 'pointer',
                  fontFamily: '"Comic Sans MS", cursive', fontSize: '0.9rem',
                }}
              >✕ Retake</button>
              <button
                onClick={activate}
                style={{
                  flex: 2, padding: '12px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ff00cc, #ff6600)',
                  border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 900,
                  fontFamily: '"Comic Sans MS", cursive', fontSize: '1rem',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
                }}
              >{monsterEmoji} Join the Party!</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active chip (top-right) ───────────────────────────────────────── */}
      {(phase === 'active' || phase === 'removing') && (
        <div style={{
          position: 'fixed', top: '70px', right: '20px', zIndex: 1000,
          background: 'rgba(10,0,18,0.92)', backdropFilter: 'blur(10px)',
          border: '2px solid #ff00cc', borderRadius: '16px', padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 0 20px rgba(255,0,200,0.4)',
          transition: 'opacity 0.6s ease',
          opacity: phase === 'removing' ? 0 : 1,
        }}>
          <img src={previewUrl} alt="selfie" style={{
            width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #ff00cc',
          }} />
          <div style={{ color: '#fff', fontFamily: '"Comic Sans MS", cursive', fontSize: '0.85rem' }}>
            <div style={{ color: '#ff00cc', fontWeight: 900 }}>{monsterEmoji} {label}</div>
            <div style={{ color: '#aaa', fontSize: '0.75rem' }}>You're in the world!</div>
          </div>

          {/* Screenshot & Share on X */}
          {onScreenshot && (
            <button
              onClick={onScreenshot}
              title="Screenshot & Share on X"
              style={{
                background: '#000', border: '2px solid #fff',
                borderRadius: '8px', color: '#fff', padding: '5px 10px',
                cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '5px',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <span style={{ fontWeight: 900, fontSize: '1rem' }}>𝕏</span> Share
            </button>
          )}

          <button
            onClick={remove}
            title="Leave"
            style={{
              background: 'rgba(255,0,0,0.18)', border: '1px solid #ff4444',
              borderRadius: '8px', color: '#ff4444', padding: '5px 10px',
              cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: '"Comic Sans MS", cursive',
            }}
          >Leave 👋</button>
        </div>
      )}
    </>
  );
}
