"""
voice_priority.py — P1 override. Pauses everything when voice is active.
Atomic and zero-overhead.
"""

import asyncio
from app.config import REDIS_URL
import redis.asyncio as aioredis

_redis = None

async def _get_redis():
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis

async def is_voice_active() -> bool:
    """True if any live mic session is happening."""
    r = await _get_redis()
    try:
        count = await r.scard("active_voice_sessions")
        return bool(count > 0)
    except:
        return False

async def voice_priority_guard():
    """Returns True if we should skip the autonomous tick."""
    if await is_voice_active():
        print("[VOICE_PRIORITY] 🔥 Live mic session detected — pausing all background actions")
        return True
    return False
