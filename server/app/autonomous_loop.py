"""
autonomous_loop.py — Courage's autonomous heartbeat.

Every 18 minutes, Courage wakes up, checks the state of his world,
decides what to do, and acts — all without anyone asking him to.

Architecture (OpenClaw heartbeat model):
  1. State gather  — Redis/SQLite only, zero API calls
  2. Decision      — Groq 8b-instant, structured JSON output
  3. Execution     — run_agent() with ws_emit=None (background mode)
  4. Bookkeeping   — update bucket times, log decision, snapshot goals

This module never raises. ALL exceptions are caught and logged.
The server must never crash because of an autonomous tick.
"""

import json
import re
import time
import datetime
import httpx

from app.config import GROQ_API_KEY, GROQ_MODEL_FAST, REDIS_URL
from app.twitter_memory import get_recent_tweets, get_unreplied_mentions
from app.goal_tracker import (
    get_last_bucket_times, update_bucket_time,
    snapshot_goals, record_autonomous_decision,
    update_autonomous_decision_executed,
)

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

async def _gather_state(redis) -> dict:
    """
    Collect everything needed for the decision step.
    Only reads Redis/SQLite — zero API calls.
    NOW INCLUDES Elite Tier 1 data (trench + $RCR).
    """
    state = {}

    # ── PHASE 1: Check for urgent events in Redis (short-term memory) ──
    try:
        urgent = await redis.get("courage:last_urgent_event") if redis else None
        if urgent:
            state["urgent_event"] = json.loads(urgent)
            # clear after reading
            await redis.delete("courage:last_urgent_event")
    except Exception:
        state["urgent_event"] = None

    # Recent tweets (for deduplication context)
    try:
        recent_tweets = await get_recent_tweets(5)
    except Exception:
        recent_tweets = []

    # Unreplied mentions count
    try:
        unreplied = await get_unreplied_mentions(limit=20)
        unreplied_count = len(unreplied)
    except Exception:
        unreplied_count = 0

    # ── Social Pulse (for Contextual Triage) ──
    mention_pulse = "none"
    try:
        from app.twitter_memory import get_recent_mention_snippets
        mention_pulse = await get_recent_mention_snippets(3)
    except Exception:
        pass

    # ── ELITE TIER 1: TRENCH PULSE ─────────────────────────────────────
    trench_unread_count = 0
    trench_pulse = "none"
    try:
        from app.twitter_memory import get_unprocessed_trench_tweets
        trench_tweets = await get_unprocessed_trench_tweets(limit=8)
        trench_unread_count = len(trench_tweets)
        trench_pulse = "Unprocessed $RCR trenches:\n" + "\n".join(
            f"- @{t['author']}: {t['text'][:80]}" for t in trench_tweets
        ) if trench_tweets else "No new trench activity."
    except Exception:
        pass

    # ── ELITE TIER 1: $RCR HUSTLE ─────────────────────────────────────
    rcr_stats = {"price": 0, "status": "unavailable"}
    try:
        from app.hustle_service import get_rcr_stats
        rcr_stats = await get_rcr_stats()
    except Exception:
        pass

    # ── PHASE 2: Real RAG Context (long-term memory) ─────────────────────
    rag_context = ""
    try:
        from app.rag import retrieve_top_k
        # Pull relevant past trenches + token history
        trench_rag = await retrieve_top_k("community sentiment about $RCR and Courage", k=4, source_filter="trench")
        token_rag = await retrieve_top_k("$RCR price momentum and holder excitement", k=3, source_filter="token")
        rag_context = "Relevant past memory:\n" + "\n".join(
            [f"- {r['content']}" for r in trench_rag + token_rag]
        )
    except Exception:
        rag_context = "no rag memory yet"

    # Active voice sessions
    active_sessions = 0
    if redis:
        try:
            active_sessions = int(await redis.scard("active_voice_sessions") or 0)
        except Exception:
            pass

    # Bucket cooldown status
    bucket_status = {}
    try:
        bucket_times = await get_last_bucket_times()
        now = time.time()
        for bucket, cooldown_min in BUCKET_COOLDOWNS.items():
            last_used = float(bucket_times.get(bucket, 0))
            elapsed_min = (now - last_used) / 60
            bucket_status[bucket] = {
                "elapsed_min": round(elapsed_min, 1),
                "cooled_down": elapsed_min >= cooldown_min,
                "cooldown_min": cooldown_min,
            }
    except Exception:
        bucket_status = {b: {"elapsed_min": 999, "cooled_down": True, "cooldown_min": v}
                         for b, v in BUCKET_COOLDOWNS.items()}

    # Article URLs and Topics Courage has already covered (48h TTL)
    covered_urls: list[str] = []
    covered_topics: list[str] = []
    if redis:
        try:
            covered_urls = await redis.lrange("courage:covered_urls", 0, 29) or []
            covered_topics = await redis.lrange("courage:covered_topics", 0, 19) or []
        except Exception:
            pass

    # ── News Triage (Reasoned Retrieval) ──
    # We pull a larger raw sample from the vault, then triage them for 
    # both 'Panic Index' and 'Relevance' to the current Social Pulse.
    raw_news = []
    try:
        from app.news_cache import get_varied_articles
        raw_news = await get_varied_articles(limit=25, country="", random_sample=True, exclude_urls=covered_urls)
    except Exception:
        pass

    triaged_news = []
    vibe = "neutral"
    if raw_news:
        try:
            # Contextual Triage: Pick news that matters + Detect the 'Vibe'
            triage_result = await _triage_news(raw_news, context=mention_pulse)
            triaged_news = triage_result.get("articles", [])
            vibe = triage_result.get("vibe", "neutral")

            # Filter for high panic OR high relevance (LLM scores these internally)
            triaged_news = [h for h in triaged_news if h["panic_index"] >= PANIC_THRESHOLD]
            # Keep top 6 most interesting
            triaged_news = sorted(triaged_news, key=lambda x: x["panic_index"], reverse=True)[:6]
        except Exception as e:
            print(f"[AUTO] Triage failed: {e}. Falling back to raw news.")
            triaged_news = [
                {"title": a.get("title", "")[:100], "url": a.get("url", ""), "panic_index": 5}
                for a in raw_news[:6]
            ]

    # Crypto headlines (also triage slightly)
    crypto_headlines = []
    try:
        from app.crypto_news import get_cached_crypto_headlines
        crypto = await get_cached_crypto_headlines()
        crypto_headlines = [
            {
                "title":       a.get("title", "")[:100],
                "url":         a.get("url", ""),
                "source_name": a.get("source_name", "Unknown"),
                "panic_index": 7 if "crash" in a.get("title", "").lower() or "pump" in a.get("title", "").lower() else 5
            }
            for a in crypto[:3]
        ]
    except Exception:
        pass

    # Visitor activity count (24h)
    visitor_count = 0
    if redis:
        try:
            visitor_count = int(await redis.llen("courage:visitor_log") or 0)
        except Exception:
            pass

    # Daily autonomous tweet counter
    today = datetime.date.today().isoformat()
    auto_tweets_today = 0
    mention_pulse = "none"
    rate_status = "unknown"
    if redis:
        try:
            auto_tweets_today = int(await redis.get(f"courage:auto_tweets:{today}") or 0)
            
            # Fetch last known rate limits to skip a tool round
            rate_search = await redis.hgetall("rate:/tweets/search/recent")
            rate_post = await redis.hgetall("rate:/statuses/update") # v1.1
            rate_status = f"Search: {rate_search.get('remaining', '?')}, Post: {rate_post.get('remaining', '?')}"
        except Exception:
            pass

    return {
        "recent_tweets":        recent_tweets,
        "unreplied_count":      unreplied_count,
        "active_sessions":      active_sessions,
        "bucket_status":        bucket_status,
        "news_headlines":       triaged_news,
        "crypto_headlines":     crypto_headlines,
        "visitor_count":        visitor_count,
        "auto_tweets_today":    auto_tweets_today,
        "covered_urls":         covered_urls,
        "time_utc":             datetime.datetime.utcnow().strftime("%H:%M"),
        "mention_pulse":        mention_pulse,
        "trench_pulse":         trench_pulse,
        "trench_unread_count":  trench_unread_count,
        "rcr_stats":            rcr_stats,
        "rate_status":          rate_status,
        "covered_topics":       covered_topics,
        "community_vibe":       vibe,
        "urgent_event":         state.get("urgent_event"),
        "rag_context":          rag_context,
    }


