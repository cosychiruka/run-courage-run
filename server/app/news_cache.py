"""
news_cache.py — Multi-source news fetching with Redis + SQLite persistence.

Source priority (backend discovery):
  1. Guardian  — 5 000 req/day, works server+browser, no CORS issue
  2. NewsAPI   — 100 req/day, SERVER-SIDE ONLY (browser CORS blocked), budgeted
  3. GNews     — 100 req/day, works server+browser but shared w/ browser, budgeted

Budget tracking: Redis daily counters (`budget:gnews:YYYY-MM-DD`, etc.)
  Automatically stops calling an API once its daily budget is hit.

Cache layers:
  Redis  — hot cache, 30-min TTL, JSON blob per country/category
  SQLite — durable store, survives Redis restart, powers AI context
"""

import hashlib
import json
import time
import datetime
import asyncio
import aiosqlite
import redis.asyncio as aioredis
import httpx
from typing import Optional

from app.config import (
    DB_PATH, REDIS_URL,
    GNEWS_API_KEY, GUARDIAN_API_KEY, NEWSAPI_KEY, FIRECRAWL_API_KEY,
    GNEWS_DAILY_BUDGET, NEWSAPI_DAILY_BUDGET,
)

# ── Redis connection ───────────────────────────────────────────────────────────
_redis: Optional[aioredis.Redis] = None
_redis_available: bool = True

async def get_redis() -> Optional[aioredis.Redis]:
    global _redis, _redis_available
    if _redis is None and _redis_available:
        try:
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            # Short-circuit check: ping to see if host exists
            await asyncio.wait_for(_redis.ping(), timeout=1.0)
            print(f"[REDIS] Connected successfully to {REDIS_URL}")
        except Exception as e:
            print(f"[REDIS] Warning: Could not connect to {REDIS_URL}. Hot-cache disabled. Falling back to SQLite persistence. Error: {e}")
            _redis = None
            _redis_available = False
    return _redis


