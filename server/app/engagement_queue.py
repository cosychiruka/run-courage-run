"""
engagement_queue.py — Redis-backed queue for safe bulk replies (max 8 every 15 min).
"""

import asyncio
import time
from app.config import REDIS_URL
import redis.asyncio as aioredis
from app.tools import dispatch_tool  # for post_tweet
import json
from datetime import datetime
from app.image_gen import create_courage_art_realtime
from app.twitter_memory import save_posted_tweet

_queue_redis = None

async def _get_queue_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

async def enqueue_reply(tweet_id: str, text: str):
    r = await _get_queue_redis()
    await r.rpush("courage:reply_queue", f"{tweet_id}|{text}")
    print(f"[QUEUE] Enqueued reply to {tweet_id}")

async def queue_post_with_media(text: str, image_url: str = None, reply_to_tweet_id: str = None):
    """PHASE 5: Safe queue that supports text + image + reply."""
    r = await _get_queue_redis()
    payload = {
        "text": text,
        "image_url": image_url,
        "reply_to_tweet_id": reply_to_tweet_id,
        "timestamp": datetime.now().isoformat()
    }
    await r.rpush("courage:reply_queue_v5", json.dumps(payload))
    print(f"[QUEUE] Added post with media → {text[:60]}...")

async def process_reply_queue(x_client):
    """PHASE 5: Processes queued posts with images safely."""
    r = await _get_queue_redis()
    while True:
        try:
            # Check v5 queue first
            item_json = await r.lpop("courage:reply_queue_v5")
            if not item_json:
                # Fallback to legacy v1 queue if empty
                legacy_item = await r.lpop("courage:reply_queue")
                if legacy_item:
                    tweet_id, text = legacy_item.split("|", 1)
                    item = {"text": text, "reply_to_tweet_id": tweet_id}
                else:
                    await asyncio.sleep(12)
                    continue
            else:
                item = json.loads(item_json)

            text = item["text"]
            image_url = item.get("image_url")
            reply_to = item.get("reply_to_tweet_id")

            # Generate image if URL provided (Fal.ai returns public URL)
            media_id = None
            if image_url:
                # Download and upload to Twitter via your existing v1 API
                media_id = await _upload_media_to_twitter(x_client, image_url)

            # Post using correct client (your mixed auth)
            if reply_to and reply_to != 'none':
                response = x_client.client.create_tweet(text=text, in_reply_to_tweet_id=reply_to, media_ids=[media_id] if media_id else None)
            else:
                response = x_client.client.create_tweet(text=text, media_ids=[media_id] if media_id else None)

            tweet_id = response.data['id']
            await save_posted_tweet(tweet_id, text, image_url)
            print(f"[POSTED] ✅ {text[:80]}... (tweet_id: {tweet_id})")

            await asyncio.sleep(45)  # safe X rate limit padding (Phase 5.3 safety)

        except Exception as e:
            print(f"[QUEUE ERROR] {e}")
            await asyncio.sleep(30)

async def _upload_media_to_twitter(x_client, image_url: str):
    """Uploads Fal.ai image to Twitter v1.1 API."""
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(image_url)
        media = resp.content
    upload_resp = x_client.api.media_upload(filename="courage_art.png", media=media)
    return upload_resp.media_id_string
