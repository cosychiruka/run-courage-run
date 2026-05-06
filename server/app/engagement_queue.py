"""
engagement_queue.py — Redis-backed queue for safe bulk replies (max 8 every 15 min).
"""

import asyncio
import time
from app.config import REDIS_URL
import redis.asyncio as aioredis
from app.tools import dispatch_tool  # for post_tweet

_queue_redis = None

async def _get_queue_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

async def enqueue_reply(tweet_id: str, text: str):
    r = await _get_queue_redis()
    await r.rpush("courage:reply_queue", f"{tweet_id}|{text}")
    print(f"[QUEUE] Enqueued reply to {tweet_id}")

async def process_reply_queue(x_client=None):
    """Background worker with DYNAMIC rate-limit adaptive pacing."""
    r = await _get_queue_redis()
    while True:
        item = await r.lpop("courage:reply_queue")
        if not item:
            await asyncio.sleep(30)
            continue

        tweet_id, text = item.split("|", 1)
        try:
            # Read live rate limits from Redis (already populated by x_client)
            rate_post = await r.hgetall("rate:/statuses/update") or {}
            remaining = int(rate_post.get("remaining", 10))

            if remaining <= 3:
                sleep_time = 45  # aggressive back-off
                print(f"[QUEUE] Rate limit tight ({remaining} left) — sleeping 45s")
            elif remaining <= 8:
                sleep_time = 20
            else:
                sleep_time = 12

            await dispatch_tool("post_tweet", {"text": text, "reply_to_id": tweet_id}, x_client)
            print(f"[QUEUE] Posted reply to {tweet_id} | remaining={remaining}")
            await asyncio.sleep(sleep_time)
        except Exception as e:
            print(f"[QUEUE] Reply failed: {e}")
            await r.rpush("courage:reply_queue", item)  # requeue
