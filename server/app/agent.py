"""
agent.py — Courage AI tool-calling agent (Groq backend).

Features:
- Tiered model: llama-3.1-8b-instant for simple chat, llama-3.3-70b-versatile for tool calls
- ws_emit callback: streams tool_call / tool_result events to the frontend in real-time
- Context isolation: history is passed in per-connection, never shared
- Clean text: all tool-call XML artifacts are stripped before the final reply
"""

import json
import re
import datetime
import httpx
import redis as _sync_redis
from typing import Optional, Callable, Awaitable

from app.system_prompt import build_context_prompt
from app.tools import TOOL_SCHEMAS, dispatch_tool, _last_tweet_cards
from app.news_cache import get_all_recent, get_varied_articles
from app.twitter_memory import init_twitter_db, get_twitter_summary
from app.goal_tracker import get_goal_progress_summary

from app.config import GROQ_API_KEY, GROQ_MODEL, GROQ_MODEL_FAST, GROQ_DAILY_TOKEN_BUDGET

MAX_TOOL_ROUNDS = 8
CONTEXT_TIMEOUT = 60

# ── Groq token tracking ────────────────────────────────────────────────────────
_token_redis: Optional[_sync_redis.Redis] = None

def _init_token_tracker(redis_url: str):
    global _token_redis
    try:
        _token_redis = _sync_redis.from_url(redis_url, decode_responses=True)
    except Exception as e:
        print(f"[TOKENS] Token tracker init failed: {e}")

def _track_groq_usage(usage: dict):
    if not _token_redis or not usage:
        return
    try:
        today = datetime.date.today().isoformat()
        tokens = usage.get("total_tokens", 0)
        _token_redis.incrby(f"groq:tokens:{today}", tokens)
        _token_redis.incrby(f"groq:calls:{today}", 1)
        _token_redis.expire(f"groq:tokens:{today}", 86400)
        _token_redis.expire(f"groq:calls:{today}", 86400)
    except Exception:
        pass

def _groq_budget_ok() -> bool:
    """Return False when today's Groq token spend has hit the daily ceiling."""
    if not _token_redis:
        return True  # can't check → allow
    try:
        today = datetime.date.today().isoformat()
        used = int(_token_redis.get(f"groq:tokens:{today}") or 0)
        return used < GROQ_DAILY_TOKEN_BUDGET
    except Exception:
        return True  # Redis error → allow rather than block


# Emit callback type: async fn(msg: dict) -> None
WsEmit = Optional[Callable[[dict], Awaitable[None]]]

# Strip any XML tool-call artifacts the model might leak into final text
_TOOL_TAG_RE = re.compile(
    r"(</?function[^>]*>|</?parameter[^>]*>|```json.*?```|```.*?```)",
    re.DOTALL | re.IGNORECASE,
)


# ── Groq chat completion call ──────────────────────────────────────────────────

async def _groq_chat(messages: list[dict], use_tools: bool = True, fast: bool = False) -> dict:
    # IMPORTANT: Only use fast (8b) model when NOT offering tools.
    # llama-3.1-8b-instant does not reliably emit structured tool_calls —
    # it leaks JSON args into the text content, which corrupts history and causes 400 errors.
    model = GROQ_MODEL_FAST if (fast and not use_tools) else GROQ_MODEL
    payload = {
        "model":       model,
        "messages":    messages,
        "stream":      False,
        "temperature": 0.78,
        "max_tokens":  1024,
    }

    if use_tools:
        payload["tools"]       = TOOL_SCHEMAS
        payload["tool_choice"] = "auto"

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }

    async with httpx.AsyncClient(timeout=CONTEXT_TIMEOUT) as client:
        try:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            resp = r.json()
            _track_groq_usage(resp.get("usage", {}))
            return resp
        except httpx.HTTPStatusError as e:
            # Handle both Rate Limit (429) and Payload Too Large (413)
            if e.response.status_code in (413, 429):
                retry_after = e.response.headers.get("retry-after", "60")
                code = e.response.status_code
                print(f"[GROQ] {code} Error on {model} (Retry-After: {retry_after}s).")
                # FALLBACK: If 70b (with tools) hits 429, try 8b without tools as last resort.
                # 8b can't emit structured tool_calls but can produce a plain text tweet
                # when the prompt already contains the article content.
                if not fast and use_tools:
                    print("[GROQ] Attempting fallback to 8b (no tools)...")
                    payload["model"] = GROQ_MODEL_FAST
                    payload.pop("tools", None)
                    payload.pop("tool_choice", None)
                    try:
                        r2 = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            json=payload,
                            headers=headers,
                        )
                        r2.raise_for_status()
                        resp = r2.json()
                        _track_groq_usage(resp.get("usage", {}))
                        return resp
                    except httpx.HTTPStatusError as e2:
                        if e2.response.status_code == 429:
                            retry_after2 = e2.response.headers.get("retry-after", "?")
                            print(f"[GROQ] Fallback also 429 (Retry-After: {retry_after2}s). Both models exhausted.")
                        raise e2
            raise e


