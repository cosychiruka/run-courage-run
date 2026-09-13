import asyncio
import time
import unittest
from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import crypto_news


class _EmptyRedis:
    async def get(self, _key):
        return None

    async def set(self, *_args, **_kwargs):
        return True


class CryptoNewsCacheTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        crypto_news._memory_cache = None
        crypto_news._refresh_lock = asyncio.Lock()

    async def test_concurrent_callers_share_one_upstream_refresh(self):
        article = {
            "title": "Sourced crypto headline",
            "url": "https://example.test/story",
            "category": "crypto",
            "country": "crypto",
            "provider": "coindesk",
        }

        async def delayed_fetch(_limit):
            await asyncio.sleep(0.01)
            return [article]

        with (
            patch.object(crypto_news, "COINDESK_API_KEY", "configured"),
            patch.object(crypto_news, "_get_redis", AsyncMock(return_value=_EmptyRedis())),
            patch.object(crypto_news, "_fetch_coindesk", AsyncMock(side_effect=delayed_fetch)) as fetch,
            patch.object(crypto_news, "_save_to_sqlite", AsyncMock()),
        ):
            results = await asyncio.gather(
                crypto_news.get_crypto_headlines(10),
                crypto_news.get_crypto_headlines(10),
                crypto_news.get_crypto_headlines(10),
            )

        self.assertEqual(results, [[article], [article], [article]])
        self.assertEqual(fetch.await_count, 1)

    async def test_fresh_memory_cache_avoids_redis_and_upstream(self):
        article = {"title": "Cached", "url": "https://example.test/cached"}
        crypto_news._memory_cache = (time.time(), [article])

        with patch.object(crypto_news, "_get_redis", AsyncMock()) as get_redis:
            result = await crypto_news.get_crypto_headlines(1)

        self.assertEqual(result, [article])
        get_redis.assert_not_awaited()

    async def test_sqlite_fallback_is_not_rewritten_as_fresh(self):
        article = {
            "title": "Last sourced story",
            "url": "https://example.test/stale",
            "category": "crypto",
            "country": "crypto",
        }

        with (
            patch.object(crypto_news, "COINDESK_API_KEY", ""),
            patch.object(crypto_news, "_get_redis", AsyncMock(return_value=_EmptyRedis())),
            patch.object(crypto_news, "_fetch_free_crypto_rss", AsyncMock(return_value=[])),
            patch("app.news_cache.get_all_recent", AsyncMock(return_value=[article])),
            patch.object(crypto_news, "_save_to_sqlite", AsyncMock()) as save,
        ):
            result = await crypto_news.get_crypto_headlines(1)

        self.assertEqual(result, [article])
        save.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
