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
from fastapi.responses import JSONResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import os

from app.config import FRONTEND_ORIGIN, OLLAMA_HOST, REDIS_URL
from app.news_cache import (
    init_db, discovery_round, get_all_recent, get_recent_articles,
    get_cached_articles, fetch_pair, search_newsapi, search_gnews,
    get_budget_status,
)
from app.voice import load_models, transcribe, synthesise
from app.agent import run_agent
from app.x_client import make_x_client
from app.tweet_image import render_news_card, render_card_for_url

# ── Scheduler + shared state ───────────────────────────────────────────────────
scheduler = AsyncIOScheduler()
x_client  = None


async def _tweet_image_fn(article_url: str):
    return await render_card_for_url(article_url)


# ── Background voice model loader ─────────────────────────────────────────────
async def _load_voice_models_bg():
    """Load voice models in background so health checks pass immediately."""
    try:
        print("[STARTUP] Loading voice models (background)...")
        await asyncio.to_thread(load_models)
        print("[STARTUP] Voice models ready.")
    except Exception as e:
        print(f"[STARTUP] Voice model loading failed: {e}")
        print("[STARTUP] Voice features will be unavailable.")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global x_client

    try:
        # DB — fast, do first
        print("[STARTUP] Initializing database...")
        await init_db()
        print("[STARTUP] Database initialized.")

        # X client (optional — graceful if keys missing)
        print("[STARTUP] Setting up X client...")
        x_client = make_x_client()
        print("[STARTUP] X client setup completed.")

        # Background jobs — 30 min interval:
        # Guardian 5000/day ÷ 48 rounds × 4 pairs = 192 calls → well within limit
        # GNews/NewsAPI budgets only consumed when Guardian fails
        scheduler.add_job(discovery_round, "interval", minutes=30, id="discovery")
        scheduler.start()
        print("[STARTUP] Background scheduler started.")

        # First discovery immediately (non-blocking)
        asyncio.create_task(discovery_round())
        print("[STARTUP] Initial news discovery queued.")

        # Voice models — load in background AFTER server is ready to serve
        asyncio.create_task(_load_voice_models_bg())

        print("\n" + "="*50)
        print("🐕 COURAGE AI BACKEND — READY")
        print(f"📡 OLLAMA_HOST: {OLLAMA_HOST}")
        print(f"🗄️ REDIS_URL:   {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}")
        print(f"🌐 FRONTEND:    {FRONTEND_ORIGIN}")
        print("="*50 + "\n")

    except Exception as e:
        print(f"[STARTUP] ERROR during initialization: {e}")
        print("[STARTUP] Continuing with limited functionality...")
        # Don't re-raise - allow app to start even if some components fail

    yield

    print("[SHUTDOWN] Shutting down...")
    scheduler.shutdown(wait=False)
    print("[SHUTDOWN] Shutdown complete.")


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

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    budget = await get_budget_status()
    return {"status": "ok", "x_enabled": x_client is not None, "budget": budget}


@app.get("/api/news")
async def get_news(
    country: str = "us",
    category: str = "general",
    limit: int = 10,
    fresh: bool = False,   # ?fresh=true skips cache and fetches live (costs a request)
):
    """
    Returns cached news for a given country/category.
    Flow: Redis hot cache → SQLite → live fetch (only if cache miss or fresh=true).
    """
    if not fresh:
        # 1. Redis hot cache (30-min TTL)
        cached = await get_cached_articles(country, category)
        if cached:
            return JSONResponse(cached[:limit])

        # 2. SQLite durable store
        stored = await get_recent_articles(limit, country, category)
        if stored:
            return JSONResponse(stored)

    # 3. Live fetch — Guardian → NewsAPI → GNews with budget tracking
    articles = await fetch_pair(country, category, limit)
    return JSONResponse(articles)


@app.get("/api/news/search")
async def search_news(q: str, limit: int = 10):
    """
    Keyword search across NewsAPI (primary) and GNews (fallback), both budgeted.
    Results are NOT cached — search is on-demand only.
    """
    # Try NewsAPI first (higher quality search)
    results = await search_newsapi(q, limit)
    if not results:
        results = await search_gnews(q, limit)
    return JSONResponse(results)


@app.get("/api/news/budget")
async def news_budget():
    """Returns today's API usage counters for monitoring."""
    return JSONResponse(await get_budget_status())


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

# ── Static Files (Frontend) ──────────────────────────────────────────────────
# Mount the built React app. Serve index.html for any unknown paths (SPA)

if os.path.exists("/app/static"):
    app.mount("/static", StaticFiles(directory="/app/static"), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Skip if it's an API or WS route
        if full_path.startswith("api") or full_path.startswith("ws") or full_path.startswith("health"):
            return Response(status_code=404)
            
        # Check if the file exists in static folder
        file_path = os.path.join("/app/static", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Otherwise serve index.html for SPA routing
        return FileResponse("/app/static/index.html")
else:
    @app.get("/")
    async def root_fallback():
        return {"message": "Courage Backend is running. Frontend assets not found in /app/static. Build issue?"}