# ── Helper: scrub any leaked tool syntax from text ────────────────────────────

def _clean(text: str) -> str:
    cleaned = _TOOL_TAG_RE.sub("", text).strip()
    # Also collapse multiple blank lines left behind
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned or "..."


# ── Helper: build properly structured tool_calls for Groq ─────────────────────

def _build_groq_tool_calls(calls: list[dict]) -> list[dict]:
    """
    Groq requires tool_calls to be a list of:
      {"id": "...", "type": "function", "function": {"name": "...", "arguments": "<json string>"}}
    This normalises both native-Groq format and any dict-style calls we constructed.
    """
    out = []
    for i, call in enumerate(calls):
        if "function" in call:
            # Already in Groq format
            out.append(call)
        else:
            # Our constructed dict format
            out.append({
                "id":   call.get("id", f"call_{i}_{call.get('name', 'tool')}"),
                "type": "function",
                "function": {
                    "name":      call["name"],
                    "arguments": json.dumps(call.get("arguments", {})),
                },
            })
    return out


# ── Main agent entry point ─────────────────────────────────────────────────────

async def run_agent(
    user_message: str,
    history: list[dict],
    x_client=None,
    tweet_image_fn=None,
    world_context: Optional[str] = None,
    ws_emit: WsEmit = None,
    max_tool_rounds: int = MAX_TOOL_ROUNDS,
    compact: bool = False,
    target_article: Optional[dict] = None,
) -> str:
    """
    Run one full Courage agent turn and return the final text response.
    ws_emit: async callable to stream tool events to the frontend.
    max_tool_rounds: cap on tool-call iterations (default MAX_TOOL_ROUNDS; use 4 for autonomous mode).
    compact: trim context, skip twitter_summary — reduces Groq token burn.
    target_article: Direct Handoff — skip general fetch and focus ONLY on this story.
    """
    # Hard stop if today's Groq token budget is exhausted
    if not _groq_budget_ok():
        msg = (
            "The things I do for you people... I've burned through all my Grok thinking power for today! "
            "*collapses dramatically* Try again tomorrow. *whimper*"
        )
        if ws_emit:
            await ws_emit({"type": "done", "reply": msg})
        return msg

    # Ensure Twitter memory tables exist
    await init_twitter_db()

    # Build system prompt. 
    # Efficiency Fix: If we have a target_article, SKIP the varied news fetch entirely.
    recent_articles = []
    if not target_article:
        article_limit   = 5 if compact else 10
        recent_articles = await get_varied_articles(limit=article_limit)
        
    twitter_summary = "" if compact else await get_twitter_summary()
    goal_summary    = await get_goal_progress_summary()
    
    system = build_context_prompt(
        recent_articles,
        world_context=world_context,
        twitter_summary=twitter_summary,
        model_name=GROQ_MODEL,
        goal_summary=goal_summary,
        target_article=target_article,
    )
    
    # Add a final instruction if rate status was injected in user_message
    if "Current X Rate Status" in user_message:
        system += (
            "\n\n== OPERATIONAL NOTE ==\n"
            "I have already injected your current Twitter rate limit status into the user message. "
            "If the limits look safe, do NOT call get_x_rate_status. Proceed directly to the next tool or your final response."
        )

    def _sanitise_history(hist: list[dict]) -> list[dict]:
        """
        Remove corrupted assistant messages where the 8b model leaked raw tool-call
        JSON into the text content field instead of tool_calls. These cause Groq 400s.
        We detect actual corruption specifically: valid JSON that contains tool-call
        keys (arguments, name, function) — not arbitrary JSON-shaped chat replies.
        """
        _CORRUPTION_KEYS = {"arguments", "name", "function", "tool_calls", "tool_use"}
        safe = []
        for m in hist:
            role    = m.get("role", "")
            content = (m.get("content") or "").strip()
            if role == "assistant" and content.startswith("{") and content.endswith("}"):
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and _CORRUPTION_KEYS & parsed.keys():
                        continue  # confirmed corruption — drop this message
                except (json.JSONDecodeError, ValueError):
                    pass  # not valid JSON at all → keep it
            safe.append(m)
        return safe

    clean_history = _sanitise_history(history)

    messages: list[dict] = [
        {"role": "system", "content": system},
        *clean_history,
        {"role": "user", "content": user_message},
    ]


    for _round in range(max_tool_rounds):
        # Always use 70b (GROQ_MODEL) when tools are enabled.
        # 8b-instant cannot reliably emit structured tool_calls — it leaks JSON as text.
        resp    = await _groq_chat(messages, use_tools=True, fast=False)
        choice  = resp.get("choices", [{}])[0]
        msg     = choice.get("message", {})
        content = msg.get("content") or ""

        native_calls: list[dict] = msg.get("tool_calls") or []
        finish_reason = choice.get("finish_reason", "")

        if finish_reason == "stop" and not native_calls:
            return _clean(content)

        if native_calls:
            assistant_msg: dict = {"role": "assistant", "content": content, "tool_calls": native_calls}
            messages.append(assistant_msg)

            for call in native_calls:
                fn   = call.get("function", {})
                name = fn.get("name", "")
                raw_args = fn.get("arguments", "{}")
                if isinstance(raw_args, str):
                    try:
                        raw_args = json.loads(raw_args)
                    except json.JSONDecodeError:
                        raw_args = {}

                # Stream tool_call event to frontend before running
                label = _TOOL_LABELS.get(name, f"🔧 {name}...")
                if ws_emit:
                    await ws_emit({"type": "tool_call", "tool": name, "label": label})

                result = await dispatch_tool(
                    name, raw_args,
                    x_client=x_client,
                    tweet_image_fn=tweet_image_fn,
                )

                # SAFETY VALVE: Truncate tool result to 10,000 chars before injecting into memory.
                # This prevents '413 Payload Too Large' if a tool (like fetch_article) returns
                # a massive body, while still giving the agent plenty of data to work with.
                safe_result = result
                if len(result) > 10000:
                    safe_result = result[:10000] + "... [truncated for brevity]"

                # Stream tool_result event to frontend after done
                if ws_emit:
                    await ws_emit({"type": "tool_result", "tool": name, "summary": safe_result[:120]})

                messages.append({
                    "role":         "tool",
                    "tool_call_id": call.get("id", f"call_{name}"),
                    "name":         name,
                    "content":      safe_result,
                })

            continue  # next round with tool results injected

        # No tool calls and not a clean stop — treat current content as final
        if content:
            return _clean(content)

    # ── Safety: force a final answer after MAX_TOOL_ROUNDS ────────────────────
    # Forced final answer: 8b-instant is fine here — no tools offered, just text generation
    final_resp = await _groq_chat(messages, use_tools=False, fast=True)
    final_msg  = final_resp.get("choices", [{}])[0].get("message", {})
    return _clean(final_msg.get("content", "") or "The things I do for you people... something got lost. Try again?")


# ── Tool display labels ────────────────────────────────────────────────────────
_TOOL_LABELS = {
    "get_news":             "📰 Fetching news articles...",
    "fetch_article":        "📄 Reading full article...",
    "get_x_rate_status":    "🐦 Checking Twitter rate limits...",
    "get_my_tweets":        "🐦 Reading my recent tweets...",
    "get_my_profile":       "🐦 Checking my Twitter profile...",
    "get_mentions":         "🔔 Checking Twitter mentions...",
    "post_tweet":           "✉️ Posting tweet...",
    "search_tweets":        "🔍 Searching Twitter...",
    "get_twitter_trends":   "📈 Discovering trending topics...",
    "get_twitter_memory":   "🗄️ Recalling Twitter history...",
    "record_twitter_action":"💾 Saving to memory...",
    "get_crypto_news":      "📈 Fetching crypto headlines...",
}
