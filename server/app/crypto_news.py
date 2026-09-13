"""
Primary:   CoinDesk News API (CCData-powered, rich snippets, includes images)
Fallback:  CoinDesk RSS (keyless)

Normalized schema matches the existing `articles` table:
  title, description, url, image_url, source_name, published_at,
  category="crypto", country="crypto"

Cache: Redis key "courage_crypto_news" (30-min TTL) + SQLite articles table
Budget: Redis counter budget:coindesk:YYYY-MM-DD
"""

import json
import time
import datetime
import asyncio
import httpx

from app.config import REDIS_URL, COINDESK_API_KEY

CRYPTO_CACHE_KEY = "courage_crypto_news"
CRYPTO_CACHE_TTL = 1800  # 30 minutes
COINDESK_DAILY_BUDGET = 1000

# Module-level Redis singleton (lazy init)
_redis = None
_memory_cache: tuple[float, list[dict]] | None = None
_refresh_lock = asyncio.Lock()


async def _get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        except Exception as e:
            print(f"[CRYPTO] Redis init failed: {e}")
    return _redis


# ── Normalisers ────────────────────────────────────────────────────────────────

def _norm_coindesk(item: dict) -> dict:
    """CoinDesk News V1 (CCData) normalization — uses SCREAMING_SNAKE_CASE."""
    published = item.get("PUBLISHED_ON", 0)
    if isinstance(published, (int, float)) and published > 0:
        published = datetime.datetime.utcfromtimestamp(published).isoformat()
    
    source_data = item.get("SOURCE_DATA", {})
    source_name = source_data.get("NAME", "CoinDesk")

    return {
        "title":        item.get("TITLE", ""),
        "description":  item.get("BODY", ""),
        "url":          item.get("URL", ""),
        "image_url":    item.get("IMAGE_URL"),
        "source_name":  source_name,
        "published_at": published,
        "category":     "crypto",
        "country":      "crypto",
        "provider":     "coindesk",
    }


# ── Budget helpers ─────────────────────────────────────────────────────────────

async def _get_budget_count(provider: str) -> int:
    r = await _get_redis()
    if not r:
        return 0
    today = datetime.date.today().isoformat()
    try:
        val = await r.get(f"budget:{provider}:{today}")
        return int(val or 0)
    except Exception:
        return 0


async def _bump_budget(provider: str):
    r = await _get_redis()
    if not r:
        return
    today = datetime.date.today().isoformat()
    key = f"budget:{provider}:{today}"
    try:
        await r.incr(key)
        await r.expire(key, 86400)
    except Exception:
        pass


# ── Fetch functions ────────────────────────────────────────────────────────────

