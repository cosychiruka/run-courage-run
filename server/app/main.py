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
import asyncio
import time
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import os
import httpx

from app.config import FRONTEND_ORIGIN, REDIS_URL, AUTONOMOUS_INTERVAL_MINUTES, DB_PATH
from app.news_cache import (
    init_db, discovery_round, get_recent_articles,
    get_cached_articles, fetch_pair, search_newsapi, search_gnews,
    get_budget_status,
)
from app.voice import load_models, transcribe, synthesise
from app.agent import run_agent, _init_token_tracker
from app.x_client import make_x_client
from app.tweet_image import render_news_card, render_card_for_url
from app.twitter_memory import init_twitter_db, prune_old_data as prune_twitter_memory
from app.goal_tracker import init_goal_db
from app.crypto_news import crypto_discovery_round
from app.autonomous_loop import autonomous_tick
import aiosqlite
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







# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global x_client, _redis

    async def _init_everything():
        try:
            print("[STARTUP] Courage is waking up in the background...")
            # 1. DBs — fast
            from app.goal_tracker import init_goal_db
            await init_db()
            await init_twitter_db()
            await init_goal_db()
            print("[STARTUP] Databases initialized.")

            # 2. Redis
            global _redis
            try:
                _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
                await asyncio.wait_for(_redis.ping(), timeout=5.0)
                print("[STARTUP] Redis connected.")
                await _redis.delete("active_voice_sessions")
            except Exception as e:
                _redis = None
                print(f"[STARTUP] Redis unavailable ({e}) — pulse falling back to memory.")

            # 3. X Client
            from app.config import make_x_client
            global x_client
            x_client = make_x_client()
            print(f"[STARTUP] X client: {'ACTIVE' if x_client else 'DISABLED'}")

            # 4. Background jobs
            scheduler.add_job(discovery_round,       "interval", minutes=30,  id="discovery")
            scheduler.add_job(crypto_discovery_round,"interval", minutes=30,  id="crypto_discovery")
            scheduler.add_job(prune_twitter_memory,  "interval", weeks=1,     id="memory_prune")
            scheduler.add_job(
                autonomous_tick, "interval",
                minutes=AUTONOMOUS_INTERVAL_MINUTES, id="autonomous", jitter=60,
                kwargs={"x_client": x_client, "tweet_image_fn": _tweet_image_fn},
            )
            scheduler.start()
            print("[STARTUP] Scheduler online.")

            # 5. Initial runs
            asyncio.create_task(discovery_round())
            asyncio.create_task(crypto_discovery_round())
            asyncio.create_task(_load_voice_models_bg())

            # 6. Groq tracker
            _init_token_tracker(REDIS_URL)
            print("[STARTUP] Courage Brain is fully awake. 🐕✨")

        except Exception as e:
            print(f"[STARTUP] FATAL BACKGROUND ERROR: {e}")

    # START IMMEDIATELY
    init_task = asyncio.create_task(_init_everything())
    
    yield

    # Cleanup
    print("[SHUTDOWN] Shutting down...")
    init_task.cancel()
    scheduler.shutdown(wait=False)
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
    if _redis:
        await _redis.aclose()
    print("[SHUTDOWN] Shutdown complete.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Courage AI Backend", lifespan=lifespan)

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "timestamp": time.time()}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:4173", "https://runcouragerun.fun", "https://www.runcouragerun.fun"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST ───────────────────────────────────────────────────────────────────────

