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

import json
import time
import aiosqlite
from typing import Optional

from app.config import DB_PATH, REDIS_URL

# ── Redis (for reflections) ────────────────────────────────────────────────────
_redis = None

async def _get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        except:
            pass
    return _redis

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

CREATE TABLE IF NOT EXISTS tw_trench_tweets (
    tweet_id    TEXT PRIMARY KEY,
    author      TEXT,
    text        TEXT NOT NULL,
    cashtag     TEXT,
    created_at  REAL NOT NULL,
    processed   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS token_daily_stats (
    date        TEXT PRIMARY KEY,
    price       REAL,
    market_cap  REAL,
    volume_24h  REAL,
    change_24h  REAL
);

CREATE TABLE IF NOT EXISTS rag_vectors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content     TEXT,
    embedding   BLOB,  -- we can expand to real embeddings later
    source      TEXT,  -- 'trench' or 'token'
    metadata    TEXT,  -- JSON metadata
    last_accessed REAL,
    created_at  REAL
);

CREATE TABLE IF NOT EXISTS autonomous_ticks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    reasoning TEXT,
    tool_used TEXT,
    success INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT,
    status TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS tw_reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_taken TEXT NOT NULL,
    outcome TEXT NOT NULL,
    created_at REAL NOT NULL
);
"""


async def log_reflection(action_taken: str, outcome: str):
    """Log a post-action reflection for community learning."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO tw_reflections (action_taken, outcome, created_at) VALUES (?,?,?)",
            (action_taken, outcome, time.time()),
        )
        await db.commit()


async def init_twitter_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        for stmt in _SCHEMA.strip().split(";"):
            if stmt.strip():
                await db.execute(stmt)
        try:
            await db.execute(
                "ALTER TABLE autonomous_ticks ADD COLUMN execution_status TEXT"
            )
        except Exception:
            # Column already exists in most upgraded deployments.
            pass
        await db.commit()


async def save_autonomous_decision(
    action: str,
    reasoning: str,
    tool_used: str,
    success_code: int,
    execution_status: str | None = None,
):
    """Persist an autonomous decision with backward-compatible schema writes."""
    status = (execution_status or "").strip().lower()
    if not status:
        status = "success" if int(success_code) == 1 else "queued" if int(success_code) == 2 else "failed"
    ts = time.time()
    iso_ts = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(ts))
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO autonomous_ticks (timestamp, action, reasoning, tool_used, success, execution_status)"
                " VALUES (?,?,?,?,?,?)",
                (iso_ts, action, reasoning or "", tool_used or action, int(success_code), status),
            )
        except Exception:
            await db.execute(
                "INSERT INTO autonomous_ticks (timestamp, action, reasoning, tool_used, success)"
                " VALUES (?,?,?,?,?)",
                (iso_ts, action, reasoning or "", tool_used or action, int(success_code)),
            )
        await db.commit()


async def log_activity_event(
    event: str,
    message: str,
    source: str = "system",
    status: str | None = None,
    metadata: dict | None = None,
):
    """Durable activity stream for dashboard history and postmortems."""
    ts = time.time()
    iso_ts = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(ts))
    payload = json.dumps(metadata or {}, ensure_ascii=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO activity_events (timestamp, event, message, source, status, metadata)"
            " VALUES (?,?,?,?,?,?)",
            (iso_ts, str(event or "BRAIN").upper(), message or "", source, status, payload),
        )
        await db.commit()


