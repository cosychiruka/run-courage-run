"""
agent.py — Ollama tool-calling loop for Courage.

Sends messages to Ollama, handles tool calls in a loop,
and returns the final response text.
"""

import json
import re
import httpx
from typing import Optional

from app.config import OLLAMA_HOST, OLLAMA_MODEL
from app.system_prompt import build_context_prompt
from app.tools import TOOL_SCHEMAS, TOOL_NAMES, dispatch_tool
from app.news_cache import get_all_recent

MAX_TOOL_ROUNDS = 6   # max consecutive tool calls before forcing a final answer
CONTEXT_TIMEOUT = 180  # seconds — generous for local LLM


# ── Ollama chat call ───────────────────────────────────────────────────────────

async def _ollama_chat(messages: list[dict], use_tools: bool = True) -> dict:
    payload = {
        "model":    OLLAMA_MODEL,
        "messages": messages,
        "stream":   False,
        "options":  {"num_ctx": 16384, "temperature": 0.72},
    }
    if use_tools:
        payload["tools"] = TOOL_SCHEMAS

    async with httpx.AsyncClient(timeout=CONTEXT_TIMEOUT) as client:
        r = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
        r.raise_for_status()
        return r.json()


# ── Qwen XML-style tool call extractor (fallback when native not present) ─────

_FUNC_RE = re.compile(r"<function=(\w+)>(.*?)</function>", re.DOTALL)
_PARAM_RE = re.compile(r"<parameter=(\w+)>(.*?)</parameter>", re.DOTALL)

def _extract_xml_tools(text: str) -> list[dict]:
    calls = []
    for fn_match in _FUNC_RE.finditer(text):
        name = fn_match.group(1)
        if name not in TOOL_NAMES:
            continue
        args = {}
        for p in _PARAM_RE.finditer(fn_match.group(2)):
            raw = p.group(2).strip()
            try:
                args[p.group(1)] = json.loads(raw)
            except json.JSONDecodeError:
                args[p.group(1)] = raw
        calls.append({"name": name, "arguments": args})
    return calls


# ── Main agent run ─────────────────────────────────────────────────────────────

async def run_agent(
    user_message: str,
    history: list[dict],
    x_client=None,
    tweet_image_fn=None,
) -> str:
    """
    Run the full Courage agent for one user turn.
    Returns the final text response.
    """
    # Build system prompt with recent news injected
    recent_articles = await get_all_recent(limit=8)
    system = build_context_prompt(recent_articles)

    messages = [
        {"role": "system", "content": system},
        *history,
        {"role": "user", "content": user_message},
    ]

    for _round in range(MAX_TOOL_ROUNDS):
        resp   = await _ollama_chat(messages, use_tools=True)
        msg    = resp.get("message", {})
        content = msg.get("content", "")

        # Native tool calls (Ollama structured format)
        native_calls = msg.get("tool_calls") or []

        # XML-style tool calls (Qwen fallback)
        xml_calls = _extract_xml_tools(content) if not native_calls and content else []

        all_calls = native_calls or xml_calls

        if not all_calls:
            # No tool calls — this is the final response
            return content.strip() or "..."

        # Execute each tool and feed results back
        messages.append({"role": "assistant", "content": content, "tool_calls": native_calls or None})

        for call in all_calls:
            # Normalise across native + XML formats
            if "function" in call:
                name = call["function"].get("name", "")
                raw_args = call["function"].get("arguments", {})
            else:
                name = call.get("name", "")
                raw_args = call.get("arguments", {})

            if isinstance(raw_args, str):
                try:
                    raw_args = json.loads(raw_args)
                except json.JSONDecodeError:
                    raw_args = {}

            result = await dispatch_tool(name, raw_args, x_client=x_client, tweet_image_fn=tweet_image_fn)

            messages.append({
                "role":         "tool",
                "name":         name,
                "content":      result,
                "tool_call_id": call.get("id", f"call_{name}"),
            })

    # Forced final answer after hitting MAX_TOOL_ROUNDS
    final = await _ollama_chat(messages, use_tools=False)
    return final.get("message", {}).get("content", "").strip() or "..."