@app.get("/api/x-status")
async def x_status():
    from app.config import (
        X_CONSUMER_KEY, X_CONSUMER_SECRET,
        X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_BEARER_TOKEN,
    )
    return {
        "x_client_active": x_client is not None,
        "keys": {
            "X_CONSUMER_KEY":        bool(X_CONSUMER_KEY),
            "X_CONSUMER_SECRET":     bool(X_CONSUMER_SECRET),
            "X_ACCESS_TOKEN":        bool(X_ACCESS_TOKEN),
            "X_ACCESS_TOKEN_SECRET": bool(X_ACCESS_TOKEN_SECRET),
            "X_BEARER_TOKEN":        bool(X_BEARER_TOKEN),
        },
    }


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
async def voice_ws(ws: WebSocket, session: str = ""):
    await ws.accept()

    # Track this session as active (so autonomous loop can be conservative)
    _session_id = session or f"anon_{int(time.time())}"
    if _redis:
        try:
            await _redis.sadd("active_voice_sessions", _session_id)
            await _redis.expire("active_voice_sessions", 3600)  # safety TTL
        except Exception:
            pass

    # ── Per-session history (isolated per user connection) ─────────────────────────
    # Each WebSocket connection gets its OWN history. If a session_id is provided
    # we also persist it in Redis so reconnections restore context.
    session_key = f"session:{session}:history" if session else None
    history: list[dict] = []

    if session_key and _redis:
        try:
            raw = await _redis.get(session_key)
            if raw:
                history = json.loads(raw)
                print(f"[SESSION] Restored {len(history)} history entries for session={session}")
        except Exception as e:
            print(f"[SESSION] Could not load history: {e}")

    audio_buffer = bytearray()

    # ── Helper: emit a JSON message to this specific client ───────────────────────
    async def ws_emit(msg: dict):
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            pass  # client may have disconnected during a tool call

    async def _save_history():
        if session_key and _redis:
            try:
                # Keep last 40 messages; TTL 4 hours
                to_save = history[-40:]
                await _redis.set(session_key, json.dumps(to_save), ex=14400)
            except Exception as e:
                print(f"[SESSION] Could not save history: {e}")

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

                if kind == "voice_cancel":
                    audio_buffer.clear()
                    await ws.send_text(json.dumps({"type": "cancelled"}))
                    continue

                if kind == "voice_end":
                    if not audio_buffer:
                        await ws.send_text(json.dumps({"type": "error", "message": "No audio data received. Please hold the button to record."}))
                        continue
                    
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

                    # 2. Agent (with optional world context and live tool-event streaming)
                    try:
                        reply = await run_agent(
                            user_message=transcript,
                            history=history,
                            x_client=x_client,
                            tweet_image_fn=_tweet_image_fn,
                            world_context=world_context,
                            ws_emit=ws_emit,
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
                    if len(history) > 40:
                        history = history[-40:]
                    await _save_history()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS ERROR] {e}")
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass
    finally:
        # Remove from active sessions — always runs on disconnect
        if _redis:
            try:
                await _redis.srem("active_voice_sessions", _session_id)
            except Exception:
                pass

        # Store compact visitor log entry — topic keywords only, no personal info
        if _redis and history:
            try:
                user_turns = [m["content"][:50] for m in history if m.get("role") == "user"][:3]
                log_entry = json.dumps({
                    "ts": time.time(),
                    "turn_count": len(history) // 2,
                    "topics": user_turns,
                })
                await _redis.lpush("courage:visitor_log", log_entry)
                await _redis.ltrim("courage:visitor_log", 0, 499)
                await _redis.expire("courage:visitor_log", 86400)
            except Exception:
                pass


# ── Goal Progress ─────────────────────────────────────────────────────────────

@app.get("/api/goal_progress")
async def goal_progress():
    """Returns Courage's growth stats, bucket usage, and tweet counters."""
    from app.goal_tracker import get_goal_progress_summary, get_last_bucket_times
    summary      = await get_goal_progress_summary()
    bucket_times = await get_last_bucket_times()
    today        = datetime.date.today().isoformat()
    auto_tweets  = 0
    total_tweets = 0
    if _redis:
        try:
            auto_tweets  = int(await _redis.get(f"courage:auto_tweets:{today}")  or 0)
            total_tweets = int(await _redis.get(f"courage:total_tweets:{today}") or 0)
        except Exception:
            pass
    groq_backoff_until = None
    groq_429_streak    = 0
    if _redis:
        try:
            backoff_raw = await _redis.get("courage:groq_backoff_until")
            if backoff_raw:
                groq_backoff_until = float(backoff_raw)
            groq_429_streak = int(await _redis.get("courage:groq_429_streak") or 0)
        except Exception:
            pass
    return JSONResponse({
        "summary":              summary,
        "bucket_last_used":     bucket_times,
        "auto_tweets_today":    auto_tweets,
        "total_tweets_today":   total_tweets,
        "groq_circuit_breaker": {
            "active":           groq_backoff_until is not None and time.time() < (groq_backoff_until or 0),
            "backoff_until_ts": groq_backoff_until,
            "streak":           groq_429_streak,
            "remaining_min":    max(0, int(((groq_backoff_until or 0) - time.time()) / 60)),
        },
    })


