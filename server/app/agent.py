"""
agent.py — Courage AI tool-calling agent (Groq backend).

Sends messages to Groq, handles tool calls in a strict loop,
and returns clean final text. Never leaks tool syntax to the user.
"""

import json
import re
import httpx
from typing import Optional

from app.system_prompt import build_context_prompt
from app.tools import TOOL_SCHEMAS, TOOL_NAMES, dispatch_tool
from app.news_cache import get_all_recent
from app.twitter_memory import init_twitter_db, get_twitter_summary

from app.config import GROQ_API_KEY, GROQ_MODEL

MAX_TOOL_ROUNDS = 8    # enough for: check rate → fetch news (×2) → post tweet → record
CONTEXT_TIMEOUT = 60   # Groq is fast; 60s is generous

# Strip any XML tool-call artifacts the model might leak into final text
_TOOL_TAG_RE = re.compile(
    r"(</?function[^>]*>|</?parameter[^>]*>|```json.*?```|```.*?```)",
    re.DOTALL | re.IGNORECASE,
)


# ── Groq chat completion call ──────────────────────────────────────────────────

async def _groq_chat(messages: list[dict], use_tools: bool = True) -> dict:
    payload = {
        "model":       GROQ_MODEL,
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
) -> str:
    """
    Run one full Courage agent turn and return the final text response.
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
    )

    messages: list[dict] = [
        {"role": "system", "content": system},
        *history,
        {"role": "user", "content": user_message},
    ]

    for _round in range(MAX_TOOL_ROUNDS):
        resp    = await _groq_chat(messages, use_tools=True)
        choice  = resp.get("choices", [{}])[0]
        msg     = choice.get("message", {})
        content = msg.get("content") or ""

        # ── Groq native tool calls ───────────────────────────────────────────
        native_calls: list[dict] = msg.get("tool_calls") or []

        finish_reason = choice.get("finish_reason", "")

        # If finish_reason == "stop" with no tool calls → final answer
        if finish_reason == "stop" and not native_calls:
            return _clean(content)

        # If finish_reason == "tool_calls" or we have calls → execute them
        if native_calls:
            # Append the assistant's message exactly as Groq returned it
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

                result = await dispatch_tool(
                    name, raw_args,
                    x_client=x_client,
                    tweet_image_fn=tweet_image_fn,
                )

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
    final_resp = await _groq_chat(messages, use_tools=False)
    final_msg  = final_resp.get("choices", [{}])[0].get("message", {})
    return _clean(final_msg.get("content", "") or "The things I do for you people... something got lost. Try again?")
