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
QUEUE_READY = "courage:reply_queue_v5"
QUEUE_PROCESSING = "courage:reply_queue_processing"
QUEUE_DEAD = "courage:reply_queue_dead"


async def _safe_lmove(r, src: str, dst: str, where_from: str = "LEFT", where_to: str = "RIGHT"):
    """Compatibility shim for Redis versions that expose LMOVE differently."""
    try:
        return await r.lmove(src, dst, where_from, where_to)
    except Exception:
        try:
            return await r.execute_command("LMOVE", src, dst, where_from, where_to)
        except Exception:
            return None


def _parse_iso_timestamp(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).timestamp()
    except Exception:
        return None


async def _emit_queue_activity(r, event: str, message: str, status: str | None = None, metadata: dict | None = None):
    payload = {
        "timestamp": datetime.now().isoformat(),
        "event": str(event or "QUEUE").upper(),
        "message": message,
    }
    try:
        await r.lpush("courage:live_activity", json.dumps(payload))
        await r.ltrim("courage:live_activity", 0, 499)
    except Exception:
        pass
    try:
        await r.xadd(
            "courage:activity_log",
            {"type": payload["event"], "msg": message, "timestamp": payload["timestamp"]},
            maxlen=1000,
        )
    except Exception:
        pass
    try:
        from app.twitter_memory import log_activity_event
        await log_activity_event(
            event=payload["event"],
            message=message,
            source="engagement_queue",
            status=status,
            metadata=metadata or {},
        )
    except Exception:
        pass


async def _recover_stalled_processing_items(r, stale_seconds: int = 900, max_scan: int = 50):
    """
    Requeue or dead-letter items abandoned in processing (e.g. crash mid-send).
    """
    raw_items = await r.lrange(QUEUE_PROCESSING, 0, max_scan - 1)
    if not raw_items:
        return

    now = time.time()
    for raw in raw_items:
        try:
            item = json.loads(raw)
        except Exception:
            await r.lrem(QUEUE_PROCESSING, 1, raw)
            await r.rpush(QUEUE_DEAD, raw)
            await _emit_queue_activity(
                r,
                "POST_DEAD_LETTER",
                "[QUEUE] Corrupt processing payload moved to dead-letter",
                status="failed",
            )
            continue

        ts = (
            _parse_iso_timestamp(item.get("processing_started_at"))
            or _parse_iso_timestamp(item.get("last_attempt_at"))
            or _parse_iso_timestamp(item.get("timestamp"))
        )
        if ts is not None and (now - ts) < stale_seconds:
            continue

        item["retries"] = int(item.get("retries", 0)) + 1
        item["last_error"] = item.get("last_error") or "Recovered from stale processing slot"
        item["last_attempt_at"] = datetime.now().isoformat()
        await r.lrem(QUEUE_PROCESSING, 1, raw)
        if item["retries"] >= 8:
            await r.rpush(QUEUE_DEAD, json.dumps(item))
            await _emit_queue_activity(
                r,
                "POST_DEAD_LETTER",
                f"[{item.get('type','POST')}] stale processing item moved to dead-letter after {item['retries']} retries",
                status="failed",
                metadata={"retries": item["retries"]},
            )
        else:
            await r.lpush(QUEUE_READY, json.dumps(item))
            await _emit_queue_activity(
                r,
                "POST_REQUEUED",
                f"[{item.get('type','POST')}] recovered from processing stall (retry {item['retries']})",
                status="queued",
                metadata={"retries": item["retries"]},
            )

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
    last_recovery_check = 0.0
    while True:
        item = None
        item_json = None
        processing_item_json = None
        legacy_item = None
        try:
            if x_client is None:
                from app.x_client import make_x_client
                x_client = make_x_client()
                if x_client is None:
                    print("[QUEUE] X client unavailable — preserving queue and sleeping")
                    await asyncio.sleep(60)
                    continue

            if (time.time() - last_recovery_check) > 60:
                await _recover_stalled_processing_items(r)
                last_recovery_check = time.time()

            # Hard guard: if spend-cap flag is active, do not pop items.
            credit_status = await r.get("courage:x_credit_status")
            if credit_status == "capped":
                print("[QUEUE] X credit status capped — queue preserved, waiting 5 minutes")
                await asyncio.sleep(300)
                continue

            # Atomic claim from ready queue to processing queue.
            item_json = await _safe_lmove(r, QUEUE_READY, QUEUE_PROCESSING, "LEFT", "RIGHT")
            if not item_json:
                # Fallback to legacy v1 queue if empty
                legacy_item = await r.lpop("courage:reply_queue")
                if legacy_item:
                    tweet_id, text = legacy_item.split("|", 1)
                    item = {
                        "text": text,
                        "reply_to_tweet_id": tweet_id,
                        "type": "LEGACY_REPLY",
                        "retries": 0,
                        "timestamp": datetime.now().isoformat(),
                    }
                else:
                    await asyncio.sleep(10)
                    continue
            else:
                try:
                    item = json.loads(item_json)
                except Exception:
                    await r.lrem(QUEUE_PROCESSING, 1, item_json)
                    await r.rpush(QUEUE_DEAD, item_json)
                    await _emit_queue_activity(
                        r,
                        "POST_DEAD_LETTER",
                        "[QUEUE] Invalid JSON payload moved to dead-letter",
                        status="failed",
                    )
                    await asyncio.sleep(2)
                    continue

                item["processing_started_at"] = datetime.now().isoformat()
                processing_item_json = json.dumps(item)
                try:
                    # Claimed item sits at processing tail.
                    await r.lset(QUEUE_PROCESSING, -1, processing_item_json)
                except Exception:
                    processing_item_json = item_json

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

            if item_json:
                await r.lrem(QUEUE_PROCESSING, 1, processing_item_json or item_json)

            await _emit_queue_activity(
                r,
                "POST_SUCCESS",
                f"[{p_type}] Posted: {text[:80]}...",
                status="success",
                metadata={"tweet_id": tweet_id, "type": p_type},
            )

            # Wait for X rate limit padding (45s)
            await asyncio.sleep(45)

        except Exception as e:
            err_str = str(e)
            print(f"[QUEUE ERROR] {err_str}")

            # Never drop messages: put failed payload back for retry.
            try:
                if item_json and item is not None:
                    item["retries"] = int(item.get("retries", 0)) + 1
                    item["last_error"] = err_str[:240]
                    item["last_attempt_at"] = datetime.now().isoformat()
                    await r.lrem(QUEUE_PROCESSING, 1, processing_item_json or item_json)
                    if item["retries"] >= 8:
                        await r.rpush(QUEUE_DEAD, json.dumps(item))
                        await _emit_queue_activity(
                            r,
                            "POST_DEAD_LETTER",
                            f"[{item.get('type','POST')}] moved to dead-letter after {item['retries']} retries",
                            status="failed",
                            metadata={"retries": item["retries"], "error": err_str[:120]},
                        )
                    else:
                        await r.lpush(QUEUE_READY, json.dumps(item))
                        await _emit_queue_activity(
                            r,
                            "POST_REQUEUED",
                            f"[{item.get('type','POST')}] requeued (retry {item['retries']}) — {err_str[:120]}",
                            status="queued",
                            metadata={"retries": item["retries"]},
                        )
                elif legacy_item:
                    await r.lpush("courage:reply_queue", legacy_item)
            except Exception as rq_e:
                print(f"[QUEUE REQUEUE ERROR] {rq_e}")

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
