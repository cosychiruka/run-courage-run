"""
main.py — FastAPI application: voice WebSocket, REST endpoints, APScheduler.

Endpoints:
  GET  /health          — liveness check
  WS   /ws/voice        — full voice chat pipeline (audio in → audio out)
  POST /api/render_card — render a news article as PNG (for tweet image preview)
  GET  /api/news        — latest cached news articles (for frontend sync)
"""

import json
import base64
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import FRONTEND_ORIGIN
from app.news_cache import init_db, discovery_round, get_all_recent
from app.voice import load_models, transcribe, synthesise
from app.agent import run_agent
from app.x_client import make_x_client
from app.tweet_image import render_news_card, render_card_for_url

# ── Scheduler + shared state ───────────────────────────────────────────────────
scheduler = AsyncIOScheduler()
x_client  = None


async def _tweet_image_fn(article_url: str):
    return await render_card_for_url(article_url)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global x_client

    # DB
    await init_db()

    # Voice models (runs in thread via asyncio.to_thread inside load_models)
    await asyncio.to_thread(load_models)

    # X client (optional — graceful if keys missing)
    x_client = make_x_client()

    # Background jobs
    scheduler.add_job(discovery_round, "interval", minutes=10, id="discovery")
    scheduler.start()

    # First discovery immediately (non-blocking)
    asyncio.create_task(discovery_round())

    yield

    scheduler.shutdown(wait=False)


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Courage AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST ───────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "x_enabled": x_client is not None}


@app.get("/api/news")
async def get_news(limit: int = 10):
    articles = await get_all_recent(limit=limit)
    return JSONResponse(articles)


@app.post("/api/render_card")
async def api_render_card(payload: dict):
    """
    Body: { "url": "https://..." }  OR  { "article": {...} }
    Returns: PNG image bytes
    """
    article = payload.get("article")
    url     = payload.get("url")

    if article:
        png = await render_news_card(article)
    elif url:
        png = await render_card_for_url(url)
    else:
        raise HTTPException(400, "Provide 'url' or 'article'")

    if not png:
        raise HTTPException(500, "Render failed")

    return Response(content=png, media_type="image/png")


# ── Voice WebSocket ────────────────────────────────────────────────────────────
#
# Protocol (JSON messages interleaved with binary audio):
#
#   Client → Server (binary):  raw audio bytes (webm/ogg from MediaRecorder)
#   Client → Server (text):    { "type": "voice_end" }   ← signals end of recording
#   Client → Server (text):    { "type": "ping" }        ← keepalive
#
#   Server → Client (text):    { "type": "transcript",  "text": "..." }
#   Server → Client (text):    { "type": "thinking" }
#   Server → Client (binary):  WAV audio chunk (PCM 24kHz)
#   Server → Client (text):    { "type": "done",       "reply": "..." }
#   Server → Client (text):    { "type": "error",      "message": "..." }

@app.websocket("/ws/voice")
async def voice_ws(ws: WebSocket):
    await ws.accept()
    history: list[dict] = []
    audio_buffer = bytearray()

    try:
        while True:
            msg = await ws.receive()

            # Binary — accumulate audio chunks
            if "bytes" in msg and msg["bytes"]:
                audio_buffer.extend(msg["bytes"])
                continue

            # Text — control messages
            if "text" in msg:
                data = json.loads(msg["text"])
                kind = data.get("type", "")

                if kind == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
                    continue

                if kind == "voice_end" and audio_buffer:
                    raw_audio = bytes(audio_buffer)
                    audio_buffer.clear()

                    # 1. Transcribe
                    try:
                        transcript = await transcribe(raw_audio)
                    except Exception as e:
                        await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
                        continue

                    if not transcript.strip():
                        err_wav = await synthesise("Oh no... I couldn't quite hear that. Try again?")
                        await ws.send_bytes(err_wav)
                        await ws.send_text(json.dumps({"type": "done", "reply": ""}))
                        continue

                    await ws.send_text(json.dumps({"type": "transcript", "text": transcript}))
                    await ws.send_text(json.dumps({"type": "thinking"}))

                    # 2. Agent
                    try:
                        reply = await run_agent(
                            user_message=transcript,
                            history=history,
                            x_client=x_client,
                            tweet_image_fn=_tweet_image_fn,
                        )
                    except Exception as e:
                        err_msg = "The things I do for you people... something went wrong on my end."
                        await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
                        reply = err_msg

                    # 3. TTS
                    try:
                        wav = await synthesise(reply)
                        await ws.send_bytes(wav)
                    except Exception as e:
                        await ws.send_text(json.dumps({"type": "error", "message": f"TTS: {e}"}))

                    # 4. Done + update history
                    await ws.send_text(json.dumps({"type": "done", "reply": reply}))

                    history.extend([
                        {"role": "user",      "content": transcript},
                        {"role": "assistant", "content": reply},
                    ])
                    # Keep last 20 turns to avoid bloating context
                    if len(history) > 40:
                        history = history[-40:]

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS ERROR] {e}")
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass
