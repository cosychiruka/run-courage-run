"""
game_sensor.py — Watches for "Become a Monster" + Courage game activity (even without $RCR).
Emits GAME_MOMENT so Courage can shout out players.
"""

import time
from app.redis_utils import get_redis_client
from app.x_client import make_x_client
from app.events import emit_event

async def game_sensor_loop():
    """PHASE 5.5+ CLEAN FIX: Respect global 6-minute cooldown."""
    x = make_x_client()
    r = await get_redis_client()
    
    while True:
        try:
            # GLOBAL COOLDOWN CHECK — same as the brain
            last_post = await r.get("courage:last_autonomous_post") if r else None
            if last_post and (time.time() - float(last_post)) < 360:   # 6 minutes
                print("[GAME_SENSOR] Global cooldown active — backing off")
                await asyncio.sleep(60)
                continue

            # Search for game-related activity (no cashtag required)
            query = '"become a monster" OR "courage" OR "homestead" OR "runcouragerun" -is:retweet lang:en'
            tweets = x.search_recent(query=query, max_results=10)

            for t in tweets.data or []:
                if any(kw in t.text.lower() for kw in ["monster", "homestead", "courage", "runcouragerun"]):
                    await emit_event("GAME_MOMENT", {
                        "tweet_id": str(t.id),
                        "author": str(t.author_id),
                        "text": t.text[:120]
                    })
                    break  # one at a time
        except Exception as e:
            print(f"[GAME_SENSOR] Error: {e}")

        # Respect global heartbeat (re-check every 60s)
        await asyncio.sleep(60) 
