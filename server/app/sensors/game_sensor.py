"""
game_sensor.py — Watches for "Become a Monster" + Courage game activity (even without $RCR).
Emits GAME_MOMENT so Courage can shout out players.
"""

import asyncio
from app.x_client import make_x_client
from app.events import emit_event

async def game_sensor_loop():
    x = make_x_client()
    while True:
        try:
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

        await asyncio.sleep(1200)  # every 20 minutes (safety first)
