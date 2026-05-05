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
}


# ── State gathering ────────────────────────────────────────────────────────────

async def _gather_state(redis) -> dict:
    """
    Collect everything needed for the decision step.
    Only reads Redis/SQLite — zero API calls.
    """
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

    # Article URLs Courage has already covered (capped Redis list, 48h TTL)
    # MUST be fetched before news_headlines so exclude_urls filter works
    covered_urls: list[str] = []
    if redis:
        try:
            covered_urls = await redis.lrange("courage:covered_urls", 0, 29) or []
        except Exception:
            pass

    # Top news headlines (VARIED for decision variety — cross-category, no country filter)
    news_headlines = []
    try:
        from app.news_cache import get_varied_articles
        articles = await get_varied_articles(limit=8, country="", random_sample=True, exclude_urls=covered_urls)
        news_headlines = [
            {
                "title":       a.get("title", "")[:100],
                "url":         a.get("url", ""),
                "source_name": a.get("source_name", "Unknown"),
                "category":    a.get("category", "general"),
                "description": a.get("description", "")[:200],
                "image":       a.get("image_url") or a.get("image_url") or a.get("image"),
            }
            for a in articles
        ]
    except Exception:
        pass

    # Top crypto headlines (cache only)
    crypto_headlines = []
    try:
        from app.crypto_news import get_cached_crypto_headlines
        crypto = await get_cached_crypto_headlines()
        crypto_headlines = [
            {
                "title":       a.get("title", "")[:100],
                "url":         a.get("url", ""),
                "source_name": a.get("source_name", "Unknown"),
                "description": a.get("description", "")[:200],
                "image":       a.get("image_url"),
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
    if redis:
        try:
            auto_tweets_today = int(await redis.get(f"courage:auto_tweets:{today}") or 0)
        except Exception:
            pass

    return {
        "recent_tweets":        recent_tweets,
        "unreplied_count":      unreplied_count,
        "active_sessions":      active_sessions,
        "bucket_status":        bucket_status,
        "news_headlines":       news_headlines,
        "crypto_headlines":     crypto_headlines,
        "visitor_count":        visitor_count,
        "auto_tweets_today":    auto_tweets_today,
        "covered_urls":         covered_urls,
        "time_utc":             datetime.datetime.utcnow().isoformat(),
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
- A selection of fresh headlines (pick ONE to react to — include article_url in your reasoning so it can be pre-marked as covered):
{news_lines}
- Top crypto headlines available:
{crypto_lines}
- Visitors in last 24h: {visitor_count}
- Your last 3 tweets (avoid repeating topics):
{recent_tweet_lines}

Decision rules (follow these strictly):
1. SKIP if active_sessions > 0 — be conservative while someone is chatting
2. REPLY_MENTIONS if unreplied_count > 2 — community engagement is priority
3. SKIP if auto_tweets_today >= {daily_cap} — daily cap reached
4. Only pick a bucket that is cooled_down = true
5. Do not pick the same bucket as your most recent tweet if another cooled-down option exists
6. Aim for variety across categories (Tech, Business, General, etc.) where interesting stories exist.
7. NEVER react to the same specific news story twice.

Valid actions: TWEET_NEWS, TWEET_CRYPTO, REPLY_MENTIONS, RANDOM, WORLD_UPDATE, SOCIAL, SKIP

Response format (exactly this JSON structure):
{
  "action": "TWEET_NEWS", 
  "bucket": "NEWS", 
  "reasoning": "Fresh Guardian story about X...", 
  "confidence": 0.85,
  "article_url": "https://...",
  "article_title": "..."
}

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
        f"  - {h['title']} [{h['url']}] ({h['source_name']})" for h in state["news_headlines"]
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
        visitor_count=state["visitor_count"],
        recent_tweet_lines=recent_tweet_lines,
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
    return json.loads(raw)


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
        f"[Autonomous Decision: {decision.get('reasoning', '')}]\n"
        f"[Recent tweets to avoid: {recent_summary}]"
        f"{covered_note}"
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
    )


# ── Main tick ──────────────────────────────────────────────────────────────────

async def autonomous_tick(x_client=None, tweet_image_fn=None):
    """
    Single autonomous heartbeat tick. Called by APScheduler every 18 minutes.
    ALL exceptions are caught — this MUST never crash the server.
    """
    tick_start = datetime.datetime.utcnow().isoformat()
    print(f"[AUTO] Autonomous tick starting at {tick_start}")

    try:
        # Get shared Redis
        redis = None
        try:
            import redis.asyncio as aioredis
            redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        except Exception as e:
            print(f"[AUTO] Redis unavailable: {e}")

        # 1. Gather state (no API calls)
        state = await _gather_state(redis)
        print(
            f"[AUTO] State — sessions: {state['active_sessions']}, "
            f"unreplied: {state['unreplied_count']}, "
            f"auto_tweets_today: {state['auto_tweets_today']}"
        )

        # 2. Hard skip conditions (before burning a Groq call on the decision)
        if state["auto_tweets_today"] >= DAILY_AUTO_TWEET_CAP:
            print(f"[AUTO] Daily cap reached ({DAILY_AUTO_TWEET_CAP}). Skipping.")
            return

        if state["active_sessions"] > 0:
            # Someone is chatting — be conservative, but still reply to urgent mentions
            if state["unreplied_count"] <= 2:
                print(f"[AUTO] {state['active_sessions']} active voice session(s). Skipping non-urgent tick.")
                return

        # 2b. Circuit breaker: skip if we're in a Groq 429 backoff window.
        #     Hammering Groq while rate-limited prolongs the limit — back off instead.
        if redis:
            try:
                backoff_until = await redis.get("courage:groq_backoff_until")
                if backoff_until and time.time() < float(backoff_until):
                    remaining_min = int((float(backoff_until) - time.time()) / 60)
                    streak = int(await redis.get("courage:groq_429_streak") or "0")
                    print(f"[AUTO] Groq 429 circuit breaker active (streak={streak}, {remaining_min}m remaining). Skipping tick.")
                    return
            except Exception:
                pass

        # 3. Decision (fast Groq call)
        try:
            decision = await _decide(state)
        except Exception as e:
            print(f"[AUTO] Decision step failed: {e}. Skipping tick.")
            return

        action     = decision.get("action", "SKIP")
        bucket     = decision.get("bucket", "SKIP")
        reasoning  = decision.get("reasoning", "")
        confidence = float(decision.get("confidence", 1.0))
        print(f"[AUTO] Decision — action={action} bucket={bucket} confidence={confidence:.2f} | {reasoning}")

        # 4a. Confidence gate — skip weak decisions before burning execution resources
        if confidence < 0.5:
            print(f"[AUTO] Low confidence ({confidence:.2f}). Skipping tick.")
            return

        # 4b. Log the decision (best-effort); capture row id for later update
        decision_id: int | None = None
        try:
            decision_id = await record_autonomous_decision(action, bucket, reasoning)
        except Exception as e:
            print(f"[AUTO] Decision logging failed (non-fatal): {e}")

        if action == "SKIP":
            print("[AUTO] Decided to SKIP this tick.")
            return

        # 5. Double-check bucket cooldown (LLM can occasionally ignore rules)
        if bucket in BUCKET_COOLDOWNS:
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

        # 6a. Pre-mark the article URL as covered immediately after decision
        #     This prevents the same article from being picked on the next tick even if
        #     execution fails (Groq 429, budget exhausted, etc.)
        if redis and action in ("TWEET_NEWS", "TWEET_CRYPTO"):
            try:
                chosen_url = decision.get("article_url", "")
                if not chosen_url:
                    # Fall back: extract first URL-shaped token from reasoning
                    import re as _re
                    m = _re.search(r'https?://\S+', decision.get("reasoning", ""))
                    chosen_url = m.group(0) if m else ""
                if chosen_url:
                    await redis.lpush("courage:covered_urls", chosen_url)
                    await redis.ltrim("courage:covered_urls", 0, 29)
                    await redis.expire("courage:covered_urls", 172800)
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
        print(f"[AUTO] Unexpected error in autonomous tick: {e}")
