"""
rag.py — SQLite memory with low-RAM lexical retrieval or optional semantic embeddings.
"""

import time
import aiosqlite
import asyncio
import re

from app.config import DB_PATH, RAG_MODE

_model = None

async def _get_model():
    if RAG_MODE != "semantic":
        return None
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = await asyncio.to_thread(
                SentenceTransformer, 'all-MiniLM-L6-v2', device='cpu'
            )
        except ImportError:
            print("[RAG] sentence-transformers is unavailable; using lexical retrieval.")
    return _model

async def embed_and_store(content: str, source: str, metadata: dict = None):
    """Embed text and store in rag_vectors table."""
    model = await _get_model()
    embedding = b""
    if model is not None:
        import numpy as np
        embedding_numpy = await asyncio.to_thread(
            lambda: model.encode(content, convert_to_numpy=True).astype(np.float32)
        )
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
    """Use semantic retrieval when enabled, otherwise low-memory lexical scoring."""
    model = await _get_model()
    query_emb = None
    np = None
    if model is not None:
        import numpy as np_module
        np = np_module
        query_emb = await asyncio.to_thread(
            lambda: model.encode(query, convert_to_numpy=True).astype(np.float32)
        )

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM rag_vectors") as cur:
            rows = await cur.fetchall()

    if not rows:
        return []

    results = []
    query_terms = set(re.findall(r"[a-z0-9$@]+", query.casefold()))
    for row in rows:
        if source_filter and row["source"] != source_filter:
            continue
        if query_emb is not None and row["embedding"]:
            emb = np.frombuffer(row["embedding"], dtype=np.float32)
            norm_query = np.linalg.norm(query_emb)
            norm_emb = np.linalg.norm(emb)
            similarity = 0 if norm_query == 0 or norm_emb == 0 else np.dot(query_emb, emb) / (norm_query * norm_emb)
        else:
            content_terms = set(re.findall(r"[a-z0-9$@]+", row["content"].casefold()))
            similarity = len(query_terms & content_terms) / max(1, len(query_terms))

        results.append({"content": row["content"], "similarity": float(similarity), **dict(row)})

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:k]

async def get_rag_vector_count() -> int:
    """Return the total number of embedded vectors in the DB."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM rag_vectors") as cur:
                row = await cur.fetchone()
                return row[0] if row else 0
    except Exception:
        return 0

async def get_top_rag_vectors(limit: int = 50) -> list[dict]:
    """Return the most recent embedded vectors for visualization."""
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
