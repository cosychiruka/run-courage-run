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

async def queue_post_with_media(text: str, image_url: str = None, reply_to_tweet_id: str = None, post_type: str = "GENERIC"):
    """PHASE 5: Safe queue that supports text + image + reply + type tagging."""
    r = await _get_queue_redis()
    payload = {
        "text": text,
        "image_url": image_url,
        "reply_to_tweet_id": reply_to_tweet_id,
        "type": post_type,
        "timestamp": datetime.now().isoformat()
    }
    await r.rpush("courage:reply_queue_v5", json.dumps(payload))
    print(f"[QUEUE] Added {post_type} post with media → {text[:60]}...")

async def process_reply_queue(x_client):
    """PHASE 5: Processes queued posts with images safely."""
    r = await _get_queue_redis()
    while True:
        try:
            if x_client is None:
                from app.x_client import make_x_client
                x_client = make_x_client()
                if x_client is None:
                    print("[QUEUE] X client unavailable — preserving queue and sleeping")
                    await asyncio.sleep(60)
                    continue

            # Check v5 queue first
            item_json = await r.lpop("courage:reply_queue_v5")
            if not item_json:
                # Fallback to legacy v1 queue if empty
                legacy_item = await r.lpop("courage:reply_queue")
                if legacy_item:
                    tweet_id, text = legacy_item.split("|", 1)
                    item = {"text": text, "reply_to_tweet_id": tweet_id, "type": "LEGACY_REPLY"}
                else:
                    await asyncio.sleep(10)
                    continue
            else:
                item = json.loads(item_json)

            text = item["text"]
            image_url = item.get("image_url")
            reply_to = item.get("reply_to_tweet_id")
            p_type = item.get("type", "POST")

            print(f"[QUEUE] Processing {p_type}: {text[:50]}...")

            # Generate/Upload media
            media_id = None
            if image_url:
                media_id = await _upload_media_to_twitter(x_client, image_url)

            # Post using correct client
            resp = x_client.create_tweet(
                text=text,
                media_ids=[media_id] if media_id else None,
                reply_to=reply_to if reply_to != 'none' else None
            )

            tweet_id = resp.data['id']
            await save_posted_tweet(tweet_id, text, reply_to)
            print(f"[POSTED] ✅ {p_type} SUCCESS (tweet_id: {tweet_id})")

            # Log successful post to activity stream for dashboard
            await r.xadd("courage:activity_log", {
                "type": "POST_SUCCESS",
                "msg": f"[{p_type}] Posted: {text[:80]}...",
                "timestamp": datetime.now().isoformat()
            }, maxlen=100)

            # Wait for X rate limit padding (45s)
            await asyncio.sleep(45)

        except Exception as e:
            err_str = str(e)
            print(f"[QUEUE ERROR] {err_str}")

            # ── Spend-cap circuit breaker ──────────────────────────────────
            # 403 SpendCapReached means we're blocked until May 29 (billing reset).
            # Stop hammering the API — pause the worker for 30 minutes.
            if "403" in err_str or "SpendCapReached" in err_str or "spend cap" in err_str.lower():
                print("[QUEUE] ⚠️  X spend cap detected — pausing queue worker for 30 minutes")
                try:
                    await r.set("courage:x_spend_cap_hit", "1", ex=1800)  # 30-min Redis flag
                    await r.set("courage:x_credit_status", "capped", ex=1800)
                except Exception:
                    pass
                await asyncio.sleep(1800)  # 30 minutes
            else:
                await asyncio.sleep(20)

async def _upload_media_to_twitter(x_client, image_url: str):
    """Uploads Fal.ai image OR local path to Twitter v1.1 API."""
    import httpx
    import os
    
    try:
        # Check if it's a local file first
        if os.path.exists(image_url):
            with open(image_url, "rb") as f:
                media = f.read()
            upload_resp = x_client.api.media_upload(filename="news_card.png", media=media)
            return upload_resp.media_id_string
            
        # Otherwise treat as URL
        async with httpx.AsyncClient() as client:
            resp = await client.get(image_url)
            media = resp.content
        upload_resp = x_client.api.media_upload(filename="courage_art.png", media=media)
        return upload_resp.media_id_string
    except Exception as e:
        print(f"[UPLOAD ERROR] {e}")
        return None