@app.post("/api/autonomous/reset-circuit-breaker")
async def reset_circuit_breaker():
    """Clear the Groq 429 circuit breaker so the next autonomous tick runs immediately."""
    if not _redis:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    try:
        await _redis.delete("courage:groq_backoff_until")
        await _redis.delete("courage:groq_429_streak")
        print("[ADMIN] Groq circuit breaker manually cleared.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return JSONResponse({"status": "ok", "message": "Circuit breaker cleared. Next tick will attempt execution."})


@app.post("/api/autonomous/trigger-now")
async def trigger_now():
    """Manually trigger an autonomous tick immediately."""
    from app.autonomous_loop import autonomous_tick
    # Use create_task so we return immediately to the admin UI
    asyncio.create_task(autonomous_tick(x_client=x_client, tweet_image_fn=_tweet_image_fn))
    return JSONResponse({"status": "ok", "message": "Autonomous tick triggered in background."})


# ── Admin Dashboard ────────────────────────────────────────────────────────────

@app.get("/api/admin/history")
async def admin_history(limit: int = 50):
    """Returns the full autonomous decision history for the dashboard."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM autonomous_decisions ORDER BY decided_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
    return JSONResponse(rows)


@app.get("/api/admin/system-status")
async def admin_system_status():
    """Aggregates all critical system health metrics into one payload."""
    from app.goal_tracker import get_last_bucket_times
    from app.news_cache import get_budget_status
    
    # 1. Bucket Status
    bucket_times = await get_last_bucket_times()
    
    # 2. News API Budgets
    news_budgets = await get_budget_status()
    
    # 3. Groq Status
    groq_backoff_until = None
    groq_429_streak = 0
    if _redis:
        backoff_raw = await _redis.get("courage:groq_backoff_until")
        if backoff_raw: groq_backoff_until = float(backoff_raw)
        groq_429_streak = int(await _redis.get("courage:groq_429_streak") or 0)
        
    # 4. Twitter Stats (from memory)
    from app.goal_tracker import get_goal_progress_summary
    growth_summary = await get_goal_progress_summary()
    
    # 5. Visitor Pulse
    visitor_count = 0
    recent_visitors = []
    if _redis:
        visitor_count = await _redis.llen("courage:visitor_log")
        raw_logs = await _redis.lrange("courage:visitor_log", 0, 9)
        recent_visitors = [json.loads(l) for l in raw_logs]

    return JSONResponse({
        "timestamp": time.time(),
        "buckets": bucket_times,
        "news_budgets": news_budgets,
        "growth": growth_summary,
        "visitors": {
            "total_24h": visitor_count,
            "recent": recent_visitors
        },
        "circuit_breakers": {
            "groq_active": groq_backoff_until is not None and time.time() < groq_backoff_until,
            "groq_backoff_until": groq_backoff_until,
            "groq_streak": groq_429_streak
        }
    })


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
        "You are the narrator of Courage's story in the bright Kansas noon. Euriel just {euriel_state}. "
        "Courage is watching from the yard. Decide a narrative moment or thought. "
        "Respond ONLY with valid JSON:\n"
        "{\"action\": \"<one of: courage_sniff|courage_bark|leaf_blows|bird_lands|cloud_shadow|narration>\","
        " \"message\": \"<poetic narrator observation, max 12 words>\"}"
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

    from app.config import GROQ_API_KEY, GROQ_MODEL
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    messages = [
        {"role": "system", "content": "You are a world event director. Output ONLY valid JSON. No extra text."},
        {"role": "user",   "content": prompt},
    ]
    try:
        client = get_http_client()
        r = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json={
            "model":   GROQ_MODEL,
            "messages": messages,
            "stream":  False,
            "response_format": {"type": "json_object"},
            "temperature": 0.9,
        })
        r.raise_for_status()
        raw = r.json().get("choices", [{}])[0].get("message", {}).get("content", "{}").strip()
        # Strip markdown fences just in case
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return JSONResponse(json.loads(raw))
    except Exception:
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
        # ── Bot Guard: Block common malicious scans ──
        # These are common paths bots hit looking for vulnerabilities.
        # We block them early to clean up logs and save resources.
        bot_paths = [
            "wp-", "xmlrpc", "php", ".env", ".git", 
            "config", "admin", "login", "setup", "install"
        ]
        if any(bp in full_path.lower() for bp in bot_paths):
            return Response(status_code=404, content="Not Found")

        # Skip if it's an API or WS route (but allow health)
        if full_path.startswith("api") or full_path.startswith("ws"):
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
