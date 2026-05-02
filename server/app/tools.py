"""
tools.py — All agent tools: schema definitions (OpenAI-compatible JSON) + dispatch logic.

Tools available to Courage:
  - get_news              : fetch news by category (5 per category)
  - fetch_article         : scrape full article text
  - get_x_rate_status     : check Twitter API rate limits
  - get_my_tweets         : fetch @runcouragerun's recent posts
  - get_mentions          : fetch mentions and replies
  - post_tweet            : post a tweet (or reply)
  - get_twitter_trends    : discover trending topics on X/Twitter
  - get_twitter_memory    : recall Courage's stored Twitter activity history
  - record_twitter_action : save a tweet/mention/trend to long-term memory
"""

import json
import time
from typing import Any

from app.news_cache import (
    get_cached_articles, get_all_recent,
    fetch_from_gnews, fetch_from_guardian,
    fetch_full_article, save_full_content,
    save_articles, cache_articles,
    fetch_pair,
)
from app.config import GNEWS_API_KEY
import app.twitter_memory as tw_mem

# ── Tool schema definitions ────────────────────────────────────────────────────

TOOL_SCHEMAS = [
    # ── News ──────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_news",
            "description": (
                "Retrieve recent news articles for a SINGLE country+category pair. "
                "Returns up to 5 articles. "
                "Call this MULTIPLE times with different categories to get broad coverage: "
                "general, technology, business, sports, science, health. "
                "Always call this before discussing any news topic — never invent headlines."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "country":  {"type": "string",  "default": "us",      "description": "ISO country code, e.g. 'us', 'gb'"},
                    "category": {"type": "string",  "default": "general", "description": "One of: general, technology, business, sports, science, health, entertainment"},
                    "refresh":  {"type": "boolean", "default": False,     "description": "Force fresh API fetch even if cache is warm"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_article",
            "description": "Fetch the full text of a specific news article by URL. Use when a user wants details beyond the headline.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full article URL"},
                },
                "required": ["url"],
            },
        },
    },
    # ── Twitter / X ───────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_x_rate_status",
            "description": "Check current Twitter/X API rate limit status before making any X API calls. Always call this first before posting.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_tweets",
            "description": (
                "Retrieve @runcouragerun's recent tweets directly from the X API. "
                "Use get_twitter_memory instead if you just want a quick summary of past activity "
                "without spending a rate-limit call."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "default": 5, "description": "Number of recent tweets to fetch (5-10)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_mentions",
            "description": (
                "Fetch recent mentions and replies to @runcouragerun on X. "
                "You should proactively check this and reply to interesting mentions. "
                "After replying, call record_twitter_action to save it."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "default": 10, "description": "Number of mentions to fetch"},
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
                "Post a tweet as @runcouragerun. ALWAYS call get_x_rate_status first. "
                "Tweets must be Courage-voiced: punchy, dramatically anxious, 1-2 sentences + a Courage-ism. "
                "Max 280 chars. After posting successfully, call record_twitter_action to save it to memory."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text":        {"type": "string", "description": "Tweet text (max 280 chars)"},
                    "article_url": {"type": "string", "description": "Optional: URL of article to attach as a news-card image"},
                    "reply_to_id": {"type": "string", "description": "Optional: tweet ID to reply to (for replying to mentions)"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_twitter_trends",
            "description": (
                "Discover what topics are currently trending on Twitter/X. "
                "Use this to find viral news, crypto meme trends, and pop-culture moments worth tweeting about. "
                "After reviewing trends, call record_twitter_action to save interesting ones to memory."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "woeid": {"type": "integer", "default": 1, "description": "Yahoo Where-On-Earth ID. 1=worldwide, 23424977=US, 23424975=UK"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_twitter_memory",
            "description": (
                "Recall your stored Twitter activity history: tweets you posted, mentions received, "
                "and trends discovered — WITHOUT hitting the X API. "
                "Use this when a user asks what you've been up to on Twitter."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "record_twitter_action",
            "description": (
                "Save a Twitter action to your long-term memory (SQLite attic computer). "
                "Call this AFTER: posting a tweet, replying to a mention, or discovering interesting trends. "
                "This lets you remember your own activity without burning API rate limits."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "description": "One of: 'tweet' (posted), 'mention_reply' (replied to someone), 'trend' (discovered a trend)",
                    },
                    "tweet_id":    {"type": "string", "description": "Tweet ID (for tweet or mention_reply actions)"},
                    "text":        {"type": "string", "description": "Text content of tweet or trend topic"},
                    "reply_to_id": {"type": "string", "description": "For replies: the tweet ID you replied to"},
                    "author":      {"type": "string", "description": "For mentions: the @username who mentioned you"},
                    "trend_data":  {"type": "string", "description": "For trends: JSON array of {name, tweet_volume} objects"},
                },
                "required": ["action_type"],
            },
        },
    },
]

