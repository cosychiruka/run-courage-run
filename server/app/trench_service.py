"""
trench_service.py — Bulk cashtag ("$RCR") fetching + deduplication + RAG-ready storage.
Atomic, rate-limit safe.
"""

import time
import asyncio
import aiosqlite
from app.config import DB_PATH, REDIS_URL
from app.x_client import make_x_client
import app.twitter_memory as tw_mem
from app.redis_utils import get_redis_client, track_x_search_cost

async def fetch_trench_tweets(cashtag: str = "$RCR", limit: int = 50, since_days: int = 1):
    """Bulk fetch new cashtag tweets → save to DB → return count."""
    
    # PHASE 5.8: Configurable Cooldown
    _redis = await get_redis_client()
    if _redis:
        cooldown_min = int(await _redis.get("courage:sensor_cooldown_minutes") or 25)
        last_sensor = await _redis.get("courage:last_sensor_search")
        if last_sensor and (time.time() - float(last_sensor)) < (cooldown_min * 60):
            print(f"[TRENCH] Cooldown active ({cooldown_min} min) — skipping")
            return f"Trench data for {cashtag} is already fresh (cooldown active)."

    x = make_x_client()
    if not x:
        return "X client not configured."

    try:
        # Search for cashtag
        query = f"{cashtag} -is:retweet lang:en"
        tweets = x.search_recent(query=query, max_results=limit)
        
        # Track cost
        count = len(tweets.data) if tweets.data else 0
        await track_x_search_cost(count)

        if not tweets.data:
            return 0

        # Mark sensor search time
        if _redis:
            await _redis.set("courage:last_sensor_search", time.time())

        # Save to DB
        async with aiosqlite.connect(DB_PATH) as db:
            added_count = 0
            for t in tweets.data:
                # Basic dedup check
                exists = await db.execute("SELECT id FROM tweets WHERE tweet_id = ?", (str(t.id),))
                if await exists.fetchone():
                    continue
                
                await db.execute(
                    "INSERT INTO tweets (tweet_id, author_id, text, timestamp, processed) VALUES (?, ?, ?, ?, ?)",
                    (str(t.id), str(t.author_id), t.text, time.strftime('%Y-%m-%d %H:%M:%S'), 0)
                )
                added_count += 1
            await db.commit()
            
        return added_count
    except Exception as e:
        print(f"[TRENCH ERROR] {e}")
        return f"Error: {e}"
