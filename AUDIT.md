# Run Courage Run — Enhancement Audit & Production Polish Plan
**Date:** 2026-05-04  
**Scope:** Full codebase review post-autonomous agent merge  
**Status:** TEMPORARY — delete after implementation sprint is complete

---

## Executive Summary

The autonomous agent merge is architecturally sound and covers the happy path well. The integration compiles cleanly, the heartbeat loop is resilient, and the character voice is strong. However, zooming out to production reality reveals **5 critical bugs**, **8 choke points**, and **12 polish gaps** that would cause silent failures, cost overruns, or degraded character quality in production. Several key patterns from competitor research (ElizaOS, agent_xbt, OpenClaw) were identified earlier but not applied.

**Overall production readiness: 6.1/10**

---

## Component Ratings

| Component | Rating | Headline Issue |
|-----------|--------|----------------|
| Autonomous heartbeat loop | 7/10 | Solid but burns X API on every tick for profile read |
| Crypto news integration | 7/10 | CoinGecko images only appear when CryptoPanic is DOWN |
| Twitter tools & safety | 8/10 | Strong safety filter; GIF upload is a silent fail path |
| Character & system prompt | 7/10 | Year says "2025," lore says "CSS source code" — both wrong |
| Goal tracking & metrics | 5/10 | Tables exist, `executed` field never updated, no pruning |
| Redis architecture | 5/10 | 4–5 separate connection pools across modules |
| Cost management | 4/10 | Budget tracked but never enforced — costs can spiral |
| Memory & deduplication | 5/10 | Same article can be tweeted repeatedly |
| Session management | 6/10 | Stale sessions survive 60 min after server crash |
| Production observability | 3/10 | No structured metrics, no error alerting |

---

## CRITICAL BUGS (fix before next deploy)

