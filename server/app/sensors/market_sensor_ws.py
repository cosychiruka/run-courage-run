"""
market_sensor_ws.py — Official DexScreener WebSocket for sub-second $RCR surges.
Replaces the old poll-based market_sensor.py (we keep the old one as backup).
"""

import asyncio
import json
import time
from app.config import RCR_TOKEN_ADDRESS
from app.events import emit_event, _get_event_redis

if not RCR_TOKEN_ADDRESS:
    print("[MARKET_WS] ⚠️ RCR_TOKEN_ADDRESS missing in .env. Realtime market monitoring disabled.")
    WS_URL = None
else:
    WS_URL = f"wss://io.dexscreener.com/dex/screener/pairs/h24/solana/{RCR_TOKEN_ADDRESS}"

LAST_PRICE = None

async def market_sensor_ws_loop():
    global LAST_PRICE
    if not WS_URL:
        return
    while True:
        try:
            # Reconnect loop
            import websockets
            async with websockets.connect(WS_URL) as ws:
                print("[MARKET_WS] Connected to DexScreener realtime")
                async for message in ws:
                    data = json.loads(message)
                    if "pairs" not in data or not data["pairs"]:
                        continue

                    pair = data["pairs"][0]
                    current = float(pair["priceUsd"])

                    if LAST_PRICE and current > 0:
                        change = (current - LAST_PRICE) / LAST_PRICE
                        if abs(change) >= 0.03:  # 3% = instant reaction
                            await emit_event("MARKET_SURGE", {
                                "price": current,
                                "change_percent": round(change * 100, 2),
                                "volume_24h": float(pair["volume"]["h24"]),
                                "liquidity": float(pair["liquidity"]["usd"])
                            })
                            # Store last surge for admin dashboard
                            r = await _get_event_redis()
                            await r.set("courage:last_market_surge", json.dumps({
                                "price": current, 
                                "change": change,
                                "timestamp": time.time()
                            }), ex=3600)

                    LAST_PRICE = current

        except Exception as e:
            print(f"[MARKET_WS] Disconnected, reconnecting in 5s: {e}")
            await asyncio.sleep(5)