# ── SQLite schema ──────────────────────────────────────────────────────────────
CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS articles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    url          TEXT UNIQUE NOT NULL,
    image_url    TEXT,
    published_at TEXT,
    source_name  TEXT,
    source_url   TEXT,
    full_content TEXT,
    category     TEXT DEFAULT 'general',
    country      TEXT DEFAULT 'us',
    provider     TEXT DEFAULT 'guardian',
    fetched_at   REAL NOT NULL
)
"""

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_TABLE)
        # Add provider column if upgrading from older schema
        try:
            await db.execute("ALTER TABLE articles ADD COLUMN provider TEXT DEFAULT 'guardian'")
        except Exception:
            pass
        await db.commit()


# ── Daily budget helpers ───────────────────────────────────────────────────────

def _budget_key(provider: str) -> str:
    day = datetime.date.today().isoformat()
    return f"budget:{provider}:{day}"

async def budget_remaining(provider: str, daily_limit: int) -> int:
    r = await get_redis()
    if not r: return daily_limit
    try:
        used = int(await r.get(_budget_key(provider)) or 0)
        return max(0, daily_limit - used)
    except Exception:
        return daily_limit

async def consume_budget(provider: str) -> bool:
    """Increment counter. Returns True if call is allowed, False if budget exhausted."""
    limit = GNEWS_DAILY_BUDGET if provider == "gnews" else NEWSAPI_DAILY_BUDGET
    r = await get_redis()
    if not r: return True # allow if no redis
    
    key = _budget_key(provider)
    try:
        used = int(await r.get(key) or 0)
        if used >= limit:
            print(f"[BUDGET] {provider} daily limit reached ({used}/{limit}), skipping API call")
            return False
        await r.incr(key)
        await r.expire(key, 86400)
    except Exception:
        pass
    return True

async def get_budget_status() -> dict:
    r = await get_redis()
    gnews_used = 0
    newsapi_used = 0
    if r:
        try:
            gnews_used   = int(await r.get(_budget_key("gnews"))   or 0)
            newsapi_used = int(await r.get(_budget_key("newsapi")) or 0)
        except Exception:
            pass
            
    return {
        "gnews":   {"used": gnews_used,   "limit": GNEWS_DAILY_BUDGET},
        "newsapi": {"used": newsapi_used, "limit": NEWSAPI_DAILY_BUDGET},
        "guardian": {"used": -1, "limit": 5000},   # not tracked
    }


# ── Article normalisation ──────────────────────────────────────────────────────

def _norm_guardian(item: dict) -> dict:
    return {
        "title":       item.get("webTitle", ""),
        "description": item.get("fields", {}).get("trailText", ""),
        "content":     item.get("fields", {}).get("bodyText", "") or item.get("fields", {}).get("trailText", ""),
        "url":         item.get("webUrl", ""),
        "image":       item.get("fields", {}).get("thumbnail"),
        "publishedAt": item.get("webPublicationDate"),
        "source":      {"name": "The Guardian", "url": "https://www.theguardian.com"},
        "provider":    "guardian",
    }

def _norm_newsapi(item: dict) -> dict:
    return {
        "title":       item.get("title", ""),
        "description": item.get("description", "") or "",
        "content":     item.get("content", "") or item.get("description", "") or "",
        "url":         item.get("url", ""),
        "image":       item.get("urlToImage"),
        "publishedAt": item.get("publishedAt"),
        "source":      {"name": item.get("source", {}).get("name", "NewsAPI"), "url": ""},
        "provider":    "newsapi",
    }

def _norm_gnews(item: dict) -> dict:
    return {
        "title":       item.get("title", ""),
        "description": item.get("description", "") or "",
        "content":     item.get("content", "") or item.get("description", "") or "",
        "url":         item.get("url", ""),
        "image":       item.get("image"),
        "publishedAt": item.get("publishedAt"),
        "source":      {"name": item.get("source", {}).get("name", ""), "url": item.get("source", {}).get("url", "")},
        "provider":    "gnews",
    }


# ── SQLite persistence ────────────────────────────────────────────────────────

async def save_articles(articles: list[dict], country: str = "us", category: str = "general"):
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        for a in articles:
            await db.execute("""
                INSERT INTO articles
                    (title, description, url, image_url, published_at,
                     source_name, source_url, category, country, provider, fetched_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(url) DO UPDATE SET fetched_at=excluded.fetched_at
            """, (
                a.get("title", ""),
                a.get("description", ""),
                a.get("url", ""),
                a.get("image"),
                a.get("publishedAt"),
                a.get("source", {}).get("name"),
                a.get("source", {}).get("url"),
                category, country,
                a.get("provider", "unknown"),
                now,
            ))
        await db.commit()


async def get_recent_articles(limit: int = 10, country: str = "us", category: str = "general") -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM articles
            WHERE country=? AND category=?
            ORDER BY fetched_at DESC LIMIT ?
        """, (country, category, limit)) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def get_all_recent(limit: int = 20) -> list[dict]:
    """All categories — for building AI context."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM articles ORDER BY fetched_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]

async def get_varied_articles(
    limit: int = 8, 
    country: str = "us", 
    category: Optional[str] = None,
    exclude_urls: list[str] = [],
    random_sample: bool = True
) -> list[dict]:
    """
    Refined variety fetch: 
    1. Pulls the latest 40 articles (scaled back from 100).
    2. Hard-filters out already covered URLs.
    3. Randomly samples 8 articles for a fresh mix.
    """
    import random
    
    query = "SELECT * FROM articles WHERE 1=1"
    params = []
    
    if country:
        query += " AND country=?"
        params.append(country)
    if category:
        query += " AND category=?"
        params.append(category)
        
    query += " ORDER BY fetched_at DESC LIMIT 40"
    
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, tuple(params)) as cur:
            rows = await cur.fetchall()
            
    all_articles = [dict(r) for r in rows]
    
    # 1. Hard filter already-tweeted URLs
    filtered = [a for a in all_articles if a.get("url") not in exclude_urls]
    
    # 2. Randomly sample if requested
    if random_sample and len(filtered) > limit:
        return random.sample(filtered, limit)
        
    return filtered[:limit]


# ── Redis cache helpers ────────────────────────────────────────────────────────
CACHE_TTL = 1200  # 20 minutes — balances freshness vs API budget

async def cache_articles(articles: list[dict], country: str, category: str):
    r = await get_redis()
    if not r: return
    try:
        await r.set(f"news:{country}:{category}", json.dumps(articles), ex=CACHE_TTL)
    except Exception:
        pass

async def get_cached_articles(country: str = "us", category: str = "general") -> Optional[list[dict]]:
    r = await get_redis()
    if not r: return None
    try:
        raw = await r.get(f"news:{country}:{category}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


# ── Tweet search cache (15-min TTL) ──────────────────────────────────────────
TWEET_CACHE_TTL = 900  # 15 minutes

async def cache_tweet_search(query: str, result: str, ttl: int = TWEET_CACHE_TTL):
    r = await get_redis()
    if not r:
        return
    key = f"tweets:q:{hashlib.md5(query.lower().strip().encode()).hexdigest()[:14]}"
    try:
        await r.set(key, result, ex=ttl)
    except Exception:
        pass

async def get_cached_tweet_search(query: str) -> Optional[str]:
    r = await get_redis()
    if not r:
        return None
    key = f"tweets:q:{hashlib.md5(query.lower().strip().encode()).hexdigest()[:14]}"
    try:
        return await r.get(key)
    except Exception:
        return None


# ── Guardian fetch (primary — 5000/day, no budget counter needed) ─────────────

async def fetch_from_guardian(category: str = "general", max_results: int = 10) -> list[dict]:
    section = "news" if category == "general" else category
    params = {
        "api-key":    GUARDIAN_API_KEY or "test",
        "section":    section,
        "page-size":  max_results,
        "show-fields": "trailText,thumbnail,bodyText",
        "order-by":   "newest",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://content.guardianapis.com/search", params=params)
        r.raise_for_status()
    return [_norm_guardian(i) for i in r.json().get("response", {}).get("results", [])]


# ── NewsAPI fetch (server-side ONLY — CORS blocked in browser) ────────────────
# Supports: business, entertainment, general, health, science, sports, technology
# Countries: ae ar at au be bg br ca cn co cu cz de eg fr gb gr hk hu id ie il
#            in it jp kr lt lv ma mx my ng nl no nz ph pl pt ro rs ru sa se sg
#            si sk th tr tw ua us ve za

async def fetch_from_newsapi(country: str = "us", category: str = "general", max_results: int = 10) -> list[dict]:
    if not NEWSAPI_KEY:
        raise ValueError("NEWSAPI_KEY not configured")
    if not await consume_budget("newsapi"):
        raise RuntimeError("NewsAPI daily budget exhausted")

    params = {
        "apiKey":   NEWSAPI_KEY,
        "country":  country,
        "category": category,
        "pageSize": min(max_results, 100),
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://newsapi.org/v2/top-headlines", params=params)
        r.raise_for_status()
    articles = r.json().get("articles", [])
    # Filter out "[Removed]" tombstone articles NewsAPI sometimes returns
    return [_norm_newsapi(a) for a in articles if a.get("title") != "[Removed]"]


async def search_newsapi(query: str, max_results: int = 10) -> list[dict]:
    if not NEWSAPI_KEY:
        return []
    if not await consume_budget("newsapi"):
        return []

    params = {
        "apiKey":   NEWSAPI_KEY,
        "q":        query,
        "pageSize": min(max_results, 100),
        "sortBy":   "publishedAt",
        "language": "en",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://newsapi.org/v2/everything", params=params)
        r.raise_for_status()
    return [_norm_newsapi(a) for a in r.json().get("articles", []) if a.get("title") != "[Removed]"]


# ── GNews fetch (budgeted — also callable from browser but protect budget) ────

async def fetch_from_gnews(country: str = "us", category: str = "general", max_results: int = 10) -> list[dict]:
    if not GNEWS_API_KEY:
        print("[GNEWS] GNEWS_API_KEY is not set in environment — skipping GNews call")
        raise ValueError("GNEWS_API_KEY not configured")
    if not await consume_budget("gnews"):
        raise RuntimeError("GNews daily budget exhausted")

    params = {
        "token":   GNEWS_API_KEY,
        "lang":    "en",
        "country": country,
        "topic":   "breaking-news" if category == "general" else category,
        "max":     max_results,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://gnews.io/api/v4/top-headlines", params=params)
        if not r.is_success:
            print(f"[GNEWS] HTTP {r.status_code} error — body: {r.text[:500]}")
        r.raise_for_status()
    return [_norm_gnews(a) for a in r.json().get("articles", [])]


async def search_gnews(query: str, max_results: int = 10) -> list[dict]:
    if not GNEWS_API_KEY:
        return []
    if not await consume_budget("gnews"):
        return []

    params = {"token": GNEWS_API_KEY, "lang": "en", "q": query, "max": max_results}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://gnews.io/api/v4/search", params=params)
        if not r.is_success:
            print(f"[GNEWS] search HTTP {r.status_code} — body: {r.text[:500]}")
        r.raise_for_status()
    return [_norm_gnews(a) for a in r.json().get("articles", [])]


# ── Full article text (Firecrawl → Jina fallback) ─────────────────────────────

async def fetch_full_article(url: str) -> str:
    async def _jina() -> str:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"https://r.jina.ai/{url}", headers={"Accept": "text/plain"})
            return r.text[:6000] if r.is_success else ""

    if FIRECRAWL_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {FIRECRAWL_API_KEY}"},
                    json={"url": url, "formats": ["markdown"]},
                )
                if r.is_success:
                    return r.json().get("data", {}).get("markdown", "")[:6000]
        except Exception:
            pass

    return await _jina()


async def save_full_content(url: str, content: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE articles SET full_content=? WHERE url=?", (content, url))
        await db.commit()


# ── Unified fetch for a single country/category pair ─────────────────────────

async def fetch_pair(country: str, category: str, max_results: int = 10) -> list[dict]:
    """
    Collect news from all available sources for variety:
      1. Guardian (Primary)
      2. NewsAPI  (Budgeted)
      3. GNews    (Budgeted)
    """
    all_articles = []
    seen_urls = set()

    def _add_unique(articles):
        for a in articles:
            if a.get("url") not in seen_urls:
                seen_urls.add(a.get("url"))
                all_articles.append(a)

    # 1. Guardian
    try:
        print(f"[NEWS] Trying Guardian for {country}/{category}...")
        res = await fetch_from_guardian(category, max_results)
        if res:
            print(f"[NEWS] Guardian OK: {len(res)} articles")
            _add_unique(res)
    except Exception as e:
        print(f"[NEWS] Guardian FAILED: {e}")

    # 2. NewsAPI
    if NEWSAPI_KEY:
        try:
            print(f"[NEWS] Trying NewsAPI for {country}/{category}...")
            res = await fetch_from_newsapi(country, category, max_results // 2)
            if res:
                print(f"[NEWS] NewsAPI OK: {len(res)} articles")
                _add_unique(res)
        except Exception as e:
            print(f"[NEWS] NewsAPI FAILED: {e}")

    # 3. GNews
    if GNEWS_API_KEY:
        try:
            print(f"[NEWS] Trying GNews for {country}/{category}...")
            res = await fetch_from_gnews(country, category, max_results // 2)
            if res:
                print(f"[NEWS] GNews OK: {len(res)} articles")
                _add_unique(res)
        except Exception as e:
            print(f"[NEWS] GNews FAILED: {e}")

    return all_articles[:max_results]


# ── Discovery round — called by APScheduler ───────────────────────────────────
# Runs every 30 minutes (changed from 10 min).
# Guardian: 5000/day → 48 rounds × 4 pairs = 192 calls → well within limit.
# NewsAPI/GNews: budgeted, only consumed when Guardian fails.

DISCOVERY_PAIRS = [
    ("us", "general"),
    ("us", "technology"),
    ("us", "business"),
    ("us", "sports"),
    ("us", "entertainment"),
    ("gb", "general"),   # UK coverage via Guardian
]

async def discovery_round():
    print("[DISCOVERY] Starting news round...")
    budget = await get_budget_status()
    print(f"[DISCOVERY] Budget — GNews: {budget['gnews']['used']}/{budget['gnews']['limit']} | "
          f"NewsAPI: {budget['newsapi']['used']}/{budget['newsapi']['limit']}")

    for country, category in DISCOVERY_PAIRS:
        # Skip if already have fresh cache
        cached = await get_cached_articles(country, category)
        if cached:
            print(f"[DISCOVERY] Cache hit: {country}/{category}, skipping fetch")
            continue

        try:
            articles = await fetch_pair(country, category)
            if articles:
                await save_articles(articles, country, category)
                await cache_articles(articles, country, category)
                print(f"[DISCOVERY] Stored {len(articles)} articles [{articles[0]['provider']}]: {country}/{category}")
            
            # Pacing: avoid hammering GNews/NewsAPI free tiers too fast
            await asyncio.sleep(1.2)
        except Exception as e:
            print(f"[DISCOVERY ERROR] {country}/{category}: {e}")

    print("[DISCOVERY] Round complete.")
