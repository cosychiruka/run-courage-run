import sqlite3
import datetime

def check_activity():
    db_path = 'courage.db'
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        print("--- Tables in DB ---")
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = c.fetchall()
        for t in tables:
            print(f"- {t[0]}")
            
        if ('autonomous_decisions',) in tables:
            print("\n--- Recent Autonomous Decisions ---")
            c.execute("SELECT action, bucket, reasoning, confidence, tweet_id, decided_at FROM autonomous_decisions ORDER BY decided_at DESC LIMIT 10")
            rows = c.fetchall()
            for r in rows:
                print(r)
        
        if ('tw_tweets',) in tables:
            print("\n--- Recent Tweets ---")
            c.execute("SELECT tweet_id, text, created_at FROM tw_tweets ORDER BY created_at DESC LIMIT 5")
            rows = c.fetchall()
            for r in rows:
                print(r)
                
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_activity()
