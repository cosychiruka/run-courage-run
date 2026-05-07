import os
import sys
from dotenv import load_dotenv

# Ensure we can import app modules
sys.path.append(os.path.join(os.getcwd(), "server"))

load_dotenv()

from app.x_client import make_x_client

def test_x():
    print("--- X CLIENT DIAGNOSTIC ---")
    x = make_x_client()
    if not x:
        print("[FAIL] Client initialization failed (check your keys).")
        return

    print("[ OK ] Client initialized.")
    
    # 1. Test get_me (simplest auth test)
    print("\n[1] Testing get_me()...")
    try:
        me = x.get_my_profile()
        if me and me.data:
            print(f"[ OK ] Success! Logged in as @{me.data.username} (ID: {me.data.id})")
        else:
            print("[FAIL] Success response but no data.")
    except Exception as e:
        print(f"[FAIL] get_me failed: {e}")

    # 2. Test search_recent (the "glitch")
    print("\n[2] Testing search_recent('$RCR')...")
    try:
        results = x.search_recent("$RCR", max_results=10)
        if results and results.data:
            print(f"[ OK ] Success! Found {len(results.data)} tweets.")
        else:
            print("[ OK ] Success, but no tweets found for $RCR.")
    except Exception as e:
        print(f"[FAIL] search_recent failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response Body: {e.response.text}")

    # 3. Test post (if search works or not, let's see if we can post a diagnostic tweet)
    # Actually, let's just do a dry run or skip if user didn't ask to post.
    # The user asked "RUN TESTS??".
    print("\n[3] (Skipping post test to avoid spamming your account)")

if __name__ == "__main__":
    test_x()
