"""
main.py — FastAPI application: voice WebSocket, REST endpoints, APScheduler.

Endpoints:
  GET  /health               — liveness check
  WS   /ws/voice             — full voice chat pipeline (audio in → audio out)
  POST /api/render_card      — render a news article as PNG
  GET  /api/news             — latest cached news articles
  POST /api/world/event      — LLM decides a world event given world state
  POST /api/world/presence   — lightweight monster selfie session presence
  GET  /api/world/presence   — get active monsters in a world
"""

import json
import base64
import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import os
import httpx

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
import redis.asyncio as aioredis

# ── Shared HTTP client (persistent pool, not per-request) ─────────────────────
_http_client: httpx.AsyncClient | None = None

def get_http_client() -> httpx.AsyncClient:
    """Return the shared httpx client. Created lazily on first call."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30)
    return _http_client

# ── Redis client (for presence) ───────────────────────────────────────────────
_redis: aioredis.Redis | None = None

def get_redis() -> aioredis.Redis | None:
    return _redis

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


# ── Ollama model auto-pull ─────────────────────────────────────────────────────
async def _ensure_ollama_model_bg():
    """
    On startup, check whether the configured model exists in Ollama.
    If not, trigger a pull via the Ollama REST API.
    Retries with backoff — handles Ollama being slow to start.
    Runs entirely in the background — never blocks the server.
    """
    from app.config import OLLAMA_HOST, OLLAMA_MODEL
    retry_delays = [5, 15, 30, 60, 120]  # seconds between attempts

    for attempt, delay in enumerate(retry_delays, 1):
        await asyncio.sleep(delay)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{OLLAMA_HOST}/api/tags")
                if resp.status_code != 200:
                    raise Exception(f"HTTP {resp.status_code}")

                existing = [m["name"] for m in resp.json().get("models", [])]
                model_base = OLLAMA_MODEL.split(":")[0]
                already_have = any(
                    m == OLLAMA_MODEL or m.startswith(model_base)
                    for m in existing
                )
                if already_have:
                    print(f"[OLLAMA] Model '{OLLAMA_MODEL}' already present ✓")
                    return

            # Model not found — trigger pull
            print(f"[OLLAMA] Pulling '{OLLAMA_MODEL}' (attempt {attempt}/{len(retry_delays)})...")
            async with httpx.AsyncClient(timeout=600) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/pull",
                    json={"name": OLLAMA_MODEL, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            try:
                                data = __import__("json").loads(line)
                                status = data.get("status", "")
                                completed = data.get("completed", 0)
                                total = data.get("total", 0)
                                if total:
                                    pct = int(completed / total * 100)
                                    if pct % 10 == 0:  # log every 10%
                                        print(f"[OLLAMA] {status} {pct}%")
                                elif status:
                                    print(f"[OLLAMA] {status}")
                            except Exception:
                                pass
            print(f"[OLLAMA] '{OLLAMA_MODEL}' ready ✓ Courage has a brain!")
            return  # success — stop retrying

        except httpx.ConnectError:
            if attempt < len(retry_delays):
                print(f"[OLLAMA] Not reachable at {OLLAMA_HOST} (attempt {attempt}) — retrying in {retry_delays[attempt]}s...")
            else:
                print(f"[OLLAMA] Cannot reach {OLLAMA_HOST} after {len(retry_delays)} attempts. Check OLLAMA_HOST env var.")
        except Exception as e:
            if attempt < len(retry_delays):
                print(f"[OLLAMA] Error (attempt {attempt}): {e} — retrying in {retry_delays[attempt]}s...")
            else:
                print(f"[OLLAMA] Giving up after {len(retry_delays)} attempts: {e}")



# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global x_client, _redis

    try:
        # DB — fast, do first
        print("[STARTUP] Initializing database...")
        await init_db()
        print("[STARTUP] Database initialized.")

        # Redis — for presence persistence across redeploys
        try:
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await _redis.ping()
            print("[STARTUP] Redis connected (presence will survive redeploys).")
        except Exception as e:
            _redis = None
            print(f"[STARTUP] Redis unavailable ({e}) — presence falls back to in-memory.")

        # X client (optional — graceful if keys missing)
        print("[STARTUP] Setting up X client...")
        x_client = make_x_client()
        print("[STARTUP] X client setup completed.")

        # Background jobs — 30 min interval
        scheduler.add_job(discovery_round, "interval", minutes=30, id="discovery")
        scheduler.start()
        print("[STARTUP] Background scheduler started.")

        asyncio.create_task(discovery_round())
        print("[STARTUP] Initial news discovery queued.")

        asyncio.create_task(_load_voice_models_bg())
        asyncio.create_task(_ensure_ollama_model_bg())

        print("\n" + "="*50)
        print("🐕 COURAGE AI BACKEND — READY")
        print(f"📡 OLLAMA_HOST: {OLLAMA_HOST}")
        print(f"🗄️ REDIS_URL:   {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}")
        print(f"🌐 FRONTEND:    {FRONTEND_ORIGIN}")
        print("="*50 + "\n")

    except Exception as e:
        print(f"[STARTUP] ERROR during initialization: {e}")
        print("[STARTUP] Continuing with limited functionality...")

    yield

    print("[SHUTDOWN] Shutting down...")
    scheduler.shutdown(wait=False)
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
    if _redis:
        await _redis.aclose()
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
                    # Safety cap: reject absurdly large audio buffers (>5 MB = ~5 min recording)
                    if len(audio_buffer) > 5 * 1024 * 1024:
                        audio_buffer.clear()
                        await ws.send_text(json.dumps({"type": "error", "message": "Recording too long. Please keep it under 2 minutes."}))
                        continue
                    raw_audio = bytes(audio_buffer)
                    audio_buffer.clear()
                    world_context = data.get("world_context", None)

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

                    # 2. Agent (with optional world context injected)
                    try:
                        reply = await run_agent(
                            user_message=transcript,
                            history=history,
                            x_client=x_client,
                            tweet_image_fn=_tweet_image_fn,
                            world_context=world_context,
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


# ── World Event Engine ─────────────────────────────────────────────────────────
# The LLM acts as an invisible director, periodically deciding what happens in
# each 3D world.  Returns a structured JSON action the frontend can apply.

WORLD_EVENT_PROMPTS = {
    "disco": (
        "You are the invisible DJ brain of the Nowhere High School Disco. "
        "The party has been running for {elapsed}s. Current ghost count: {ghost_count}. "
        "Decide ONE event. Respond ONLY with valid JSON, no markdown:\n"
        "{\"action\": \"<one of: speed_up|slow_down|color_shift|ghost_frenzy|freeze_frame|lights_out|dj_shoutout>\","
        " \"message\": \"<short funny DJ announcement, max 12 words>\","
        " \"hue\": <0.0-1.0 for color_shift only, else null>}"
    ),
    "evening": (
        "You are the ghost haunting the Bagge farmhouse at evening in Nowhere, Kansas. "
        "Courage the dog has been watching you for {elapsed}s. You feel {mood}. "
        "Decide your next move. Respond ONLY with valid JSON:\n"
        "{\"action\": \"<one of: retreat|advance|hide|call_friends|taunt|disappear>\","
        " \"message\": \"<what the ghost rasps aloud, max 10 words, spooky>\"}"
    ),
    "sunrise": (
        "You are narrating Courage's inner thoughts at sunrise. {elapsed}s have passed. "
        "Courage is {state}. "
        "Write a poetic internal thought bubble. Respond ONLY with valid JSON:\n"
        "{\"action\": \"thought_bubble\","
        " \"message\": \"<Courage's thought, max 14 words, anxious but brave>\"}"
    ),
    "noon": (
        "You are narrating the Noon world. Euriel just {euriel_state}. Courage has been watching for {elapsed}s. "
        "Decide a small narrative moment. Respond ONLY with valid JSON:\n"
        "{\"action\": \"<one of: courage_sniff|courage_bark|leaf_blows|bird_lands|cloud_shadow>\","
        " \"message\": \"<brief narrator note, max 10 words>\"}"
    ),
}

@app.post("/api/world/event")
async def world_event(payload: dict):
    """
    Body: { "world": "disco"|"evening"|"sunrise"|"noon", "state": {...} }
    Returns: { "action": "...", "message": "...", ... }
    LLM picks the next world event.  Falls back to a random safe default.
    """
    world = payload.get("world", "evening")
    state = payload.get("state", {})

    template = WORLD_EVENT_PROMPTS.get(world, WORLD_EVENT_PROMPTS["evening"])
    try:
        prompt = template.format(**{**{"elapsed": 30, "ghost_count": 5, "mood": "mischievous",
                                       "state": "running", "euriel_state": "left"}, **state})
    except KeyError:
        prompt = template

    from app.config import OLLAMA_HOST, OLLAMA_MODEL
    messages = [
        {"role": "system", "content": "You are a world event director. Output ONLY valid JSON. No extra text."},
        {"role": "user",   "content": prompt},
    ]
    try:
        client = get_http_client()
        r = await client.post(f"{OLLAMA_HOST}/api/chat", json={
            "model":   OLLAMA_MODEL,
            "messages": messages,
            "stream":  False,
            "format":  "json",   # enforce JSON at inference level — no regex needed
            "options": {"temperature": 0.9, "num_ctx": 1024},
        })
        r.raise_for_status()
        raw = r.json().get("message", {}).get("content", "{}").strip()
        # Strip markdown fences in case older Ollama ignores format param
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return JSONResponse(json.loads(raw))
    except Exception as e:
        # Fallback safe defaults per world
        defaults = {
            "disco": {"action": "dj_shoutout", "message": "Nowhere High is ON FIRE tonight!", "hue": None},
            "evening": {"action": "taunt", "message": "Mwahahaha... I see you, pink dog."},
            "sunrise": {"action": "thought_bubble", "message": "What's out there... I'll face it anyway."},
            "noon": {"action": "leaf_blows", "message": "A warm Kansas breeze drifts by."},
        }
        return JSONResponse(defaults.get(world, {"action": "idle", "message": "..."}))


# ── World Presence (Monster Selfie sessions) ───────────────────────────────────
# Redis-backed with in-memory fallback. Survives redeployments.

_world_presence_mem: dict = {}  # Fallback if Redis is down
_PRESENCE_TTL = 600  # 10 minutes

@app.post("/api/world/presence")
async def update_presence(payload: dict):
    """Register or refresh a monster selfie presence session."""
    world = payload.get("world", "disco")
    uid   = payload.get("uid", "anon")
    name  = payload.get("name", "Anonymous Monster")
    emoji = payload.get("emoji", "👻")
    
    data = {"name": name, "emoji": emoji, "last_seen": time.time()}
    redis = get_redis()
    
    if redis:
        try:
            key = f"presence:{world}:{uid}"
            await redis.set(key, json.dumps(data), ex=_PRESENCE_TTL)
        except Exception as e:
            print(f"[REDIS ERROR] update_presence: {e}")
            # Fallback handled below
    
    # Always update memory as fallback/backup
    if world not in _world_presence_mem:
        _world_presence_mem[world] = {}
    _world_presence_mem[world][uid] = data
    
    return JSONResponse({"ok": True})

@app.get("/api/world/presence")
async def get_presence(world: str = "disco"):
    """Return all active monster selfie sessions in a world."""
    now = time.time()
    active_users = []
    redis = get_redis()
    
    if redis:
        try:
            # Find all presence keys for this world
            cursor = 0
            while True:
                cursor, keys = await redis.scan(cursor, match=f"presence:{world}:*", count=100)
                for key in keys:
                    raw = await redis.get(key)
                    if raw:
                        v = json.loads(raw)
                        uid = key.split(":")[-1]
                        active_users.append({
                            "uid": uid, 
                            "name": v["name"], 
                            "emoji": v["emoji"],
                            "seconds_ago": int(now - v["last_seen"])
                        })
                if cursor == 0:
                    break
            if active_users:
                return JSONResponse(active_users)
        except Exception as e:
            print(f"[REDIS ERROR] get_presence: {e}")
            # Fallback to memory
    
    # Memory fallback
    sessions = _world_presence_mem.get(world, {})
    active_users = [
        {"uid": k, "name": v["name"], "emoji": v["emoji"],
         "seconds_ago": int(now - v["last_seen"])}
        for k, v in sessions.items()
        if now - v["last_seen"] < _PRESENCE_TTL
    ]
    # Prune memory while we are at it
    _world_presence_mem[world] = {
        k: v for k, v in sessions.items()
        if now - v["last_seen"] < _PRESENCE_TTL
    }
    
    return JSONResponse(active_users)


# ── Static Files (Frontend) ───────────────────────────────────────────────────
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
