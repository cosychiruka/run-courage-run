import asyncio
import aiosqlite
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "courage.db")

async def migrate():
    print(f"Migrating database at {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("DB NOT FOUND. Skipping.")
        return

    async with aiosqlite.connect(DB_PATH) as db:
        # Check if data_preview exists
        cursor = await db.execute("PRAGMA table_info(autonomous_ticks)")
        columns = await cursor.fetchall()
        column_names = [c[1] for r in columns]
        
        if "data_preview" not in column_names:
            print("Adding 'data_preview' column to autonomous_ticks...")
            await db.execute("ALTER TABLE autonomous_ticks ADD COLUMN data_preview TEXT")
            await db.commit()
            print("Migration complete!")
        else:
            print("'data_preview' column already exists.")

if __name__ == "__main__":
    asyncio.run(migrate())
