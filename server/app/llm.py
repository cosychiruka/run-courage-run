"""
Shared LLM client helpers.

OpenRouter exposes an OpenAI-compatible API, so the rest of the app can use one
call path for the autonomous brain, voice agent, and small tweet-writing helpers.
"""

from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI

from app.config import (
    DEFAULT_MODEL,
    FALLBACK_MODEL,
    # GROQ_API_KEY,  # Legacy - now using OpenRouter
    # GROQ_MODEL,   # Legacy - now using OpenRouter
    # GROQ_MODEL_FAST,  # Legacy - now using OpenRouter
    LLM_PROVIDER,
    OPENROUTER_API_KEY,
    OPENROUTER_REFERER,
    OPENROUTER_TITLE,
)

_openrouter_client: AsyncOpenAI | None = None
# _groq_client: Any | None = None  # Legacy - now using OpenRouter


def active_llm_label() -> str:
    provider = (LLM_PROVIDER or "openrouter").lower()
    if provider == "openrouter":
        return f"OpenRouter ({DEFAULT_MODEL})"
    # Legacy Groq support removed
    raise ValueError(f"Unsupported LLM_PROVIDER: {provider}. Only 'openrouter' is supported now.")


def default_model_name(fast: bool = False) -> str:
    provider = (LLM_PROVIDER or "openrouter").lower()
    if provider == "openrouter":
        return DEFAULT_MODEL
    # Legacy Groq support removed - fast parameter ignored for OpenRouter
    raise ValueError(f"Unsupported LLM_PROVIDER: {provider}. Only 'openrouter' is supported now.")


def _get_openrouter_client() -> AsyncOpenAI:
    global _openrouter_client
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
    if _openrouter_client is None:
        _openrouter_client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": OPENROUTER_REFERER,
                "X-Title": OPENROUTER_TITLE,
                "X-OpenRouter-Title": OPENROUTER_TITLE,
            },
        )
    return _openrouter_client


# def _get_groq_client() -> Any:  # Legacy - now using OpenRouter
#     global _groq_client
#     if not GROQ_API_KEY:
#         raise RuntimeError("GROQ_API_KEY is not configured")
#     if _groq_client is None:
#         from groq import AsyncGroq
#
#         _groq_client = AsyncGroq(api_key=GROQ_API_KEY)
#     return _groq_client


async def get_llm_client_and_model(fast: bool = False, fallback: bool = False):
    """Return an OpenAI-compatible async client and model name."""
    provider = (LLM_PROVIDER or "openrouter").lower()
    
    if provider == "openrouter":
        model = FALLBACK_MODEL if fallback else DEFAULT_MODEL
        return _get_openrouter_client(), model
    
    # Legacy Groq support removed
    raise ValueError(f"Unsupported LLM_PROVIDER: {provider}. Only 'openrouter' is supported now.")


def _status_code(exc: Exception) -> int | None:
    response = getattr(exc, "response", None)
    return getattr(exc, "status_code", None) or getattr(response, "status_code", None)


def is_retryable_llm_error(exc: Exception) -> bool:
    status = _status_code(exc)
    if status in {429, 500, 502, 503, 504}:
        return True
    text = str(exc).lower()
    return "rate limit" in text or "rate_limit" in text or "too many requests" in text


async def create_chat_completion(
    *,
    messages: list[dict],
    fast: bool = False,
    allow_fallback: bool = True,
    **kwargs: Any,
):
    """
    Create a chat completion and use the paid OpenRouter fallback model only when
    the default free model is rate-limited or temporarily unavailable.
    """
    client, model = await get_llm_client_and_model(fast=fast)
    try:
        return await client.chat.completions.create(model=model, messages=messages, **kwargs)
    except Exception as exc:
        provider = (LLM_PROVIDER or "openrouter").lower()
        can_try_fallback = (
            allow_fallback
            and provider == "openrouter"
            and DEFAULT_MODEL != FALLBACK_MODEL
            and is_retryable_llm_error(exc)
        )
        if not can_try_fallback:
            raise

        print(f"[LLM] {DEFAULT_MODEL} unavailable ({exc}); retrying with {FALLBACK_MODEL}")
        fallback_client, fallback_model = await get_llm_client_and_model(fallback=True)
        return await fallback_client.chat.completions.create(
            model=fallback_model,
            messages=messages,
            **kwargs,
        )


def completion_to_dict(completion: Any) -> dict:
    if isinstance(completion, dict):
        return completion
    if hasattr(completion, "model_dump"):
        return completion.model_dump()
    if hasattr(completion, "model_dump_json"):
        return json.loads(completion.model_dump_json())
    raise TypeError(f"Unsupported completion response type: {type(completion)!r}")
