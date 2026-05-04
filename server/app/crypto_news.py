"""
crypto_news.py — Crypto news fetching with CryptoPanic + CoinGecko fallback.

Primary:   CryptoPanic free API (real-time aggregation, broad, crypto-specific)
Fallback:  CoinGecko Demo API (10,000/month free, has thumb_2x image URLs)

Normalized schema matches the existing `articles` table:
  title, description, url, image_url, source_name, published_at,
  category="crypto", country="crypto"

Cache: Redis key "courage_crypto_news" (30-min TTL) + SQLite articles table
Budget: Redis counters budget:cryptopanic:YYYY-MM-DD, budget:coingecko:YYYY-MM-DD
"""

import json
import time
import datetime
from datetime import timezone
import httpx

from app.config import DB_PATH, REDIS_URL, CRYPTOPANIC_API_KEY, COINGECKO_API_KEY

CRYPTO_CACHE_KEY = "courage_crypto_news"
CRYPTO_CACHE_TTL = 1800  # 30 minutes
CRYPTOPANIC_DAILY_BUDGET = 200
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

def _norm_cryptopanic(item: dict) -> dict:
    return {
        "title":        item.get("title", ""),
        "description":  item.get("title", ""),  # CP often omits description
        "url":          item.get("url", ""),
        "image_url":    None,                   # No images on CP free tier
        "source_name":  item.get("domain", "CryptoPanic"),
        "published_at": item.get("published_at", ""),
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

async def _fetch_cryptopanic(limit: int = 20) -> list[dict]:
    if not CRYPTOPANIC_API_KEY:
        return []
    used = await _get_budget_count("cryptopanic")
    if used >= CRYPTOPANIC_DAILY_BUDGET:
        print(f"[CRYPTO] CryptoPanic daily budget reached ({used}/{CRYPTOPANIC_DAILY_BUDGET})")
        return []

    url = (
        f"https://cryptopanic.com/api/v1/posts/"
        f"?auth_token={CRYPTOPANIC_API_KEY}&public=true&kind=news"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
        r.raise_for_status()

    await _bump_budget("cryptopanic")
    results = r.json().get("results", [])
    return [_norm_cryptopanic(i) for i in results[:limit]]


async def _fetch_coingecko(limit: int = 20) -> list[dict]:
    if not COINGECKO_API_KEY:
        return []
    used = await _get_budget_count("coingecko")
    if used >= COINGECKO_DAILY_BUDGET:
        print(f"[CRYPTO] CoinGecko daily budget reached ({used}/{COINGECKO_DAILY_BUDGET})")
        return []

    headers = {"x-cg-demo-api-key": COINGECKO_API_KEY}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.coingecko.com/api/v3/news",
            headers=headers,
            params={"per_page": limit},
        )
        r.raise_for_status()

    await _bump_budget("coingecko")
    data = r.json()
    items = data.get("data", data) if isinstance(data, dict) else data
    return [_norm_coingecko(i) for i in items[:limit]]


async def _save_to_sqlite(articles: list[dict]):
    """Persist crypto articles into the shared articles table."""
    try:
        from app.news_cache import save_articles
        await save_articles(articles, "crypto", "crypto")
    except Exception as e:
        print(f"[CRYPTO] SQLite save failed (non-fatal): {e}")


# ── Public API ─────────────────────────────────────────────────────────────────

def _title_key(title: str) -> str:
    """Normalised title key for deduplication across sources."""
    import re as _re
    return _re.sub(r"[^a-z0-9]", "", title.lower())[:40]


async def get_crypto_headlines(limit: int = 10) -> list[dict]:
    """
    Fetch crypto news with caching.

    Both sources are always attempted (never pure fallback) so that CoinGecko's
    image-rich articles (thumb_2x) are always available for tweet image attachment.

    Merge order: CoinGecko first (has images) → CryptoPanic fill-ins.
    Deduplication by normalised title prefix so near-identical stories don't appear twice.
    Cache: Redis key CRYPTO_CACHE_KEY, 30-min TTL.
    Never raises — returns [] on all failures.
    """
    r = await _get_redis()

    # 1. Cache hit
    if r:
        try:
            cached = await r.get(CRYPTO_CACHE_KEY)
            if cached:
                return json.loads(cached)[:limit]
        except Exception:
            pass

    # 2. Fetch both sources independently (never short-circuit)
    cp_articles: list[dict] = []
    cg_articles: list[dict] = []

    if CRYPTOPANIC_API_KEY:
        try:
            cp_articles = await _fetch_cryptopanic(20)
            print(f"[CRYPTO] CryptoPanic: {len(cp_articles)} articles")
        except Exception as e:
            print(f"[CRYPTO] CryptoPanic failed: {e}")

    if COINGECKO_API_KEY:
        try:
            cg_articles = await _fetch_coingecko(15)
            print(f"[CRYPTO] CoinGecko: {len(cg_articles)} articles")
        except Exception as e:
            print(f"[CRYPTO] CoinGecko failed: {e}")

    # 3. Merge: CoinGecko first (image URLs), then CryptoPanic fill-ins
    #    Deduplicate by normalised 40-char title prefix
    seen: set[str] = set()
    merged: list[dict] = []

    for a in cg_articles:
        key = _title_key(a.get("title", ""))
        if key and key not in seen:
            seen.add(key)
            merged.append(a)

    for a in cp_articles:
        key = _title_key(a.get("title", ""))
        if key and key not in seen:
            seen.add(key)
            merged.append(a)

    if not merged:
        return []

    # 4. Cache in Redis + persist to SQLite
    if r:
        try:
            await r.set(CRYPTO_CACHE_KEY, json.dumps(merged), ex=CRYPTO_CACHE_TTL)
        except Exception:
            pass
    await _save_to_sqlite(merged)

    print(f"[CRYPTO] Merged {len(merged)} unique articles ({len(cg_articles)} CG + {len(cp_articles)} CP)")
    return merged[:limit]


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
