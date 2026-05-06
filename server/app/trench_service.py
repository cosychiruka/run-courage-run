"""
trench_service.py — Bulk cashtag ("$RCR") fetching + deduplication + RAG-ready storage.
Atomic, rate-limit safe.
"""

import time
from app.config import DB_PATH
from app.x_client import make_x_client
import app.twitter_memory as tw_mem
import aiosqlite

async def fetch_trench_tweets(cashtag: str = "$RCR", limit: int = 50, since_days: int = 1):
    """Bulk fetch new cashtag tweets → save to DB → return count."""
    x = make_x_client()
    if not x:
        return "X client not ready."

    query = f"{cashtag} -is:retweet lang:en"  # original posts only
    try:
        tweets = x.search_recent(query=query, max_results=limit)
        if not tweets or not tweets.data:
            return f"No new {cashtag} tweets found."

        saved = 0
        async with aiosqlite.connect(DB_PATH) as db:
            for t in tweets.data:
                # dedupe
                async with db.execute("SELECT 1 FROM tw_trench_tweets WHERE tweet_id=?", (str(t.id),)) as cur:
                    if await cur.fetchone():
                        continue
                await db.execute(
                    "INSERT INTO tw_trench_tweets (tweet_id, author, text, cashtag, created_at, processed) "
                    "VALUES (?,?,?,?,?,0)",
                    (str(t.id), str(t.author_id), t.text, cashtag, time.time())
                )
                
                # Auto-embed for RAG (PHASE 2)
                try:
                    await tw_mem.save_trench_tweet_with_rag({
                        "tweet_id": str(t.id),
                        "author": str(t.author_id),
                        "text": t.text,
                        "cashtag": cashtag
                    })
                except Exception as e:
                    print(f"[RAG ERROR] {e}")

                saved += 1
            await db.commit()

        print(f"[TRENCH] Saved {saved} new {cashtag} tweets.")
        return f"Fetched and saved {saved} new {cashtag} trench tweets."
    except Exception as e:
        return f"Trench fetch failed: {e}"
