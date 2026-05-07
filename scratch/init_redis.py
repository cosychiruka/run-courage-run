import asyncio
import redis.asyncio as aioredis

async def main():
    try:
        r = aioredis.from_url('redis://:x580z9UAnAV6Fl46@redis-jhla.internal:6379')
        await r.set('courage:sensor_cooldown_minutes', 15)
        print("✅ Redis Cooldown Initialized to 15 minutes.")
    except Exception as e:
        print(f"❌ Redis Init Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