async def _fetch_coindesk(limit: int = 20) -> list[dict]:
    if not COINDESK_API_KEY:
        return []
    used = await _get_budget_count("coindesk")
    if used >= COINDESK_DAILY_BUDGET:
        print(f"[CRYPTO] CoinDesk daily budget reached ({used}/{COINDESK_DAILY_BUDGET})")
        return []

    try:
        url = "https://data-api.coindesk.com/news/v1/article/list"
        params = {"limit": limit, "lang": "EN"}
        headers = {
            "Authorization": f"Bearer {COINDESK_API_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params, headers=headers)
            if not r.is_success:
                print(f"[CRYPTO] CoinDesk API error: {r.status_code} - {r.text[:200]}")
                return []

        await _bump_budget("coindesk")
        data = r.json()
        results = data.get("Data", [])
        return [_norm_coindesk(i) for i in results]
    except Exception as e:
        import traceback
        print(f"[CRYPTO] CoinDesk fetch failed: {e}")
        # Optional: traceback.print_exc()
        return []


async def _save_to_sqlite(articles: list[dict]):
    """Persist crypto articles into the shared articles table."""
    try:
        from app.news_cache import save_articles
        await save_articles(articles, "crypto", "crypto")
    except Exception as e:
        print(f"[CRYPTO] SQLite save failed (non-fatal): {e}")


async def _fetch_free_crypto_rss(limit: int = 20) -> list[dict]:
    """Fetches free real-time crypto news from CoinDesk RSS feed (no API key required)."""
    url = "https://www.coindesk.com/arc/outboundfeeds/rss/"
    articles = []
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            if resp.status_code == 200:
                import xml.etree.ElementTree as ET
                import re
                root = ET.fromstring(resp.content)
                channel = root.find("channel")
                if channel is not None:
                    for item in channel.findall("item")[:limit]:
                        title = item.findtext("title") or ""
                        link = item.findtext("link") or ""
                        desc = item.findtext("description") or ""
                        pub_date = item.findtext("pubDate") or ""
                        
                        clean_desc = re.sub(r'<[^>]+>', '', desc).strip()
                        
                        media_url = None
                        for media in item.findall("{http://search.yahoo.com/mrss/}content"):
                            media_url = media.get("url")
                            if media_url:
                                break
                        if not media_url:
                            enclosure = item.find("enclosure")
                            if enclosure is not None:
                                media_url = enclosure.get("url")

                        if title:
                            articles.append({
                                "title": title.strip(),
                                "description": clean_desc[:350],
                                "url": link.strip(),
                                "image_url": media_url,
                                "source_name": "CoinDesk News",
                                "published_at": pub_date,
                                "category": "crypto",
                                "country": "crypto",
                                "provider": "coindesk-rss",
                            })
    except Exception as e:
        print(f"[CRYPTO_RSS] Free RSS fetch failed: {e}")
    return articles


# ── Public API ─────────────────────────────────────────────────────────────────

async def get_crypto_headlines(limit: int = 10) -> list[dict]:
    """Fetch Robinhood crypto news from CoinDesk / RSS feeds with caching."""
    global _memory_cache

    now = time.time()
    if _memory_cache and now - _memory_cache[0] < CRYPTO_CACHE_TTL:
        return _memory_cache[1][:limit]

    async with _refresh_lock:
        # Another request may have refreshed while this one waited.
        now = time.time()
        if _memory_cache and now - _memory_cache[0] < CRYPTO_CACHE_TTL:
            return _memory_cache[1][:limit]

        return await _refresh_crypto_headlines(limit)


async def _refresh_crypto_headlines(limit: int) -> list[dict]:
    """Single-flight refresh shared by all callers in this server process."""
    global _memory_cache
    r = await _get_redis()

    # 1. Cache hit
    if r:
        try:
            cached = await r.get(CRYPTO_CACHE_KEY)
            if cached:
                articles = json.loads(cached)
                _memory_cache = (time.time(), articles)
                return articles[:limit]
        except Exception:
            pass

    # 2. Fetch CoinDesk API (if key available) or Free RSS feed
    articles: list[dict] = []
    restored_from_sqlite = False
    if COINDESK_API_KEY:
        try:
            articles = await _fetch_coindesk(20)
            print(f"[CRYPTO] CoinDesk API: {len(articles)} articles")
        except Exception as e:
            print(f"[CRYPTO] CoinDesk API failed: {e}")

    if not articles:
        try:
            articles = await _fetch_free_crypto_rss(20)
            print(f"[CRYPTO] Free RSS Feed: {len(articles)} articles")
        except Exception as e:
            print(f"[CRYPTO] Free RSS failed: {e}")

    if not articles:
        # Preserve the latest sourced data when both live CoinDesk paths fail.
        try:
            from app.news_cache import get_all_recent
            articles = await get_all_recent(limit=max(limit, 20))
            restored_from_sqlite = bool(articles)
        except Exception:
            articles = []

    if not articles:
        return []

    # 3. Cache in Redis + persist to SQLite
    if r:
        try:
            await r.set(CRYPTO_CACHE_KEY, json.dumps(articles), ex=CRYPTO_CACHE_TTL)
        except Exception:
            pass
    if not restored_from_sqlite:
        await _save_to_sqlite(articles)
    _memory_cache = (time.time(), articles)

    return articles[:limit]


async def get_cached_crypto_headlines() -> list[dict]:
    """
    Pure in-process/Redis cache read — no API calls.
    Used by autonomous_loop.py state gathering so it never triggers API usage.
    """
    global _memory_cache
    if _memory_cache and time.time() - _memory_cache[0] < CRYPTO_CACHE_TTL:
        return _memory_cache[1]

    r = await _get_redis()
    if not r:
        return []
    try:
        cached = await r.get(CRYPTO_CACHE_KEY)
        if cached:
            articles = json.loads(cached)
            _memory_cache = (time.time(), articles)
            return articles
    except Exception:
        pass
    return []


async def get_crypto_budget_status() -> dict:
    """Return the only metered editorial-source counter still in use."""
    return {
        "coindesk": {
            "used": await _get_budget_count("coindesk"),
            "limit": COINDESK_DAILY_BUDGET,
            "key_configured": bool(COINDESK_API_KEY),
            "fallback": "CoinDesk RSS",
        }
    }


async def crypto_discovery_round():
    """
    APScheduler job: force-refresh crypto news cache every 30 minutes.
    All exceptions are caught — this must never crash the server.
    """
    global _memory_cache
    print("[CRYPTO DISCOVERY] Starting crypto discovery round...")
    try:
        _memory_cache = None
        r = await _get_redis()
        if r:
            try:
                await r.delete(CRYPTO_CACHE_KEY)
            except Exception:
                pass
        articles = await get_crypto_headlines(20)
        print(f"[CRYPTO DISCOVERY] Complete — {len(articles)} articles cached.")
    except Exception as e:
        print(f"[CRYPTO DISCOVERY] Failed (non-fatal): {e}")