### BUG-1 — System prompt says "2025" and "CSS source code"
**File:** [system_prompt.py:17](server/app/system_prompt.py#L17)  
**Line:** `Now in 2025, someone ran your CSS source code through a server`  
**Problem:** Courage's birthday is May 1st, 2026. The year is wrong. Also "CSS" is styling — he runs on Python, not CSS. This breaks character immediately if anyone asks about his origin.  
**Fix:** Change to `Now in 2026, someone ran an AI model through a server`

---

### BUG-2 — Sync Redis client blocking the async event loop
**File:** [tools.py:692](server/app/tools.py#L692)  
**Code:** `r = _sync_redis.from_url(REDIS_URL, decode_responses=True)` inside `_check_api_credits()`  
**Problem:** Synchronous `redis.get()` calls inside an async function block the entire asyncio event loop. Every `check_api_credits` tool call causes a measurable latency spike on all concurrent WebSocket connections.  
**Fix:** Use `redis.asyncio` with `await r.get()` — same pattern as goal_tracker.py already uses correctly.

---

### BUG-3 — CoinGecko images only available when CryptoPanic is DOWN
**File:** [crypto_news.py:183](server/app/crypto_news.py#L183)  
**Problem:** The fallback chain is: CryptoPanic → (only if empty) CoinGecko. CryptoPanic articles have `image_url: None` (no images on free tier). CoinGecko articles have `thumb_2x` image URLs — but they're only fetched when CryptoPanic fails. So tweet images will be attached to crypto tweets roughly 5% of the time (when CryptoPanic is down), not 100%.  
**Fix:** Always merge both sources, OR always include a CoinGecko pass for image-enrichment. Simplest fix: if CryptoPanic returns articles but they all have `image_url: None`, do a CoinGecko fetch just for the thumbnails and merge by title matching. Or more pragmatically: change the cache to try both in parallel and prefer CoinGecko records with images.

---

### BUG-4 — `autonomous_decisions.executed` and `tweet_id` never updated
**File:** [goal_tracker.py:83](server/app/goal_tracker.py#L83)  
**Problem:** `record_autonomous_decision()` inserts a row with `executed=0, tweet_id=NULL`. After `_execute()` runs and (possibly) posts a tweet, there is no code that updates this row with `executed=1` and the actual `tweet_id`. The audit log is permanently half-empty. We can't tell from the DB which decisions actually resulted in posted tweets.  
**Fix:** `_execute()` in autonomous_loop.py should return the tweet_id (parse it from the agent reply string), then `autonomous_tick()` calls `UPDATE autonomous_decisions SET executed=1, tweet_id=? WHERE id=?`.

---

### BUG-5 — GIF attachment to Twitter will fail silently
**File:** [tools.py:487](server/app/tools.py#L487)  
**Problem:** `_download_article_image()` accepts `image/gif` and saves it as `.gif`. Then `x_client.upload_media()` is called. Twitter's v1 media upload requires animated GIFs to use a specific upload type parameter (`media_category=tweet_gif`). Without it, GIF uploads fail. The exception is caught and `media_id = None`, so the tweet posts without an image — silently losing the image with no log.  
**Fix:** Filter out GIFs (`if ct.split(";")[0].strip() == "image/gif": return None`) or add proper animated GIF upload support. Filtering is the safe default.

---

## CHOKE POINTS (will cause production pain under load)

### CHOKE-1 — 4–5 separate Redis connection pools
**Files:** news_cache.py, crypto_news.py, goal_tracker.py, autonomous_loop.py (per-tick new connection), agent.py (sync client)  
**Problem:** Each module initializes its own `_redis` singleton. This means Redis sees 4–5 separate connection pools from one process. Under load, this exhausts connection limits and adds unnecessary overhead. The autonomous_loop creates a brand-new connection every 18 minutes and never closes it properly.  
**Fix:** Create a shared `get_redis_client()` in a new `server/app/redis_client.py` and import it everywhere. One pool, one connection.

---

### CHOKE-2 — Goal snapshot burns X API every autonomous tick
**File:** [autonomous_loop.py:419](server/app/autonomous_loop.py#L419)  
**Code:** `resp = x_client.get_my_profile()` called after EVERY executed tick  
**Problem:** This is a live X API read (`GET /users/me`) every 18 minutes. That's 80 reads/day just for follower snapshots. On a paid plan at $0.005/read = $0.40/day just for self-checks. Also, if execution fails and we return early, this never runs — so snapshots are inconsistent. And follower count doesn't change meaningfully every 18 minutes.  
**Fix:** Move goal snapshots to once per day (use a Redis flag `courage:goal_snapshot:{date}` to track). Only snapshot if the flag is not set. This brings it to 1 read/day instead of 80.

---

### CHOKE-3 — Groq token budget tracked but never enforced
**File:** [agent.py:39](server/app/agent.py#L39), [config.py:38](server/app/config.py#L38)  
**Problem:** `GROQ_DAILY_TOKEN_BUDGET = 500,000` exists in config and `_track_groq_usage()` records usage. But nothing reads this budget and stops Groq calls when it's reached. The autonomous loop calling `run_agent()` with up to 8 tool rounds × up to 25 ticks/day = potentially 200 Groq calls with no ceiling.  
**Fix:** In `_groq_chat()` in agent.py, before making the call, check `groq:tokens:{today}` against `GROQ_DAILY_TOKEN_BUDGET`. If exceeded, raise a specific exception. In `autonomous_tick()`, catch this and SKIP.

---

### CHOKE-4 — Stale active_voice_sessions after server crash
**File:** [main.py:293](server/app/main.py#L293)  
**Problem:** On WebSocket connect, the session ID is added to the Redis SET with a 3600s TTL. On disconnect (in `finally`), it's removed. But if the server crashes mid-session, the `finally` block never runs. The SET entry lives for 60 minutes. During those 60 minutes, the autonomous loop sees `active_sessions > 0` and skips non-urgent ticks. So a crash causes Courage to go "silent" autonomously for up to an hour.  
**Fix:** On server startup (in `lifespan`), call `await _redis.delete("active_voice_sessions")` to clear stale entries from any previous crash. The SET is rebuilt as connections re-establish.

---

### CHOKE-5 — No deduplication: same article tweeted repeatedly
**Problem:** Nothing tracks which article URLs have been covered in tweets. If a story persists in the news cache for 2+ days, the autonomous NEWS bucket can tweet about the same story multiple times. The `recent_tweet_lines` hint in the decision prompt is soft (LLM can ignore it).  
**Fix:** Track covered URLs in a Redis SET `courage:covered_urls` with 48h TTL per URL. In `_post_tweet()`, after a successful tweet where `article_url` was used, add `article_url` to this set. In `_get_news()` tool output, optionally mark articles as `[already covered]`. Better: add a check in `autonomous_tick()` execution prompt — inject "URLs you have already covered this week" into the action prompt.

---

### CHOKE-6 — Interactive tweets bypass daily cap entirely
**Problem:** `courage:auto_tweets:{today}` only counts autonomous ticks. A voice chat user can ask Courage to tweet 20 times in one session with no cap. The goal endpoint only shows autonomous count, not total.  
**Fix:** In `_post_tweet()` in tools.py, after a successful tweet, increment a separate counter `courage:total_tweets:{today}` (distinct from `auto_tweets`). Expose this in `/api/goal_progress` and `check_api_credits`. Add a soft warning in `_post_tweet()` if total exceeds 50/day.

---

### CHOKE-7 — History sanitization is too broad
**File:** [agent.py:173](server/app/agent.py#L173)  
**Code:** `if stripped.startswith("{") and stripped.endswith("}"):` → skip  
**Problem:** This skips any assistant message that happens to be pure JSON. In practice, this is meant to catch corrupt tool-call leakage. But if Courage legitimately summarizes something in JSON format, that message is silently dropped from history. Over long sessions this creates gaps that confuse the LLM.  
**Fix:** Be more specific: only skip if the JSON parses successfully AND contains `tool_calls`-style keys (`arguments`, `name`, `function`). Use `json.loads()` + key checking instead of just string boundaries.

---

### CHOKE-8 — `run_agent()` called in autonomous mode with full 8-round tool loop
**File:** [autonomous_loop.py:306](server/app/autonomous_loop.py#L306)  
**Problem:** `_execute()` calls `run_agent()` which rebuilds the FULL system prompt (SQLite × 3 queries + Redis × 2 reads) and then enters up to 8 rounds of Llama-4-Scout tool calls. For a background autonomous post, this is very heavy. Also, `get_goal_progress_summary()` is called, which runs a SQLite query — inside what is already a tight 18-min loop.  
**Impact:** Each autonomous tick potentially takes 15–30 seconds and burns 3,000–8,000 Groq tokens just for `run_agent()` plus multiple X API calls.  
**Partial fix:** In `autonomous_tick()`, cap tool rounds to 4 (not 8) for autonomous mode. Pass `max_tool_rounds=4` into `run_agent()` — needs a new optional param.

---

## POLISH GAPS (quality of life + character integrity)

### POLISH-1 — Goal summary injected in wrong order for transformer attention
**File:** [system_prompt.py:309](server/app/system_prompt.py#L309)  
**Problem:** Goal summary is injected *before* the news block. In transformer models, content at the very end of the prompt gets higher attention weight (recency effect). The most mission-critical Courage behavior (his goals) should come last, not buried before news.  
**Fix:** Move `goal_summary` injection to AFTER the news block — the very last thing before the prompt ends.

---

### POLISH-2 — `twitter_memory` grows forever with no pruning
**File:** [twitter_memory.py](server/app/twitter_memory.py)  
**Problem:** `tw_tweets`, `tw_mentions`, `tw_trends`, `tw_searches` grow without any LIMIT or TTL. After 6 months of operation, `get_twitter_summary()` will still only fetch the last 5/10 rows (fine), but the table will have thousands of rows slowing down all queries.  
**Fix:** Add a weekly cleanup job in the scheduler: `DELETE FROM tw_tweets WHERE created_at < strftime('%s','now','-30 days')`. Same for other tables with appropriate windows.

---

### POLISH-3 — `check_api_credits` doesn't include crypto budget or autonomous tweet count
**File:** [tools.py:689](server/app/tools.py#L689)  
**Problem:** `_check_api_credits()` shows Groq tokens, X search quota, GNews, NewsAPI, Guardian. Missing: CryptoPanic budget, CoinGecko budget, autonomous tweets today, total tweets today.  
**Fix:** Add 4 lines to the output pulling from Redis.

---

### POLISH-4 — Autonomous loop has no per-tick outcome feedback
**Problem (from competitor research):** agent_xbt and OpenClaw both track what happened AFTER a tweet was posted — engagement received, whether it triggered replies. Courage posts and forgets. Over time, this means he can't learn what types of posts perform better.  
**Roadmap fix:** After posting, store tweet_id in `autonomous_decisions`. Then add a daily "check engagement" tick that calls `get_my_tweets()` and updates engagement metrics for recent autonomous tweets. Feed top-performing tweet patterns into the decision prompt as "what worked well lately."

---

### POLISH-5 — No confidence scoring on autonomous decisions
**Problem (from OpenClaw research):** OpenClaw's decision LLM outputs a confidence score (0–1). Low confidence = SKIP. High confidence = execute. We have action + bucket + reasoning but no confidence signal.  
**Fix:** Add `"confidence": 0.0–1.0` to the JSON schema in `_DECISION_TEMPLATE`. In `autonomous_tick()`, SKIP if confidence < 0.5. This dramatically reduces low-quality autonomous posts.

```python
# Add to decision prompt format example:
{"action": "TWEET_NEWS", "bucket": "NEWS", "reasoning": "...", "confidence": 0.85}
# Add to tick:
if float(decision.get("confidence", 1.0)) < 0.5:
    print(f"[AUTO] Low confidence ({decision['confidence']}). Skipping.")
    return
```

---

### POLISH-6 — No article deduplication signal from competitor research (ElizaOS)
**Problem:** ElizaOS tracks `processed_urls` — a set of article URLs already covered. This prevents the same story from being discussed multiple times. We don't have this.  
**Fix:** See CHOKE-5. Redis SET `courage:covered_urls` with per-entry 48h TTL using `EXPIRE` on each member. Inject covered URLs as context in action prompts.

---

### POLISH-7 — Visitor log stores raw user text (privacy concern)
**File:** [main.py:436](server/app/main.py#L436)  
**Code:** `user_turns = [m["content"][:50] for m in history...]`  
**Problem:** First 50 chars of raw user messages are stored in Redis for 24h. If a user says something personal ("my name is John and I'm from..."), it's logged verbatim.  
**Fix:** Replace raw content with extracted topic keywords. Use simple word filtering: strip names, numbers, personal pronouns. Or simply store only the topic bucket (NEWS/CRYPTO/WORLD) inferred from the conversation, not raw text.

---

### POLISH-8 — Action prompts missing explicit "do not repost" instruction
**File:** [autonomous_loop.py:43](server/app/autonomous_loop.py#L43)  
**Problem:** `TWEET_NEWS` action prompt says "pick the most interesting article" but doesn't explicitly say "skip articles already covered this week." Courage has no hard signal to avoid repetition.  
**Fix:** Inject covered URLs into each action prompt when available.

---

### POLISH-9 — `GROQ_MODEL_FAST` still points to deprecated llama-3.1-8b-instant
**File:** [config.py:8](server/app/config.py#L8)  
**Current:** `"llama-3.1-8b-instant"` — this model was soft-deprecated by Groq in Q1 2026.  
**Recommended:** `"llama-3.2-11b-vision-instruct"` or `"llama-3.1-8b-instant"` (still works but check Groq status page).  
**Actual impact:** The fast model is only used for the autonomous decision JSON call (no tool calls). If it gets deprecated, autonomous decisions silently fail with a 404. Add error handling that falls back to `GROQ_MODEL` if `GROQ_MODEL_FAST` fails.

---

### POLISH-10 — `get_my_profile` tool exists but is missing from `check_api_credits` and goal awareness loop
**Problem:** `get_my_profile` is a tool Courage can call, but the goal snapshot system in `autonomous_tick()` calls `x_client.get_my_profile()` directly (bypassing the tool system). These are parallel paths. The tool version records in the tool_call stream; the direct version doesn't.  
**Fix:** In `autonomous_tick()`, instead of calling `x_client.get_my_profile()` directly, run a minimal one-shot agent call with the specific task "call get_my_profile and return the follower count as JSON." Or better: expose a direct `x_client.get_follower_count()` helper that doesn't go through the tool system at all.

---

### POLISH-11 — World context only injected at voice chat time, not in autonomous mode
**Problem:** The WORLD bucket action prompt tells Courage to write about his 3D worlds. But in `_execute()`, `world_context=None` is passed. So Courage has NO information about which world is currently active when writing WORLD bucket tweets. He'll make something up from the system prompt knowledge.  
**Opportunity:** Pass the current "most active world" from a Redis key (e.g., `courage:active_world`) which the frontend could set when users enter a scene. This gives autonomous WORLD tweets real grounding.

---

### POLISH-12 — No startup verification that new tables were created
**File:** [main.py:95](server/app/main.py#L95)  
**Problem:** `await init_goal_db()` is called at startup, which runs `CREATE TABLE IF NOT EXISTS`. But if it silently fails (e.g., permission issue), the server starts fine but `goal_snapshots` and `autonomous_decisions` tables don't exist. The first autonomous tick will fail when trying to write to them.  
**Fix:** After `init_goal_db()`, run a quick sanity check: `SELECT name FROM sqlite_master WHERE type='table'` and log the list. This surfaces table creation failures immediately at startup.

---

## Priority Implementation Order

### Sprint 1 — Fix before next deploy (bugs that break things)
| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | Fix "2025" → "2026" and "CSS" → "Python/AI" in system prompt | system_prompt.py | 2 min |
| 2 | Fix sync Redis in `_check_api_credits` → async | tools.py | 10 min |
| 3 | Filter out GIFs in `_download_article_image` | tools.py | 5 min |
| 4 | Clear `active_voice_sessions` on startup | main.py | 5 min |
| 5 | Daily goal snapshot (not per-tick) | autonomous_loop.py | 15 min |

### Sprint 2 — Choke points (prevent silent production failures)
| # | Fix | File | Effort |
|---|-----|------|--------|
| 6 | Shared Redis client module | redis_client.py (new) | 30 min |
| 7 | Groq token budget enforcement | agent.py | 20 min |
| 8 | Update `autonomous_decisions.executed` after tweet | autonomous_loop.py + goal_tracker.py | 20 min |
| 9 | Add `confidence` field to decision JSON | autonomous_loop.py | 10 min |
| 10 | Max tool rounds = 4 for autonomous mode | agent.py + autonomous_loop.py | 10 min |

### Sprint 3 — Polish & competitor-inspired upgrades
| # | Fix | File | Effort |
|---|-----|------|--------|
| 11 | Covered URL tracking (ElizaOS pattern) | tools.py + autonomous_loop.py | 45 min |
| 12 | Move goal_summary to end of system prompt | system_prompt.py | 5 min |
| 13 | Twitter memory pruning (30-day cleanup job) | twitter_memory.py + main.py | 20 min |
| 14 | Enrich `check_api_credits` with crypto budget + tweet counts | tools.py | 15 min |
| 15 | CoinGecko image enrichment pass on top of CryptoPanic | crypto_news.py | 45 min |
| 16 | Visitor log: keywords-only, no raw user text | main.py | 15 min |
| 17 | Startup table verification log | main.py | 5 min |

---

## Competitor Patterns — What We Should Have Adopted

### From ElizaOS
| Pattern | Status | Priority |
|---------|--------|----------|
| Processed URL tracking (no repeat coverage) | Missing | High — CHOKE-5 |
| Memory consolidation / pruning | Missing | Medium — POLISH-2 |
| Action validators (is this action meaningful?) | Partially in decision prompt | Low |
| In-character consistency evaluation loop | Not implemented | Low |

### From agent_xbt
| Pattern | Status | Priority |
|---------|--------|----------|
| Engagement scoring before posting | Not implemented | Medium — POLISH-4 |
| Mention prioritization by follower count | Not implemented | Low |
| Trend-to-tweet direct pipeline | Partial (SOCIAL bucket) | Low |

### From OpenClaw
| Pattern | Status | Priority |
|---------|--------|----------|
| Confidence scoring per decision | Missing | High — POLISH-5 |
| Action outcome tracking (tweet → engagement) | Missing | Medium — POLISH-4 |
| Zero-API state gather before decision | ✅ Implemented correctly | — |

---

## What Is Working Well (Don't Touch)

- **WebSocket session isolation** — each connection truly gets its own history, no cross-contamination
- **Safety filter** (`_check_tweet_safety`) — wallet/contract address blocking is solid
- **Temp image cleanup** — `finally` block guarantees no orphaned temp files
- **News discovery multi-source waterfall** — Guardian → NewsAPI → GNews with budget gates
- **Autonomous loop exception handling** — the "never crash the server" design is correctly implemented
- **Character voice in system prompt** — the existing lore blocks are excellent and should not be touched
- **Crypto fallback chain** — Redis → CryptoPanic → CoinGecko → [] is the right order
- **History sanitization for corrupt 8b model output** — the pattern exists and is needed

---

*Delete this file after Sprint 3 is complete.*
