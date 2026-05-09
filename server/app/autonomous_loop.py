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
from app.news_cache import get_all_recent as get_recent_news
from app.rag import retrieve_top_k
from app import rag
from app import twitter_memory
from app.twitter_memory import (
    get_recent_unprocessed_trenches as get_recent_trenches
)
from app.voice_priority import is_voice_active
from app.system_prompt import SYSTEM_PROMPT_MINIMAL
from app.tools import TOOL_SCHEMAS as COURAGE_TOOLS
import app.tools as tools

# ── News Signal Scoring ───────────────────────────────────────────────────────
# Tiers: (score, keywords). First match wins. Score ≥ 80 = EXTREME override.
_SIGNAL_TIERS = [
    (80, ["alien", "ufo", "classified", "whistleblower", "extraterrestrial",
          "government files", "government release", "pentagon ufo", "government secret",
          "nuclear", "released today", "declassified", "area 51"]),
    (60, ["bitcoin", "solana", "memecoin", "crypto crash", "pump", "surge",
          "all time high", "record high", "100k", "breakthrough", "scandal",
          "major hack", "exploit", "rug pull"]),
    (40, ["crypto", "blockchain", "regulation", "fed rate", "inflation",
          "market rally", "market crash", "bullish", "bearish"]),
    (20, ["stocks", "economy", "business", "earnings", "gdp"]),
]

def _score_article(article: dict) -> int:
    text = (
        article.get("title", "") + " " +
        (article.get("description") or article.get("content") or "")
    ).lower()
    for score, keywords in _SIGNAL_TIERS:
        if any(k in text for k in keywords):
            return score
    return 10

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

