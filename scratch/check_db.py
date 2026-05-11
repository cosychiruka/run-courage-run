import asyncio
import aiosqlite
import os

DB_PATH = "./data/courage.db"

async def check():
    if not os.path.exists(DB_PATH):
        print(f"DB NOT FOUND at {DB_PATH}")
        return
    
    async with aiosqlite.connect(DB_PATH) as db:
        print("--- Tables ---")
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur:
            tables = await cur.fetchall()
            for t in tables:
                print(f"Table: {t[0]}")
        
        print("\n--- Recent Ticks ---")
        try:
            async with db.execute("SELECT * FROM autonomous_ticks ORDER BY timestamp DESC LIMIT 5") as cur:
                rows = await cur.fetchall()
                print(f"Ticks count: {len(rows)}")
                for r in rows:
                    print(dict(zip([d[0] for d in cur.description], r)))
        except Exception as e:
            print(f"Error reading autonomous_ticks: {e}")

        print("\n--- RAG Vectors ---")
        try:
            async with db.execute("SELECT count(*) FROM rag_vectors") as cur:
                row = await cur.fetchone()
                print(f"RAG count: {row[0]}")
        except Exception as e:
            print(f"Error reading rag_vectors: {e}")

if __name__ == "__main__":
    asyncio.run(check())
