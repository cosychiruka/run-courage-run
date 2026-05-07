import asyncio
import redis.asyncio as aioredis

async def main():
    try:
        r = aioredis.from_url('redis://:x580z9UAnAV6Fl46@redis-jhla.internal:6379')
        # Clear the lockout and the error streak
        await r.delete("courage:groq_backoff_until")
        await r.delete("courage:groq_429_streak")
        # Also reset today's spend counter just so we start fresh
        await r.delete("courage:x_spend_today")
        print("✅ Groq Lockout Cleared. Courage is now FREE to think!")
    except Exception as e:
        print(f"❌ Redis Reset Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
