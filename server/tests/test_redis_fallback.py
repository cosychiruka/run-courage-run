import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.redis_utils import MockRedis, MockSyncRedis


class AsyncMemoryRedisTests(unittest.IsolatedAsyncioTestCase):
    async def test_voice_session_sets_and_key_scan(self):
        cache = MockRedis()

        self.assertEqual(await cache.sadd("active_voice_sessions", "one"), 1)
        self.assertEqual(await cache.sadd("active_voice_sessions", "one"), 0)
        self.assertEqual(await cache.scard("active_voice_sessions"), 1)
        self.assertEqual(await cache.keys("active_*"), ["active_voice_sessions"])
        self.assertEqual(await cache.srem("active_voice_sessions", "one"), 1)
        self.assertEqual(await cache.scard("active_voice_sessions"), 0)


class SyncMemoryRedisTests(unittest.TestCase):
    def test_llm_budget_counter_commands(self):
        cache = MockSyncRedis()

        self.assertEqual(cache.incr("llm:calls:today"), 1)
        self.assertEqual(cache.incrby("llm:tokens:today", 25), 25)
        self.assertTrue(cache.expire("llm:tokens:today", 86400))
        self.assertEqual(cache.get("llm:tokens:today"), "25")


if __name__ == "__main__":
    unittest.main()
