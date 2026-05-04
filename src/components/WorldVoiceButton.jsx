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
  idle:      'Tap to Talk',
  listening: 'Tap to Send 🔴',
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

  // Tap-toggle: first tap starts listening, second tap sends
  const handleTap = useCallback(async (e) => {
    e.preventDefault();
    if (voiceState === 'idle') {
      await handlePress();
    } else if (voiceState === 'listening') {
      await handleRelease();
    }
    // Ignore taps while thinking or speaking
  }, [voiceState, handlePress, handleRelease]);

  // Helper to render bold text and clean up markdown symbols
  const formatText = (text) => {
    if (!text) return '';
    // Handle **bold** or __bold__
    let processed = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
    // Remove other common MD artifacts like # or - if they leak in
    processed = processed.replace(/^[#\-\*\s]+/, '');
    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  if (!visible) return null;

  const isBusy = voiceState !== 'idle';

  return (
    <>
      <ThinkingOverlay
        visible={voiceState === 'thinking'}
        transcript={transcript}
        toolLog={toolLog}
      />
      <div className="world-chat-bubble-container">
        {/* Transcript + Reply bubble */}
        {expanded && (transcript || reply || error) && (
          <div className="world-chat-bubble">
            <button className="world-chat-close" onClick={() => setExpanded(false)}>✕</button>
            {transcript && (
              <div className="world-chat-user">
                You: <span style={{ fontWeight: 500, color: '#666' }}>{transcript}</span>
              </div>
            )}
            {reply && (
              <div className="world-chat-text">
                <span className="world-chat-courage">🐕 Courage:</span> {formatText(reply)}
              </div>
            )}
            {error && (
              <div style={{ fontSize: '0.8rem', color: '#ff6666', marginTop: '8px' }}>⚠️ {error}</div>
            )}
          </div>
        )}

        {/* Quota indicator */}
        <div className="world-quota-panel">
          {quota.canSpeak ? (
            <span>🎙 {formatTime(quota.remainingSecs)} left</span>
          ) : (
            <span>⏳ Resting… {formatResetIn(quota.resetInSecs)}</span>
          )}
          <div className="world-quota-bar">
            <div className="world-quota-progress" style={{ width: `${Math.max(0, (quota.remainingSecs / 900) * 100)}%` }} />
          </div>
        </div>

        {/* Mic FAB */}
        <button
          onClick={handleTap}
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