async def get_recent_activity_events(limit: int = 200) -> list[dict]:
    """Read recent durable activity rows for admin monitoring."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, timestamp, event, message, source, status, metadata "
            "FROM activity_events ORDER BY id DESC LIMIT ?",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ── Write helpers ──────────────────────────────────────────────────────────────

async def record_tweet(tweet_id: str, text: str, reply_to_id: Optional[str] = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO tw_tweets (tweet_id, text, reply_to_id, created_at) VALUES (?,?,?,?)",
            (tweet_id, text, reply_to_id, time.time()),
        )
        await db.commit()

async def save_posted_tweet(tweet_id: str, text: str, reply_to_id: Optional[str] = None):
    """PHASE 5 alias for record_tweet."""
    return await record_tweet(tweet_id, text, reply_to_id)


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

async def get_own_recent_posts(limit: int = 10) -> list[dict]:
    """Alias for Phase 6.3 self-learning loop."""
    return await get_recent_tweets(limit)


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


async def get_recent_mention_snippets(limit: int = 3) -> str:
    """Return a single string summarizing the last few mentions for the decision step."""
    mentions = await get_recent_mentions(limit)
    if not mentions:
        return "none"
    return " | ".join(f"@{m['author']}: {m['text'][:60]}" for m in mentions)


async def get_recent_trends(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_trends ORDER BY captured_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def prune_old_data(tweet_days: int = 30, trend_days: int = 60):
    """
    Delete old rows to keep the DB lean. Called weekly by APScheduler.
    Tweets/mentions/searches: 30-day window. Trends: 60-day window (useful for patterns).
    """
    tweet_cutoff  = time.time() - (tweet_days  * 86400)
    trend_cutoff  = time.time() - (trend_days  * 86400)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM tw_tweets   WHERE created_at  < ?", (tweet_cutoff,))
        await db.execute("DELETE FROM tw_mentions  WHERE created_at  < ?", (tweet_cutoff,))
        await db.execute("DELETE FROM tw_searches  WHERE searched_at < ?", (tweet_cutoff,))
        await db.execute("DELETE FROM tw_trends    WHERE captured_at < ?", (trend_cutoff,))
        await db.commit()
    print(f"[MEMORY] Pruned Twitter history older than {tweet_days}d (trends: {trend_days}d).")


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


async def get_unprocessed_trench_tweets(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tw_trench_tweets WHERE processed=0 ORDER BY created_at DESC LIMIT ?",
            (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]

async def get_recent_unprocessed_trenches(limit: int = 20) -> list[dict]:
    """PHASE 5 alias for get_unprocessed_trench_tweets."""
    return await get_unprocessed_trench_tweets(limit)

async def mark_trench_processed(tweet_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE tw_trench_tweets SET processed=1 WHERE tweet_id=?", (tweet_id,))
        await db.commit()


async def record_trench_tweet(tweet_id: str, author: str, text: str, cashtag: str = "$RCR"):
    """Save a fetched trench tweet to tw_trench_tweets."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO tw_trench_tweets (tweet_id, author, text, cashtag, created_at, processed)"
            " VALUES (?,?,?,?,?,0)",
            (tweet_id, author, text, cashtag, time.time()),
        )
        await db.commit()


async def save_trench_tweet_with_rag(tweet: dict):
    """Called from trench_service after insert."""
    try:
        from app.rag import embed_and_store  # lazy import — RAG may not be available
        content = f"@{tweet['author']}: {tweet['text']}"
        metadata = {"tweet_id": tweet["tweet_id"], "cashtag": tweet["cashtag"]}
        await embed_and_store(content, source="trench", metadata=metadata)
    except Exception as e:
        print(f"[RAG] embed_and_store failed (non-fatal): {e}")


async def get_unprocessed_trench_tweets_count() -> int:
    """Used by admin dashboard."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM tw_trench_tweets WHERE processed=0") as cur:
            row = await cur.fetchone()
            return row[0] if row else 0

async def get_unprocessed_trench_count() -> int:
    """PHASE 5 alias."""
    return await get_unprocessed_trench_tweets_count()

async def count_unprocessed_trenches() -> int:
    """Alias for Sharp Minimal payload."""
    return await get_unprocessed_trench_tweets_count()

async def count_auto_tweets_today() -> int:
    """Count tweets posted by the autonomous engine today."""
    from datetime import datetime
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM tw_tweets WHERE created_at >= ?", (today_start,)) as cur:
            row = await cur.fetchone()
            return row[0] if row else 0

async def get_recent_reflections(limit: int = 5):
    """Return last N reflections for _gather_state. Stub for now we can make it real later."""
    try:
        r_client = await _get_redis()
        if not r_client: return []
        reflections = await r_client.lrange("courage:reflections", 0, limit-1)
        return [json.loads(r) for r in reflections] if reflections else []
    except Exception:
        return []    # safe fallback so tick never dies again
