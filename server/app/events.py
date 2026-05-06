"""
events.py — Lightweight Redis pub/sub for urgent events.
Used by sensors to wake Courage immediately (P2 priority).
"""

import json
import time
from app.config import REDIS_URL
import redis.asyncio as aioredis

_redis = None

async def _get_event_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

async def emit_event(event_type: str, payload: dict):
    """Fire-and-forget urgent event (e.g. MARKET_SURGE, GAME_MOMENT)."""
    r = await _get_event_redis()
    message = json.dumps({
        "type": event_type,
        "payload": payload,
        "timestamp": time.time()
    })
    await r.publish("courage:urgent_events", message)
    print(f"[EVENT] Emitted {event_type}")

async def trigger_realtime_art(prompt: str):
    """Called by Orchestrator on high-priority events."""
    from app.image_gen import create_courage_art_realtime
    url = await create_courage_art_realtime(prompt)
    if url:
        await emit_event("ART_GENERATED", {"url": url, "prompt": prompt})
        print(f"[ART] Realtime cartoon ready: {url}")
    return url
