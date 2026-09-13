"""
voice.py — Voice pipeline: Whisper STT → Agent → Kokoro TTS

Flow:
  1. Receive raw audio bytes (webm/ogg from browser MediaRecorder)
  2. Transcribe with faster-whisper (local, fast, accurate)
  3. Run through Courage agent (tools, news, etc.)
  4. Synthesise speech with kokoro-onnx
  5. Yield PCM audio chunks for streaming back to browser
"""

import io
import tempfile
import asyncio
import gc
import ctypes
import sys
import soundfile as sf
from pathlib import Path
from typing import AsyncIterator

from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro

from app.config import (
    KOKORO_MODEL_PATH,
    KOKORO_VOICE,
    KOKORO_VOICES_PATH,
    VOICE_MEMORY_MODE,
    WHISPER_BEAM_SIZE,
    WHISPER_MODEL,
)

# ── Shared model instances (resident or loaded per turn) ────────────────
_whisper: WhisperModel | None = None
_kokoro:  Kokoro | None       = None
_loading = False
_available = False
_model_lock = asyncio.Lock()


def _trim_native_memory():
    """Return released native allocations to Linux when the allocator supports it."""
    gc.collect()
    if sys.platform.startswith("linux"):
        try:
            ctypes.CDLL("libc.so.6").malloc_trim(0)
        except Exception:
            pass


def _load_whisper() -> WhisperModel:
    global _whisper
    if _whisper is None:
        _whisper = WhisperModel(
            WHISPER_MODEL,
            device="cpu",
            compute_type="int8",
            cpu_threads=1,
            num_workers=1,
        )
    return _whisper


def _load_kokoro() -> Kokoro:
    global _kokoro
    if _kokoro is None:
        _kokoro = Kokoro(KOKORO_MODEL_PATH, KOKORO_VOICES_PATH)
    return _kokoro


def _unload_whisper():
    global _whisper
    if _whisper is not None:
        try:
            _whisper.model.unload_model()
        except Exception:
            pass
        _whisper = None
        _trim_native_memory()


def _unload_kokoro():
    global _kokoro
    if _kokoro is not None:
        _kokoro = None
        _trim_native_memory()


def load_models():
    """Validate low-memory assets or preload both models in resident mode."""
    global _available, _loading
    _loading = True

    if VOICE_MEMORY_MODE == "low":
        missing = [
            path for path in (KOKORO_MODEL_PATH, KOKORO_VOICES_PATH)
            if not Path(path).is_file()
        ]
        _available = not missing
        _loading = False
        if missing:
            print(f"[VOICE] Missing low-memory voice assets: {', '.join(missing)}")
        else:
            print("[VOICE] Low-memory mode ready; models will load one at a time per turn.")
        return

    print("[VOICE] Loading Whisper...")
    try:
        _load_whisper()
        print("[VOICE] Whisper loaded successfully.")
    except Exception as e:
        print(f"[VOICE] ERROR: Failed to load Whisper model: {e}")
        print("[VOICE] Voice transcription will not be available.")
        
    print("[VOICE] Loading Kokoro TTS...")
    try:
        _load_kokoro()
        print("[VOICE] Kokoro TTS loaded successfully.")
    except Exception as e:
        print(f"[VOICE] ERROR: Failed to load Kokoro TTS: {e}")
        print("[VOICE] Voice synthesis will not be available.")
        
    _available = _whisper is not None and _kokoro is not None
    if _available:
        print("[VOICE] All models ready.")
        print("[VOICE] Memory usage optimized.")
    else:
        print("[VOICE] WARNING: Some models failed to load - voice features limited.")
        print("[VOICE] Running with reduced functionality.")
    _loading = False


def get_voice_status() -> dict:
    """Expose availability, residency, and low-memory serialization state."""
    whisper_ready = _whisper is not None
    kokoro_ready = _kokoro is not None
    return {
        "ready": _available and not _loading,
        "mode": VOICE_MEMORY_MODE,
        "loading": _loading,
        "busy": _model_lock.locked(),
        "resident": {
            "whisper": whisper_ready,
            "kokoro": kokoro_ready,
        },
    }


