/**
 * voiceService.js — Frontend bridge to the Courage voice WebSocket backend.
 *
 * Usage:
 *   const svc = createVoiceService({ onState, onTranscript, onReply, onAudio });
 *   await svc.start();   // begin recording
 *   await svc.stop();    // stop recording, send to backend, receive response
 *   svc.destroy();       // clean up WebSocket + AudioContext
 */

const WS_URL = import.meta.env.VITE_BACKEND_WS || 'ws://localhost:8000/ws/voice';

// 24kHz mono PCM — matches Kokoro TTS output
const TTS_SAMPLE_RATE = 24000;

export function createVoiceService({ onState, onTranscript, onReply, onAudio, onError } = {}) {
  let ws = null;
  let mediaRecorder = null;
  let audioCtx = null;
  let stream = null;
  let connected = false;

  // ── WebSocket management ───────────────────────────────────────────────────

  function connect() {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected = true;
        resolve();
      };

      ws.onerror = (e) => {
        connected = false;
        onError?.('WebSocket error — is the backend running?');
        reject(e);
      };

      ws.onclose = () => {
        connected = false;
      };

      ws.onmessage = async (event) => {
        // Binary message = TTS WAV audio
        if (event.data instanceof ArrayBuffer) {
          await _playWav(event.data);
          onAudio?.();
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
            case 'done':
              onReply?.(msg.reply);
              onState?.('idle');
              break;
            case 'error':
              onError?.(msg.message);
              onState?.('idle');
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

  async function _playWav(arrayBuffer) {
    onState?.('speaking');
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext({ sampleRate: TTS_SAMPLE_RATE });
    }
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const src     = audioCtx.createBufferSource();
      src.buffer    = decoded;
      src.connect(audioCtx.destination);
      src.start();
    } catch (e) {
      onError?.(`Audio playback error: ${e.message}`);
    }
  }

  // ── MediaRecorder (microphone capture) ─────────────────────────────────────

  async function _startRecording() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/ogg;codecs=opus';

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
        ws.send(e.data);  // binary chunk
      }
    };

    // Collect 250ms chunks for low-latency streaming
    mediaRecorder.start(250);
    onState?.('listening');
  }

  function _stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
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

  // ── Public API ─────────────────────────────────────────────────────────────

  async function start() {
    if (!connected) {
      await connect();
      _startPing();
    }
    await _startRecording();
  }

  async function stop() {
    await _stopRecording();
    onState?.('thinking');
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'voice_end' }));
    }
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

  return { start, stop, destroy };
}
