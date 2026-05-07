"""
Primary:   CoinDesk News API (CCData-powered, rich snippets, includes images)
Fallback:  CoinGecko Demo API (10,000/month free, secondary source)

Normalized schema matches the existing `articles` table:
  title, description, url, image_url, source_name, published_at,
  category="crypto", country="crypto"

Cache: Redis key "courage_crypto_news" (30-min TTL) + SQLite articles table
Budget: Redis counters budget:coindesk:YYYY-MM-DD, budget:coingecko:YYYY-MM-DD
"""

import json
import time
import datetime
from datetime import timezone
import httpx

from app.config import DB_PATH, REDIS_URL, COINDESK_API_KEY, COINGECKO_API_KEY

CRYPTO_CACHE_KEY = "courage_crypto_news"
CRYPTO_CACHE_TTL = 1800  # 30 minutes
COINDESK_DAILY_BUDGET = 1000
COINGECKO_DAILY_BUDGET = 300

# Module-level Redis singleton (lazy init)
_redis = None


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
    }


def _norm_coingecko(item: dict) -> dict:
    # updated_at is an epoch int on CoinGecko
    published = item.get("updated_at", 0)
    if isinstance(published, (int, float)) and published > 0:
        published = datetime.datetime.utcfromtimestamp(published).isoformat()

    author = item.get("author", {})
    source = author.get("name", "CoinGecko") if isinstance(author, dict) else str(author or "CoinGecko")

    image = item.get("thumb_2x") or item.get("image", {}).get("thumb", "") if isinstance(item.get("image"), dict) else item.get("thumb_2x", "")

    return {
        "title":        item.get("title", ""),
        "description":  item.get("description", ""),
        "url":          item.get("url", ""),
        "image_url":    image or None,
        "source_name":  source,
        "published_at": published,
        "category":     "crypto",
        "country":      "crypto",
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


async def _fetch_coingecko(limit: int = 20) -> list[dict]:
    if COINGECKO_API_KEY.startswith("CG-"):
        # Research confirmed: CoinGecko '/news' endpoint is a PAID-ONLY feature.
        # Demo keys return 401 or 422. Skipping to avoid log noise.
        return []

    used = await _get_budget_count("coingecko")
    if used >= COINGECKO_DAILY_BUDGET:
        print(f"[CRYPTO] CoinGecko daily budget reached ({used}/{COINGECKO_DAILY_BUDGET})")
        return []

    headers = {"x-cg-demo-api-key": COINGECKO_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/news",
                headers=headers,
                params={"per_page": limit},
            )
            r.raise_for_status()
            data = r.json()
            # data["data"] is a list of news items
            results = []
            for item in data.get("data", []):
                results.append({
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "source": item.get("author") or "CoinGecko",
                    "image": item.get("thumb_2x") or item.get("thumb"),
                    "publishedAt": datetime.datetime.fromtimestamp(item.get("updated_at", 0)).isoformat(),
                })
            return results

    except Exception as e:
        # User requested to keep CoinGecko even if unpaid; just return empty list on failure.
        print(f"[CRYPTO] CoinGecko fetch skipped or failed: {e}")
        return []


async def _save_to_sqlite(articles: list[dict]):
    """Persist crypto articles into the shared articles table."""
    try:
        from app.news_cache import save_articles
        await save_articles(articles, "crypto", "crypto")
    except Exception as e:
        print(f"[CRYPTO] SQLite save failed (non-fatal): {e}")


# ── Public API ─────────────────────────────────────────────────────────────────

async def get_crypto_headlines(limit: int = 10) -> list[dict]:
    """Fetch crypto news from CoinDesk with caching."""
    r = await _get_redis()

    # 1. Cache hit
    if r:
        try:
            cached = await r.get(CRYPTO_CACHE_KEY)
            if cached:
                return json.loads(cached)[:limit]
        except Exception:
            pass

    # 2. Fetch CoinDesk
    articles: list[dict] = []
    if COINDESK_API_KEY:
        try:
            articles = await _fetch_coindesk(20)
            print(f"[CRYPTO] CoinDesk: {len(articles)} articles")
        except Exception as e:
            print(f"[CRYPTO] CoinDesk failed: {e}")

    if not articles:
        return []

    # 3. Cache in Redis + persist to SQLite
    if r:
        try:
            await r.set(CRYPTO_CACHE_KEY, json.dumps(articles), ex=CRYPTO_CACHE_TTL)
        except Exception:
            pass
    await _save_to_sqlite(articles)

    return articles[:limit]


async def get_cached_crypto_headlines() -> list[dict]:
    """
    Pure Redis-only read — no API calls.
    Used by autonomous_loop.py state gathering so it never triggers API usage.
    """
    r = await _get_redis()
    if not r:
        return []
    try:
        cached = await r.get(CRYPTO_CACHE_KEY)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    return []


async def crypto_discovery_round():
    """
    APScheduler job: force-refresh crypto news cache every 30 minutes.
    All exceptions are caught — this must never crash the server.
    """
    print("[CRYPTO DISCOVERY] Starting crypto discovery round...")
    try:
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
