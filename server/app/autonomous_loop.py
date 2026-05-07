"""
autonomous_loop.py — Courage's autonomous heartbeat.

Every 18 minutes, Courage wakes up, checks the state of his world,
decides what to do, and acts — all without anyone asking him to.

Architecture (OpenClaw heartbeat model):
  1. State gather  — Redis/SQLite only, zero API calls
  2. Decision      — Groq 8b-instant, structured JSON output
  3. Execution     — run_agent() with ws_emit=None (background mode)
  4. Bookkeeping   — update bucket times, log decision, snapshot goals

The server must never crash because of an autonomous tick.
"""

import json
import time
import datetime
from app.config import GROQ_API_KEY, REDIS_URL

from app.goal_tracker import (
    get_last_bucket_times, update_bucket_time,
    snapshot_goals, record_autonomous_decision,
    update_autonomous_decision_executed,
)
from app.voice_priority import is_voice_active
from app.twitter_memory import (
    get_unprocessed_trench_count,
    get_recent_unprocessed_trenches
)
from app.hustle_service import get_rcr_stats
from app.news_cache import get_latest_news_articles
from app.rag import retrieve_top_k
from app.system_prompt import SYSTEM_PROMPT
from app.tools import TOOL_SCHEMAS
from app.image_gen import create_courage_art
from app.engagement_queue import queue_post_with_media
from groq import AsyncGroq

# ── Phase 5 Globals ───────────────────────────────────────────────────────────
groq_client = AsyncGroq(api_key=GROQ_API_KEY)
LAST_REACTIVE_TICK = 0
REACTIVE_COOLDOWN_SECONDS = 300 # 5m safety
_redis = None

# ── Bucket cooldowns (minutes between uses of the same bucket) ─────────────────
BUCKET_COOLDOWNS = {
    "RANDOM": 120,   # 2h — spontaneous but not spammy
    "WORLD":   60,   # 1h — world updates
    "NEWS":    60,   # 1h — news reactions
    "SOCIAL": 180,   # 3h — replies/shoutouts (don't be creepy)
    "CRYPTO":  90,   # 90m — crypto reactions
}

DAILY_AUTO_TWEET_CAP = 25   # Paid plan — generous but not spam
PANIC_THRESHOLD = 6         # Only consider news with Panic Index >= 6


