import os
import sys
import tweepy
from urllib.parse import unquote
from dotenv import load_dotenv

# Ensure we can import app modules
sys.path.append(os.path.join(os.getcwd(), "server"))
load_dotenv()

def test_bearer_search():
    print("--- X BEARER TOKEN SEARCH TEST ---")
    raw_bearer = os.getenv("X_BEARER_TOKEN") or os.getenv("VITE_X_BEARER_TOKEN")
    if not raw_bearer:
        print("[FAIL] No Bearer Token found in .env")
        return

    bearer = unquote(raw_bearer)
    client = tweepy.Client(bearer_token=bearer)
    
    print(f"Testing search with Bearer: {bearer[:10]}...")
    try:
        res = client.search_recent_tweets("$RCR")
        if res and res.data:
            print(f"[ OK ] Found {len(res.data)} tweets!")
        else:
            print("[ OK ] Success, but no tweets found.")
    except Exception as e:
        print(f"[FAIL] Bearer search failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Body: {e.response.text}")

def test_user_search():
    print("\n--- X USER AUTH SEARCH TEST ---")
    ck = os.getenv("X_CONSUMER_KEY") or os.getenv("VITE_X_CONSUMER_KEY")
    cs = os.getenv("X_CONSUMER_SECRET") or os.getenv("VITE_X_CONSUMER_SECRET")
    at = os.getenv("X_ACCESS_TOKEN") or os.getenv("VITE_X_ACCESS_TOKEN")
    as_ = os.getenv("X_ACCESS_TOKEN_SECRET") or os.getenv("VITE_X_ACCESS_TOKEN_SECRET")
    
    client = tweepy.Client(
        consumer_key=ck,
        consumer_secret=cs,
        access_token=at,
        access_token_secret=as_
    )
    
    print("Testing search with User Auth...")
    try:
        res = client.search_recent_tweets("$RCR")
        if res and res.data:
            print(f"[ OK ] Found {len(res.data)} tweets!")
        else:
            print("[ OK ] Success, but no tweets found.")
    except Exception as e:
        print(f"[FAIL] User Auth search failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Body: {e.response.text}")

if __name__ == "__main__":
    test_bearer_search()
    test_user_search()