# ── Decision step ──────────────────────────────────────────────────────────────

_DECISION_SYSTEM = "Output ONLY valid JSON. No markdown, no explanation outside the JSON object."

_DECISION_TEMPLATE = """\
You are Courage the Cowardly Dog's autonomous brain. You wake up every 18 minutes and decide what to do next on Twitter.
Respond ONLY with valid JSON — no markdown, no extra text.

Current state:
- Time (UTC): {time_utc}
- Unreplied mentions: {unreplied_count}
- Active voice chat sessions RIGHT NOW: {active_sessions}
- Auto tweets posted today: {auto_tweets_today} / {daily_cap} max
- Content bucket status (elapsed / cooldown):
{bucket_status_lines}
- Fresh headlines (Pre-Triaged for high Panic Index):
{news_lines}
- Crypto headlines:
{crypto_lines}
- $RCR MARKET STATS: {rcr_stats}
- TRENCH PULSE ($RCR community): {trench_pulse}
- Unprocessed trench tweets: {trench_unread_count}
- URGENT EVENT (Instant reaction needed!): {urgent_event}
- LONG TERM MEMORY (RAG):
{rag_context}
- SOCIAL PULSE (Latest mentions): {mention_pulse}
- COMMUNITY VIBE (Community mood): {community_vibe}
- CURRENT X RATE LIMITS: {rate_status}
- RECENTLY DISCUSSED TOPICS (Avoid repeating these): {topic_history}
- Last 3 tweets:
{recent_tweet_lines}

Decision rules:
1. SKIP if active_sessions > 0.
2. REPLY_MENTIONS if unreplied_count > 2 OR if the Social Pulse indicates someone is talking directly to you.
3. Only pick cooled_down = true buckets.
4. Aim for variety. Do NOT repeat topics listed in RECENTLY DISCUSSED TOPICS.
5. If confidence < 0.5, SKIP.
6. If the Social Pulse contains $RCR questions, prioritize SOCIAL or RANDOM bucket to address them.
7. Use TRENCH_READING if trench_unread_count > 0 and you have time for community work.
8. Use TOKEN_HUSTLE to update holders on $RCR stats from DexScreener.

Valid actions: TWEET_NEWS, TWEET_CRYPTO, REPLY_MENTIONS, RANDOM, WORLD_UPDATE, SOCIAL, TRENCH_READING, TOKEN_HUSTLE, SKIP

Response format (exactly this JSON structure):
{{
  "action": "TWEET_NEWS", 
  "bucket": "NEWS", 
  "reasoning": "Panic about X story because users in mentions are worried...", 
  "confidence": 0.85,
  "article_url": "https://...",
  "topic_keyword": "Topic name (1-2 words)"
}}

confidence: 0.0–1.0. High = clear obvious action. Low = uncertain, nothing great to post, or weak reasoning.
Ticks with confidence < 0.5 are automatically skipped — be honest.
"""


