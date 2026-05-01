import React, { useEffect, useRef } from 'react';

/**
 * ThinkingOverlay — glass-morphism modal showing live tool call activity.
 * Appears when voiceState === 'thinking', disappears when Courage starts speaking.
 *
 * Props:
 *   visible     {boolean}    — show/hide
 *   transcript  {string}     — what the user said (shown at top)
 *   toolLog     {Array}      — list of { type: 'call'|'result', tool, label, summary }
 */
export default function ThinkingOverlay({ visible, transcript, toolLog = [] }) {
  const logRef = useRef(null);

  // Auto-scroll log to bottom as entries arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [toolLog]);

  if (!visible) return null;

  return (
    <div className="thinking-overlay" aria-live="polite" aria-label="Courage is thinking">
      {/* Backdrop blur */}
      <div className="thinking-backdrop" />

      <div className="thinking-card">
        {/* Animated brain header */}
        <div className="thinking-header">
          <div className="thinking-brain">
            <span className="thinking-brain-emoji">🧠</span>
            <div className="thinking-pulse-ring" />
            <div className="thinking-pulse-ring thinking-pulse-ring--2" />
          </div>
          <div className="thinking-title-group">
            <p className="thinking-title">Courage is thinking…</p>
            {transcript && (
              <p className="thinking-transcript">
                <span className="thinking-quote-icon">🎙</span>
                &ldquo;{transcript}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Live tool log */}
        {toolLog.length > 0 && (
          <div className="thinking-log" ref={logRef}>
            {toolLog.map((entry, i) => (
              <div
                key={i}
                className={`thinking-log-entry thinking-log-entry--${entry.type}`}
              >
                {entry.type === 'call' ? (
                  <>
                    <span className="thinking-log-spinner" />
                    <span className="thinking-log-label">{entry.label}</span>
                  </>
                ) : (
                  <>
                    <span className="thinking-log-check">✓</span>
                    <span className="thinking-log-label thinking-log-label--done">
                      {entry.label?.replace('…', '')} — done
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {toolLog.length === 0 && (
          <div className="thinking-dots">
            <span /><span /><span />
          </div>
        )}
      </div>

      <style>{`
        .thinking-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 140px;
          pointer-events: none;
        }

        .thinking-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          animation: thinking-fadein 0.25s ease;
        }

        .thinking-card {
          position: relative;
          z-index: 1;
          min-width: 280px;
          max-width: min(460px, 92vw);
          background: rgba(15, 10, 30, 0.82);
          border: 1px solid rgba(180, 140, 255, 0.28);
          border-radius: 18px;
          padding: 16px 20px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow:
            0 8px 32px rgba(0,0,0,0.45),
            0 0 0 1px rgba(255,255,255,0.05) inset,
            0 0 40px rgba(160, 100, 255, 0.12);
          animation: thinking-slidein 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }

        .thinking-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .thinking-brain {
          position: relative;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .thinking-brain-emoji {
          font-size: 22px;
          position: relative;
          z-index: 2;
          animation: thinking-brain-bob 1.4s ease-in-out infinite;
        }

        .thinking-pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(180, 130, 255, 0.6);
          animation: thinking-ring-pulse 1.6s ease-out infinite;
        }
        .thinking-pulse-ring--2 {
          animation-delay: 0.7s;
          border-color: rgba(130, 180, 255, 0.4);
        }

        .thinking-title-group { flex: 1; min-width: 0; }

        .thinking-title {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: rgba(220, 200, 255, 0.95);
          letter-spacing: 0.3px;
          text-transform: uppercase;
          font-family: 'Outfit', sans-serif;
        }

        .thinking-transcript {
          margin: 3px 0 0;
          font-size: 12px;
          color: rgba(180, 170, 200, 0.75);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-style: italic;
          font-family: 'Outfit', sans-serif;
        }

        .thinking-quote-icon { margin-right: 4px; }

        .thinking-log {
          max-height: 140px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none;
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .thinking-log::-webkit-scrollbar { display: none; }

        .thinking-log-entry {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-family: 'Outfit', sans-serif;
          color: rgba(200, 190, 220, 0.85);
          animation: thinking-fadein 0.2s ease;
        }

        .thinking-log-entry--result .thinking-log-label--done {
          color: rgba(130, 255, 180, 0.8);
        }

        .thinking-log-spinner {
          width: 12px;
          height: 12px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(180, 130, 255, 0.3);
          border-top-color: rgba(180, 130, 255, 0.9);
          animation: thinking-spin 0.7s linear infinite;
        }

        .thinking-log-check {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          font-size: 11px;
          color: rgba(130, 255, 180, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .thinking-dots {
          display: flex;
          gap: 5px;
          justify-content: center;
          padding: 6px 0 2px;
        }
        .thinking-dots span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(180, 130, 255, 0.7);
          animation: thinking-dot-bounce 1.2s ease-in-out infinite;
        }
        .thinking-dots span:nth-child(2) { animation-delay: 0.18s; background: rgba(130, 180, 255, 0.7); }
        .thinking-dots span:nth-child(3) { animation-delay: 0.36s; background: rgba(255, 160, 220, 0.7); }

        @keyframes thinking-fadein   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes thinking-slidein  { from { opacity: 0; transform: translateY(18px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes thinking-brain-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes thinking-ring-pulse { 0% { transform: scale(0.7); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes thinking-spin   { to { transform: rotate(360deg); } }
        @keyframes thinking-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
