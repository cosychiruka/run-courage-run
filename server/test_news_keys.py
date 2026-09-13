import asyncio
import os
import sys
from dotenv import load_dotenv

# Add parent dir to path so we can import 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv()

from app.crypto_news import get_crypto_headlines

async def test_keys():
    print("=== COURAGE CRYPTO NEWS AUDIT ===")

    print("\n[1] Testing CoinDesk API/RSS pipeline...")
    if not os.getenv("COINDESK_API_KEY"):
        print("NOTICE: COINDESK_API_KEY is missing; testing the keyless RSS fallback.")
    try:
        res = await get_crypto_headlines(limit=1)
        if res:
            provider = res[0].get("provider", "unknown")
            print(f"SUCCESS ({provider}): Found '{res[0]['title'][:50]}...'")
        else:
            print("FAILED: Both CoinDesk API/cache and RSS fallback returned no results.")
    except Exception as e:
        print(f"FAILED: {e}")

    print("\n=== AUDIT COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(test_keys())