async def _decide(state: dict) -> dict:
    """Call Groq 8b-instant with a compact state summary. Returns decision dict."""
    bucket_lines = "\n".join(
        f"  {b}: {v['elapsed_min']}m elapsed / {v['cooldown_min']}m cooldown → {'READY' if v['cooled_down'] else 'COOLING'}"
        for b, v in state["bucket_status"].items()
    )
    news_lines = "\n".join(
        f"  - [Panic: {h.get('panic_index', 5)}/10] {h['title']} [{h['url']}] ({h['source_name']})" for h in state["news_headlines"]
    ) or "  (no news cached yet)"

    crypto_lines = "\n".join(
        f"  - {h['title']} [{h['url']}] ({h['source_name']})" for h in state["crypto_headlines"]
    ) or "  (no crypto news cached yet)"

    recent_tweet_lines = "\n".join(
        f"  - {t.get('text', '')[:100]}" for t in state["recent_tweets"][:3]
    ) or "  (none yet)"

    prompt = _DECISION_TEMPLATE.format(
        time_utc=state["time_utc"],
        unreplied_count=state["unreplied_count"],
        active_sessions=state["active_sessions"],
        auto_tweets_today=state["auto_tweets_today"],
        daily_cap=DAILY_AUTO_TWEET_CAP,
        bucket_status_lines=bucket_lines,
        news_lines=news_lines,
        crypto_lines=crypto_lines,
        recent_tweet_lines=recent_tweet_lines,
        mention_pulse=state["mention_pulse"],
        community_vibe=state["community_vibe"],
        rate_status=state["rate_status"],
        topic_history=", ".join(state["covered_topics"]) or "none",
        trench_pulse=state["trench_pulse"],
        trench_unread_count=state["trench_unread_count"],
        rcr_stats=state["rcr_stats"],
        urgent_event=state["urgent_event"] or "None",
        rag_context=state["rag_context"]
    )

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL_FAST,
        "messages": [
            {"role": "system", "content": _DECISION_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "temperature": 0.6,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers=headers,
        )
        r.raise_for_status()

    raw = r.json()["choices"][0]["message"]["content"]
    decision = _bulletproof_parse(raw)
    if not decision or not isinstance(decision, dict):
        return {"action": "SKIP", "reasoning": "Parse failure", "confidence": 0}
    return decision


async def _triage_news(articles: list[dict], context: str = "none") -> dict:
    """Uses a fast model round to assign Panic Index and detect community vibe."""
    if not articles: return {"articles": [], "vibe": "neutral"}
    
    headlines_text = "\n".join([f"[{i}] {a.get('title')}" for i, a in enumerate(articles)])
    
    prompt = (
        "You are the 'Reasoned Retrieval' filter for Courage AI. "
        "Score each headline below on a 'Panic Index' (0-10).\n"
        "10 = Extremely scary, global impact, or directly answers a concern in the SOCIAL PULSE.\n"
        "5 = Standard news.\n"
        "0 = Boring or irrelevant.\n\n"
        f"SOCIAL PULSE (Latest mentions): {context}\n\n"
        "MISSION: \n"
        "1. Score headlines by panic/relevance.\n"
        "2. Summarize the 'Community Vibe' (1 sentence) based on the Social Pulse.\n\n"
        "Format: Return ONLY a JSON object with 'articles' (list of {index, panic_score}) and 'vibe' (string).\n\n"
        f"Headlines:\n{headlines_text}"
    )
    
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": GROQ_MODEL_FAST,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
            r.raise_for_status()
            raw_content = r.json()["choices"][0]["message"]["content"]
            
            data = _bulletproof_parse(raw_content)
            if not data:
                return {"articles": [], "vibe": "neutral"}
            
            scores = data.get("articles", [])
            vibe = data.get("vibe", "neutral")

            print(f"[TRIAGE] Parsed {len(scores)} scores from LLM. Vibe: {vibe}")
            
            # Merge back
            triaged = []
            for s in scores:
                idx = s.get("index")
                if idx is not None and idx < len(articles):
                    a = articles[idx]
                    triaged.append({
                        "title": a.get("title", ""),
                        "url": a.get("url", ""),
                        "source_name": a.get("source_name", "Unknown"),
                        "panic_index": s.get("panic_score", 5)
                    })
            return {"articles": triaged, "vibe": vibe}
        except Exception as e:
            print(f"[TRIAGE] Failed to parse or fetch: {e}")
            return {"articles": [], "vibe": "neutral"}

# ── Execution step ─────────────────────────────────────────────────────────────

async def _execute(decision: dict, state: dict, x_client, tweet_image_fn) -> str | None:
    """Build a proactive prompt and call run_agent() in background mode."""
    from app.agent import run_agent

    action = decision.get("action", "SKIP")
    if action == "SKIP":
        return None

    # Direct Handoff: Find the article object that matches the decision
    target_article = None
    chosen_url = decision.get("article_url")
    if chosen_url:
        all_headlines = state.get("news_headlines", []) + state.get("crypto_headlines", [])
        for h in all_headlines:
            if h.get("url") == chosen_url:
                target_article = h
                break

    base_prompt = ACTION_PROMPTS.get(action, ACTION_PROMPTS["RANDOM"])

    recent_summary = " | ".join(
        t.get("text", "")[:80] for t in state["recent_tweets"][:3]
    ) or "none yet"

    # Inject already-covered URLs
    covered_note = ""
    covered = state.get("covered_urls", [])
    if covered:
        covered_note = f"\n[Already covered: {' | '.join(covered[:5])}]"

    proactive_prompt = (
        f"{base_prompt}\n\n"
        f"[Current X Rate Status: {state.get('rate_status', 'unknown')}]\n"
        f"[Autonomous Decision: {decision.get('reasoning', '')}]\n"
        f"[Recent tweets to avoid: {recent_summary}]"
        f"{covered_note}\n\n"
        f"IMPORTANT: I've already checked your rate limits (see above). If they look okay, "
        f"do NOT call get_x_rate_status. Just post the tweet directly."
    )

    return await run_agent(
        user_message=proactive_prompt,
        history=[],
        x_client=x_client,
        tweet_image_fn=tweet_image_fn,
        world_context=None,
        ws_emit=None,
        max_tool_rounds=3,
        compact=True,
        target_article=target_article, # The Direct Handoff
        community_vibe=state.get("community_vibe"),
    )


# ── Main tick ──────────────────────────────────────────────────────────────────

async def autonomous_tick(x_client=None, tweet_image_fn=None, force=False):
    """
    Single autonomous heartbeat tick. Called by APScheduler every 60 minutes.
    ALL exceptions are caught — this MUST never crash the server.
    """
    tick_start = datetime.datetime.utcnow().isoformat()
    print(f"[AUTO] Autonomous tick starting at {tick_start}")

    # ── PHASE 4: VOICE PRIORITY OVERRIDE (P1) ─────────────────────
    from app.voice_priority import voice_priority_guard
    if await voice_priority_guard():
        return  # voice is live — skip entire tick

    # 0. Circuit breaker: skip if we're in a Groq 429 backoff window.
    #    Checking this at the very top prevents burning ANY resources if we're locked out.
    redis = None
    try:
        from app.redis_utils import get_redis_client
        redis = await get_redis_client()
        if redis:
            # Mark running
            await redis.set("courage:autonomous_running", "1")
            
            backoff_until = await redis.get("courage:groq_backoff_until")
            if backoff_until and time.time() < float(backoff_until):
                remaining_min = int((float(backoff_until) - time.time()) / 60)
                streak = int(await redis.get("courage:groq_429_streak") or "0")
                print(f"[AUTO] Groq 429 circuit breaker active (streak={streak}, {remaining_min}m remaining). Skipping tick.")
                await redis.set("courage:autonomous_running", "0")
                return
    except Exception as e:
        print(f"[AUTO] Circuit breaker/Redis check failed: {e}")

    try:
        # 1. Gather state (no API calls)
        state = await _gather_state(redis)

        # ── PHASE 3 + MULTI-REFERENCE NEWS/GAME CONTEXT ─────────────────────
        if force and state.get("urgent_event"):
            from app.events import trigger_realtime_art
            event = state["urgent_event"]
            if event["type"] == "MARKET_SURGE":
                prompt = "Courage shocked and pumping hard"
                news_image_url = None
                game_ctx = None
            elif event["type"] == "GAME_MOMENT":
                prompt = "Courage cheering wildly for a player"
                news_image_url = None
                game_ctx = event["payload"].get("text", "epic monster moment")
            elif event["type"] == "NEWS_MOMENT":   # new support
                prompt = "Courage reacting to dramatic news"
                news_image_url = event["payload"].get("image_url")   # from news tool
                game_ctx = None
            else:
                prompt = "Courage being brave"
                news_image_url = None
                game_ctx = None

            await trigger_realtime_art(prompt, news_image_url=news_image_url, game_context=game_ctx)

        print(
            f"[AUTO] State — sessions: {state['active_sessions']}, "
            f"unreplied: {state['unreplied_count']}, "
            f"auto_tweets_today: {state['auto_tweets_today']}"
        )

        # 2. Hard skip conditions
        if not force:
            if state["auto_tweets_today"] >= DAILY_AUTO_TWEET_CAP:
                print(f"[AUTO] Daily cap reached ({DAILY_AUTO_TWEET_CAP}). Skipping.")
                return

            if state["active_sessions"] > 0:
                # Someone is chatting — be conservative, but still reply to urgent mentions
                if state["unreplied_count"] <= 2:
                    print(f"[AUTO] {state['active_sessions']} active voice session(s). Skipping non-urgent tick.")
                    return

        try:
            decision = await _decide(state)
        except Exception as e:
            # If the decision step itself hits a 429, arm the breaker immediately.
            if "429" in str(e) and redis:
                try:
                    streak = int(await redis.get("courage:groq_429_streak") or "0") + 1
                    await redis.setex("courage:groq_429_streak", 86400, str(streak))
                    backoff_min = min(30 * (2 ** (streak - 1)), 240)
                    backoff_until = time.time() + backoff_min * 60
                    await redis.setex("courage:groq_backoff_until", int(backoff_min * 60 + 120), str(backoff_until))
                    print(f"[AUTO] Groq 429 hit during _decide. Streak={streak}. Circuit breaker armed: {backoff_min}m backoff.")
                except Exception:
                    pass
            
            import traceback
            print(f"[AUTO] Decision step failed: {e}. Skipping tick.")
            traceback.print_exc()
            return

        action     = decision.get("action", "SKIP")
        bucket     = decision.get("bucket", "SKIP")
        reasoning  = decision.get("reasoning", "")
        confidence = float(decision.get("confidence", 1.0))
        print(f"[AUTO] Decision — action={action} bucket={bucket} confidence={confidence:.2f} | {reasoning}")

        # 4a. Confidence gate — skip weak decisions before burning execution resources
        if not force and confidence < 0.5:
            print(f"[AUTO] Low confidence ({confidence:.2f}). Skipping tick.")
            return

        # 4b. Log the decision (best-effort); capture row id for later update
        decision_id: int | None = None
        try:
            decision_id = await record_autonomous_decision(
                action, 
                bucket, 
                reasoning, 
                confidence=confidence, 
                topic=decision.get("topic_keyword", "")
            )
        except Exception as e:
            print(f"[AUTO] Decision logging failed (non-fatal): {e}")

        if action == "SKIP":
            print("[AUTO] Decided to SKIP this tick.")
            return

        # 5. Double-check bucket cooldown (LLM can occasionally ignore rules)
        if not force and bucket in BUCKET_COOLDOWNS:
            try:
                bucket_times = await get_last_bucket_times()
                last_used    = float(bucket_times.get(bucket, 0))
                elapsed_min  = (time.time() - last_used) / 60
                if elapsed_min < BUCKET_COOLDOWNS[bucket]:
                    print(
                        f"[AUTO] Bucket {bucket} still cooling "
                        f"({elapsed_min:.1f}m < {BUCKET_COOLDOWNS[bucket]}m). Skipping."
                    )
                    return
            except Exception:
                pass  # If check fails, proceed anyway

        # 6a. Pre-mark the article URL and Topic Keyword as covered
        if redis:
            try:
                chosen_url = decision.get("article_url", "")
                if chosen_url:
                    await redis.lpush("courage:covered_urls", chosen_url)
                    await redis.ltrim("courage:covered_urls", 0, 29)
                    await redis.expire("courage:covered_urls", 172800)
                
                topic = decision.get("topic_keyword", "").lower().strip()
                if topic:
                    await redis.lpush("courage:covered_topics", topic)
                    await redis.ltrim("courage:covered_topics", 0, 19) # last 20 topics
                    await redis.expire("courage:covered_topics", 172800)
            except Exception:
                pass

        # 6b. Guard: skip execution if Groq budget is already exhausted
        from app.agent import _groq_budget_ok
        if not _groq_budget_ok():
            print("[AUTO] Groq token budget exhausted — skipping execution this tick.")
            return

        # 6c. Execute via run_agent (max 4 tool rounds in autonomous mode)
        result = None
        execution_exception = None
        try:
            result = await _execute(decision, state, x_client, tweet_image_fn)
            print(f"[AUTO] Execution complete. Result snippet: {(result or '')[:120]}")
        except Exception as e:
            execution_exception = e
            print(f"[AUTO] Execution failed: {e}")

        # 6d. Detect budget-exhausted placeholder — no tweet was posted, skip bookkeeping
        _BUDGET_MARKER = "burned through all my thinking power"
        if result and _BUDGET_MARKER in result:
            print("[AUTO] Groq budget hit during execution — no tweet posted, skipping bookkeeping.")
            return

        # 6e. If execution threw an exception, check if a tweet was actually posted before the error
        #     (Groq 429 can occur AFTER a successful tweet post — we still want to record the tweet)
        tweet_confirmed = result is not None and execution_exception is None
        if execution_exception and not tweet_confirmed:
            # 429 from Groq: arm the circuit breaker so we stop hammering the rate limit.
            # Exponential backoff: 30m, 60m, 120m, 240m (capped).
            if "429" in str(execution_exception) and redis:
                try:
                    streak = int(await redis.get("courage:groq_429_streak") or "0") + 1
                    await redis.setex("courage:groq_429_streak", 86400, str(streak))
                    backoff_min = min(30 * (2 ** (streak - 1)), 240)
                    backoff_until = time.time() + backoff_min * 60
                    await redis.setex("courage:groq_backoff_until", int(backoff_min * 60 + 120), str(backoff_until))
                    print(f"[AUTO] Groq 429 streak={streak}. Circuit breaker armed: {backoff_min}m backoff.")
                except Exception:
                    pass

            try:
                from app.twitter_memory import get_recent_tweets
                recent = await get_recent_tweets(1)
                if recent and time.time() - float(recent[0].get("created_at", 0)) < 180:
                    tweet_confirmed = True
                    print("[AUTO] Execution threw but tweet was found — proceeding with bookkeeping.")
            except Exception:
                pass
            if not tweet_confirmed:
                return  # Nothing was posted — no bookkeeping

        # 7. Increment daily autonomous tweet counter
        if redis:
            try:
                today_key = f"courage:auto_tweets:{datetime.date.today().isoformat()}"
                await redis.incr(today_key)
                await redis.expire(today_key, 86400)
            except Exception as e:
                print(f"[AUTO] Tweet counter update failed (non-fatal): {e}")

        # 8. Update bucket last-used time
        if bucket and bucket != "SKIP":
            try:
                await update_bucket_time(bucket)
            except Exception as e:
                print(f"[AUTO] Bucket time update failed (non-fatal): {e}")

        # 9. Mark decision as executed — link to the tweet just posted (best-effort)
        if decision_id and result:
            try:
                from app.twitter_memory import get_recent_tweets
                recent = await get_recent_tweets(1)
                if recent:
                    latest = recent[0]
                    # Only claim this tweet if it was posted within the last 2 minutes
                    if time.time() - float(latest.get("created_at", 0)) < 120:
                        await update_autonomous_decision_executed(
                            decision_id, latest.get("tweet_id", "")
                        )
            except Exception as e:
                print(f"[AUTO] Decision executed-update failed (non-fatal): {e}")

        # 10. Daily goal snapshot — one X API read per day, not per tick
        today_str     = datetime.date.today().isoformat()
        snapshot_flag = f"courage:goal_snapshot:{today_str}"
        already_done  = False
        if redis:
            try:
                already_done = bool(await redis.get(snapshot_flag))
            except Exception:
                pass

        if not already_done and x_client:
            try:
                resp = x_client.get_my_profile()
                if resp and resp.data:
                    u       = resp.data
                    metrics = u.public_metrics or {}
                    await snapshot_goals(
                        follower_count  = metrics.get("followers_count",  0),
                        tweet_count     = metrics.get("tweet_count",      0),
                        following_count = metrics.get("following_count",  0),
                    )
                    if redis:
                        await redis.set(snapshot_flag, "1", ex=86400)
                    print("[AUTO] Daily goal snapshot taken.")
            except Exception as e:
                print(f"[AUTO] Goal snapshot failed (non-fatal): {e}")

        # 11. Clear Groq 429 circuit breaker — execution succeeded, streak is over.
        if redis:
            try:
                await redis.delete("courage:groq_backoff_until")
                await redis.delete("courage:groq_429_streak")
            except Exception:
                pass

        print("[AUTO] Tick complete.")

    except Exception as e:
        # Absolute last-resort safety net — NEVER crash the server
        import traceback
        print(f"[AUTO] Unexpected error in autonomous tick: {e}")
        traceback.print_exc()


# Global reference so sensors can trigger it
FORCE_TICK_CALLBACK = None
LAST_REACTIVE_TICK = 0

async def force_autonomous_tick(x_client, tweet_image_fn):
    """Called by urgent event listener — runs a full decision tick immediately."""
    global LAST_REACTIVE_TICK
    now = time.time()
    if now - LAST_REACTIVE_TICK < 60:
        print(f"[REACTIVE] Cooldown active ({int(60 - (now - LAST_REACTIVE_TICK))}s remaining) — skipping duplicate tick.")
        return
    
    LAST_REACTIVE_TICK = now
    print("[REACTIVE] Urgent event received — forcing immediate tick!")
    await autonomous_tick(x_client=x_client, tweet_image_fn=tweet_image_fn, force=True)
