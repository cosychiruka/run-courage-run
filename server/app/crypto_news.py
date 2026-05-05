"""
crypto_news.py — Crypto news and market discovery using FREE/DEMO tier endpoints.

1. CoinDesk (CCData): Free tier news (1,000/day).
2. CoinGecko (Demo): Trending Coins search (Free on Demo tier). 
   - Note: /news is a paid endpoint on CoinGecko, so we use /search/trending instead.

Normalized schema matches the existing `articles` table.
"""

import json
import time
import datetime
from datetime import timezone
import httpx
from typing import Optional

from app.config import DB_PATH, REDIS_URL, COINDESK_API_KEY, COINGECKO_API_KEY

CRYPTO_CACHE_KEY = "courage_crypto_news"
CRYPTO_CACHE_TTL = 1800  # 30 minutes
COINDESK_DAILY_BUDGET = 1000
COINGECKO_DAILY_BUDGET = 50 # Demo tier is generous but we stay safe

_redis = None

async def _get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        except Exception: pass
    return _redis

async def _get_budget_count(provider: str) -> int:
    r = await _get_redis()
    if not r: return 0
    today = datetime.date.today().isoformat()
    try:
        val = await r.get(f"budget:{provider}:{today}")
        return int(val or 0)
    except: return 0

async def _bump_budget(provider: str):
    r = await _get_redis()
    if not r: return
    today = datetime.date.today().isoformat()
    key = f"budget:{provider}:{today}"
    try:
        await r.incr(key)
        await r.expire(key, 86400)
    except: pass

# ── Normalisers ────────────────────────────────────────────────────────────────

def _norm_coindesk(item: dict) -> dict:
    published = item.get("PUBLISHED_ON", 0)
    if isinstance(published, (int, float)) and published > 0:
        published = datetime.datetime.fromtimestamp(published, tz=timezone.utc).isoformat()
    
    source_name = item.get("SOURCE_DATA", {}).get("NAME", "CoinDesk")

    return {
        "title":        item.get("TITLE", ""),
        "description":  item.get("BODY", ""),
        "url":          item.get("URL", ""),
        "image_url":    item.get("IMAGE_URL"),
        "source_name":  source_name,
        "published_at": published,
        "category":     "crypto",
        "country":      "crypto",
    }

def _norm_trending(item: dict) -> dict:
    """Format a trending coin as a news-like entry."""
    coin = item.get("item", {})
    name = coin.get("name", "Unknown Coin")
    symbol = coin.get("symbol", "???")
    rank = coin.get("market_cap_rank", "N/A")
    price = coin.get("data", {}).get("price", "???")
    
    return {
        "title":        f"TRENDING: {name} ({symbol}) is pumping!",
        "description":  f"{name} is currently trending in the crypto trenches! Market Cap Rank: #{rank}. Current Price: {price}. #WAGMI",
        "url":          f"https://www.coingecko.com/en/coins/{coin.get('slug')}",
        "image_url":    coin.get("large"),
        "source_name":  "CoinGecko Trending",
        "published_at": datetime.datetime.now(timezone.utc).isoformat(),
        "category":     "crypto",
        "country":      "crypto",
    }

# ── Fetch functions ────────────────────────────────────────────────────────────

async def _fetch_coindesk(limit: int = 20) -> list[dict]:
    if not COINDESK_API_KEY: return []
    if await _get_budget_count("coindesk") >= COINDESK_DAILY_BUDGET: return []

    url = "https://data-api.coindesk.com/news/v1/article/list"
    params = {"limit": limit, "lang": "EN"}
    headers = {"Authorization": f"Bearer {COINDESK_API_KEY}"}
    
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(url, params=params, headers=headers)
            if r.status_code == 200:
                await _bump_budget("coindesk")
                data = r.json()
                return [_norm_coindesk(i) for i in data.get("Data", [])]
            else:
                print(f"[CRYPTO] CoinDesk error: {r.status_code}")
        except Exception as e:
            print(f"[CRYPTO] CoinDesk failed: {e}")
    return []

async def _fetch_coingecko_trending() -> list[dict]:
    """Trending search is FREE on the Demo tier."""
    if not COINGECKO_API_KEY: return []
    if await _get_budget_count("coingecko") >= COINGECKO_DAILY_BUDGET: return []

    url = "https://api.coingecko.com/api/v3/search/trending"
    headers = {"x-cg-demo-api-key": COINGECKO_API_KEY}
    
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                await _bump_budget("coingecko")
                data = r.json()
                coins = data.get("coins", [])
                return [_norm_trending(c) for c in coins]
            else:
                print(f"[CRYPTO] CoinGecko error: {r.status_code} {r.text[:50]}")
        except Exception as e:
            print(f"[CRYPTO] CoinGecko failed: {e}")
    return []

async def _save_to_sqlite(articles: list[dict]):
    try:
        from app.news_cache import save_articles
        await save_articles(articles, "crypto", "crypto")
    except Exception as e:
        print(f"[CRYPTO] SQLite save failed: {e}")

# ── Public API ─────────────────────────────────────────────────────────────────

def _title_key(title: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]", "", title.lower())[:40]

async def get_crypto_headlines(limit: int = 10) -> list[dict]:
    r = await _get_redis()
    if r:
        try:
            cached = await r.get(CRYPTO_CACHE_KEY)
            if cached: return json.loads(cached)[:limit]
        except: pass

    cd_articles = await _fetch_coindesk(20)
    cg_trending = await _fetch_coingecko_trending()

    seen = set()
    merged = []
    # Mix trending into news for variety
    for a in cg_trending + cd_articles:
        key = _title_key(a.get("title", ""))
        if key and key not in seen:
            seen.add(key)
            merged.append(a)

    if not merged: return []

    if r:
        try: await r.set(CRYPTO_CACHE_KEY, json.dumps(merged), ex=CRYPTO_CACHE_TTL)
        except: pass
    await _save_to_sqlite(merged)
    return merged[:limit]

async def get_cached_crypto_headlines() -> list[dict]:
    r = await _get_redis()
    if not r: return []
    try:
        cached = await r.get(CRYPTO_CACHE_KEY)
        if cached: return json.loads(cached)
    except: pass
    return []

async def crypto_discovery_round():
    print("[CRYPTO DISCOVERY] Starting free-tier discovery round...")
    try:
        articles = await get_crypto_headlines(20)
        print(f"[CRYPTO DISCOVERY] Complete — {len(articles)} items cached.")
    except Exception as e:
        print(f"[CRYPTO DISCOVERY] Failed: {e}")