# ── Action prompts sent to run_agent as the "user message" ─────────────────────
ACTION_PROMPTS = {
    "TWEET_NEWS": (
        "You have decided to react to a specific news story. *ears perk up* "
        "Craft a Courage-voiced reaction tweet using the Target News Story in your memory. "
        "Focus ONLY on that story. Check get_x_rate_status first. Post the tweet. Record it."
    ),
    "TWEET_CRYPTO": (
        "You have decided to react to a crypto headline. *shivers* "
        "Craft a Courage-voiced reaction tweet about it using the info in your memory. "
        "Check get_x_rate_status first. Post the tweet. Record it."
    ),
    "REPLY_MENTIONS": (
        "You have unreplied mentions — people talked to you and you haven't written back! "
        "Call get_mentions to see them. Pick the most interesting one and reply as Courage. "
        "Be warm, brave, and in character. Check get_x_rate_status first. "
        "Reply using post_tweet with reply_to_id. Record it with record_twitter_action."
    ),
    "RANDOM": (
        "You are awake, alone in your digital farmhouse. No particular mission. Just... being Courage. "
        "What is on your mind right now? "
        "Tweet something random and genuine — a Courage-brain thought, "
        "an observation about being an AI dog, something existential but brave. "
        "Check get_x_rate_status first. Keep it punchy — 1-2 sentences. Record it."
    ),
    "WORLD_UPDATE": (
        "The 3D worlds are running right now — the disco, the farmhouse at evening, the sunrise run. "
        "Write a tweet about what it is like in one of your worlds. Set the scene. "
        "Be the director and the dog. Make people curious about visiting. "
        "Mention your world subtly without being an ad about it. "
        "Check get_x_rate_status first. Record after posting."
    ),
    "SOCIAL": (
        "Time for some social connection. Check get_twitter_memory to see recent mentions. "
        "Or use search_tweets to search '$RCR' and see who is talking about you. "
        "Write a Courage-voiced social tweet — grateful, dramatic, warm — inspired by what you find. "
        "Encourage people to visit your world or follow you, but gently. Like a tail wag, not a shout. "
        "Check get_x_rate_status first. Record the tweet."
    ),
    "TRENCH_READING": (
        "You are sitting down in your free time to read the $RCR trenches. "
        "Call get_trench_pulse to see what the community is saying. "
        "Pick 1-2 interesting tweets and craft smart, funny, in-character replies. "
        "Use create_courage_art if you want to attach a cartoon. "
        "Queue them safely with the engagement queue."
    ),
    "TOKEN_HUSTLE": (
        "Check on $RCR performance. Call get_rcr_stats. "
        "If we are pumping, tweet an encouraging update. "
        "Always include yesterday vs today delta. Be brave for the holders!"
    ),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _bulletproof_parse(raw: str):
    """Strip markdown, find JSON boundaries, and attempt to wrap in braces if needed."""
    try:
        from typing import Optional
        import json
        clean = raw.strip()
        if "```json" in clean:
            clean = clean.split("```json")[1].split("```")[0].strip()
        elif "```" in clean:
            clean = clean.split("```")[1].split("```")[0].strip()

        start_bracket = clean.find("[")
        start_brace = clean.find("{")
        
        # Determine the start of the JSON object/list
        if start_bracket == -1: start = start_brace
        elif start_brace == -1: start = start_bracket
        else: start = min(start_bracket, start_brace)
        
        end_bracket = clean.rfind("]")
        end_brace = clean.rfind("}")
        end = max(end_bracket, end_brace)
        
        if start != -1 and end != -1:
            clean = clean[start:end+1]
        elif '"action"' in clean and "{" not in clean:
            # Emergency: AI sent key-value but forgot braces
            clean = "{" + clean + "}"

        return json.loads(clean)
    except Exception as e:
        print(f"[PARSER ERROR] Failed to decode JSON: {e}")
        print(f"[PARSER ERROR] Raw Content: {raw}")
        return None

# ── State gathering ────────────────────────────────────────────────────────────

async def _gather_state():
    """PHASE 5: Rich state for full autonomous decisions."""
    global _redis
    if _redis is None:
        from app.redis_utils import get_redis_client
        _redis = await get_redis_client()

    state = {
        "voice_active": await is_voice_active(),
        "reply_queue_size": await _redis.llen("courage:reply_queue") if _redis else 0,
        "unread_trenches": await get_unprocessed_trench_count(),
        "recent_trenches_sample": await get_recent_unprocessed_trenches(limit=5),
        "rcr_stats": await get_rcr_stats(),
        "recent_news": await get_latest_news_articles(limit=3),
        "last_game_moment": await _redis.get("courage:last_game_moment") or "none" if _redis else "none",
        "rag_context": await retrieve_top_k("trench OR hustle OR news", k=6),
        "current_time": datetime.datetime.now().isoformat(),
        "cooldown_remaining": max(0, REACTIVE_COOLDOWN_SECONDS - (time.time() - LAST_REACTIVE_TICK)),
    }
    return state

async def decide_and_act(state: dict):
    """PHASE 5 CORE: Courage decides what to do autonomously."""
    global LAST_REACTIVE_TICK
    
    if state["voice_active"]:
        print("[VOICE PRIORITY] Skipping autonomous actions — voice session active")
        return

    if state["cooldown_remaining"] > 0:
        print(f"[COOLDOWN] {state['cooldown_remaining']:.0f}s remaining")
        return

    # PHASE 5.4 SAFETY: Max 1 autonomous post every 6 minutes globally
    last_post = await _redis.get("courage:last_autonomous_post")
    if last_post and (time.time() - float(last_post)) < 360:
        print("[SAFETY] Global post cooldown active — skipping")
        return

    # Build prompt for LLM to choose action
    prompt = f"""
    Current state:
    - Unread trenches: {state['unread_trenches']}
    - SOL/$RCR delta: {state['rcr_stats'].get('change_24h', 0):.2f}%
    - Recent news: {len(state['recent_news'])} articles
    - Last game moment: {state['last_game_moment']}
    
    Decide the SINGLE best action right now and call the appropriate tool.
    Be courageous, witty, and meme-native. Prioritize community value and $RCR growth.
    """

    # Call Groq with tools (this is the new autonomous brain)
    try:
        response = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            tools=TOOL_SCHEMAS,
            tool_choice="auto"
        )

        # Dispatch the chosen tool
        if response.choices[0].message.tool_calls:
            tool_call = response.choices[0].message.tool_calls[0]
            await dispatch_tool(tool_call)
            print(f"[AUTONOMOUS] Decided: {tool_call.function.name}")
            LAST_REACTIVE_TICK = time.time()
        else:
            print("[AUTONOMOUS] No action needed right now")
    except Exception as e:
        print(f"[AUTONOMOUS ERROR] {e}")

async def dispatch_tool(tool_call):
    """PHASE 5.4: Full dispatch with activity logging + safety."""
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    # Log to Redis stream for dashboard live feed
    await _redis.xadd("courage:activity_log", {
        "type": name,
        "msg": f"{name} → {str(args)[:120]}",
        "timestamp": datetime.datetime.now().isoformat()
    }, maxlen=100)  # keep last 100 events only

    if name == "auto_reply_with_art":
        trench_ids = args.get("trench_ids", [])
        reply_text = args.get("reply_text")
        art_prompt = args.get("art_prompt")
        
        # Generate cartoon using base image + context
        art_url = await create_courage_art_realtime(art_prompt)
        await queue_post_with_media(reply_text, art_url, reply_to_tweet_id=trench_ids[0] if trench_ids else None)
        print(f"[AUTONOMOUS] 📸 Queued smart reply with art for {len(trench_ids)} trenches")
        
    elif name == "auto_hustle_post":
        post_text = args.get("post_text")
        art_prompt = args.get("art_prompt", "Courage celebrating $RCR with community")
        art_url = await create_courage_art_realtime(art_prompt) if art_prompt else None
        await queue_post_with_media(post_text, art_url)
        print(f"[AUTONOMOUS] 💎 Queued token hustle post")
        
    elif name == "auto_news_react":
        post_text = f"🚨 {args.get('news_title')} — Courage reacts!"
        # Reuse existing poster or generate new
        await queue_post_with_media(post_text, args.get("poster_url"))
        print(f"[AUTONOMOUS] 📰 Queued news reaction")

    # Mark last post time for safety cooldown
    await _redis.set("courage:last_autonomous_post", time.time())

async def autonomous_tick(x_client=None, tweet_image_fn=None):
    """PHASE 5: Full autonomous decision tick."""
    print(f"[AUTO] Autonomous tick starting at {datetime.datetime.now()}")
    
    state = await _gather_state()
    await decide_and_act(state)

async def force_autonomous_tick(x_client=None, tweet_image_fn=None, event_type: str = "unknown"):
    """Urgent event trigger — runs a full tick immediately."""
    print(f"[REACTIVE] Processing urgent {event_type} tick")
    await autonomous_tick()
