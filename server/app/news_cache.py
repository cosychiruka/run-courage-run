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

async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
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
    used = int(await r.get(_budget_key(provider)) or 0)
    return max(0, daily_limit - used)

async def consume_budget(provider: str) -> bool:
    """Increment counter. Returns True if call is allowed, False if budget exhausted."""
    limit = GNEWS_DAILY_BUDGET if provider == "gnews" else NEWSAPI_DAILY_BUDGET
    r = await get_redis()
    key = _budget_key(provider)
    used = int(await r.get(key) or 0)
    if used >= limit:
        print(f"[BUDGET] {provider} daily limit reached ({used}/{limit}), skipping API call")
        return False
    await r.incr(key)
    await r.expire(key, 86400)   # reset key TTL each increment (safety)
    return True

async def get_budget_status() -> dict:
    gnews_used   = int(await (await get_redis()).get(_budget_key("gnews"))   or 0)
    newsapi_used = int(await (await get_redis()).get(_budget_key("newsapi")) or 0)
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


# ── Redis cache helpers ────────────────────────────────────────────────────────
CACHE_TTL = 1800  # 30 minutes — up from 10 min to dramatically cut API calls

async def cache_articles(articles: list[dict], country: str, category: str):
    r = await get_redis()
    await r.set(f"news:{country}:{category}", json.dumps(articles), ex=CACHE_TTL)

async def get_cached_articles(country: str = "us", category: str = "general") -> Optional[list[dict]]:
    r = await get_redis()
    raw = await r.get(f"news:{country}:{category}")
    return json.loads(raw) if raw else None


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
    Try sources in order:
      1. Guardian  (generous limits, always try)
      2. NewsAPI   (100/day budget, server-side only)
      3. GNews     (100/day budget, shared with browser callers)
    Return first successful non-empty result.
    """
    errors = []

    # 1. Guardian — primary
    try:
        articles = await fetch_from_guardian(category, max_results)
        if articles:
            return articles
    except Exception as e:
        errors.append(f"guardian: {e}")

    # 2. NewsAPI — supplement
    if NEWSAPI_KEY:
        try:
            articles = await fetch_from_newsapi(country, category, max_results)
            if articles:
                return articles
        except Exception as e:
            errors.append(f"newsapi: {e}")

    # 3. GNews — last resort
    if GNEWS_API_KEY:
        try:
            articles = await fetch_from_gnews(country, category, max_results)
            if articles:
                return articles
        except Exception as e:
            errors.append(f"gnews: {e}")

    print(f"[NEWS] All sources failed for {country}/{category}: {errors}")
    return []


# ── Discovery round — called by APScheduler ───────────────────────────────────
# Runs every 30 minutes (changed from 10 min).
# Guardian: 5000/day → 48 rounds × 4 pairs = 192 calls → well within limit.
# NewsAPI/GNews: budgeted, only consumed when Guardian fails.

DISCOVERY_PAIRS = [
    ("us", "general"),
    ("us", "technology"),
    ("us", "business"),
    ("gb", "general"),   # UK coverage via Guardian (Guardian covers UK well)
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
        except Exception as e:
            print(f"[DISCOVERY ERROR] {country}/{category}: {e}")

    print("[DISCOVERY] Round complete.")
