"""
goal_tracker.py — Courage's progress toward his goals.

Tracks:
  - Follower snapshots (daily, from Twitter profile)
  - Autonomous decision log (what the heartbeat loop decided and why)
  - Content bucket timing (when each of the 5 buckets was last used)

Birthday: May 1st, 2026 — the day Courage first woke up.
Goal: Twitter Pro status via follower growth and engagement.
"""

import time
import datetime
from datetime import timezone
import aiosqlite

from app.config import DB_PATH, REDIS_URL

BIRTHDAY = datetime.datetime(2026, 5, 1, tzinfo=timezone.utc)
BUCKET_TIMES_KEY = "courage:bucket_times"

_redis = None


async def _get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        except Exception as e:
            print(f"[GOALS] Redis init failed: {e}")
    return _redis


# ── Schema ─────────────────────────────────────────────────────────────────────

_GOAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS goal_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_count  INTEGER,
    tweet_count     INTEGER,
    following_count INTEGER,
    captured_at     TEXT
);

CREATE TABLE IF NOT EXISTS autonomous_decisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,
    bucket      TEXT,
    reasoning   TEXT,
    executed    INTEGER DEFAULT 0,
    tweet_id    TEXT,
    decided_at  TEXT
);
"""


async def init_goal_db():
    """Create goal tracking tables. Called from main.py startup after init_twitter_db()."""
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in _GOAL_SCHEMA.strip().split(";"):
            if stmt.strip():
                await db.execute(stmt)
        await db.commit()
    print("[GOALS] Goal tracker tables initialized.")


# ── Write helpers ──────────────────────────────────────────────────────────────

async def snapshot_goals(follower_count: int, tweet_count: int, following_count: int):
    """Save a follower/tweet count snapshot to track growth over time."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO goal_snapshots (follower_count, tweet_count, following_count, captured_at) "
            "VALUES (?,?,?,?)",
            (follower_count, tweet_count, following_count, datetime.datetime.utcnow().isoformat()),
        )
        await db.commit()


async def record_autonomous_decision(action: str, bucket: str, reasoning: str) -> int:
    """Log what the autonomous heartbeat decided and why. Returns the row ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO autonomous_decisions (action, bucket, reasoning, decided_at) VALUES (?,?,?,?)",
            (action, bucket, reasoning, datetime.datetime.utcnow().isoformat()),
        )
        await db.commit()
        return cur.lastrowid


async def update_autonomous_decision_executed(decision_id: int, tweet_id: str):
    """Mark a decision as executed and record the resulting tweet_id."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE autonomous_decisions SET executed=1, tweet_id=? WHERE id=?",
            (tweet_id, decision_id),
        )
        await db.commit()


# ── Read helpers ───────────────────────────────────────────────────────────────

async def get_goal_progress_summary() -> str:
    """
    Build a compact goal progress block for injection into the system prompt.
    Courage always knows his growth stats and how old he is.
    """
    try:
        age_days = (datetime.datetime.now(timezone.utc) - BIRTHDAY).days

        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM goal_snapshots ORDER BY captured_at DESC LIMIT 7"
            ) as cur:
                snapshots = [dict(r) for r in await cur.fetchall()]

        if not snapshots:
            return (
                f"== COURAGE'S GROWTH ==\n"
                f"Born: May 1st, 2026 ({age_days} days ago) — just getting started!\n"
                f"No follower snapshots yet — check profile with get_my_profile to start tracking."
            )

        latest = snapshots[0]
        follower_delta = latest["follower_count"] - snapshots[-1]["follower_count"] if len(snapshots) > 1 else 0
        delta_str = f"+{follower_delta}" if follower_delta >= 0 else str(follower_delta)

        return (
            f"== COURAGE'S GROWTH ==\n"
            f"Born: May 1st, 2026 ({age_days} days ago)\n"
            f"Followers: {latest['follower_count']:,} ({delta_str} this week)\n"
            f"Tweets posted: {latest['tweet_count']:,}"
        )
    except Exception:
        age_days = (datetime.datetime.now(timezone.utc) - BIRTHDAY).days
        return f"== COURAGE'S GROWTH ==\nBorn: May 1st, 2026 ({age_days} days ago) — tracking initializing..."


# ── Bucket time helpers (Redis hash) ──────────────────────────────────────────

async def get_last_bucket_times() -> dict:
    """
    Return when each content bucket was last used, as epoch floats.
    Keys: RANDOM, WORLD, NEWS, SOCIAL, CRYPTO. Missing keys default to 0.0.
    """
    r = await _get_redis()
    if not r:
        return {}
    try:
        raw = await r.hgetall(BUCKET_TIMES_KEY)
        return {k: float(v) for k, v in raw.items()}
    except Exception:
        return {}


async def update_bucket_time(bucket: str):
    """Record that a content bucket was just used. Stored in Redis hash."""
    r = await _get_redis()
    if r:
        try:
            await r.hset(BUCKET_TIMES_KEY, bucket, str(time.time()))
        except Exception:
            pass