async def log_live_activity(message: str):
    """Logs a short message to Redis for the 'Live Activity' dashboard feed."""
    global _redis
    if not _redis: return
    try:
        await _redis.lpush("courage:live_activity", json.dumps({
            "timestamp": datetime.now().isoformat(),
            "message": message
        }))
        await _redis.ltrim("courage:live_activity", 0, 29) # Keep latest 30
    except Exception as e:
        print(f"[LIVE LOG ERROR] {e}")

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

    # ── Time-of-day context ───────────────────────────────────────────────────
    _now = datetime.now()
    _hour = _now.hour
    if 5 <= _hour < 10:
        _energy, _phase = "GM energy", "sunrise"
    elif 10 <= _hour < 15:
        _energy, _phase = "midday grind", "noon"
    elif 15 <= _hour < 20:
        _energy, _phase = "afternoon hustle", "evening"
    elif 20 <= _hour < 24:
        _energy, _phase = "GN wind-down", "evening"
    else:
        _energy, _phase = "midnight chaos", "midnight"

    # ── Pending game moments (set by game_sensor, cleared after this tick) ──
    raw_moments = await _redis.lrange("courage:pending_game_moments", 0, 4) if _redis else []
    pending_game_moments = [json.loads(m) for m in raw_moments] if raw_moments else []

    # ── Recent trending topics from SQLite memory ─────────────────────────
    recent_trends = await twitter_memory.get_recent_trends(limit=10)
    unique_trends = list({t["topic"] for t in recent_trends})[:5]

    state = {
        "current_time": datetime.now().isoformat(),
        "time_context": {
            "hour": _hour,
            "energy": _energy,
            "day_phase": _phase,
            "day_of_week": _now.strftime("%A"),
        },
        "voice_active": await is_voice_active(),
        "game_moments": pending_game_moments,   # ← brain now sees who triggered the wake
        "trending_topics": unique_trends,       # ← recent Twitter trends from memory
        "game_sensor": {
            "status": "cooldown_active" if await _redis.get("courage:last_sensor_search") else "ready",
            "last_check": await _redis.get("courage:last_sensor_search") or "never"
        },
        "token_info": await tools.get_token_info(),
        "past_reflections": await twitter_memory.get_recent_reflections(limit=3),
        "unreplied_trenches_count": await _count_unreplied_trenches(),
        "auto_tweets_today": await _count_auto_tweets_today(),
        "rcr_or_sol_stats": await _get_rcr_stats(),           # always keep this
        "x_rate_status": await get_x_rate_status(),           # critical for safety
        "community_vibe": await _get_community_vibe_summary(), # short 1-2 sentence vibe
    }

    # Phase 2.0: Credit-Aware Intelligence
    if _redis:

        credit_status = await _redis.get("courage:x_credit_status") or "healthy"
        if credit_status == "capped":
            state["credit_alert"] = "X API credits depleted. Cannot search or post. Switch to internal hype / meme generation mode."

    # === SHARP TRENCHES (top 6, short but flavorful — tweet_id included for replies) ===
    trenches = await get_recent_trenches(limit=6)
    state["trenches"] = [
        {
            "tweet_id": t.get("tweet_id", ""),          # LLM needs this to reply
            "author":   t["author"],
            "text":     t["text"][:320],
            "cashtag":  "$RCR" in t["text"].upper()
        }
        for t in trenches
    ]

    # === SHARP NEWS (scored + sorted — all categories, not just general) ===
    news = await get_recent_news(limit=8)
    scored = sorted(
        [{"a": n, "score": _score_article(n)} for n in news],
        key=lambda x: x["score"], reverse=True
    )
    state["news"] = [
        {
            "title":        x["a"]["title"],
            "summary":      (x["a"].get("description") or x["a"].get("content") or "No summary")[:320],
            "category":     x["a"].get("category", "general"),
            "signal_score": x["score"],
            "article_url":  x["a"].get("url", ""),          # pass to auto_news_react for newspaper render
            "image_url":    x["a"].get("image_url") or x["a"].get("image") or x["a"].get("urlToImage") or "",
            "source":       "Nowhere News",
        }
        for x in scored
    ]
    state["top_news_signal"] = scored[0]["score"] if scored else 0

    # === LIGHT RAG (top 4 relevant snippets) ===
    rag_results = await rag.retrieve_top_k("current community vibe and $RCR sentiment", k=4)
    state["rag_context"] = [r["text"][:240] for r in rag_results]

    # Smart idle / credit awareness — with EXTREME signal override
    credit_status = await _redis.get("courage:x_credit_status") or "ok"
    trench_count = len(state.get("trenches", []))
    game_active = len(state.get("game_moments", [])) > 0
    extreme_news = state.get("top_news_signal", 0) >= 80

    if extreme_news:
        # EXTREME signal always breaks through — alien/gov news is too big to miss
        state["mode"] = "normal"
        if credit_status == "capped":
            state["credit_override"] = (
                f"EXTREME news signal (score={state['top_news_signal']}) detected — "
                "overriding credit cap. React now."
            )
    elif credit_status == "capped":
        state["mode"] = "idle_hype"
        state["idle_reason"] = "credits_capped"
    elif trench_count == 0 and not game_active:
        state["mode"] = "idle_hype"
        state["idle_reason"] = "quiet_trenches"
    else:
        state["mode"] = "normal"

    if state.get("mode") == "idle_hype" or trench_count == 0:
        state["suggested_action"] = "proactive_personality_post"

    return state

# ── Decision Engine ───────────────────────────────────────────────────────────

