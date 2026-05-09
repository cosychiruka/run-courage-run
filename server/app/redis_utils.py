"""
redis_utils.py — Seamless Redis integration with memory-based fallback.
Ensures Courage works perfectly in both Sliplane (Prod) and Local (no Docker) environments.
"""

import asyncio
import json
import time
from app.config import REDIS_URL

class MockPubSub:
    def __init__(self, redis_instance):
        self.redis = redis_instance
        self.queue = asyncio.Queue()

    async def subscribe(self, channel):
        if channel not in self.redis._pubsub:
            self.redis._pubsub[channel] = []
        self.redis._pubsub[channel].append(self)

    async def listen(self):
        while True:
            msg = await self.queue.get()
            yield {"type": "message", "data": msg}

class MockRedis:
    """A minimal in-memory replacement for aioredis."""
    def __init__(self):
        self._data = {}
        self._pubsub = {}
        print("[REDIS] Using In-Memory Mock (Seamless Fallback)")

    async def get(self, key):
        return self._data.get(key)

    async def set(self, key, value, ex=None):
        self._data[key] = str(value)
        return True

    async def delete(self, key):
        self._data.pop(key, None)
        return True

    async def expire(self, key, seconds):
        return True

    async def incrbyfloat(self, key, amount):
        val = float(self._data.get(key, 0)) + amount
        self._data[key] = str(val)
        return val

    async def hset(self, name, key, value):
        if name not in self._data: self._data[name] = {}
        self._data[name][key] = str(value)
        return True

    async def hgetall(self, name):
        return self._data.get(name, {})

    async def llen(self, name):
        return len(self._data.get(name, []))

    async def lrange(self, name, start, end):
        return self._data.get(name, [])[start:end+1]

    async def rpush(self, name, *values):
        if name not in self._data: self._data[name] = []
        for v in values:
            self._data[name].append(v)
        return len(self._data[name])

    async def lpush(self, name, *values):
        if name not in self._data: self._data[name] = []
        for v in values:
            self._data[name].insert(0, v)
        return len(self._data[name])

    async def ltrim(self, name, start, end):
        if name in self._data:
            self._data[name] = self._data[name][start:end + 1]
        return True

    async def incr(self, name, amount=1):
        val = int(self._data.get(name, 0)) + amount
        self._data[name] = str(val)
        return val

    async def lpop(self, name):
        if name in self._data and self._data[name]:
            return self._data[name].pop(0)
        return None

    async def xadd(self, name, fields, maxlen=None, **kwargs):
        if name not in self._data: self._data[name] = []
        entry_id = f"{int(time.time() * 1000)}-0"
        self._data[name].append((entry_id, fields))
        if maxlen and len(self._data[name]) > maxlen:
            self._data[name] = self._data[name][-maxlen:]
        return entry_id

    async def xrevrange(self, name, max="+", min="-", count=None):
        entries = list(reversed(self._data.get(name, [])))
        return entries[:count] if count else entries

    async def scard(self, name):
        return len(self._data.get(name, set()))

    async def publish(self, channel, message):
        if channel in self._pubsub:
            for ps in self._pubsub[channel]:
                await ps.queue.put(message)
        return 1

    def pubsub(self, **kwargs):
        return MockPubSub(self)


class MockSyncRedis:
    def __init__(self):
        self._data = {}
        print("[REDIS-SYNC] Using In-Memory Mock")

    def get(self, key): return self._data.get(key)
    def set(self, key, value, ex=None): self._data[key] = str(value); return True
    def incrby(self, key, amount):
        val = int(self._data.get(key, 0)) + amount
        self._data[key] = str(val)
        return val
    def hset(self, name, mapping=None, **kwargs):
        if name not in self._data: self._data[name] = {}
        if mapping: self._data[name].update(mapping)
        if kwargs: self._data[name].update(kwargs)
        return True
    def hgetall(self, name):
        return self._data.get(name, {})
    def keys(self, pattern):
        import fnmatch
        return [k for k in self._data.keys() if fnmatch.fnmatch(k, pattern)]
    def delete(self, key): self._data.pop(key, None); return True

# Global singletons
_client = None
_sync_client = None

async def get_redis_client():
    global _client
    if _client is not None:
        return _client

    try:
        import redis.asyncio as aioredis
        # Try real connection with short timeout
        client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        await asyncio.wait_for(client.ping(), timeout=2.0)
        _client = client
        print(f"[REDIS] Connected to {REDIS_URL}")
    except Exception as e:
        print(f"[REDIS] Connection failed ({e}). Falling back to Memory.")
        _client = MockRedis()
    
    return _client

def get_sync_redis_client():
    global _sync_client
    if _sync_client is not None:
        return _sync_client

    try:
        import redis
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        _sync_client = client
        print(f"[REDIS-SYNC] Connected to {REDIS_URL}")
    except Exception as e:
        print(f"[REDIS-SYNC] Connection failed ({e}). Falling back to Memory.")
        _sync_client = MockSyncRedis()
    
    return _sync_client

# ── X API Cost Tracking ────────────────────────────────────────────────────────
async def track_x_search_cost(posts_returned: int):
    """Track real spend: $0.005 per post returned"""
    r = await get_redis_client()
    if not r:
        return
    cost = posts_returned * 0.005
    await r.incrbyfloat("courage:x_spend_today", cost)
    await r.incrbyfloat("courage:x_spend_total", cost)
    await r.expire("courage:x_spend_today", 86400)  # reset every 24h
