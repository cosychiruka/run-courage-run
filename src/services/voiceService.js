/**
 * voiceService.js — Frontend bridge to the Courage voice WebSocket backend.
 *
 * Features:
 *   - Automatic reconnect with exponential backoff (up to 3 attempts)
 *   - Chunk buffering when WS is temporarily unavailable
 *   - Auto-cancel when audio is below silence threshold (< 8KB ≈ 0.5s)
 *   - Explicit cancel() — stops recording without sending to backend
 *   - Full error handling for: mic permission, WS errors, audio decode, timeouts
 */

const _productionWs = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/voice`
  : 'wss://hoodcourage.xyz/ws/voice';

const _WS_BASE = import.meta.env.VITE_BACKEND_WS ||
                 (import.meta.env.PROD ? _productionWs : 'ws://localhost:8000/ws/voice');

/** Stable session ID — persists across page refreshes so conversation history survives. */
function _getSessionId() {
  let id = localStorage.getItem('courage_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('courage_session_id', id);
  }
  return id;
}

// 24kHz mono PCM — matches Kokoro TTS output
const TTS_SAMPLE_RATE = 24000;

// Minimum audio bytes before we treat a stop() as a real recording vs accidental tap.
// ~8KB ≈ 0.5s of Opus audio at 128kbps — anything smaller is treated as silence/cancel.
const MIN_AUDIO_BYTES = 8000;

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;
const TURN_TIMEOUT_MS = 60000;

export function createVoiceService({ onState, onTranscript, onReply, onAudio, onError, onToolCall, onTweetCard } = {}) {
  let ws = null;
  let mediaRecorder = null;
  let audioCtx = null;
  let stream = null;
  let connected = false;
  let _worldContext = null;
  let _userDestroyed = false;   // set true on destroy() to suppress reconnect
  let _isConnecting = false;    // guard against concurrent connect() calls
  let _reconnectAttempts = 0;
  let _reconnectTimer = null;
  let _activeSource = null;
  let _activeUtterance = null;
  let _turnTimer = null;

  // Chunks buffered while WS is not yet open (e.g., brief reconnect gap)
  const _pendingChunks = [];

  // Running count of audio bytes captured this recording session
  let _totalBytesSent = 0;

  const sessionId = _getSessionId();
  const WS_URL = `${_WS_BASE}?session=${sessionId}`;

  // ── WebSocket management ───────────────────────────────────────────────────

  function connect() {
    if (_isConnecting) return Promise.resolve();
    _isConnecting = true;

    return new Promise((resolve, reject) => {
      console.log('[Voice] Connecting to:', WS_URL);
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected = true;
        _isConnecting = false;
        _reconnectAttempts = 0;
        console.log('[Voice] WebSocket connected');

        // Flush any chunks that queued up during a reconnect gap
        if (_pendingChunks.length > 0) {
          console.log(`[Voice] Flushing ${_pendingChunks.length} buffered chunks`);
          for (const chunk of _pendingChunks) {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
          }
          _pendingChunks.length = 0;
        }

        resolve();
      };

      ws.onerror = (e) => {
        _isConnecting = false;
        connected = false;
        console.error('[Voice] WebSocket error — readyState:', ws?.readyState, e);
        onError?.('Connection error — check your network and try again.');
        reject(new Error('WebSocket error'));
      };

      ws.onclose = (e) => {
        _clearTurnTimeout();
        connected = false;
        _isConnecting = false;
        console.log('[Voice] WebSocket closed:', e.code, e.reason);

        // If we're mid-recording and WS drops, abort cleanly
        if (mediaRecorder?.state === 'recording') {
          mediaRecorder.stop();
          stream?.getTracks().forEach(t => t.stop());
          onError?.('Connection lost while recording. Please try again.');
          onState?.('idle');
          return;
        }

        onState?.('idle');

        // Schedule reconnect for unexpected closures (not user destroy, not normal close)
        if (!_userDestroyed && e.code !== 1000 && _reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          _scheduleReconnect();
        }
      };

      ws.onmessage = async (event) => {
        // Binary = TTS WAV audio
        if (event.data instanceof ArrayBuffer) {
          _clearTurnTimeout();
          await _playWav(event.data);
          onAudio?.();
          onState?.('idle');
          return;
        }

        // Text = JSON control message
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'transcript':
              onTranscript?.(msg.text);
              break;
            case 'thinking':
              onState?.('thinking');
              break;
            case 'tool_call':
              onToolCall?.({ type: 'call', tool: msg.tool, label: msg.label });
              break;
            case 'tool_result':
              onToolCall?.({ type: 'result', tool: msg.tool, summary: msg.summary });
              break;
            case 'done':
              _clearTurnTimeout();
              onReply?.(msg.reply);
              if (msg.audio_mode === 'browser') {
                await _playBrowserSpeech(msg.reply);
              } else if (msg.audio_mode !== 'server') {
                // Compatibility with text-only responses from older backends.
                onState?.('idle');
              }
              break;
            case 'cancelled':
              _clearTurnTimeout();
              onState?.('idle');
              break;
            case 'error':
              _clearTurnTimeout();
              onError?.(msg.message);
              onState?.('idle');
              break;
            case 'tweet_card':
              onTweetCard?.(msg.tweets, msg.query);
              break;
            case 'pong':
              break;
          }
        } catch {
          // Non-JSON binary leak — ignore
        }
      };
    });
  }

  function _scheduleReconnect() {
    if (_userDestroyed || _reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, _reconnectAttempts);
    _reconnectAttempts++;
    console.log(`[Voice] Reconnect attempt ${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    _reconnectTimer = setTimeout(async () => {
      try {
        await connect();
      } catch {
        if (_reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          _scheduleReconnect();
        } else {
          onError?.('Could not reconnect. Please refresh and try again.');
        }
      }
    }, delay);
  }

  function _clearTurnTimeout() {
    clearTimeout(_turnTimer);
    _turnTimer = null;
  }

  function _armTurnTimeout() {
    _clearTurnTimeout();
    _turnTimer = setTimeout(() => {
      onError?.('Courage got lost while thinking. Please try again.');
      onState?.('idle');
      _turnTimer = null;
    }, TURN_TIMEOUT_MS);
  }

  // ── WAV playback via Web Audio API ─────────────────────────────────────────

  function _playWav(arrayBuffer) {
    onState?.('speaking');
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext({ sampleRate: TTS_SAMPLE_RATE });
    }
    return (async () => {
      try {
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        await new Promise((resolve) => {
          const src = audioCtx.createBufferSource();
          _activeSource = src;
          src.buffer = decoded;
          src.connect(audioCtx.destination);
          src.onended = () => {
            _activeSource = null;
            resolve();
          };
          src.start();
        });
      } catch (e) {
        console.error('[Voice] Audio decode error:', e.message);
        onError?.(`Audio playback error: ${e.message}`);
      }
    })();
  }

  function _playBrowserSpeech(text) {
    const cleanText = String(text || '').replace(/\*.*?\*/g, '').trim();
    if (!cleanText || typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      onError?.('Voice playback is unavailable in this browser.');
      onState?.('idle');
      return Promise.resolve();
    }

    window.speechSynthesis.cancel();
    onState?.('speaking');

    return new Promise((resolve) => {
      const utterance = new window.SpeechSynthesisUtterance(cleanText);
      _activeUtterance = utterance;
      utterance.lang = 'en-US';
      utterance.rate = 1.04;
      utterance.pitch = 1.14;

      const voices = window.speechSynthesis.getVoices();
      const preferredNames = /daniel|david|guy|mark|male/i;
      utterance.voice = voices.find((voice) => /^en(-|_)/i.test(voice.lang) && preferredNames.test(voice.name))
        || voices.find((voice) => /^en(-|_)/i.test(voice.lang))
        || null;

      let settled = false;
      const speechDeadline = Math.max(15000, Math.min(90000, cleanText.length * 90));
      const watchdog = setTimeout(() => {
        window.speechSynthesis.cancel();
        onError?.('Voice playback timed out, but Courage’s reply is on screen.');
        finish();
      }, speechDeadline);
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        if (_activeUtterance === utterance) _activeUtterance = null;
        onState?.('idle');
        resolve();
      };
      utterance.onstart = () => onAudio?.();
      utterance.onend = finish;
      utterance.onerror = (event) => {
        console.error('[Voice] Browser speech error:', event.error);
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          onError?.('Voice playback failed, but Courage’s reply is on screen.');
        }
        finish();
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  // ── MediaRecorder (microphone capture) ─────────────────────────────────────

  async function _startRecording() {
    _totalBytesSent = 0;
    _pendingChunks.length = 0;

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/ogg;codecs=opus';

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size <= 0) return;
      _totalBytesSent += e.data.size;

      if (ws?.readyState === WebSocket.OPEN) {
        // Flush any pending chunks first, then send current
        while (_pendingChunks.length > 0) {
          ws.send(_pendingChunks.shift());
        }
        ws.send(e.data);
      } else {
        // WS temporarily unavailable — buffer for flush on reconnect
        _pendingChunks.push(e.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      console.error('[Voice] MediaRecorder error:', e.error);
      onError?.(`Microphone error: ${e.error?.message || 'unknown'}`);
      onState?.('idle');
    };

    mediaRecorder.start(250);  // 250ms chunks
    onState?.('listening');
  }

  function _stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        resolve();
        return;
      }
      mediaRecorder.onstop = resolve;
      mediaRecorder.stop();
      stream?.getTracks().forEach(t => t.stop());
    });
  }

  // ── Keepalive ping ─────────────────────────────────────────────────────────
  let pingInterval = null;

  function _startPing() {
    pingInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  // ── Backend health check ───────────────────────────────────────────────────
  async function checkBackendHealth() {
    const healthUrl = WS_URL
      .replace('wss://', 'https://')
      .replace('ws://', 'http://')
      .replace('/ws/voice', '/health');
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      try {
        const res = await fetch('/health', { signal: AbortSignal.timeout(2000) });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function start() {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      console.warn('[Voice] Backend health check failed — attempting connection anyway');
    }

    if (!connected) {
      await connect();
      _startPing();
    }
    await _startRecording();
  }

  async function stop(worldContext) {
    await _stopRecording();

    // Auto-cancel if audio is below the silence threshold — user likely just tapped to dismiss
    if (_totalBytesSent < MIN_AUDIO_BYTES) {
      console.log(`[Voice] Auto-cancel: only ${_totalBytesSent} bytes recorded (below ${MIN_AUDIO_BYTES} threshold)`);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice_cancel' }));
      }
      _pendingChunks.length = 0;
      onState?.('idle');
      return;
    }

    onState?.('thinking');
    const ctx = worldContext ?? _worldContext;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'voice_end', ...(ctx ? { world_context: ctx } : {}) }));
      _armTurnTimeout();
    } else {
      onError?.('Connection lost — please try again.');
      onState?.('idle');
    }
  }

  async function cancel() {
    await _stopRecording();
    _pendingChunks.length = 0;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'voice_cancel' }));
    }
    onState?.('idle');
  }

  function setWorldContext(ctx) {
    _worldContext = ctx;
  }

  function destroy() {
    _userDestroyed = true;
    clearInterval(pingInterval);
    clearTimeout(_reconnectTimer);
    _clearTurnTimeout();
    _pendingChunks.length = 0;
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    stream?.getTracks().forEach(t => t.stop());
    if (_activeSource) {
      try { _activeSource.stop(); } catch { /* already stopped */ }
      _activeSource = null;
    }
    if (_activeUtterance && typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
      _activeUtterance = null;
    }
    ws?.close(1000, 'user destroy');
    audioCtx?.close();
    ws = null;
    connected = false;
  }

  return { start, stop, cancel, destroy, setWorldContext };
}
