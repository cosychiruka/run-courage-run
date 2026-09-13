"""
voice_priority.py — P1 override. Pauses everything when voice is active.
Atomic and zero-overhead.
"""

async def _get_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

async def is_voice_active() -> bool:
    """True if any live mic session is happening."""
    try:
        r = await _get_redis()
        count = await r.scard("active_voice_sessions")
        return bool(count > 0)
    except Exception:
        return False

async def voice_priority_guard():
    """Returns True if we should skip the autonomous tick."""
    if await is_voice_active():
        print("[VOICE_PRIORITY] 🔥 Live mic session detected — pausing all background actions")
        return True
    return False
