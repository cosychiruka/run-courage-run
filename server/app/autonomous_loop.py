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


async def _generate_personality_post(
    vibe: str, time_ctx: dict, community_vibe: str, game_moments: list
) -> str | None:
    """Groq-authored personality post — makes idle ticks sound alive, not canned."""
    hour  = time_ctx.get("hour", 12)
    phase = time_ctx.get("day_phase", "noon")
    energy = time_ctx.get("energy", "midday grind")
    day   = time_ctx.get("day_of_week", "Friday")

    shoutout = ""
    if game_moments:
        players = " ".join(f"@{m.get('author', 'someone')}" for m in game_moments[:2])
        shoutout = f"\nPlayers just visited the Homestead: {players} — mention them in the tweet!"

    prompt = (
        f"You are Courage the Cowardly Dog. Write ONE tweet for a {vibe} post.\n"
        f"Time: {hour}:00 {day}, {phase} phase — {energy}\n"
        f"Community vibe: {community_vibe}\n"
        f"{shoutout}\n"
        "Rules:\n"
        "- Max 240 chars\n"
        "- Include 1 sound effect (*whimper* / *gulp* / *gasp*) or a classic Courage catchphrase\n"
        "- Include $RCR and 1-2 relevant emojis\n"
        "- Sound alive and fun — never robotic, never generic\n"
        "- No external URLs\n"
        "Tweet text only (no quotes, no extra commentary):"
    )
    try:
        resp = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=110,
            temperature=0.93,
        )
        text = resp.choices[0].message.content.strip().strip('"').strip("'")
        import re as _re
        text = _re.sub(r'https?://\S+', '', text).strip()
        return text[:240] if text else None
    except Exception as e:
        print(f"[PERSONALITY_POST] LLM gen failed: {e}")
        return None

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

    # Surface the highest-signal alerts above the JSON blob so LLM sees them first
    game_alert = ""
    if state.get("game_moments"):
        players = ", ".join("@" + m.get("author", "?") for m in state["game_moments"][:3])
        game_alert = f"\n⚡⚡ GAME MOMENTS — Players just engaged: {players} — SHOUT THEM OUT NOW with post_tweet!\n"

    top_story = state["news"][0] if state.get("news") else None
    news_alert = ""
    if top_story and state.get("top_news_signal", 0) >= 60:
        news_alert = (
            f"\n🔥 HIGH SIGNAL NEWS (score={state['top_news_signal']}/80): "
            f"\"{top_story['title'][:80]}\" — REACT with auto_news_react!\n"
        )

    t = state.get("time_context", {})
    credit_note = state.get("credit_alert", state.get("credit_override", "healthy"))

    decision_prompt = f"""== AUTONOMOUS DECISION ==
You are Courage. Pick the SINGLE best action right now.
{game_alert}{news_alert}
🕐 {t.get('day_of_week','')} {t.get('day_phase','')} | {t.get('energy','')} | Hour {t.get('hour','')}
💬 Trenches waiting: {state.get('unreplied_trenches_count', 0)} | Mode: {state.get('mode', 'normal')} | Credits: {credit_note}
📰 Top news signal: {state.get('top_news_signal', 0)}/80 | Auto tweets today: {state.get('auto_tweets_today', 0)}

Full context (JSON):
{context}

Follow the DECISION TREE from your system prompt. Be decisive. Act now.
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
            time_ctx      = state.get("time_context", {}) if state else {}
            community_vibe = state.get("community_vibe", "quiet") if state else "quiet"
            game_moments  = state.get("game_moments", []) if state else []

            # LLM writes the post — falls back to canned text only if Groq fails
            text = await _generate_personality_post(vibe, time_ctx, community_vibe, game_moments)
            if not text:
                _FALLBACK = {
                    "gm":        "GM legends! ☀️ *wags tail* Spreading Courage. $RCR to the moon! 🐕🦺",
                    "gn":        "GN legends 🌙 *whimper* $RCR holders rest easy, we're gonna make it.",
                    "hype":      "Brrrrrrrr 🔥 *gulp* Printing energy! Spreading Courage. $RCR LFG!",
                    "meme":      "*gasp* Time for some chaos... $RCR Spreading Courage 🐕🦺 MMGA!",
                    "sol_update":"SOL pulse check — holding strong. $RCR launch incoming. The things I do for love...",
                    "random":    "Spreading Courage 🐕🦺 *wags tail* $RCR Just because we can. MMGA!",
                }
                text = _FALLBACK.get(vibe, _FALLBACK["random"])

            # Generate art for meme vibe
            image_url = None
            if vibe == "meme":
                try:
                    from app.image_gen import create_courage_art
                    image_url = await create_courage_art(
                        "Courage the Cowardly Dog spreading pure chaotic meme energy, surprised expression, vibrant cartoon art"
                    )
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
        elif name == "engagement_dog_suggest":
            result = await execute_tool("engagement_dog_suggest", {})
            # Auto-queue replies immediately — LLM only gets 1 tool call per tick
            if isinstance(result, dict) and result.get("suggested_replies"):
                trench_ids = [
                    s["tweet_id"] for s in result["suggested_replies"][:2]
                    if s.get("tweet_id")
                ]
                if trench_ids:
                    try:
                        community_vibe = state.get("community_vibe", "neutral") if state else "neutral"
                        await execute_tool("auto_reply_with_art", {
                            "trench_ids": trench_ids,
                            "reply_text": "Spreading Courage 🐕🦺 $RCR LFG! The things I do for love...",
                            "art_prompt": (
                                f"Courage the Cowardly Dog excited and waving at the community. "
                                f"Vibe: {community_vibe}"
                            ),
                        }, x_client=x_client, tweet_image_fn=tweet_image_fn)
                        await log_live_activity(f"Auto-queued {len(trench_ids)} trench repl(ies) from engagement_dog_suggest")
                    except Exception as eq_err:
                        print(f"[ENGAGEMENT AUTO-QUEUE] Failed: {eq_err}")

        elif name in ["news_dog_scan", "token_dog_report", "eternal_reflect", "viral_growth_suggest"]:
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
