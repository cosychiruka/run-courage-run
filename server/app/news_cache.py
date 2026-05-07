"""
news_cache.py — Multi-source news fetching with Redis + SQLite persistence.
Now slimmed down to Guardian only (General news) to lose weight.
Crypto news is handled by crypto_news.py (CoinDesk).
"""

import hashlib
import json
import time
import datetime
import asyncio
import aiosqlite
import httpx
from typing import Optional

from app.config import DB_PATH, GUARDIAN_API_KEY, FIRECRAWL_API_KEY

# ── Redis connection ───────────────────────────────────────────────────────────
async def get_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

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
        await db.commit()

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

async def get_all_recent(limit: int = 20) -> list[dict]:
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
    filtered = [a for a in all_articles if a.get("url") not in exclude_urls]
    if random_sample and len(filtered) > limit:
        return random.sample(filtered, limit)
    return filtered[:limit]

# ── Redis cache helpers ────────────────────────────────────────────────────────
CACHE_TTL = 7200

async def cache_articles(articles: list[dict], country: str, category: str):
    r = await get_redis()
    if not r: return
    try: await r.set(f"news:{country}:{category}", json.dumps(articles), ex=CACHE_TTL)
    except: pass

async def get_cached_articles(country: str = "us", category: str = "general") -> Optional[list[dict]]:
    r = await get_redis()
    if not r: return None
    try:
        raw = await r.get(f"news:{country}:{category}")
        return json.loads(raw) if raw else None
    except: return None

# ── Guardian fetch ────────────────────────────────────────────────────────────
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

# ── Full article text ────────────────────────────────────────────────────────
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
                if r.is_success: return r.json().get("data", {}).get("markdown", "")[:6000]
        except: pass
    return await _jina()

async def save_full_content(url: str, content: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE articles SET full_content=? WHERE url=?", (content, url))
        await db.commit()

# ── Discovery round ───────────────────────────────────────────────────────────
DISCOVERY_PAIRS = [
    ("us", "general"),
    ("us", "technology"),
    ("us", "business"),
]

async def discovery_round():
    print("[DISCOVERY] Starting news round (Guardian only)...")
    for country, category in DISCOVERY_PAIRS:
        cached = await get_cached_articles(country, category)
        if cached: continue
        try:
            articles = await fetch_from_guardian(category, max_results=20)
            if articles:
                await save_articles(articles, country, category)
                await cache_articles(articles, country, category)
                print(f"[DISCOVERY] Stored {len(articles)} articles from Guardian: {country}/{category}")
            await asyncio.sleep(1)
        except Exception as e:
            print(f"[DISCOVERY ERROR] {country}/{category}: {e}")
    print("[DISCOVERY] Round complete.")

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

async def fetch_pair(country: str, category: str, max_results: int = 10) -> list[dict]:
    try: return await fetch_from_guardian(category, max_results)
    except: return []

async def search_newsapi(query: str, max_results: int = 10) -> list[dict]: return []
async def search_gnews(query: str, max_results: int = 10) -> list[dict]: return []

async def cache_tweet_search(query: str, result: str, ttl: int = 900):
    r = await get_redis()
    if not r: return
    key = f"tweets:q:{hashlib.md5(query.lower().strip().encode()).hexdigest()[:14]}"
    try: await r.set(key, result, ex=ttl)
    except: pass

async def get_cached_tweet_search(query: str) -> Optional[str]:
    r = await get_redis()
    if not r: return None
    key = f"tweets:q:{hashlib.md5(query.lower().strip().encode()).hexdigest()[:14]}"
    try: return await r.get(key)
    except: return None

async def get_budget_status():
    return {"guardian": {"used": -1, "limit": 5000}}
