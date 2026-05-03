import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createVoiceService } from '../services/voiceService';
import ThinkingOverlay from './ThinkingOverlay';
import { quotaStart, quotaEnd, quotaCancel, quotaStatus, formatTime, formatResetIn } from '../services/voiceQuota';

/**
 * WorldVoiceButton — context-aware mic button for the 3D worlds.
 *
 * Props:
 *   worldContext  string  — 'disco' | 'evening' | 'sunrise' | 'noon'
 *   visible       bool    — only render when the world is open
 *
 * Renders a floating microphone FAB in the bottom-right corner.
 * Hold to record, release to send.  Courage's reply plays as TTS audio.
 */

const STATE_COLORS = {
  idle:      'linear-gradient(135deg, #6600cc 0%, #cc00ff 100%)',
  listening: 'linear-gradient(135deg, #cc0000 0%, #ff3333 100%)',
  thinking:  'linear-gradient(135deg, #cc6600 0%, #ff9900 100%)',
  speaking:  'linear-gradient(135deg, #006600 0%, #00cc44 100%)',
};

const STATE_EMOJI = {
  idle:      '🎙️',
  listening: '🔴',
  thinking:  '🤔',
  speaking:  '🐕',
};

const STATE_LABEL = {
  idle:      'Hold to Talk',
  listening: 'Release to Send 🔴',
  thinking:  'Thinking...',
  speaking:  'Courage says...',
};

