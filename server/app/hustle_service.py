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
    """Live stats with smart fallback to SOL until $RCR launches."""
    token_addr = RCR_TOKEN_ADDRESS.strip()

    if not token_addr:
        # Fallback to SOL tracking
        SOL_PAIR = "So11111111111111111111111111111111111111112"  # Wrapped SOL
        fallback_url = f"https://api.dexscreener.com/token-pairs/v1/solana/{SOL_PAIR}"
        print("[HUSTLE] No $RCR token yet → tracking SOL as placeholder")
        use_url = fallback_url
        is_fallback = True
    else:
        use_url = f"https://api.dexscreener.com/token-pairs/v1/solana/{token_addr}"
        is_fallback = False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(use_url)
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
            "is_sol_fallback": is_fallback,
            "symbol": "SOL" if is_fallback else "$RCR"
        }

        await _save_daily_snapshot(stats)
        return stats

    except Exception:
        # Ultimate safe fallback
        last = await _get_last_known_price()
        return {
            "price": last,
            "volume_24h": 0,
            "market_cap": 0,
            "change_24h": 0,
            "status": "FALLBACK_LAST_KNOWN",
            "is_sol_fallback": True,
            "symbol": "SOL"
        }

async def _save_daily_snapshot(stats: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        # 1. Update/Insert daily summary
        await db.execute(
            "INSERT OR REPLACE INTO token_daily_stats (date, price, market_cap, volume_24h, change_24h) "
            "VALUES (?,?,?,?,?)",
            (datetime.now(timezone.utc).date().isoformat(), stats["price"],
             stats.get("market_cap", 0), stats.get("volume_24h", 0), stats.get("change_24h", 0))
        )
        # 2. Add high-res snapshot
        await db.execute(
            "CREATE TABLE IF NOT EXISTS token_snapshots (ts REAL, price REAL, volume REAL)"
        )
        await db.execute(
            "INSERT INTO token_snapshots (ts, price, volume) VALUES (?,?,?)",
            (time.time(), stats["price"], stats.get("volume_24h", 0))
        )
        await db.commit()

        # Auto-embed for RAG
        from app.rag import embed_and_store
        date = datetime.now(timezone.utc).date().isoformat()
        content = f"$RCR price ${stats['price']:.6f} | 24h change {stats.get('change_24h',0):+.1f}% | Vol ${stats.get('volume_24h',0):,.0f}"
        await embed_and_store(content, source="token", metadata={"date": date})

async def _get_last_known_price():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT price FROM token_daily_stats ORDER BY date DESC LIMIT 1"
        ) as cur:
            row = await cur.fetchone()
            return float(row[0]) if row else 0.0
