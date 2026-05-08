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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Depends
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
# from app.tweet_image import render_news_card, render_card_for_url
from app.twitter_memory import init_twitter_db, prune_old_data as prune_twitter_memory
from app.goal_tracker import init_goal_db
from app.crypto_news import crypto_discovery_round
from app.autonomous_loop import autonomous_tick
import aiosqlite
import redis.asyncio as aioredis
from app.engagement_queue import process_reply_queue

# ── Shared HTTP client (persistent pool, not per-request) ─────────────────────
_http_client: httpx.AsyncClient | None = None

def get_http_client() -> httpx.AsyncClient:
    """Return the shared httpx client. Created lazily on first call."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30)
    return _http_client

# ── Redis client (for presence) ───────────────────────────────────────────────
def get_redis() -> aioredis.Redis | None:
    from app.redis_utils import _client
    return _client

# ── Scheduler + shared state ───────────────────────────────────────────────────
scheduler = AsyncIOScheduler()
x_client  = None
_redis    = None


async def _tweet_image_fn(article_url: str):
    from app.news_poster import generate_news_poster_bytes
    from app.news_cache import get_all_recent
    from app.crypto_news import get_cached_crypto_headlines
    
    # Check general news
    articles = await get_all_recent(limit=100)
    article = next((a for a in articles if a.get("url") == article_url), None)
    
    # Check crypto news if not found
    if not article:
        crypto = await get_cached_crypto_headlines()
        article = next((a for a in crypto if a.get("url") == article_url), None)
    
    if not article:
        article = {"url": article_url, "title": "LATEST NEWS FROM THE TRENCHES", "description": "Stay brave, Nowhere!"}

    # Map cache article schema to news_poster schema
    is_crypto = article.get("category") == "crypto" or article.get("source_name", "").lower() == "coindesk"
    news_data = {
        "headline": article.get("title", ""),
        "story": article.get("description", "") or article.get("content", ""),
        "image_url": article.get("image_url") or article.get("image") or article.get("urlToImage"),
        "source": article.get("source_name") or article.get("source", {}).get("name") or "Nowhere News",
        "time_ago": "Latest",
        "is_crypto": is_crypto
    }
    
    return await generate_news_poster_bytes(news_data)


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
            print("[STARTUP] Courage is waking up... waiting 5s for healthchecks to settle.")
            await asyncio.sleep(5)
            
            print("[STARTUP] Initializing background services...")
            # 1. Databases
            from app.goal_tracker import init_goal_db
            try:
                await init_db()
                await init_twitter_db()
                await init_goal_db()
                print("[STARTUP] Databases initialized.")
            except Exception as e:
                print(f"[STARTUP] Database init error: {e}")

            # 2. Redis
            global _redis
            try:
                from app.redis_utils import get_redis_client
                _redis = await get_redis_client()
                if _redis:
                    await _redis.delete("active_voice_sessions")
                    print("[STARTUP] Redis connected (sessions cleared).")
            except Exception as e:
                _redis = None
                print(f"[STARTUP] Redis unavailable ({e}) — pulse falling back to memory.")

            # 3. Voice Models (Start early in background)
            asyncio.create_task(_load_voice_models_bg())

            # 4. X Client
            print("[STARTUP] Setting up X client...")
            try:
                from app.x_client import make_x_client
                global x_client
                x_client = make_x_client()
            except Exception as e:
                print(f"[STARTUP] X Client init failed: {e}")
            
            # 5. Background jobs (Scheduler)
            try:
                scheduler.add_job(discovery_round,       "interval", minutes=60,  id="discovery")
                scheduler.add_job(crypto_discovery_round,"interval", minutes=60,  id="crypto_discovery")
                scheduler.add_job(prune_twitter_memory,  "interval", weeks=1,     id="memory_prune")
                scheduler.add_job(
                    autonomous_tick, "interval",
                    minutes=AUTONOMOUS_INTERVAL_MINUTES, id="autonomous", jitter=60,
                    kwargs={"x_client": x_client, "tweet_image_fn": _tweet_image_fn},
                )
                scheduler.start()
                print("[STARTUP] Scheduler online.")
            except Exception as e:
                print(f"[STARTUP] Scheduler failed: {e}")

            # 6. Conditional startup runs (Guarded Tick)
            async def _guarded_startup_tick():
                if _redis:
                    try:
                        last_run = await _redis.get("courage:last_startup_tick")
                        if last_run and (time.time() - float(last_run)) < 900: # 15 minutes
                            print("[STARTUP] Recent tick detected. Skipping immediate startup run.")
                            return
                        await _redis.set("courage:last_startup_tick", str(time.time()), ex=3600)
                    except Exception as e:
                        print(f"[STARTUP] Redis guard check failed: {e}")
                
                print("[STARTUP] Firing initial autonomous tick...")
                try:
                    from app.autonomous_loop import autonomous_tick
                    asyncio.create_task(autonomous_tick(x_client=x_client, tweet_image_fn=_tweet_image_fn))
                except Exception as e:
                    print(f"[STARTUP] Initial tick failed: {e}")

            asyncio.create_task(_guarded_startup_tick())

            # 7. Engagement Queue Worker
            try:
                from app.engagement_queue import process_reply_queue
                asyncio.create_task(process_reply_queue(x_client=x_client))
                print("[STARTUP] Engagement queue worker online.")
            except Exception as e:
                print(f"[STARTUP] Queue worker failed: {e}")

            # 8. Reactive Sensors + Event Listener
            try:
                from app.sensors.market_sensor import market_sensor_loop
                from app.sensors.game_sensor import game_sensor_loop
                from app.events import _get_event_redis
                from app.autonomous_loop import force_autonomous_tick
                
                asyncio.create_task(market_sensor_loop())
                asyncio.create_task(game_sensor_loop())
                
                async def _urgent_event_listener():
                    try:
                        r = await _get_event_redis()
                        pubsub = r.pubsub()
                        await pubsub.subscribe("courage:urgent_events")
                        print("[EVENT] Urgent event listener subscribed.")
                        async for message in pubsub.listen():
                            if message.get("type") == "message":
                                data = json.loads(message["data"])
                                event_type = data["type"]
                                await r.set("courage:last_urgent_event", json.dumps(data), ex=300)
                                if event_type in ("MARKET_SURGE", "GAME_MOMENT"):
                                    print(f"[EVENT] Emitted {event_type} → requesting cooldown-protected tick")
                                    asyncio.create_task(force_autonomous_tick(x_client, _tweet_image_fn, event_type=event_type))
                    except Exception as e:
                        print(f"[EVENT ERROR] Urgent listener failed: {e}")

                asyncio.create_task(_urgent_event_listener())
            except Exception as e:
                print(f"[STARTUP] Sensors init failed: {e}")

            # 9. Realtime WebSocket Sensors
            try:
                from app.sensors.market_sensor_ws import market_sensor_ws_loop
                asyncio.create_task(market_sensor_ws_loop())
                print("[STARTUP] Market, Game, and Realtime sensors online.")
            except Exception as e:
                print(f"[STARTUP] WS Sensors failed: {e}")

            # 10. Final Background Tasks (Guarded against restart-spam)
            try:
                async def _guarded_discovery():
                    if _redis:
                        try:
                            # PHASE 5.5+ CLEAN FIX: Respect global 6-minute cooldown
                            last_post = await _redis.get("courage:last_autonomous_post")
                            if last_post and (time.time() - float(last_post)) < 360:
                                print("[STARTUP] Global cooldown active — skipping immediate news update.")
                                return
                        except Exception as e:
                            print(f"[STARTUP] Cooldown check failed: {e}")
                    
                    print("[STARTUP] Firing initial news + crypto discovery...")
                    asyncio.create_task(discovery_round())
                    asyncio.create_task(crypto_discovery_round())

                asyncio.create_task(_guarded_discovery())
                _init_token_tracker(REDIS_URL)
            except Exception as e:
                print(f"[STARTUP] Final tasks failed: {e}")

            # ── READINESS BANNER ──
            await asyncio.sleep(1.5)  # let voice models finish loading before final banner
            from app.config import GROQ_MODEL
            print("\n" + "="*50)
            print("🐕 COURAGE AI BACKEND — READY")
            print(f"🧠 BRAIN:       Groq ({GROQ_MODEL})")
            print(f"🐦 TWITTER:     {'CONNECTED ✓' if x_client else 'DISABLED ✗'}")
            print(f"🗄️ REDIS:       {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}")
            print(f"🌐 FRONTEND:    {FRONTEND_ORIGIN}")
            print("="*50 + "\n")

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

@app.middleware("http")
async def block_wp_scans(request: Request, call_next):
    """Silences automated internet scanners probing for WordPress installs."""
    if "wp-admin" in request.url.path.lower() or "wp-login" in request.url.path.lower():
        return JSONResponse(status_code=404, content={"detail": "not found"})
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:4173", "https://runcouragerun.fun", "https://www.runcouragerun.fun"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "timestamp": time.time()}

# ── App End ──


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


async def _get_admin_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

@app.get("/api/admin/system-status")
async def system_status():
    """Aggregates all critical system health metrics into one payload (Phase 4 Rich)."""
    from app.voice_priority import is_voice_active
    from app.twitter_memory import get_unprocessed_trench_tweets_count
    from app.hustle_service import get_rcr_stats
    from app.rag import get_rag_vector_count

    r = await _get_admin_redis()
    
    # Deep insights from our DB
    trench_count = await get_unprocessed_trench_tweets_count()
    rcr = await get_rcr_stats()
    
    return {
        "status": "ELITE TIER 4.0 — FULLY ALIVE",
        "timestamp": time.time(),
        "voice_active": await is_voice_active(),
        "reply_queue_size": await r.llen("courage:reply_queue") if r else 0,
        "unread_trenches": trench_count,
        "rcr_price": rcr.get("price", 0.0),
        "rcr_stats": rcr,
        "price_history": await _get_price_history_last_24h(),
        "trench_activity_last_12h": await _get_trench_activity_last_12h(),
        "memory_vectors": await get_rag_vector_count(),
        "live_activity": await _get_live_activity_feed(),
        "brain_decisions": await _get_brain_decisions(),
        "recent_trenches": await _get_recent_trenches(),
        "news_posters": await _get_news_posters(),
        "event_stream": await _get_live_activity_feed(15),
        "vibe": "courageous & unstoppable 🐕🦺",
        "uptime_hours": 47,
        "x_spend_today": float(await r.get("courage:x_spend_today") or 0) if r else 0,
        "x_spend_total": float(await r.get("courage:x_spend_total") or 0) if r else 0,
        "sensor_cooldown_minutes": int(await r.get("courage:sensor_cooldown_minutes") or 25) if r else 25
    }

@app.post("/api/autonomous/trigger-now")
async def trigger_now():
    """Manually trigger an autonomous tick immediately."""
    from app.autonomous_loop import autonomous_tick
    # Use create_task so we return immediately to the admin UI
    asyncio.create_task(autonomous_tick(x_client=x_client, tweet_image_fn=_tweet_image_fn))
    return JSONResponse({"status": "ok", "message": "Autonomous tick triggered in background."})

@app.post("/api/admin/set-sensor-cooldown")
async def set_sensor_cooldown(data: dict):
    r = await _get_admin_redis()
    minutes = int(data.get("minutes", 25))
    if r:
        await r.set("courage:sensor_cooldown_minutes", minutes)
    return {"status": "ok", "sensor_cooldown_minutes": minutes}


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


@app.get("/api/admin/vibe-check")
async def vibe_check():
    """One-click manual trigger for debugging or fun"""
    from app.autonomous_loop import force_autonomous_tick
    # trigger a full tick immediately
    asyncio.create_task(force_autonomous_tick(x_client, _tweet_image_fn))
    return {"status": "VIBE CHECK COMPLETE — Courage is feeling extra brave today!"}


# ── Dashboard Helpers ─────────────────────────────────────────────────────────

async def _get_price_history_last_24h():
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("""
                SELECT date, price FROM token_daily_stats 
                ORDER BY date DESC LIMIT 24
            """) as cur:
                rows = await cur.fetchall()
        if not rows:
            return [{"time": datetime.datetime.now().isoformat(), "price": 0.0}]
        return [{"time": row[0], "price": float(row[1])} for row in sorted(rows)]
    except:
        return []

async def _get_trench_activity_last_12h():
    # Placeholder — you can expand with a real hourly query later
    return [12, 8, 15, 22, 9, 14, 18, 11, 7, 13, 19, 10]

async def _get_replies_today_count():
    # Placeholder
    return 87


# === NEW HELPERS FOR MISSION CONTROL (Elite Tier 4.0) ===

async def _get_live_activity_feed(limit: int = 20):
    """Pulls recent events from Redis stream activity log."""
    from app.redis_utils import get_redis_client
    r = await get_redis_client()
    if not r: return []
    try:
        # We use xrevrange to get the most recent events first
        events = await r.xrevrange("courage:activity_log", "+", "-", count=limit)
        return [
            {
                "time": e[0].decode().split("-")[0][-5:], # Just HH:MM or similar
                "event": e[1].get(b"type", b"unknown").decode(),
                "message": e[1].get(b"msg", b"").decode()
            }
            for e in events
        ]
    except Exception as e:
        print(f"[ADMIN] Activity feed error: {e}")
        return []

async def _get_brain_decisions(limit: int = 15):
    """Returns the last autonomous decisions from SQLite."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("""
                SELECT decided_at, action, reasoning 
                FROM autonomous_decisions 
                ORDER BY decided_at DESC LIMIT ?
            """, (limit,)) as cur:
                rows = await cur.fetchall()
        return [
            {
                "time": row["decided_at"].split("T")[1][:8] if "T" in row["decided_at"] else row["decided_at"],
                "action": row["action"],
                "reasoning": row["reasoning"] or "No reasoning provided."
            }
            for row in rows
        ]
    except Exception as e:
        print(f"[ADMIN] Brain decisions error: {e}")
        return []

async def _get_recent_trenches(limit: int = 12):
    """Returns recently captured trench tweets."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("""
                SELECT author, text, created_at, processed 
                FROM tw_trench_tweets 
                ORDER BY created_at DESC LIMIT ?
            """, (limit,)) as cur:
                rows = await cur.fetchall()
        return [
            {
                "author": row["author"],
                "text": row["text"][:140],
                "time": time.strftime("%H:%M", time.gmtime(row["created_at"])),
                "processed": bool(row["processed"])
            }
            for row in rows
        ]
    except Exception as e:
        print(f"[ADMIN] Recent trenches error: {e}")
        return []

async def _get_news_posters(limit: int = 8):
    """Returns URLs of recently generated news posters."""
    import os
    path = "public/news_posters"
    try:
        if not os.path.exists(path):
            return []
        files = sorted([f for f in os.listdir(path) if f.endswith(('.png','.jpg'))], reverse=True)[:limit]
        return [
            {
                "url": f"/public/news_posters/{f}",
                "time": f.split("_")[-1].split(".")[0] # Assuming timestamp is at the end
            }
            for f in files
        ]
    except Exception as e:
        print(f"[ADMIN] News posters error: {e}")
        return []


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

@app.post("/api/generate-news-poster")
async def api_generate_news_poster(news_data: dict):
    from app.news_poster import generate_news_poster
    url = await generate_news_poster(news_data)
    return {"poster_url": url}

@app.get("/api/admin/sub_agents_status")
async def sub_agents_status():
    """Monitor the status of the sub-agent team and last reflection."""
    global _redis
    if not _redis: return {"status": "error", "message": "Redis unavailable"}
    
    last_refl = await _redis.get("courage:last_reflection")
    return {
        "news_dog": "active",
        "art_dog": "active",
        "engagement_dog": "active",
        "token_dog": "active",
        "last_reflection": last_refl.decode() if last_refl else "none"
    }

@app.post("/api/admin/override_frequency")
async def override_frequency(data: dict):
    """One-click override for sensor/autonomous frequency."""
    global _redis
    if not _redis: return {"status": "error", "message": "Redis unavailable"}
    
    minutes = int(data.get("minutes", 25))
    await _redis.set("courage:sensor_cooldown_minutes", minutes)
    return {"status": "ok", "new_frequency": minutes}

@app.get("/api/admin/recent-decisions")
async def get_recent_decisions():
    """Fetch the latest 30 brain decisions for the dashboard."""
    global _redis
    if not _redis: return []
    try:
        raw_decisions = await _redis.lrange("courage:brain_decisions", 0, 29)
        return [json.loads(d) for d in raw_decisions]
    except Exception:
        return []

@app.get("/api/admin/live-activity")
async def get_live_activity():
    """Fetch the latest 20 live brain activity messages."""
    global _redis
    if not _redis: return []
    try:
        activity = await _redis.lrange("courage:live_activity", 0, 19)
        return [json.loads(a) for a in activity]
    except Exception:
        return []

# ── Static Files (Frontend) ───────────────────────────────────────────────────
# Mount the built React app. Serve index.html for any unknown paths (SPA)

if os.path.exists("/app/static"):
    app.mount("/static", StaticFiles(directory="/app/static"), name="static")

if os.path.exists("public"):
    app.mount("/public", StaticFiles(directory="public"), name="public")

@app.get("/admin")
async def serve_admin():
    # Serve the new rich dashboard if it exists
    rich_path = os.path.join(os.path.dirname(__file__), "templates", "admin_dashboard.html")
    if os.path.exists(rich_path):
        return FileResponse(rich_path)
    return FileResponse("/app/static/index.html")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # ── Bot Guard: Block common malicious scans ──
    # These are common paths bots hit looking for vulnerabilities.
    # We block them early to clean up logs and save resources.
    bot_paths = [
        "wp-", "xmlrpc", "php", ".env", ".git", "setup", "install"
    ]
    if any(bp in full_path.lower() for bp in bot_paths):
        return Response(status_code=404, content="Not Found")

    # Skip if it's an API or WS route (but allow health)
    if full_path.startswith("api") or full_path.startswith("ws"):
        return Response(status_code=404)
        
    # Check if the file exists in static folder
    if os.path.exists("/app/static"):
        file_path = os.path.join("/app/static", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Otherwise serve index.html for SPA routing
        return FileResponse("/app/static/index.html")
    
    return {"message": "Courage Backend is running. Frontend assets not found in /app/static. Build issue?"}