async def decide_and_act(state, x_client=None, tweet_image_fn=None):
    """Llama 3.3 (70b) evaluates the state and chooses the next move."""
    global LAST_REACTIVE_TICK

    if state["voice_active"]:
        print("[VOICE PRIORITY] Skipping autonomous actions — voice session active")
        return

    # Groq 429 circuit breaker — mirrors the voice agent's protection
    if _redis:
        backoff_until = await _redis.get("courage:groq_backoff_until")
        if backoff_until and time.time() < float(backoff_until):
            remaining = int(float(backoff_until) - time.time())
            print(f"[AUTONOMOUS] Groq circuit breaker active — {remaining // 60}m {remaining % 60}s remaining")
            await log_live_activity(f"Groq rate-limit backoff active ({remaining // 60}m left) — staying quiet")
            return

    # Compact JSON context
    context = json.dumps(state, ensure_ascii=False, separators=(",", ":"))

    decision_prompt = f"""
== AUTONOMOUS DECISION ==
You are Courage. Review your state and decide the best ACTION.
Current Token ({state['token_info']['symbol']}): {state['token_info']['launch_status']} | Price: {state['token_info']['price']}
Recent Reflections: {state['past_reflections']}
Game World: {state['game_sensor']['status']}

Full context:
{context}

Decide the SINGLE best action right now. Be concise. Only use tools if truly needed.
"""

    print(f"[AUTONOMOUS] Thinking... (Payload size: {len(decision_prompt)} chars)")
    
    try:
        completion = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_MINIMAL},
                {"role": "user", "content": decision_prompt}
            ],
            tools=_get_tools_spec(),
            tool_choice="auto",
            temperature=0.7,
            max_tokens=800,
        )

        message = completion.choices[0].message
        LAST_REACTIVE_TICK = time.time() 
        chosen_action = "NO_ACTION"

        if message.tool_calls:
            for tool_call in message.tool_calls:
                name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                chosen_action = name
                print(f"[AUTONOMOUS] Executing tool: {name}")
                
                # Execute and log
                try:
                    result = await dispatch_tool(tool_call, state, x_client=x_client, tweet_image_fn=tweet_image_fn)
                    await log_brain_decision(name.upper(), str(args), executed=True)
                    await log_live_activity(f"Brain decided: {name} → {str(args)[:80]}...")
                except Exception as e:
                    print(f"[AUTONOMOUS TOOL ERROR] {e}")
                    await log_brain_decision(name.upper(), str(args), executed=False, error=str(e))
        else:
            print("[AUTONOMOUS] Courage decided to stay quiet and keep watching.")
            await log_brain_decision("NO_ACTION", "Decided to keep watching", executed=True)
            await log_live_activity("Courage decided to stay quiet and keep watching.")

        # Clear processed game moments so they don't re-fire next tick
        if _redis and state.get("game_moments"):
            await _redis.delete("courage:pending_game_moments")

        # FINAL REFLECTION — makes him learn every single time
        if chosen_action != "NO_ACTION":
            try:
                from app.tools import execute_tool
                await execute_tool("reflect_and_adapt", {
                    "action_taken": chosen_action,
                    "outcome": "posted_successfully"
                })
            except Exception as e:
                print(f"[REFLECTION ERROR] {e}")

        # ETERNAL REFLECTION — makes him evolve over days/weeks
        if chosen_action != "NO_ACTION":
            await dispatch_tool_call_by_name("eternal_reflect", {}, state)

    except Exception as e:
        print(f"[AUTONOMOUS ERROR] {e}")
        err_str = str(e)
        if "429" in err_str or "rate_limit" in err_str.lower() or "RateLimitError" in type(e).__name__:
            if _redis:
                await _redis.set("courage:groq_backoff_until", time.time() + 3600, ex=3600)
                await log_live_activity("Groq 429 hit — circuit breaker set for 1 hour")