export default function WorldVoiceButton({ worldContext, visible }) {
  const [voiceState, setVoiceState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [toolLog, setToolLog] = useState([]);
  const [quota, setQuota] = useState(() => quotaStatus());
  const svcRef = useRef(null);
  const holdingRef = useRef(false);

  // Refresh quota display every 5s
  useEffect(() => {
    const t = setInterval(() => setQuota(quotaStatus()), 5000);
    return () => clearInterval(t);
  }, []);

  // Build service once
  useEffect(() => {
    const svc = createVoiceService({
      onState:      (s) => { setVoiceState(s); if (s !== 'thinking') setToolLog([]); },
      onTranscript: (t) => { setTranscript(t); setExpanded(true); setToolLog([]); },
      onReply:      (r) => { setReply(r); setExpanded(true); },
      onAudio:      () => {},
      onError:      (e) => { setError(e); setVoiceState('idle'); setToolLog([]); },
      onToolCall:   (ev) => {
        if (ev.type === 'call') {
          setToolLog(prev => [...prev, { type: 'call', tool: ev.tool, label: ev.label }]);
        } else {
          // Mark matching call as done
          setToolLog(prev => prev.map(e =>
            e.tool === ev.tool && e.type === 'call' ? { ...e, type: 'result' } : e
          ));
        }
      },
    });
    svc.setWorldContext(worldContext);
    svcRef.current = svc;
    return () => svc.destroy();
  }, []); // eslint-disable-line

  // Update context if world changes
  useEffect(() => {
    svcRef.current?.setWorldContext(worldContext);
  }, [worldContext]);

  const handlePress = useCallback(async () => {
    if (holdingRef.current) return;
    const q = quotaStatus();
    setQuota(q);
    if (!q.canSpeak) {
      setError(`Courage needs a rest! ${formatResetIn(q.resetInSecs)} you can chat again. 🐾`);
      return;
    }
    holdingRef.current = true;
    setError('');
    setTranscript('');
    setReply('');
    setExpanded(false);
    quotaStart();
    try {
      await svcRef.current?.start();
    } catch (e) {
      quotaCancel();
      setError('Mic error — allow microphone access');
      holdingRef.current = false;
    }
  }, []);

  const handleRelease = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    quotaEnd();
    setQuota(quotaStatus());
    try {
      await svcRef.current?.stop(worldContext);
    } catch (e) {
      setError('Send error');
      setVoiceState('idle');
    }
  }, [worldContext]);

  // Press-and-hold: mouse down starts, mouse up sends - eliminates double-tap confusion
  const handleMouseDown = useCallback(async (e) => {
    e.preventDefault();
    if (voiceState !== 'idle') return;
    await handlePress();
  }, [voiceState, handlePress]);

  const handleMouseUp = useCallback(async (e) => {
    e.preventDefault();
    if (voiceState !== 'listening') return;
    await handleRelease();
  }, [voiceState, handleRelease]);

  // Touch events for mobile
  const handleTouchStart = useCallback(async (e) => {
    e.preventDefault();
    if (voiceState !== 'idle') return;
    await handlePress();
  }, [voiceState, handlePress]);

  const handleTouchEnd = useCallback(async (e) => {
    e.preventDefault();
    if (voiceState !== 'listening') return;
    await handleRelease();
  }, [voiceState, handleRelease]);

  if (!visible) return null;

  const isBusy = voiceState !== 'idle';

  return (
    <>
      <ThinkingOverlay
        visible={voiceState === 'thinking'}
        transcript={transcript}
        toolLog={toolLog}
      />
      <div className="world-voice-btn" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px',
        userSelect: 'none',
      }}>
      {/* Transcript + Reply bubble */}
      {expanded && (transcript || reply || error) && (
        <div style={{
          background: 'rgba(10,0,20,0.95)', backdropFilter: 'blur(12px)',
          border: '2px solid rgba(150,0,255,0.6)', borderRadius: '16px',
          padding: '14px 18px', maxWidth: '300px', color: '#fff',
          boxShadow: '0 4px 20px rgba(120,0,255,0.3)',
          animation: 'selfieButtonPulse 0s', // reuse existing keyframe name just for entrance
        }}>
          {transcript && (
            <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '6px' }}>
              <span style={{ color: '#9933ff' }}>You:</span> {transcript}
            </div>
          )}
          {reply && (
            <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              <span style={{ color: '#cc66ff' }}>🐕 Courage:</span> {reply}
            </div>
          )}
          {error && (
            <div style={{ fontSize: '0.8rem', color: '#ff6666' }}>⚠️ {error}</div>
          )}
          <button
            onClick={() => setExpanded(false)}
            style={{
              position: 'absolute', top: '6px', right: '10px',
              background: 'none', border: 'none', color: '#666',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >✕</button>
        </div>
      )}

      {/* Quota indicator — always visible */}
      <div style={{
        background: 'rgba(10,0,20,0.85)', backdropFilter: 'blur(10px)',
        border: `1px solid ${quota.canSpeak ? 'rgba(150,0,255,0.4)' : 'rgba(255,80,80,0.5)'}`,
        borderRadius: '10px', padding: '6px 10px', minWidth: '120px',
        fontSize: '0.72rem', color: quota.canSpeak ? '#cc99ff' : '#ff8888',
        textAlign: 'center',
      }}>
        {quota.canSpeak ? (
          <span>🎙 {formatTime(quota.remainingSecs)} left this hour</span>
        ) : (
          <span>⏳ Resting… back {formatResetIn(quota.resetInSecs)}</span>
        )}
        <div style={{
          marginTop: '4px', height: '3px', borderRadius: '2px',
          background: 'rgba(255,255,255,0.1)',
        }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${Math.max(0, (quota.remainingSecs / 900) * 100)}%`,
            background: quota.canSpeak
              ? 'linear-gradient(90deg, #6600cc, #cc00ff)'
              : 'rgba(255,80,80,0.5)',
            transition: 'width 1s ease',
          }} />
        </div>
      </div>

      {/* Mic FAB */}

      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Cancel recording if mouse leaves button
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd} // Cancel recording if touch is cancelled
        disabled={voiceState === 'thinking' || voiceState === 'speaking'}
        title={STATE_LABEL[voiceState]}
        style={{
          width: '60px', height: '60px', borderRadius: '50%',
          background: STATE_COLORS[voiceState] || STATE_COLORS.idle,
          border: voiceState === 'listening' ? '4px solid #fff' : '3px solid rgba(255,255,255,0.3)',
          cursor: isBusy && voiceState !== 'listening' ? 'wait' : 'pointer',
          fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: voiceState === 'listening'
            ? '0 0 0 10px rgba(255,0,0,0.3), 0 0 0 20px rgba(255,0,0,0.1), 0 6px 20px rgba(0,0,0,0.5)'
            : '0 6px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
          animation: voiceState === 'listening' ? 'voiceListeningPulse 1.2s ease-in-out infinite' : 'none',
          userSelect: 'none', // Prevent text selection during recording
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {STATE_EMOJI[voiceState]}
      </button>

      {/* Label */}
      <div style={{
        fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)',
        textAlign: 'center', fontFamily: '"Comic Sans MS", cursive',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}>
        {STATE_LABEL[voiceState]}
      </div>
    </div>
    </>
  );
}
