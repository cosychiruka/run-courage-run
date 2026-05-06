import asyncio
import os
import sys
from dotenv import load_dotenv

# Add parent dir to path so we can import 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv()

from app.news_cache import fetch_from_gnews, fetch_from_newsapi, fetch_from_guardian
from app.crypto_news import _fetch_coindesk

async def test_keys():
    print("=== COURAGE NEWS KEY AUDIT ===")
    
    # 1. Guardian
    print("\n[1] Testing The Guardian...")
    try:
        res = await fetch_from_guardian(max_results=1)
        print(f"SUCCESS: Found '{res[0]['title'][:50]}...'")
    except Exception as e:
        print(f"FAILED: {e}")

    # 2. NewsAPI
    print("\n[2] Testing NewsAPI...")
    try:
        res = await fetch_from_newsapi(max_results=1)
        if res:
            print(f"SUCCESS: Found '{res[0]['title'][:50]}...'")
        else:
            print("OK (Empty): Key works but returned no results.")
    except Exception as e:
        print(f"FAILED: {e}")

    # 3. GNews
    print("\n[3] Testing GNews...")
    try:
        res = await fetch_from_gnews(max_results=1)
        if res:
            print(f"SUCCESS: Found '{res[0]['title'][:50]}...'")
        else:
            print("OK (Empty): Key works but returned no results.")
    except Exception as e:
        print(f"FAILED: {e}")

    # 4. CoinDesk
    print("\n[4] Testing CoinDesk...")
    if not os.getenv("COINDESK_API_KEY"):
        print("MISSING: COINDESK_API_KEY not found in .env")
    else:
        try:
            res = await _fetch_coindesk(limit=1)
            if res:
                print(f"SUCCESS: Found '{res[0]['title'][:50]}...'")
            else:
                print("FAILED: Returned 0 results (Check if your key has access to 'news/v1/article/list')")
        except Exception as e:
            print(f"FAILED: {e}")

    print("\n=== AUDIT COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(test_keys())
