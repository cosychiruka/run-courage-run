"""
game_sensor.py — Watches for "Become a Monster" + Courage game activity (even without $RCR).
Emits GAME_MOMENT so Courage can shout out players.
"""

import asyncio
import time
from app.redis_utils import get_redis_client, track_x_search_cost
from app.x_client import make_x_client
from app.events import emit_event

async def game_sensor_loop():
    """15-MIN SENSOR COOLDOWN (configurable in dashboard)"""
    x = make_x_client()
    _redis = await get_redis_client()
    
    while True:
        # CONFIGURABLE COOLDOWN FROM DASHBOARD (Default to 25m for ~$2.88/day)
        cooldown_min = int(await _redis.get("courage:sensor_cooldown_minutes") or 25)
        last_sensor = await _redis.get("courage:last_sensor_search") if _redis else None

        if last_sensor and (time.time() - float(last_sensor)) < (cooldown_min * 60):
            print(f"[GAME_SENSOR] Cooldown active ({cooldown_min} min) — backing off")
            await asyncio.sleep(60)
            continue

        try:
            # Search for game-related activity (no cashtag required)
            query = '"become a monster" OR "courage" OR "homestead" OR "runcouragerun" -is:retweet lang:en'
            tweets = x.search_recent(query=query, max_results=10)

            # Track cost
            count = len(tweets.data) if tweets.data else 0
            await track_x_search_cost(count)

            for t in tweets.data or []:
                if any(kw in t.text.lower() for kw in ["monster", "homestead", "courage", "runcouragerun"]):
                    # PHASE 5.9: Debounce events to prevent Groq spam (max 1 every 30s)
                    last_event = await _redis.get("courage:last_game_moment_event") if _redis else None
                    if last_event and (time.time() - float(last_event)) < 30:
                        print("[GAME_SENSOR] Event debounce active — skipping emit")
                        break
                        
                    await emit_event("GAME_MOMENT", {
                        "tweet_id": str(t.id),
                        "author": str(t.author_id),
                        "text": t.text[:120]
                    })
                    if _redis:
                        await _redis.set("courage:last_game_moment_event", time.time())
                    break  # one at a time
        except Exception as e:
            print(f"[GAME_SENSOR] Error: {e}")
        finally:
            # Always mark the sensor search time
            if _redis:
                await _redis.set("courage:last_sensor_search", time.time())

        # Respect global heartbeat (re-check every 60s)
        await asyncio.sleep(60) 
