"""
game_sensor.py — Watches for "Become a Monster" + Courage game activity (even without $RCR).
Emits GAME_MOMENT so Courage can shout out players.
"""

import asyncio
import time
from app.redis_utils import get_redis_client, track_x_search_cost
from app.x_client import make_x_client
from app.events import emit_event
from app.config import X_DAILY_SEARCH_SPEND_CAP

async def game_sensor_loop():
    """15-MIN SENSOR COOLDOWN (configurable in dashboard)"""
    x = make_x_client()
    _redis = await get_redis_client()
    
    while True:
        if x is None:
            x = make_x_client()
            if x is None:
                print("[GAME_SENSOR] X client unavailable — sleeping without spending")
                await asyncio.sleep(300)
                continue

        # CONFIGURABLE COOLDOWN FROM DASHBOARD (Default to 25m for ~$2.88/day)
        cooldown_min = int(await _redis.get("courage:sensor_cooldown_minutes") or 25)
        last_sensor = await _redis.get("courage:last_sensor_search") if _redis else None

        if _redis:
            credit_status = await _redis.get("courage:x_credit_status")
            spent_today = float(await _redis.get("courage:x_spend_today") or 0)
            if credit_status == "capped" or spent_today >= X_DAILY_SEARCH_SPEND_CAP:
                await _redis.set("courage:x_credit_status", "capped", ex=1800)
                print(f"[GAME_SENSOR] X spend guard active (${spent_today:.2f}/${X_DAILY_SEARCH_SPEND_CAP:.2f})")
                await asyncio.sleep(300)
                continue

        if last_sensor and (time.time() - float(last_sensor)) < (cooldown_min * 60):
            print(f"[GAME_SENSOR] Cooldown active ({cooldown_min} min) — backing off")
            await asyncio.sleep(60)
            continue

        try:
            # Search for game-related + direct community activity
            # Removed bare "courage" — too broad, burns budget on unrelated tweets
            query = (
                '"become a monster" OR "@runcouragerun" OR "runcouragerun" '
                'OR "$RCR" OR "cowardly dog" OR "homestead" -is:retweet lang:en'
            )
            tweets = x.search_recent(query=query, max_results=10)

            # Track cost
            count = len(tweets.data) if tweets.data else 0
            await track_x_search_cost(count)

            # Build author_id → username lookup from includes (search_recent requests this)
            user_map = {}
            if tweets and tweets.includes and "users" in tweets.includes:
                for u in tweets.includes["users"]:
                    user_map[u.id] = u.username

            for t in tweets.data or []:
                if any(kw in t.text.lower() for kw in [
                    "monster", "homestead", "courage", "runcouragerun",
                    "@runcouragerun", "$rcr", "cowardly dog",
                ]):
                    # PHASE 5.9: Debounce events to prevent LLM spam (max 1 every 30s)
                    last_event = await _redis.get("courage:last_game_moment_event") if _redis else None
                    if last_event and (time.time() - float(last_event)) < 30:
                        print("[GAME_SENSOR] Event debounce active — skipping emit")
                        break

                    # Use username if available so brain can write "@handle" shoutouts
                    author_username = user_map.get(t.author_id, str(t.author_id))

                    moment = {
                        "tweet_id": str(t.id),
                        "author": author_username,
                        "text": t.text[:120]
                    }
                    await emit_event("GAME_MOMENT", moment)

                    # Store in Redis so _gather_state() can inject it into brain context
                    if _redis:
                        import json as _json
                        moment_json = _json.dumps(moment)
                        await _redis.lpush("courage:pending_game_moments", moment_json)
                        await _redis.ltrim("courage:pending_game_moments", 0, 4)   # keep latest 5
                        await _redis.expire("courage:pending_game_moments", 1800)  # 30-min TTL
                        # Also persist to permanent history for admin dashboard
                        await _redis.lpush("courage:game_moment_history", moment_json)
                        await _redis.ltrim("courage:game_moment_history", 0, 49)  # keep last 50
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
