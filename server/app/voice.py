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
import soundfile as sf
from pathlib import Path
from typing import AsyncIterator

from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro

from app.config import WHISPER_MODEL, KOKORO_VOICE

# ── Singleton model instances (loaded once at startup) ────────────────────────
_whisper: WhisperModel | None = None
_kokoro:  Kokoro | None       = None


def load_models():
    """Call once at app startup to pre-load both models into memory."""
    global _whisper, _kokoro
    print("[VOICE] Loading Whisper...")
    try:
        # Load Whisper with memory optimization
        _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        print("[VOICE] Whisper loaded successfully.")
        # Clear any cached data to free memory
        import gc
        gc.collect()
    except Exception as e:
        print(f"[VOICE] ERROR: Failed to load Whisper model: {e}")
        print("[VOICE] Voice transcription will not be available.")
        
    print("[VOICE] Loading Kokoro TTS...")
    try:
        # Load Kokoro with memory optimization
        _kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
        print("[VOICE] Kokoro TTS loaded successfully.")
        # Clear any cached data to free memory
        gc.collect()
    except Exception as e:
        print(f"[VOICE] ERROR: Failed to load Kokoro TTS: {e}")
        print("[VOICE] Voice synthesis will not be available.")
        
    if _whisper is not None and _kokoro is not None:
        print("[VOICE] All models ready.")
        print("[VOICE] Memory usage optimized.")
    else:
        print("[VOICE] WARNING: Some models failed to load - voice features limited.")
        print("[VOICE] Running with reduced functionality.")


def _get_whisper() -> WhisperModel:
    if _whisper is None:
        raise RuntimeError("Voice models are still loading — please try again in a moment.")
    return _whisper


def _get_kokoro() -> Kokoro:
    if _kokoro is None:
        raise RuntimeError("Voice models are still loading — please try again in a moment.")
    return _kokoro


# ── STT ────────────────────────────────────────────────────────────────────────

async def transcribe(audio_bytes: bytes) -> str:
    """
    Transcribe audio bytes (webm/ogg/wav) → text string.
    Runs faster-whisper in a thread to avoid blocking the event loop.
    """
    def _run():
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        segments, _info = _get_whisper().transcribe(
            tmp_path,
            language="en",
            beam_size=5,
            vad_filter=True,  # skip silence automatically
        )
        text = " ".join(seg.text for seg in segments).strip()
        Path(tmp_path).unlink(missing_ok=True)
        return text

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
        samples, sr = _get_kokoro().create(text, voice=voice, speed=1.1, lang="en-us")
        buf = io.BytesIO()
        sf.write(buf, samples, sr, format="WAV", subtype="PCM_16")
        return buf.getvalue()

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
