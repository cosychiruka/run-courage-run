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
    global _queue_redis
    if _queue_redis is None:
        _queue_redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _queue_redis

async def enqueue_reply(tweet_id: str, text: str):
    r = await _get_queue_redis()
    await r.rpush("courage:reply_queue", f"{tweet_id}|{text}")
    print(f"[QUEUE] Enqueued reply to {tweet_id}")

async def process_reply_queue(x_client=None):
    """Background worker — call this from scheduler or main.py"""
    r = await _get_queue_redis()
    while True:
        item = await r.lpop("courage:reply_queue")
        if not item:
            await asyncio.sleep(30)
            continue

        tweet_id, text = item.split("|", 1)
        try:
            await dispatch_tool("post_tweet", {"text": text, "reply_to_id": tweet_id}, x_client)
            print(f"[QUEUE] Posted reply to {tweet_id}")
            await asyncio.sleep(12)  # safe back-off
        except Exception as e:
            print(f"[QUEUE] Reply failed: {e}")
            await r.rpush("courage:reply_queue", item)  # requeue
