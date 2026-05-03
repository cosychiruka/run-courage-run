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
import httpx
from typing import Optional, Callable, Awaitable

from app.system_prompt import build_context_prompt
from app.tools import TOOL_SCHEMAS, dispatch_tool
from app.news_cache import get_all_recent
from app.twitter_memory import init_twitter_db, get_twitter_summary

from app.config import GROQ_API_KEY, GROQ_MODEL, GROQ_MODEL_FAST

MAX_TOOL_ROUNDS = 8
CONTEXT_TIMEOUT = 60

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
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers=headers,
        )
        r.raise_for_status()
        return r.json()


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
) -> str:
    """
    Run one full Courage agent turn and return the final text response.
    ws_emit: async callable to stream tool events to the frontend.
    """
    # Ensure Twitter memory tables exist
    await init_twitter_db()

    # Build rich system prompt: recent articles + Twitter memory
    recent_articles  = await get_all_recent(limit=10)
    twitter_summary  = await get_twitter_summary()
    system           = build_context_prompt(
        recent_articles,
        world_context=world_context,
        twitter_summary=twitter_summary,
        model_name=GROQ_MODEL,
    )

    def _sanitise_history(hist: list[dict]) -> list[dict]:
        """
        Remove any corrupted assistant messages from history.
        The 8b model sometimes emits raw JSON tool args as text content instead of tool_calls.
        These corrupt messages cause Groq to return 400 on the next turn.
        Strategy: keep only user/assistant pairs where the assistant message has clean text (no raw JSON dumps).
        """
        safe = []
        for m in hist:
            role = m.get("role", "")
            content = m.get("content", "") or ""
            if role == "assistant":
                # If content looks like a raw JSON dump (model leaking tool args), skip
                stripped = content.strip()
                if stripped.startswith("{") and stripped.endswith("}"):
                    continue  # skip corrupted entry
            safe.append(m)
        return safe

    clean_history = _sanitise_history(history)

    messages: list[dict] = [
        {"role": "system", "content": system},
        *clean_history,
        {"role": "user", "content": user_message},
    ]


    for _round in range(MAX_TOOL_ROUNDS):
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

                # Stream tool_result event to frontend after done
                if ws_emit:
                    await ws_emit({"type": "tool_result", "tool": name, "summary": result[:120]})

                messages.append({
                    "role":         "tool",
                    "tool_call_id": call.get("id", f"call_{name}"),
                    "name":         name,
                    "content":      result,

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
    "get_mentions":         "🔔 Checking Twitter mentions...",
    "post_tweet":           "✉️ Posting tweet...",
    "search_tweets":        "🔍 Searching Twitter...",
    "get_twitter_trends":   "📈 Discovering trending topics...",
    "get_twitter_memory":   "🗄️ Recalling Twitter history...",
    "record_twitter_action":"💾 Saving to memory...",
}