# ── Tool name lookup ───────────────────────────────────────────────────────────

TOOL_NAMES = {t["function"]["name"] for t in TOOL_SCHEMAS}


# ── Tool dispatch ─────────────────────────────────────────────────────────────

async def dispatch_tool(name: str, args: dict, x_client=None, tweet_image_fn=None) -> str:
    """Execute a tool call and return a string result for the LLM."""
    try:
        match name:
            case "get_news":              return await _get_news(args)
            case "fetch_article":         return await _fetch_article(args)
            case "get_x_rate_status":     return await _get_x_rate_status(x_client)
            case "get_my_tweets":         return await _get_my_tweets(args, x_client)
            case "get_mentions":          return await _get_mentions(args, x_client)
            case "post_tweet":            return await _post_tweet(args, x_client, tweet_image_fn)
            case "get_twitter_trends":    return await _get_twitter_trends(args, x_client)
            case "get_twitter_memory":    return await _get_twitter_memory()
            case "record_twitter_action": return await _record_twitter_action(args)
            case _:                       return f"Unknown tool: {name}"
    except Exception as e:
        return f"Tool error ({name}): {e}"


# ── Individual tool implementations ───────────────────────────────────────────

async def _get_news(args: dict) -> str:
    country  = args.get("country",  "us")
    category = args.get("category", "general")
    refresh  = args.get("refresh",  False)
    limit    = 5  # Always 5 per category — enforced here

    articles = None
    if not refresh:
        articles = await get_cached_articles(country, category)

    if not articles:
        try:
            articles = await fetch_pair(country, category, max_results=limit)
            if articles:
                await save_articles(articles, country, category)
                await cache_articles(articles, country, category)
        except Exception as e:
            return f"News fetch failed: {e}"

    if not articles:
        return f"No news articles available right now for {country}/{category}."

    out = f"Found {len(articles[:limit])} articles ({country.upper()}/{category}):\n\n"
    for i, a in enumerate(articles[:limit], 1):
        source = a.get("source", {}).get("name") or a.get("source_name", "Unknown")
        out += f"[{i}] {a.get('title', 'No title')}\n"
        out += f"    Source: {source}\n"
        out += f"    URL: {a.get('url', '')}\n"
        out += f"    {a.get('description', '')[:200]}\n\n"
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
    print("[TWITTER] Tool: get_x_rate_status")
    if x_client is None:
        print("[TWITTER] X client not configured")
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
    result = "X Rate Limits:\n" + "\n".join(lines)
    print(f"[TWITTER] Rate status: {result}")
    return result


async def _get_my_tweets(args: dict, x_client) -> str:
    print(f"[TWITTER] Tool: get_my_tweets args={args}")
    if x_client is None:
        return "X client not configured."
    max_results = int(args.get("max_results", 5))
    try:
        posts = x_client.get_my_recent_posts(max_results)
        if not posts or not posts.data:
            print("[TWITTER] get_my_tweets: no posts returned")
            return "No recent posts found."
        lines = [f"- [{t.id}] {t.text}" for t in posts.data]
        print(f"[TWITTER] get_my_tweets: found {len(posts.data)} posts")
        return "Recent @runcouragerun tweets:\n" + "\n".join(lines)
    except Exception as e:
        print(f"[TWITTER] get_my_tweets FAILED: {e}")
        return f"Failed to fetch tweets: {e}"


