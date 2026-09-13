"""Shared SQLite article storage and full-text retrieval for crypto news."""

import hashlib
import time
import aiosqlite
import httpx
from typing import Optional

from app.config import DB_PATH, FIRECRAWL_API_KEY

# ── Redis connection ───────────────────────────────────────────────────────────
async def get_redis():
    from app.redis_utils import get_redis_client
    return await get_redis_client()

# ── SQLite schema ──────────────────────────────────────────────────────────────
CREATE_TABLE_ARTICLES = """
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
    category     TEXT DEFAULT 'crypto',
    country      TEXT DEFAULT 'crypto',
    provider     TEXT DEFAULT 'coindesk',
    fetched_at   REAL NOT NULL
)
"""

CREATE_TABLE_TICKS = """
CREATE TABLE IF NOT EXISTS autonomous_ticks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp    TEXT,
    action       TEXT,
    reasoning    TEXT,
    tool_used    TEXT,
    success      INTEGER,
    data_preview TEXT
)
"""

CREATE_TABLE_RAG = """
CREATE TABLE IF NOT EXISTS rag_vectors (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content      TEXT,
    embedding    BLOB,
    source       TEXT,
    metadata     TEXT,
    created_at   REAL
)
"""

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute(CREATE_TABLE_ARTICLES)
        await db.execute(CREATE_TABLE_TICKS)
        await db.execute(CREATE_TABLE_RAG)
        # Migration: add metadata column to rag_vectors if it was created before this column existed
        try:
            await db.execute("ALTER TABLE rag_vectors ADD COLUMN metadata TEXT DEFAULT '{}'")
        except Exception:
            pass  # column already exists — normal on fresh deployments
        await db.commit()

# ── SQLite persistence ────────────────────────────────────────────────────────
async def save_articles(articles: list[dict], country: str = "crypto", category: str = "crypto"):
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        for a in articles:
            source = a.get("source")
            source_name = source.get("name") if isinstance(source, dict) else source
            source_url = source.get("url") if isinstance(source, dict) else None
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
                a.get("image_url") or a.get("image"),
                a.get("published_at") or a.get("publishedAt"),
                a.get("source_name") or source_name,
                a.get("source_url") or source_url,
                category, country,
                a.get("provider") or "coindesk",
                now,
            ))
        await db.commit()

async def get_all_recent(limit: int = 10) -> list[dict]:
    """Fetch recent crypto articles, excluding legacy general-news rows."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT * FROM articles
               WHERE category='crypto' OR country='crypto'
               ORDER BY fetched_at DESC LIMIT ?""",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]

async def get_latest_news_articles(limit: int = 10) -> list[dict]:
    """PHASE 5 alias for get_all_recent."""
    return await get_all_recent(limit)

async def get_varied_articles(
    limit: int = 8,
    country: str = "crypto",
    category: Optional[str] = "crypto",
    exclude_urls: Optional[list[str]] = None,
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
    excluded = set(exclude_urls or [])
    filtered = [a for a in all_articles if a.get("url") not in excluded]
    if random_sample and len(filtered) > limit:
        return random.sample(filtered, limit)
    return filtered[:limit]

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

async def get_recent_articles(limit: int = 10, country: str = "crypto", category: str = "crypto") -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM articles
            WHERE country=? AND category=?
            ORDER BY fetched_at DESC LIMIT ?
        """, (country, category, limit)) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]

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
