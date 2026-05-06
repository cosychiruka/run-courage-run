"""
hustle_service.py — $RCR token stats via DexScreener (public, no key).
Daily snapshots + yesterday vs today delta + safe fallback.
"""

import time
import httpx
import aiosqlite
from datetime import datetime, timezone
from app.config import DB_PATH, RCR_TOKEN_ADDRESS

DEXSCREENER_URL = "https://api.dexscreener.com/token-pairs/v1/solana/"

async def get_rcr_stats():
    """Live $RCR stats with yesterday/today delta."""
    if not RCR_TOKEN_ADDRESS:
        return {"price": 0, "status": "TOKEN_ADDRESS_NOT_SET"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{DEXSCREENER_URL}{RCR_TOKEN_ADDRESS}")
            data = resp.json()

        if not data or not data.get("pairs"):
            raise Exception("No pairs")

        pair = data["pairs"][0]
        stats = {
            "price": float(pair["priceUsd"]),
            "volume_24h": float(pair["volume"]["h24"]),
            "market_cap": float(pair.get("fdv", 0)),
            "change_24h": float(pair["priceChange"]["h24"]),
            "liquidity": float(pair["liquidity"]["usd"]),
            "txns_24h": pair["txns"]["h24"],
            "fetched_at": time.time(),
        }

        # Save daily snapshot
        await _save_daily_snapshot(stats)
        return stats

    except Exception:
        # Fallback to last known
        last = await _get_last_known_price()
        return {
            "price": last,
            "volume_24h": 0,
            "market_cap": 0,
            "change_24h": 0,
            "status": "FALLBACK_LAST_KNOWN"
        }

async def _save_daily_snapshot(stats: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO token_daily_stats (date, price, market_cap, volume_24h, change_24h) "
            "VALUES (?,?,?,?,?)",
            (datetime.now(timezone.utc).date().isoformat(), stats["price"],
             stats.get("market_cap", 0), stats.get("volume_24h", 0), stats.get("change_24h", 0))
        )
        await db.commit()

async def _get_last_known_price():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT price FROM token_daily_stats ORDER BY date DESC LIMIT 1"
        ) as cur:
            row = await cur.fetchone()
            return float(row[0]) if row else 0.0