async def _get_mentions(args: dict, x_client) -> str:
    print(f"[TWITTER] Tool: get_mentions args={args}")
    if x_client is None:
        return "X client not configured."
    max_results = int(args.get("max_results", 10))
    try:
        mentions = x_client.get_mentions(max_results)
        if not mentions or not mentions.data:
            print("[TWITTER] get_mentions: no mentions returned")
            return "No recent mentions."
        lines = []
        for t in mentions.data:
            lines.append(f"- [{t.id}] {t.text}")
            await tw_mem.record_mention(str(t.id), str(getattr(t, "author_id", "unknown")), t.text)
        print(f"[TWITTER] get_mentions: found {len(mentions.data)} mentions")
        return "Recent mentions:\n" + "\n".join(lines)
    except Exception as e:
        print(f"[TWITTER] get_mentions FAILED: {e}")
        return f"Failed to fetch mentions: {e}"


async def _post_tweet(args: dict, x_client, tweet_image_fn) -> str:
    print(f"[TWITTER] Tool: post_tweet text='{args.get('text','')[:80]}...'")
    if x_client is None:
        return "X client not configured — tweet not sent."
    text        = args.get("text", "")
    article_url = args.get("article_url")
    reply_to    = args.get("reply_to_id")

    if not text:
        return "No tweet text provided."
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
        await tw_mem.record_tweet(str(tweet_id), text, reply_to)
        if reply_to:
            await tw_mem.mark_mention_replied(reply_to)
        print(f"[TWITTER] Tweet posted OK: id={tweet_id}")
        return f"Tweet posted successfully! ID: {tweet_id}"
    except Exception as e:
        print(f"[TWITTER] post_tweet FAILED: {e}")
        return f"Tweet failed: {e}"


async def _get_twitter_trends(args: dict, x_client) -> str:
    print(f"[TWITTER] Tool: get_twitter_trends args={args}")
    if x_client is None:
        return "X client not configured."
    woeid = int(args.get("woeid", 1))
    try:
        trends_raw = x_client.get_trends(woeid)
        if not trends_raw or not trends_raw[0]:
            print("[TWITTER] get_trends: no trends data returned")
            return "No trends data available."
        trends = trends_raw[0][:20]  # Top 20
        lines = []
        trend_dicts = []
        for t in trends:
            vol = t.tweet_volume or 0
            vol_str = f"{vol:,}" if vol else "n/a"
            lines.append(f"- {t.name} ({vol_str} tweets)")
            trend_dicts.append({"name": t.name, "tweet_volume": vol})
        await tw_mem.record_trends(trend_dicts, woeid)
        label = {1: "Worldwide", 23424977: "United States", 23424975: "United Kingdom"}.get(woeid, f"WOEID {woeid}")
        print(f"[TWITTER] get_trends OK: {len(trends)} trends for {label}")
        return f"Trending on Twitter ({label}):\n" + "\n".join(lines)
    except Exception as e:
        print(f"[TWITTER] get_trends FAILED: {e}")
        return f"Failed to fetch trends: {e}"


async def _get_twitter_memory() -> str:
    return await tw_mem.get_twitter_summary()


async def _record_twitter_action(args: dict) -> str:
    action_type = args.get("action_type", "")
    tweet_id    = args.get("tweet_id")
    text        = args.get("text", "")
    reply_to_id = args.get("reply_to_id")
    author      = args.get("author")
    trend_data  = args.get("trend_data")

    try:
        if action_type == "tweet" and tweet_id:
            await tw_mem.record_tweet(tweet_id, text, reply_to_id)
            return f"Recorded tweet {tweet_id} to memory."
        elif action_type == "mention_reply" and tweet_id:
            if reply_to_id:
                await tw_mem.mark_mention_replied(reply_to_id)
            await tw_mem.record_tweet(tweet_id, text, reply_to_id)
            return f"Recorded reply {tweet_id} to memory and marked original as replied."
        elif action_type == "trend" and trend_data:
            trends = json.loads(trend_data) if isinstance(trend_data, str) else trend_data
            await tw_mem.record_trends(trends)
            return f"Recorded {len(trends)} trends to memory."
        else:
            return "Nothing to record — check action_type and required fields."
    except Exception as e:
        return f"Memory write failed: {e}"