# ── STT ────────────────────────────────────────────────────────────────────────

async def transcribe(audio_bytes: bytes) -> str:
    """
    Transcribe audio bytes (webm/ogg/wav) → text string.
    Runs faster-whisper in a thread to avoid blocking the event loop.
    """
    def _run():
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name

            segments, _info = _load_whisper().transcribe(
                tmp_path,
                language="en",
                beam_size=WHISPER_BEAM_SIZE,
                vad_filter=True,
            )
            return " ".join(seg.text for seg in segments).strip()
        finally:
            if tmp_path:
                Path(tmp_path).unlink(missing_ok=True)
            if VOICE_MEMORY_MODE == "low":
                _unload_whisper()

    async with _model_lock:
        return await asyncio.to_thread(_run)


# ── TTS ────────────────────────────────────────────────────────────────────────

SAMPLE_RATE = 24000  # Kokoro default


def _clean_for_tts(text: str) -> str:
    """Strip markdown symbols and formatting noise before TTS."""
    import re
    # Remove markdown emphasis, headers, code fences
    text = re.sub(r'\*+', '', text)          # asterisks
    text = re.sub(r'_+', '', text)           # underscores
    text = re.sub(r'#+\s*', '', text)        # hash headers
    text = re.sub(r'`+', '', text)           # backticks
    text = re.sub(r'~+', '', text)           # tildes
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # [text](url) → text
    text = re.sub(r'<[^>]+>', '', text)      # HTML tags
    # Remove emojis that TTS reads literally or skips awkwardly
    text = re.sub(r'[^\x00-\x7F]', '', text)  # non-ASCII (emojis, etc)
    # Collapse multiple spaces/newlines
    text = re.sub(r'\s+', ' ', text).strip()
    return text


async def synthesise(text: str, voice: str = KOKORO_VOICE) -> bytes:
    """
    Synthesise text → WAV bytes (24kHz mono PCM).
    Runs kokoro in a thread.
    """
    text = _clean_for_tts(text)

    def _run():
        try:
            samples, sr = _load_kokoro().create(text, voice=voice, speed=1.1, lang="en-us")
            buf = io.BytesIO()
            sf.write(buf, samples, sr, format="WAV", subtype="PCM_16")
            return buf.getvalue()
        finally:
            if VOICE_MEMORY_MODE == "low":
                _unload_kokoro()

    async with _model_lock:
        return await asyncio.to_thread(_run)


async def synthesise_streaming(text: str, voice: str = KOKORO_VOICE) -> AsyncIterator[bytes]:
    """
    Stream TTS in sentence chunks for lower perceived latency.
    Splits on sentence boundaries, synthesises each independently.
    """
    import re
    text = _clean_for_tts(text)
    # Split on sentence endings, keeping the delimiter
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if not sentences:
        sentences = [text]

    for sentence in sentences:
        if not sentence:
            continue
        chunk = await synthesise(sentence, voice)
        yield chunk


# ── Convenience: full pipeline for a single audio blob ────────────────────────

async def process_voice_turn(
    audio_bytes: bytes,
    history: list[dict],
    x_client=None,
    tweet_image_fn=None,
) -> tuple[str, str, bytes]:
    """
    Full voice turn:
      audio_bytes → transcript, agent_reply, tts_wav_bytes

    Returns (transcript, reply_text, wav_bytes)
    """
    from app.agent import run_agent

    transcript = await transcribe(audio_bytes)
    if not transcript:
        fallback = "Oh no... I couldn't quite hear that. Could you try again?"
        wav = await synthesise(fallback)
        return "", fallback, wav

    reply = await run_agent(
        user_message=transcript,
        history=history,
        x_client=x_client,
        tweet_image_fn=tweet_image_fn,
    )

    wav = await synthesise(reply)
    return transcript, reply, wav
