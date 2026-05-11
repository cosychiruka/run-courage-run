"""
rag.py — Lightweight RAG using sentence-transformers + SQLite.
Atomic, runs on CPU, no LangChain bloat.
Every trench tweet and token snapshot gets embedded automatically.
"""

import time
import aiosqlite
import asyncio
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    HAS_RAG_DEPS = True
except ImportError:
    HAS_RAG_DEPS = False
    print("[RAG] Dependencies missing. RAG will be disabled.")

from app.config import DB_PATH

_model = None

async def _get_model():
    if not HAS_RAG_DEPS: return None
    global _model
    if _model is None:
        # Run in executor to avoid blocking the event loop during load
        loop = asyncio.get_event_loop()
        _model = await loop.run_in_executor(None, lambda: SentenceTransformer('all-MiniLM-L6-v2', device='cpu'))
    return _model

async def embed_and_store(content: str, source: str, metadata: dict = None):
    """Embed text and store in rag_vectors table."""
    if not HAS_RAG_DEPS: return
    model = await _get_model()
    # model.encode can be slow, but for single items it's usually okay. 
    # For bulk, we'd use an executor.
    loop = asyncio.get_event_loop()
    embedding_numpy = await loop.run_in_executor(None, lambda: model.encode(content, convert_to_numpy=True).astype(np.float32))
    embedding = embedding_numpy.tobytes()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO rag_vectors (content, embedding, source, metadata, created_at) "
            "VALUES (?,?,?,?,?)",
            (content, embedding, source, str(metadata or {}), time.time())
        )
        await db.commit()
    print(f"[RAG] Embedded {source} item")

async def retrieve_top_k(query: str, k: int = 5, source_filter: str = None) -> list[dict]:
    """Simple cosine similarity retrieval (fast on small DB)."""
    if not HAS_RAG_DEPS: return []
    model = await _get_model()
    loop = asyncio.get_event_loop()
    query_emb = await loop.run_in_executor(None, lambda: model.encode(query, convert_to_numpy=True).astype(np.float32))

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM rag_vectors") as cur:
            rows = await cur.fetchall()

    if not rows:
        return []

    results = []
    for row in rows:
        if source_filter and row["source"] != source_filter:
            continue
        emb = np.frombuffer(row["embedding"], dtype=np.float32)
        
        # Cosine similarity
        norm_query = np.linalg.norm(query_emb)
        norm_emb = np.linalg.norm(emb)
        if norm_query == 0 or norm_emb == 0:
            similarity = 0
        else:
            similarity = np.dot(query_emb, emb) / (norm_query * norm_emb)
            
        results.append({"content": row["content"], "similarity": float(similarity), **dict(row)})

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:k]

async def get_rag_vector_count() -> int:
    """Return the total number of embedded vectors in the DB."""
    if not HAS_RAG_DEPS: return 0
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM rag_vectors") as cur:
                row = await cur.fetchone()
                return row[0] if row else 0
    except Exception:
        return 0

async def get_top_rag_vectors(limit: int = 50) -> list[dict]:
    """Return the most recent embedded vectors for visualization."""
    if not HAS_RAG_DEPS: return []
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, content, source, created_at FROM rag_vectors "
                "ORDER BY created_at DESC LIMIT ?", (limit,)
            ) as cur:
                rows = await cur.fetchall()
                return [dict(r) for r in rows]
    except Exception as e:
        print(f"[RAG] Error fetching top vectors: {e}")
        return []
async def get_top_vectors_for_graph(limit: int = 50) -> list[dict]:
    """Return the most recent embedded vectors for visualization."""
    if not HAS_RAG_DEPS: return []
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, content as text_preview, created_at as embedding_timestamp, created_at as last_accessed "
                "FROM rag_vectors ORDER BY created_at DESC LIMIT ?",
                (limit,)
            ) as cur:
                rows = await cur.fetchall()
                return [dict(row) for row in rows]
    except Exception as e:
        print(f"[RAG] Error fetching graph data: {e}")
        return []
