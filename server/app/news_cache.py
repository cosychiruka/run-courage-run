"""
news_cache.py — Persistent news storage + Redis TTL cache.

SQLite stores every fetched article permanently.
Redis caches the latest article ID lists per country/category (600s TTL).
"""

import json
import time
import asyncio
import aiosqlite
import redis.asyncio as aioredis
import httpx
from typing import Optional

from app.config import (
    DB_PATH, REDIS_URL,
    GNEWS_API_KEY, GUARDIAN_API_KEY, FIRECRAWL_API_KEY,
)

# ── Redis connection (module-level singleton) ──────────────────────────────────
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
    fetched_at   REAL NOT NULL
)
"""

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_TABLE)
        await db.commit()


# ── Upsert articles ────────────────────────────────────────────────────────────
async def save_articles(articles: list[dict], country: str = "us", category: str = "general"):
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        for a in articles:
            await db.execute("""
                INSERT INTO articles
                    (title, description, url, image_url, published_at,
                     source_name, source_url, category, country, fetched_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(url) DO UPDATE SET
                    fetched_at=excluded.fetched_at
            """, (
                a.get("title", ""),
                a.get("description", ""),
                a.get("url", ""),
                a.get("image"),
                a.get("publishedAt"),
                a.get("source", {}).get("name"),
                a.get("source", {}).get("url"),
                category, country, now,
            ))
        await db.commit()


# ── Fetch from SQLite ──────────────────────────────────────────────────────────
async def get_recent_articles(limit: int = 10, country: str = "us", category: str = "general") -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM articles
            WHERE country=? AND category=?
            ORDER BY fetched_at DESC
            LIMIT ?
        """, (country, category, limit)) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def get_all_recent(limit: int = 20) -> list[dict]:
    """All categories — for building AI context."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM articles ORDER BY fetched_at DESC LIMIT ?
        """, (limit,)) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ── Redis cache helpers ────────────────────────────────────────────────────────
CACHE_TTL = 600  # 10 minutes

async def cache_articles(articles: list[dict], country: str, category: str):
    r = await get_redis()
    key = f"news:{country}:{category}"
    await r.set(key, json.dumps(articles), ex=CACHE_TTL)


async def get_cached_articles(country: str = "us", category: str = "general") -> Optional[list[dict]]:
    r = await get_redis()
    raw = await r.get(f"news:{country}:{category}")
    return json.loads(raw) if raw else None


# ── GNews fetch ────────────────────────────────────────────────────────────────
async def fetch_from_gnews(country: str = "us", category: str = "general", max_results: int = 10) -> list[dict]:
    params = {
        "token": GNEWS_API_KEY,
        "lang": "en",
        "country": country,
        "topic": "breaking-news" if category == "general" else category,
        "max": max_results,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://gnews.io/api/v4/top-headlines", params=params)
        r.raise_for_status()
        data = r.json()

    return [
        {
            "title": a.get("title", ""),
            "description": a.get("description", ""),
            "url": a.get("url", ""),
            "image": a.get("image"),
            "publishedAt": a.get("publishedAt"),
            "source": {"name": a.get("source", {}).get("name", ""), "url": a.get("source", {}).get("url", "")},
        }
        for a in data.get("articles", [])
    ]


# ── Guardian fetch ─────────────────────────────────────────────────────────────
async def fetch_from_guardian(category: str = "general", max_results: int = 10) -> list[dict]:
    section = "news" if category == "general" else category
    params = {
        "api-key": GUARDIAN_API_KEY or "test",
        "section": section,
        "page-size": max_results,
        "show-fields": "trailText,thumbnail",
        "order-by": "newest",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://content.guardianapis.com/search", params=params)
        r.raise_for_status()
        data = r.json()

    return [
        {
            "title": item.get("webTitle", ""),
            "description": item.get("fields", {}).get("trailText", ""),
            "url": item.get("webUrl", ""),
            "image": item.get("fields", {}).get("thumbnail"),
            "publishedAt": item.get("webPublicationDate"),
            "source": {"name": "The Guardian", "url": "https://www.theguardian.com"},
        }
        for item in data.get("response", {}).get("results", [])
    ]


# ── Full article fetch (Firecrawl → Jina fallback) ────────────────────────────
async def fetch_full_article(url: str) -> str:
    """Return the full article text. Tries Firecrawl, falls back to Jina reader (free)."""
    # Jina reader — no key needed, always available
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
        await db.execute(
            "UPDATE articles SET full_content=? WHERE url=?", (content, url)
        )
        await db.commit()


# ── Discovery round — called by APScheduler every 10 min ──────────────────────
async def discovery_round():
    """Fetch latest news, save to SQLite + Redis cache."""
    print("[DISCOVERY] Starting news discovery round...")
    pairs = [("us", "general"), ("us", "technology"), ("us", "business")]

    for country, category in pairs:
        try:
            if GNEWS_API_KEY:
                articles = await fetch_from_gnews(country, category)
            else:
                articles = await fetch_from_guardian(category)

            if articles:
                await save_articles(articles, country, category)
                await cache_articles(articles, country, category)
                print(f"[DISCOVERY] Cached {len(articles)} articles: {country}/{category}")
        except Exception as e:
            print(f"[DISCOVERY ERROR] {country}/{category}: {e}")

    print("[DISCOVERY] Round complete.")
