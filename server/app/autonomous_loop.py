"""
autonomous_loop.py — The heartbeat of Courage's autonomy.
Optimized for Phase 5.6 SHARP MINIMAL Strategy.
"""

import json
import asyncio
import time
import datetime
from datetime import datetime
from groq import AsyncGroq

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.x_client import make_x_client
from app.hustle_service import get_rcr_stats
from app.news_cache import get_recent_articles as get_recent_news
from app.rag import retrieve_top_k
from app import rag
from app import twitter_memory
from app.twitter_memory import (
    get_recent_unprocessed_trenches as get_recent_trenches
)
from app.voice_priority import is_voice_active
from app.system_prompt import SYSTEM_PROMPT_MINIMAL
from app.tools import TOOL_SCHEMAS as COURAGE_TOOLS

# ── Phase 5 Globals ───────────────────────────────────────────────────────────
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
LAST_REACTIVE_TICK = 0
REACTIVE_COOLDOWN_SECONDS = 360 
_redis = None

def _get_tools_spec():
    return COURAGE_TOOLS

# ── Sharp Minimal Helpers ──────────────────────────────────────────────────────

async def _count_unreplied_trenches():
    return await twitter_memory.count_unprocessed_trenches()

async def _count_auto_tweets_today():
    return await twitter_memory.count_auto_tweets_today()

async def _get_community_vibe_summary():
    """Cheap one-line vibe from RAG — keeps him emotionally sharp"""
    results = await rag.retrieve_top_k("overall community mood right now", k=3)
    if not results:
        return "Community is quiet"
    return results[0]["text"][:180]

async def _get_rcr_stats():
    from app.hustle_service import get_rcr_stats
    return await get_rcr_stats()

async def get_x_rate_status():
    x = make_x_client()
    return x.get_rate_status() if x else {}

# ── State gathering ────────────────────────────────────────────────────────────

async def _gather_state():
    """SHARP MINIMAL PAYLOAD — keeps Courage witty & context-aware (Phase 5.6)"""
    global _redis
    if _redis is None:
        from app.redis_utils import get_redis_client
        _redis = await get_redis_client()

    state = {
        "current_time": datetime.now().isoformat(),
        "voice_active": await is_voice_active(),
        "unreplied_trenches_count": await _count_unreplied_trenches(),
        "auto_tweets_today": await _count_auto_tweets_today(),
        "rcr_or_sol_stats": await _get_rcr_stats(),           # always keep this
        "x_rate_status": await get_x_rate_status(),           # critical for safety
        "community_vibe": await _get_community_vibe_summary(), # short 1-2 sentence vibe
    }

    # === SHARP TRENCHES (top 6, short but flavorful) ===
    trenches = await get_recent_trenches(limit=6)
    state["trenches"] = [
        {
            "author": t["author"],
            "text": t["text"][:320],                    # enough for wit
            "cashtag": "$RCR" in t["text"].upper()
        }
        for t in trenches
    ]

    # === SHARP NEWS (title + meaningful 2-sentence summary) ===
    news = await get_recent_news(limit=5)
    state["news"] = [
        {
            "title": n["title"],
            "summary": (n.get("description") or n.get("content") or "No summary")[:280]
        }
        for n in news
    ]

    # === LIGHT RAG (top 4 relevant snippets) ===
    rag_results = await rag.retrieve_top_k("current community vibe and $RCR sentiment", k=4)
    state["rag_context"] = [r["text"][:240] for r in rag_results]

    return state

# ── Decision Engine ───────────────────────────────────────────────────────────

async def decide_and_act(state: dict):
    """PHASE 5 CORE: Courage decides what to do autonomously."""
    global LAST_REACTIVE_TICK
    
    if state["voice_active"]:
        print("[VOICE PRIORITY] Skipping autonomous actions — voice session active")
        return

    # Compact JSON context
    context = json.dumps(state, ensure_ascii=False, separators=(",", ":"))

    full_prompt = f"""{SYSTEM_PROMPT_MINIMAL}

Current minimal state:
{context}

Decide the SINGLE best action right now. Be concise. Only use tools if truly needed.
"""

    print(f"[AUTONOMOUS] Thinking... (Payload size: {len(full_prompt)} chars)")
    
    try:
        completion = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": full_prompt}],
            tools=_get_tools_spec(),
            tool_choice="auto",
            temperature=0.7,
            max_tokens=800,
        )

        message = completion.choices[0].message
        LAST_REACTIVE_TICK = time.time() 

        if message.tool_calls:
            for tool_call in message.tool_calls:
                await dispatch_tool(tool_call)
        else:
            print("[AUTONOMOUS] Courage decided to stay quiet and keep watching.")

    except Exception as e:
        print(f"[AUTONOMOUS ERROR] {e}")

async def dispatch_tool(tool_call):
    """Routes LLM tool calls to actual function executions."""
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    print(f"[TOOL] Courage is using: {name} with args {args}")

    from app.tools import execute_tool
    await execute_tool(name, args)

# ── Heartbeat ──────────────────────────────────────────────────────────────────

async def autonomous_tick(x_client=None, tweet_image_fn=None):
    """Global heartbeat — called every few minutes by scheduler."""
    now = time.time()
    if now - LAST_REACTIVE_TICK < REACTIVE_COOLDOWN_SECONDS:
        return

    state = await _gather_state()
    await decide_and_act(state)

async def force_autonomous_tick(x_client=None, tweet_image_fn=None, event_type: str = None):
    """Force a tick (accepts event_type for compatibility)."""
    state = await _gather_state()
    await decide_and_act(state)
