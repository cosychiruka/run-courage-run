"""
autonomous_loop.py — The heartbeat of Courage's autonomy.
Optimized for Phase 5.6 Minimal Payload Strategy.
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
from app.news_cache import get_recent_articles
from app.rag import retrieve_top_k
from app.twitter_memory import (
    get_unprocessed_trench_count,
    get_recent_unprocessed_trenches
)
from app.voice_priority import is_voice_active
from app.system_prompt import SYSTEM_PROMPT_MINIMAL
from app.tools import TOOL_SCHEMAS as COURAGE_TOOLS

# ── Phase 5 Globals ───────────────────────────────────────────────────────────
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
LAST_REACTIVE_TICK = 0
REACTIVE_COOLDOWN_SECONDS = 360 # 6m safety (Phase 5 synchronized pulse)
_redis = None

def _get_tools_spec():
    return COURAGE_TOOLS

def _parse_json_response(raw: str):
    """Helper to extract JSON from markdown or raw text."""
    try:
        clean = raw.strip()
        if clean.startswith("```json"):
            clean = clean.split("```json")[1].split("```")[0].strip()
        elif clean.startswith("```"):
            clean = clean.split("```")[1].split("```")[0].strip()
        
        # Handle cases where AI adds leading/trailing text
        if "{" in clean and "}" in clean:
            start = clean.find("{")
            end = clean.rfind("}")
            clean = clean[start:end+1]
        
        return json.loads(clean)
    except Exception as e:
        print(f"[PARSER ERROR] Failed to decode JSON: {e}")
        return None

# ── State gathering ────────────────────────────────────────────────────────────

async def _gather_state():
    """MINIMAL PAYLOAD — only what the brain actually needs (Phase 5.6 optimization)"""
    global _redis
    if _redis is None:
        from app.redis_utils import get_redis_client
        _redis = await get_redis_client()

    state = {
        "current_time": datetime.now().isoformat(),
        "voice_active": await is_voice_active(),
        "reply_queue_size": await _redis.llen("courage:reply_queue") if _redis else 0,
        "rcr_stats": await get_rcr_stats(),
        "rate_status": {}, # will fill if client available
    }

    # Add rate status
    x = make_x_client()
    if x:
        state["rate_status"] = x.get_rate_status()

    # === MINIMAL TRENCHES (max 5, ultra-short) ===
    trenches = await get_recent_unprocessed_trenches(limit=5)
    state["trenches"] = [
        {"id": t["tweet_id"], "text": t["text"][:280], "author": t["author"]} 
        for t in trenches
    ]
    state["unread_trenches"] = await get_unprocessed_trench_count()

    # === MINIMAL NEWS (max 4, title + 1 sentence only) ===
    news = await get_recent_articles(limit=4)
    state["news"] = [
        {"title": n["title"], "summary": (n.get("description") or n.get("content") or "")[:180]} 
        for n in news
    ]

    # === MINIMAL RAG (top 3 only, short excerpts) ===
    rag_results = await retrieve_top_k("current community vibe", k=3)
    state["rag_context"] = [r["text"][:220] for r in rag_results]

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
        LAST_REACTIVE_TICK = time.time() # Update cooldown regardless of outcome

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

    # Tool dispatch logic (already implemented in previous phases)
    # This is a simplified placeholder to keep the file clean
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

async def force_autonomous_tick(x_client=None, tweet_image_fn=None):
    """Immediate manual override."""
    state = await _gather_state()
    await decide_and_act(state)