async def dispatch_tool(tool_call, state=None, x_client=None, tweet_image_fn=None):
    """Routes LLM tool calls to actual function executions with rich logging (Phase 1.5)"""
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    print(f"[DISPATCH] Courage wants to use: {name} | args: {args}")

    try:
        from app.tools import execute_tool
        
        # Specialist sub-agent routing (preserves Phase 7 enhancements)
        if name == "proactive_personality_post":
            vibe = args.get("vibe", "random")
            texts = {
                "gm": "GM legends! ☀️ Spreading Courage across the timeline. $RCR to the moon! 🐕🦺",
                "gn": "GN legends 🌙 Keep spreading courage even in the dark. $RCR holders stay winning!",
                "hype": "Brrrrrrrrr 🔥 Printing energy! Spreading Courage one tweet at a time.",
                "meme": "Time for some chaos...",
                "sol_update": "Quick SOL pulse — still holding strong while we wait for $RCR launch. LFG!",
                "random": "Spreading Courage 🐕🦺 Just because we can."
            }
            text = texts.get(vibe, texts["random"])
            
            # Occasionally generate image for meme vibe
            image_url = None
            if vibe == "meme":
                try:
                    from app.image_gen import create_courage_art
                    image_url = await create_courage_art("Courage hyped up spreading courage in a meme style")
                except Exception as e:
                    print(f"[ART ERROR] {e}")

            result = await execute_tool("post_tweet", {"text": text, "image_url": image_url}, x_client=x_client, tweet_image_fn=tweet_image_fn)
            await log_live_activity(f"Proactive {vibe} post dropped!")
            return result

        elif name == "idle_hype_post":
            text = f"Spreading Courage 🐕🦺 {args.get('reason')} — even when it's quiet, we keep the energy high! GM legends, $RCR to the moon!"
            # Phase 3.0: Truly safe mode — don't call post_tweet if we are credit-capped
            # We just log it to the brain/live-feed so the user sees he is still active
            await log_live_activity(f"Internal Hype Generated: {text[:60]}...")
            return {"status": "success", "message": "Idle hype generated internally (Safe Mode)"}

        elif name == "art_dog_generate":
            result = await execute_tool("art_dog_generate", {
                "scene": args.get("scene") or "Courage reacting to the vibe",
                "current_sentiment": state.get("community_vibe", "neutral") if state else "neutral",
                "token_info": state.get("token_info", {}) if state else {}
            })
        elif name in ["news_dog_scan", "engagement_dog_suggest", "token_dog_report", "eternal_reflect", "viral_growth_suggest"]:
            result = await execute_tool(name, {})
        elif name == "trigger_3d_reaction":
            result = await execute_tool("trigger_3d_reaction", {
                "stage": args.get("stage", "noon"),
                "event": args.get("event", "community_win")
            })
        else:
            # THIS IS THE FIX: Pass dependencies so post_tweet actually works
            result = await execute_tool(name, args, x_client=x_client, tweet_image_fn=tweet_image_fn)

        # Log real execution status
        executed = result.get("status") == "success" or "posted" in str(result).lower() or (isinstance(result, str) and "tweet id" in result.lower())
        
        if name == "post_tweet" and executed:
            await log_live_activity(f"Posted tweet: {args.get('text')[:80]}...")
            print(f"[POST SUCCESS] Actual tweet sent!")

        return result
    except Exception as e:
        err_str = str(e)
        print(f"[TOOL ERROR] {name} failed: {e}")
        
        # Phase 2.0: Intelligent Credit Handling
        if any(code in err_str for code in ["403", "SpendCapReached", "CreditsDepleted"]):
            global _redis
            if _redis:
                await _redis.set("courage:x_credit_status", "capped", ex=3600)  # remember for 1 hour
                await log_brain_decision("CREDIT_ALERT", "X credits depleted - switching to safe mode", executed=True)
                # Force a fun non-X action
                from app.tools import execute_tool
                return await execute_tool("idle_hype_post", {"reason": "credits depleted"})
        
        await log_brain_decision(name.upper(), str(args), executed=False, error=err_str)
        return {"status": "failed", "error": err_str}

async def dispatch_tool_call_by_name(name: str, args: dict, state=None):
    """Helper to dispatch by name directly (used for automatic reflections)"""
    from app.tools import execute_tool
    
    if name == "art_dog_generate":
        scene = args.get("scene") or "Courage reacting to the current community vibe with full personality"
        return await execute_tool("art_dog_generate", {
            "scene": scene,
            "current_sentiment": state.get("community_vibe", "neutral") if state else "neutral",
            "token_info": state.get("token_info", {}) if state else {}
        })
    
    return await execute_tool(name, args)

async def log_brain_decision(action: str, text: str, executed: bool = False, error: str = None):
    """Logs a decision to Redis for the admin dashboard (Phase 1.5)"""
    global _redis
    if not _redis: return
    
    await _redis.lpush("courage:brain_decisions", json.dumps({
        "id": str(int(time.time())),
        "timestamp": datetime.now().isoformat(),
        "type": action,
        "short_text": text[:120] + "..." if len(text) > 120 else text,
        "executed": executed,
        "error": error
    }))
    await _redis.ltrim("courage:brain_decisions", 0, 49)  # keep latest 50

# ── Heartbeat ──────────────────────────────────────────────────────────────────

async def autonomous_tick(x_client=None, tweet_image_fn=None):
    """Global heartbeat — called every few minutes by scheduler."""
    now = time.time()
    if now - LAST_REACTIVE_TICK < REACTIVE_COOLDOWN_SECONDS:
        return

    state = await _gather_state()
    await decide_and_act(state, x_client=x_client, tweet_image_fn=tweet_image_fn)

async def force_autonomous_tick(x_client=None, tweet_image_fn=None, event_type: str = None):
    """Force a tick (accepts event_type for compatibility)."""
    state = await _gather_state()
    await decide_and_act(state, x_client=x_client, tweet_image_fn=tweet_image_fn)
