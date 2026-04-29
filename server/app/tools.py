"""
tools.py — All agent tools: definitions (OpenAI-compatible JSON schema)
and dispatch logic (what actually runs when the LLM calls a tool).
"""

import json
import time
from typing import Any

from app.news_cache import (
    get_cached_articles, get_all_recent,
    fetch_from_gnews, fetch_from_guardian,
    fetch_full_article, save_full_content,
    save_articles, cache_articles,
)
from app.config import GNEWS_API_KEY

# ── Tool schema definitions (sent to Ollama) ──────────────────────────────────

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_news",
            "description": (
                "Retrieve recent cached news articles. "
                "Call this before discussing any news topic. "
                "Always prefer cache — only set refresh=true if the user explicitly asks for latest news."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "country":  {"type": "string", "default": "us",      "description": "ISO country code, e.g. 'us', 'gb'"},
                    "category": {"type": "string", "default": "general", "description": "Topic: general, technology, business, sports, science, health"},
                    "limit":    {"type": "integer","default": 5,         "description": "Max articles to return (1-10)"},
                    "refresh":  {"type": "boolean","default": False,     "description": "Force API re-fetch even if cache is fresh"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_article",
            "description": "Fetch the full text of a specific news article by URL. Use when the user wants details beyond the headline.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full article URL"},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_x_rate_status",
            "description": "Check current Twitter/X API rate limit status before making any X API calls.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_tweets",
            "description": "Retrieve @runcouragerun's recent tweets to stay aware of what was already posted.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_mentions",
            "description": "Check recent mentions / replies to @runcouragerun on X.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "default": 10},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "post_tweet",
            "description": (
                "Post a tweet as @runcouragerun. "
                "ALWAYS check get_x_rate_status first. "
                "Tweets must be Courage-voiced: punchy, dramatic, 1-2 sentences + a Courage-ism. "
                "Max 280 chars."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text":          {"type": "string",  "description": "Tweet text (max 280 chars)"},
                    "article_url":   {"type": "string",  "description": "Optional: URL of article to attach as news-card image"},
                    "reply_to_id":   {"type": "string",  "description": "Optional: tweet ID to reply to"},
                },
                "required": ["text"],
            },
        },
    },
]

# ── Tool name lookup ───────────────────────────────────────────────────────────

TOOL_NAMES = {t["function"]["name"] for t in TOOL_SCHEMAS}


# ── Tool dispatch ─────────────────────────────────────────────────────────────

async def dispatch_tool(name: str, args: dict, x_client=None, tweet_image_fn=None) -> str:
    """
    Execute a tool call and return a string result for the LLM.
    x_client and tweet_image_fn are injected by agent.py.
    """
    try:
        if name == "get_news":
            return await _get_news(args)

        elif name == "fetch_article":
            return await _fetch_article(args)

        elif name == "get_x_rate_status":
            return await _get_x_rate_status(x_client)

        elif name == "get_my_tweets":
            return await _get_my_tweets(args, x_client)

        elif name == "get_mentions":
            return await _get_mentions(args, x_client)

        elif name == "post_tweet":
            return await _post_tweet(args, x_client, tweet_image_fn)

        else:
            return f"Unknown tool: {name}"

    except Exception as e:
        return f"Tool error ({name}): {e}"


# ── Individual tool implementations ───────────────────────────────────────────

async def _get_news(args: dict) -> str:
    country  = args.get("country",  "us")
    category = args.get("category", "general")
    limit    = min(int(args.get("limit", 5)), 10)
    refresh  = args.get("refresh", False)

    articles = None
    if not refresh:
        articles = await get_cached_articles(country, category)

    if not articles:
        try:
            if GNEWS_API_KEY:
                articles = await fetch_from_gnews(country, category, limit)
            else:
                articles = await fetch_from_guardian(category, limit)
            if articles:
                await save_articles(articles, country, category)
                await cache_articles(articles, country, category)
        except Exception as e:
            return f"News fetch failed: {e}"

    if not articles:
        return "No news articles available right now."

    out = f"Found {len(articles[:limit])} articles ({country}/{category}):\n\n"
    for i, a in enumerate(articles[:limit], 1):
        out += f"[{i}] {a.get('title', 'No title')}\n"
        out += f"    Source: {a.get('source', {}).get('name', 'Unknown')}\n"
        out += f"    URL: {a.get('url', '')}\n"
        out += f"    {a.get('description', '')[:150]}\n\n"
    return out.strip()


async def _fetch_article(args: dict) -> str:
    url = args.get("url", "")
    if not url:
        return "No URL provided."
    content = await fetch_full_article(url)
    if content:
        await save_full_content(url, content)
        return f"Full article content:\n\n{content[:4000]}"
    return "Could not retrieve article content."


async def _get_x_rate_status(x_client) -> str:
    if x_client is None:
        return "X client not configured (missing API keys)."
    status = x_client.get_rate_status()
    if not status:
        return "No rate limit data yet — no X API calls made this session."
    lines = []
    for endpoint, data in status.items():
        remaining = data.get("remaining", "?")
        reset_ts  = int(data.get("reset", 0))
        reset_in  = max(0, reset_ts - int(time.time()))
        lines.append(f"{endpoint}: {remaining} remaining, resets in {reset_in}s")
    return "X Rate Limits:\n" + "\n".join(lines)


async def _get_my_tweets(args: dict, x_client) -> str:
    if x_client is None:
        return "X client not configured."
    max_results = int(args.get("max_results", 5))
    try:
        posts = x_client.get_my_recent_posts(max_results)
        if not posts or not posts.data:
            return "No recent posts found."
        return "Recent @runcouragerun tweets:\n" + "\n".join(
            f"- [{t.id}] {t.text}" for t in posts.data
        )
    except Exception as e:
        return f"Failed to fetch tweets: {e}"


async def _get_mentions(args: dict, x_client) -> str:
    if x_client is None:
        return "X client not configured."
    max_results = int(args.get("max_results", 10))
    try:
        mentions = x_client.get_mentions(max_results)
        if not mentions or not mentions.data:
            return "No recent mentions."
        return "Recent mentions:\n" + "\n".join(
            f"- [{t.id}] {t.text}" for t in mentions.data
        )
    except Exception as e:
        return f"Failed to fetch mentions: {e}"


async def _post_tweet(args: dict, x_client, tweet_image_fn) -> str:
    if x_client is None:
        return "X client not configured — tweet not sent."
    text        = args.get("text", "")
    article_url = args.get("article_url")
    reply_to    = args.get("reply_to_id")

    if len(text) > 280:
        return f"Tweet too long ({len(text)} chars). Max 280."

    media_id = None
    if article_url and tweet_image_fn:
        try:
            img_bytes = await tweet_image_fn(article_url)
            if img_bytes:
                media_id = x_client.upload_media(img_bytes)
        except Exception as e:
            print(f"[TWEET IMAGE] Failed: {e}")

    try:
        resp = x_client.create_tweet(
            text=text,
            media_ids=[media_id] if media_id else None,
            reply_to=reply_to,
        )
        tweet_id = resp.data.get("id", "?")
        return f"Tweet posted successfully! ID: {tweet_id}"
    except Exception as e:
        return f"Tweet failed: {e}"
