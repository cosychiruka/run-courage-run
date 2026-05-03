"""
twitter_memory.py — SQLite-backed long-term memory for Courage's Twitter activity.

Stores:
  - Tweets he posted (id, text, created_at, reply_to_id)
  - Mentions/replies he received (id, author, text, created_at)
  - Replies he sent to mentions (id, text, reply_to_id, created_at)
  - Trends he discovered (topic, tweet_volume, woeid, captured_at)

This lets Courage summarise his Twitter history on demand without
hitting the X API rate limits every time someone asks "what have you
been up to on Twitter?"
"""

import time
import aiosqlite
from typing import Optional

from app.config import DB_PATH

# ── Schema ─────────────────────────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tw_tweets (
    tweet_id    TEXT PRIMARY KEY,
    text        TEXT NOT NULL,
    reply_to_id TEXT,
    created_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tw_mentions (
    tweet_id    TEXT PRIMARY KEY,
    author      TEXT,
    text        TEXT NOT NULL,
    replied     INTEGER DEFAULT 0,
    created_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tw_trends (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic       TEXT NOT NULL,
    tweet_volume INTEGER,
    woeid       INTEGER DEFAULT 1,
    captured_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tw_searches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    query       TEXT NOT NULL,
    result_peek TEXT,
    searched_at REAL NOT NULL
);
"""


async def init_twitter_db():
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in _SCHEMA.strip().split(";"):
            if stmt.strip():
                await db.execute(stmt)
        await db.commit()


# ── Write helpers ──────────────────────────────────────────────────────────────

async def record_tweet(tweet_id: str, text: str, reply_to_id: Optional[str] = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO tw_tweets (tweet_id, text, reply_to_id, created_at) VALUES (?,?,?,?)",
            (tweet_id, text, reply_to_id, time.time()),
        )
        await db.commit()


async def record_mention(tweet_id: str, author: str, text: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO tw_mentions (tweet_id, author, text, replied, created_at) VALUES (?,?,?,0,?)",
            (tweet_id, author, text, time.time()),
        )
        await db.commit()


async def mark_mention_replied(tweet_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE tw_mentions SET replied=1 WHERE tweet_id=?", (tweet_id,))
        await db.commit()


async def record_trends(trends: list[dict], woeid: int = 1):
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        for t in trends:
            await db.execute(
                "INSERT INTO tw_trends (topic, tweet_volume, woeid, captured_at) VALUES (?,?,?,?)",
                (t.get("name", ""), t.get("tweet_volume"), woeid, now),
            )
        await db.commit()


async def record_search(query: str, result_peek: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO tw_searches (query, result_peek, searched_at) VALUES (?,?,?)",
            (query, result_peek, time.time()),
        )
        await db.commit()


async def get_recent_searches(limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_searches ORDER BY searched_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


# ── Read helpers ───────────────────────────────────────────────────────────────

async def get_recent_tweets(limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_tweets ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def get_unreplied_mentions(limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_mentions WHERE replied=0 ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def get_recent_mentions(limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_mentions ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def get_recent_trends(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_trends ORDER BY captured_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def get_twitter_summary() -> str:
    """
    Build a concise plain-text summary of Courage's recent Twitter activity.
    Called by the system prompt builder so the LLM always knows his history.
    """
    tweets   = await get_recent_tweets(5)
    mentions = await get_recent_mentions(5)
    trends   = await get_recent_trends(10)
    searches = await get_recent_searches(5)

    lines = ["== MY TWITTER ACTIVITY (from memory) =="]

    if tweets:
        lines.append(f"\nMy last {len(tweets)} tweets:")
        for t in tweets:
            reply_note = f" [reply to {t['reply_to_id']}]" if t.get("reply_to_id") else ""
            lines.append(f"  - [{t['tweet_id']}]{reply_note} {t['text']}")
    else:
        lines.append("\nI haven't posted any tweets yet this session.")

    if mentions:
        lines.append(f"\nRecent mentions/replies I received ({len(mentions)}):")
        for m in mentions:
            replied = "✓ replied" if m.get("replied") else "⚠ not yet replied"
            lines.append(f"  - @{m['author']}: {m['text']} [{replied}]")
    else:
        lines.append("\nNo mentions received yet.")

    if trends:
        unique_topics = list({t["topic"] for t in trends})[:10]
        lines.append(f"\nTrends I've discovered: {', '.join(unique_topics)}")

    if searches:
        lines.append(f"\nMy recent Twitter searches (check these before searching again):")
        for s in searches:
            age_min = int((time.time() - s["searched_at"]) / 60)
            age_str = f"{age_min}m ago" if age_min < 60 else f"{age_min // 60}h ago"
            lines.append(f"  - \"{s['query']}\" ({age_str})")

    return "\n".join(lines)
