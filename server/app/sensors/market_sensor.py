"""
market_sensor.py — Polls $RCR every 60s and emits MARKET_SURGE on big moves.
Runs as background task. Zero impact on heartbeat.
"""

import asyncio
import time
from app.hustle_service import get_rcr_stats
from app.events import emit_event

LAST_PRICE = None
SURGE_THRESHOLD = 0.04  # 4% move triggers instant reaction

async def market_sensor_loop():
    global LAST_PRICE
    while True:
        try:
            stats = await get_rcr_stats()
            current = stats.get("price", 0)

            if LAST_PRICE and current > 0:
                change = (current - LAST_PRICE) / LAST_PRICE
                if abs(change) >= SURGE_THRESHOLD:
                    await emit_event("MARKET_SURGE", {
                        "price": current,
                        "change_percent": round(change * 100, 2),
                        "volume": stats.get("volume_24h", 0)
                    })

            LAST_PRICE = current
        except Exception as e:
            print(f"[MARKET_SENSOR] Error: {e}")

        await asyncio.sleep(60)  # 60-second tick
