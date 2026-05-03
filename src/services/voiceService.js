/**
 * voiceService.js — Frontend bridge to the Courage voice WebSocket backend.
 *
 * Usage:
 *   const svc = createVoiceService({ onState, onTranscript, onReply, onAudio });
 *   await svc.start();   // begin recording
 *   await svc.stop();    // stop recording, send to backend, receive response
 *   svc.destroy();       // clean up WebSocket + AudioContext
 */

const _WS_BASE = import.meta.env.VITE_BACKEND_WS ||
                 (typeof __VITE_BACKEND_WS__ !== 'undefined' ? __VITE_BACKEND_WS__ : null) ||
                 (import.meta.env.PROD
                   ? 'wss://runcouragerun.life/ws/voice'
                   : 'ws://localhost:8000/ws/voice');

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

export function createVoiceService({ onState, onTranscript, onReply, onAudio, onError, onToolCall, onTweetCard } = {}) {
  let ws = null;
  let mediaRecorder = null;
  let audioCtx = null;
  let stream = null;
  let connected = false;
  let _worldContext = null;

  // Build WS URL with session ID so backend restores per-user history on reconnect
  const sessionId = _getSessionId();
  const WS_URL = `${_WS_BASE}?session=${sessionId}`;

  // ── WebSocket management ───────────────────────────────────────────────────

  function connect() {
    return new Promise((resolve, reject) => {
      console.log('[Voice] Attempting WebSocket connection to:', WS_URL);
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected = true;
        console.log('[Voice] WebSocket connected successfully');
        resolve();
      };

      ws.onerror = (e) => {
        connected = false;
        console.error('[Voice] WebSocket error:', e);
        console.error('[Voice] WebSocket URL:', WS_URL);
        console.error('[Voice] ReadyState:', ws.readyState);
        onError?.('WebSocket error — is the backend running?');
        reject(e);
      };

      ws.onclose = (e) => {
        connected = false;
        onState?.('idle');
        console.log('[Voice] WebSocket closed:', e.code, e.reason);
      };

      ws.onmessage = async (event) => {
        // Binary message = TTS WAV audio
        if (event.data instanceof ArrayBuffer) {
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
              onReply?.(msg.reply);
              // Do NOT set idle here. The wav audio follows immediately and will set idle when done.
              break;
            case 'error':
              onError?.(msg.message);
              onState?.('idle');
              break;
            case 'tweet_card':
              onTweetCard?.(msg.tweets, msg.query);
              break;
            case 'pong':
              break;
            default:
              break;
          }
        } catch {
          // non-JSON binary leak — ignore
        }
      };
    });
  }

  // ── WAV playback via Web Audio API ─────────────────────────────────────────

  function _playWav(arrayBuffer) {
    onState?.('speaking');
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext({ sampleRate: TTS_SAMPLE_RATE });
    }
    return new Promise(async (resolve) => {
      try {
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const src     = audioCtx.createBufferSource();
        src.buffer    = decoded;
        src.connect(audioCtx.destination);
        src.onended = resolve;
        src.start();
      } catch (e) {
        onError?.(`Audio playback error: ${e.message}`);
        resolve();
      }
    });
  }

  // ── MediaRecorder (microphone capture) ─────────────────────────────────────

  async function _startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      throw new Error('Microphone access denied. Please allow microphone access.');
    }
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/ogg;codecs=opus';

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    // Audio level monitoring
    let audioContext = null;
    let analyser = null;
    let levelCheckInterval = null;
    let silentFrames = 0;
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      // Check audio levels every 500ms
      levelCheckInterval = setInterval(() => {
        if (!analyser) return;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        if (average < 5) {
          silentFrames++;
          if (silentFrames >= 3) {
            console.warn('[Voice] No audio detected - check microphone');
            onError?.('No audio detected. Please check your microphone.');
          }
        } else {
          silentFrames = 0; // Reset counter when audio is detected
        }
      }, 500);
    } catch (error) {
      console.warn('[Voice] Audio monitoring not available:', error);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
        ws.send(e.data);  // binary chunk
      }
    };

    // Clean up function
    const cleanup = () => {
      if (levelCheckInterval) {
        clearInterval(levelCheckInterval);
        levelCheckInterval = null;
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };

    // Store cleanup for later use
    mediaRecorder._cleanup = cleanup;

    // Collect 250ms chunks for low-latency streaming
    mediaRecorder.start(250);
    onState?.('listening');
  }

  function _stopRecording() {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve();
        return;
      }
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('[Voice] MediaRecorder stop timeout - forcing cleanup');
        cleanup();
        resolve();
      }, 2000);
      
      const cleanup = () => {
        clearTimeout(timeout);
        // Clean up audio monitoring
        if (mediaRecorder && mediaRecorder._cleanup) {
          mediaRecorder._cleanup();
        }
        stream?.getTracks().forEach(t => {
          try {
            t.stop();
          } catch (e) {
            console.warn('[Voice] Error stopping audio track:', e);
          }
        });
        stream = null;
        mediaRecorder = null;
      };
      
      mediaRecorder.onstop = () => {
        cleanup();
        resolve();
      };
      
      try {
        mediaRecorder.stop();
      } catch (error) {
        console.error('[Voice] Error stopping MediaRecorder:', error);
        cleanup();
        reject(error);
      }
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

  // ── Health check function
  async function checkBackendHealth() {
    try {
      const healthUrl = WS_URL.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws/voice', '/health');
      console.log('[Voice] Checking backend health at:', healthUrl);
      const response = await fetch(healthUrl);
      const data = await response.json();
      console.log('[Voice] Backend health check:', data);
      return response.ok;
    } catch (error) {
      console.error('[Voice] Backend health check failed:', error);
      console.log('[Voice] Falling back to same-origin health check');
      // Fallback to same origin
      try {
        const response = await fetch('/health');
        const data = await response.json();
        console.log('[Voice] Same-origin health check:', data);
        return response.ok;
      } catch (fallbackError) {
        console.error('[Voice] Same-origin health check also failed:', fallbackError);
        return false;
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function start() {
    // First check if backend is accessible
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      onError?.('Backend health check failed - WebSocket connection may fail');
    }

    if (!connected) {
      await connect();
      _startPing();
    }
    await _startRecording();
  }

  async function stop(worldContext) {
    await _stopRecording();
    onState?.('thinking');
    const ctx = worldContext ?? _worldContext;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'voice_end', ...(ctx ? { world_context: ctx } : {}) }));
    }
  }

  function setWorldContext(ctx) {
    _worldContext = ctx;
  }

  function destroy() {
    clearInterval(pingInterval);
    mediaRecorder?.stop();
    stream?.getTracks().forEach(t => t.stop());
    ws?.close();
    audioCtx?.close();
    ws = null;
    connected = false;
  }

  return { start, stop, destroy, setWorldContext };
}
