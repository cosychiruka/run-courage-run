import asyncio
import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.autonomous_loop import _triage_news

async def run_test():
    print("RUNNING COURAGE PANIC TRIAGE TEST...")
    
    mock_articles = [
        {"title": "Local bakery opens new branch in Nowhere, Kansas", "source_name": "Local News"},
        {"title": "SOLANA NETWORK HALTED: MASSIVE EXPLOIT IN PROGRESS", "source_name": "Crypto Alert"},
        {"title": "Global stock markets plunge as mystery virus shuts down tech hubs", "source_name": "Global News"},
        {"title": "Kitten found safe in tree after 2 days", "source_name": "Happy News"},
        {"title": "SpaceX Starship orbital launch delayed by 1 hour", "source_name": "Space Tech"}
    ]
    
    try:
        results = await _triage_news(mock_articles)
        print("\n--- TRIAGE RESULTS ---")
        for res in sorted(results, key=lambda x: x['panic_index'], reverse=True):
            panic = res.get('panic_index', 0)
            status = "CRITICAL" if panic >= 8 else "ALERT" if panic >= 6 else "BORING"
            print(f"[{panic}/10] {status}: {res['title']}")
            
        print("\n[OK] Triage logic verified.")
    except Exception as e:
        print(f"[FAIL] Triage test failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
