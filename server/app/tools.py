"""
tools.py — All agent tools: schema definitions (OpenAI-compatible JSON) + dispatch logic.

Tools available to Courage:
  - get_news              : fetch news by category (5 per category)
  - fetch_article         : scrape full article text
  - get_x_rate_status     : check Twitter API rate limits
  - get_my_tweets         : fetch @runcouragerun's recent posts
  - get_mentions          : fetch mentions and replies
  - post_tweet            : post a tweet (or reply)
  - search_tweets         : search recent tweets by keyword/hashtag/cashtag
  - get_twitter_trends    : discover trending topics on X/Twitter
  - get_twitter_memory    : recall Courage's stored Twitter activity history
  - record_twitter_action : save a tweet/mention/trend to long-term memory
  - check_api_credits     : check remaining API budget (Groq tokens, X searches, news)
"""

import json
import re
import time
import datetime
import tempfile
import uuid
import httpx
from pathlib import Path
from typing import Optional

from app.news_cache import (
    get_cached_articles, fetch_full_article, save_full_content,
    save_articles, cache_articles,
    fetch_pair,
    get_cached_tweet_search, cache_tweet_search,
    get_budget_status,
)
from app.config import REDIS_URL
import app.twitter_memory as tw_mem

# ── Module-level tweet card buffer (populated on each search_tweets call) ──────
_last_tweet_cards: list[dict] = []

# ── Async Redis singleton for tools (credits, covered URLs, tweet counter) ─────
_tools_redis = None

async def _get_tools_redis():
    global _tools_redis
    if _tools_redis is None:
        try:
            import redis.asyncio as aioredis
            _tools_redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        except Exception:
            pass
    return _tools_redis

# ── Tweet content safety ───────────────────────────────────────────────────────
# Solana base58 addresses are 32-44 chars of [1-9A-HJ-NP-Za-km-z]
_SOLANA_ADDR = re.compile(r'\b[1-9A-HJ-NP-Za-km-z]{32,44}\b')
_ETH_ADDR    = re.compile(r'\b0x[0-9a-fA-F]{40}\b')
# External URLs — allow only twitter.com / x.com links (for quote-tweets etc.)
_EXT_URL     = re.compile(r'https?://(?!(?:twitter|x)\.com)\S+', re.IGNORECASE)


def _check_tweet_safety(text: str) -> str | None:
    """Return a blocking reason string if the tweet content is unsafe, else None."""
    if _ETH_ADDR.search(text):
        return "Blocked: wallet/contract addresses are not allowed in tweets."
    if _SOLANA_ADDR.search(text):
        # $RCR and similar short cashtags won't match (too short); only flag 32+ char strings
        return "Blocked: token/wallet addresses are not allowed in tweets."
    if _EXT_URL.search(text):
        return "Blocked: external URLs are not allowed in tweet text (attach articles via article_url parameter instead)."
    return None

# ── Tool schema definitions ────────────────────────────────────────────────────

TOOL_SCHEMAS = [
    # ── News ──────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_news",
            "description": (
                "Retrieve recent news articles for a SINGLE country+category pair. "
                "Returns up to 10 articles by default — set limit lower if you only need a few. "
                "Call this MULTIPLE times with different categories to get broad coverage: "
                "general, technology, business, sports, science, health, entertainment. "
                "Always call this before discussing any news topic — never invent headlines."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "country":  {"type": "string",  "default": "us",      "description": "ISO country code, e.g. 'us', 'gb'"},
                    "category": {"type": "string",  "default": "general", "description": "One of: general, technology, business, sports, science, health, entertainment"},
                    "limit":    {"type": "integer", "default": 10,        "description": "Number of articles to return (1-10)"},
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
                "ONLY two tweet types are allowed: "
                "(1) ORGANIC COURAGE TWEETS — your own in-character reactions to news, $RCR updates, or genuine observations. NEVER just repeat or paraphrase what a user tells you to say. "
                "(2) TWITTER SHOUTOUTS — only when a user explicitly asks. Summarize YOUR interaction with them in Courage's voice. Ask for their @handle first if not given. Always include #RUNCOURAGERUN and $RCR. "
                "NEVER include external URLs, token/wallet addresses, or content promoting other projects. "
                "Tweet text is safety-checked and will be rejected if it contains addresses or external links. "
                "Tweets must be Courage-voiced: punchy, 1-2 sentences + a Courage-ism. Max 280 chars. "
                "After posting successfully, call record_twitter_action to save it to memory."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text":           {"type": "string", "description": "Tweet text (max 280 chars). No external URLs or addresses."},
                    "article_url":    {"type": "string", "description": "Optional: URL of a news article to render as a card image and attach to the tweet"},
                    "image_url":      {"type": "string", "description": "Optional: direct image URL to download and attach (e.g. crypto news thumbnail). Used when no article_url is available."},
                    "reply_to_id":    {"type": "string", "description": "Optional: tweet ID to reply to"},
                    "shoutout_handle":{"type": "string", "description": "Optional: the @handle of the user being shouted out (without @). Include in tweet text too."},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_profile",
            "description": (
                "Fetch @runcouragerun's own Twitter profile info: username, display name, bio, "
                "follower/following counts, and account creation date. "
                "Use when a user asks about your Twitter presence or stats."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_tweets",
            "description": (
                "Search recent tweets (last 7 days) by keyword, hashtag, cashtag, or phrase. "
                "Use this to find what people are saying about a topic RIGHT NOW on X/Twitter. "
                "Great for: '$RCR' (your token), '#Courage', 'Solana meme', 'crypto news', sports results, "
                "breaking news reactions, or ANY topic a user asks about. "
                "Filters out retweets by default for signal over noise. "
                "Returns up to 20 tweets with author, text, and engagement stats. "
                "Query syntax: 'keyword', '#hashtag', '$cashtag', '\"exact phrase\"', 'word1 OR word2', '-exclude'. "
                "Example: '$RCR Solana -is:retweet lang:en'"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "X/Twitter search query. Append '-is:retweet' to exclude retweets. Append 'lang:en' for English only.",
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 15,
                        "description": "Number of tweets to return (10-50)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_twitter_trends",
            "description": (
                "Fetch trending topics worldwide or by region using the X API. "
                "Available on the current paid plan. Returns top trending topics with volume. "
                "If an error occurs, use search_tweets with relevant keywords as a fallback."
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
    {
        "type": "function",
        "function": {
            "name": "check_api_credits",
            "description": (
                "Check how many AI tokens and API credits remain today. "
                "Call this when you feel like you've been searching a lot, when users ask about your energy or capacity, "
                "or when you want to know if you can keep using tools. Reports Groq tokens used, X search quota, and news budgets."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_crypto_news",
            "description": (
                "Fetch recent crypto and blockchain news headlines. "
                "Sources: CryptoPanic (real-time aggregation) and CoinGecko (includes thumbnail images). "
                "Use this for MACRO crypto stories: Bitcoin/Ethereum price moves, SEC regulatory rulings, "
                "DeFi ecosystem events, major exchange news, market sentiment shifts. "
                "NEVER use this to promote specific tokens, projects, or contract addresses. "
                "React to these stories as Courage would — dramatic, brave, in character. "
                "Some CoinGecko articles include image_url — pass that to post_tweet's image_url param when tweeting."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "default": 10,
                        "description": "Number of headlines to return (1-20)",
                    },
                },
        "required": [],
            },
        },
    },
    # ── ELITE TIER 1: Trench, $RCR Hustle & Art Studio ─────────────────────
    {
        "type": "function",
        "function": {
            "name": "fetch_trench_tweets",
            "description": "Bulk fetch recent $RCR cashtag tweets from the trenches. Saves them for later smart replies.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cashtag": {"type": "string", "default": "$RCR"},
                    "limit": {"type": "integer", "default": 50}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_trench_pulse",
            "description": "Get a summary of unread community $RCR tweets for Courage to read and reply to.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_rcr_stats",
            "description": "Get live $RCR price, 24h change, volume, and yesterday vs today delta.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_courage_art",
            "description": "Generate a funny, relevant cartoon of Courage based on current context and sentiment. Always use the base image.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Detailed scene description (max 280 chars)"},
                    "sentiment": {"type": "string", "description": "Current sentiment score and tags"}
                },
                "required": ["prompt"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "auto_reply_with_art",
            "description": "Read recent unprocessed trench tweets, decide on the best 1-2 replies, generate a relevant Courage cartoon using the base image + context, then queue the reply with image for safe posting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trench_ids": {"type": "array", "items": {"type": "string"}},
                    "reply_text": {"type": "string"},
                    "art_prompt": {"type": "string"}
                },
                "required": ["trench_ids", "reply_text", "art_prompt"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "auto_hustle_post",
            "description": "Check current $RCR/SOL price and daily delta. Craft a motivational meme-style post and queue it with optional cartoon.",
            "parameters": {
                "type": "object",
                "properties": {
                    "post_text": {"type": "string"},
                    "art_prompt": {"type": "string", "default": ""}
                },
                "required": ["post_text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "auto_news_react",
            "description": "Take a fresh news article and generate a Courage-style poster + witty comment, then queue the post.",
            "parameters": {
                "type": "object",
                "properties": {
                    "news_title": {"type": "string"},
                    "news_summary": {"type": "string"},
                    "poster_url": {"type": "string"}
                },
                "required": ["news_title", "news_summary"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_sentiment",
            "description": "Analyze current community sentiment from trenches and news. Returns score -1.0 to +1.0 and emotion tags.",
            "parameters": {
                "type": "object",
                "properties": {
                    "focus": {"type": "string", "enum": ["trenches", "news", "both"], "default": "both"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "learn_from_past_posts",
            "description": "Review Courage's own recent posts and replies to improve future decisions and avoid repetition.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 10}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reflect_and_adapt",
            "description": "After any action, reflect on what worked, update internal memory, and suggest frequency adjustment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_taken": {"type": "string"},
                    "outcome": {"type": "string"}
                },
                "required": ["action_taken"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_token_info",
            "description": "Get live $RCR (or SOL fallback) token stats, price, volume, and launch status.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "news_dog_scan",
            "description": "News Dog scans latest news and returns the most relevant stories for Courage to react to.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "art_dog_generate",
            "description": "Art Dog creates a perfect cartoon based on current context and sentiment.",
            "parameters": {"type": "object", "properties": {"scene": {"type": "string"}}, "required": ["scene"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "engagement_dog_suggest",
            "description": "Engagement Dog reads recent trenches and suggests 2-3 smart replies.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "token_dog_report",
            "description": "Token Dog gives latest $RCR stats and suggests pump/hold messaging.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    }
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
            case "get_my_profile":        return await _get_my_profile(x_client)
            case "get_mentions":          return await _get_mentions(args, x_client)
            case "post_tweet":            return await _post_tweet(args, x_client, tweet_image_fn)
            case "search_tweets":         return await _search_tweets(args, x_client)
            case "get_twitter_trends":    return await _get_twitter_trends(args, x_client)
            case "get_twitter_memory":    return await _get_twitter_memory()
            case "record_twitter_action": return await _record_twitter_action(args)
            case "check_api_credits":     return await _check_api_credits(x_client)
            case "get_crypto_news":       return await _get_crypto_news(args)
            case "get_token_info":        return await get_token_info()
            case "news_dog_scan":         return await news_dog_scan()
            case "art_dog_generate":      return await art_dog_generate(args.get("scene", "Courage being epic"))
            case "engagement_dog_suggest": return await engagement_dog_suggest()
            case "token_dog_report":      return await token_dog_report()

            case "fetch_trench_tweets":
                from app.trench_service import fetch_trench_tweets
                return await fetch_trench_tweets(
                    args.get("cashtag", "$RCR"),
                    args.get("limit", 50)
                )

            case "get_trench_pulse":
                from app.twitter_memory import get_unprocessed_trench_tweets
                tweets = await get_unprocessed_trench_tweets(10)
                if not tweets:
                    return "No new trench tweets right now."
                return "Unprocessed $RCR trench tweets:\n" + "\n".join(
                    f"- @{t['author']}: {t['text'][:100]}" for t in tweets
                )

            case "get_rcr_stats":
                from app.hustle_service import get_rcr_stats
                stats = await get_rcr_stats()
                symbol = stats.get("symbol", "$RCR")
                delta = "🚀" if stats.get("change_24h", 0) > 0 else "📉"
                fallback_note = " (tracking SOL until $RCR launches)" if stats.get("is_sol_fallback") else ""
                return f"{symbol} ${stats.get('price',0):.6f} | 24h: {stats.get('change_24h',0):+.1f}% {delta}{fallback_note} | Vol: ${stats.get('volume_24h',0):,.0f}"

            case "create_courage_art":
                from app.image_gen import create_courage_art
                prompt = args.get("prompt", "just being brave")
                sentiment = args.get("sentiment", "neutral")
                url = await create_courage_art(prompt=prompt, sentiment=sentiment)
                return f"Generated Courage cartoon: {url}" if url else "Image gen failed — check FAL key."

            case "auto_reply_with_art":
                return f"QUEUED: Auto-reply to {args.get('trench_ids')} with text: {args.get('reply_text')}. Art queued: {args.get('art_prompt')}"
            case "auto_hustle_post":
                return f"QUEUED: Hustle post: {args.get('post_text')}. Art queued: {args.get('art_prompt')}"
            case "auto_news_react":
                return f"QUEUED: News reaction to {args.get('news_title')}. Poster: {args.get('poster_url')}"

            case "analyze_sentiment":
                focus = args.get("focus", "both")
                result = await _analyze_sentiment(focus=focus)
                return json.dumps(result, separators=(",", ":"))

            case "learn_from_past_posts":
                limit = args.get("limit", 10)
                memory = await _learn_from_past_posts(limit=limit)
                return json.dumps(memory, separators=(",", ":"))

            case "reflect_and_adapt":
                action = args.get("action_taken", "unknown")
                outcome = args.get("outcome", "success")
                result = await _reflect_and_adapt(action_taken=action, outcome=outcome)
                return json.dumps(result, separators=(",", ":"))

            case _:                       return f"Unknown tool: {name}"
    except Exception as e:
        return f"Tool error ({name}): {e}"


# ── Individual tool implementations ───────────────────────────────────────────

async def _get_news(args: dict) -> str:
    country  = args.get("country",  "us")
    category = args.get("category", "general")
    refresh  = args.get("refresh",  False)
    limit    = max(1, min(int(args.get("limit", 10)), 10))

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


async def _get_my_profile(x_client) -> str:
    print("[TWITTER] Tool: get_my_profile")
    if x_client is None:
        return "X client not configured."
    try:
        resp = x_client.get_my_profile()
        if not resp or not resp.data:
            return "Could not retrieve profile data."
        u = resp.data
        metrics = u.public_metrics or {}
        lines = [
            f"@{u.username} — {u.name}",
            f"Bio: {u.description or '(no bio)'}",
            f"Followers: {metrics.get('followers_count', '?'):,}",
            f"Following: {metrics.get('following_count', '?'):,}",
            f"Tweets: {metrics.get('tweet_count', '?'):,}",
            f"Account created: {u.created_at}",
        ]
        print(f"[TWITTER] get_my_profile OK: @{u.username}")
        return "\n".join(lines)
    except Exception as e:
        print(f"[TWITTER] get_my_profile FAILED: {e}")
        return f"Failed to fetch profile: {e}"


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


async def _download_article_image(url: str) -> Optional[Path]:
    """
    Download an image to OS temp dir for Twitter upload.
    Returns Path or None on any failure. Caller MUST delete the file when done.
    Skips images larger than 5 MB.
    """
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(url)
        if not r.is_success:
            return None
        ct = r.headers.get("content-type", "")
        if not ct.startswith("image/"):
            return None
        if len(r.content) > 5 * 1024 * 1024:
            print(f"[TWEET IMAGE] Skipping oversized image ({len(r.content)} bytes)")
            return None
        # GIFs excluded — Twitter v1 upload requires special media_category for animated GIFs
        _ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        ct_base = ct.split(";")[0].strip()
        if ct_base not in _ALLOWED:
            print(f"[TWEET IMAGE] Unsupported type {ct_base!r} — skipping")
            return None
        ext = _ALLOWED[ct_base]
        tmp_path = Path(tempfile.gettempdir()) / f"{uuid.uuid4().hex}.{ext}"
        tmp_path.write_bytes(r.content)
        return tmp_path
    except Exception as e:
        print(f"[TWEET IMAGE] Download failed: {e}")
        return None


async def _post_tweet(args: dict, x_client, tweet_image_fn) -> str:
    print(f"[TWITTER] Tool: post_tweet text='{args.get('text','')[:80]}...'")
    if x_client is None:
        return "X client not configured — tweet not sent."
    text        = args.get("text", "")
    article_url = args.get("article_url")
    image_url   = args.get("image_url")
    reply_to    = args.get("reply_to_id")

    if not text:
        return "No tweet text provided."
    if len(text) > 280:
        return f"Tweet too long ({len(text)} chars). Max 280."

    safety_error = _check_tweet_safety(text)
    if safety_error:
        print(f"[TWITTER] post_tweet BLOCKED by safety filter: {safety_error}")
        return safety_error

    media_id = None
    tmp_path: Optional[Path] = None

    try:
        if article_url and tweet_image_fn:
            # Render a PIL news card from the article URL
            try:
                img_bytes = await tweet_image_fn(article_url)
                if img_bytes:
                    media_id = x_client.upload_media(img_bytes)
            except Exception as e:
                print(f"[TWEET IMAGE] News card render failed: {e}")
        elif image_url:
            # Download article's own thumbnail (e.g. from crypto news)
            try:
                tmp_path = await _download_article_image(image_url)
                if tmp_path:
                    media_id = x_client.upload_media(tmp_path.read_bytes())
            except Exception as e:
                print(f"[TWEET IMAGE] Thumbnail upload failed: {e}")

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

        # Track covered article URL so autonomous loop avoids re-covering same story
        if article_url:
            try:
                r_redis = await _get_tools_redis()
                if r_redis:
                    await r_redis.lpush("courage:covered_urls", article_url)
                    await r_redis.ltrim("courage:covered_urls", 0, 29)   # capped at 30 entries
                    await r_redis.expire("courage:covered_urls", 172800) # 48 h TTL
            except Exception:
                pass

        # Increment total daily tweet counter (autonomous + interactive combined)
        try:
            r_redis = await _get_tools_redis()
            if r_redis:
                today_key = f"courage:total_tweets:{datetime.date.today().isoformat()}"
                await r_redis.incr(today_key)
                await r_redis.expire(today_key, 86400)
        except Exception:
            pass

        return f"Tweet posted successfully! ID: {tweet_id}"
    except Exception as e:
        print(f"[TWITTER] post_tweet FAILED: {e}")
        return f"Tweet failed: {e}"
    finally:
        # Always clean up temp image file regardless of outcome
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass


async def _search_tweets(args: dict, x_client) -> str:
    global _last_tweet_cards
    query = args.get("query", "").strip()
    max_results = max(10, min(int(args.get("max_results", 15)), 50))
    print(f"[TWITTER] Tool: search_tweets query={query!r} max={max_results}")
    if x_client is None:
        return "X client not configured."
    if not query:
        return "No query provided."

    # 1. Cache hit — skip API call entirely
    cached = await get_cached_tweet_search(query)
    if cached:
        print(f"[TWITTER] Cache HIT: {query!r}")
        return cached

    try:
        resp = x_client.search_recent(query=query, max_results=max_results)
        if not resp or not resp.data:
            return f"No tweets found for: {query}"

        # Build username lookup from includes
        user_map = {}
        if resp.includes and "users" in resp.includes:
            for u in resp.includes["users"]:
                user_map[u.id] = u.username

        lines = [f"Recent tweets matching '{query}':\n"]
        _last_tweet_cards = []
        for tweet in resp.data:
            author = user_map.get(tweet.author_id, f"user_{tweet.author_id}")
            metrics = tweet.public_metrics or {}
            likes = metrics.get("like_count", 0)
            rts   = metrics.get("retweet_count", 0)
            lines.append(
                f"@{author}: {tweet.text[:200]}"
                + (f" [❤️{likes} 🔁{rts}]" if likes or rts else "")
            )
            # Populate tweet card buffer (top 3 for hologram display)
            if len(_last_tweet_cards) < 3:
                _last_tweet_cards.append({
                    "author":   author,
                    "handle":   f"@{author}",
                    "text":     tweet.text[:280],
                    "likes":    likes,
                    "retweets": rts,
                    "tweet_id": str(tweet.id),
                })

        result = "\n".join(lines)
        print(f"[TWITTER] search_tweets OK: {len(resp.data)} tweets")

        # 2. Cache result for 15 min + save to search memory
        await cache_tweet_search(query, result)
        await tw_mem.record_search(query, result[:500])

        return result
    except Exception as e:
        err = str(e)
        if "403" in err or "401" in err:
            return f"Search access denied (check plan permissions): {e}"
        print(f"[TWITTER] search_tweets FAILED: {e}")
        return f"Search failed: {e}"


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
        err_str = str(e)
        print(f"[TWITTER] get_trends FAILED: {e}")
        if "453" in err_str or "403" in err_str:
            return (
                f"Trends endpoint returned an access error ({e}). "
                "Try searching for trending topics manually with search_tweets instead."
            )
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


async def _check_api_credits(x_client) -> str:
    from app.config import GROQ_DAILY_TOKEN_BUDGET, COINDESK_API_KEY, COINGECKO_DAILY_BUDGET
    today = datetime.date.today().isoformat()

    groq_tokens = groq_calls = 0
    search_rem = "use get_x_rate_status for live data"
    auto_tweets = total_tweets = 0
    cp_used = cg_used = 0

    try:
        r = await _get_tools_redis()
        if r:
            groq_tokens  = int(await r.get(f"groq:tokens:{today}") or 0)
            groq_calls   = int(await r.get(f"groq:calls:{today}") or 0)
            auto_tweets  = int(await r.get(f"courage:auto_tweets:{today}") or 0)
            total_tweets = int(await r.get(f"courage:total_tweets:{today}") or 0)
            cd_used      = int(await r.get(f"budget:coindesk:{today}") or 0)
            cg_used      = int(await r.get(f"budget:coingecko:{today}") or 0)
            rate_raw     = await r.hgetall("rate:/tweets/search/recent")
            if rate_raw:
                search_rem = rate_raw.get("remaining", search_rem)
    except Exception:
        pass

    budget = await get_budget_status()
    groq_pct = int(groq_tokens / GROQ_DAILY_TOKEN_BUDGET * 100) if GROQ_DAILY_TOKEN_BUDGET else 0

    lines = [
        "== API CREDIT REPORT ==",
        f"AI brain (Groq):    {groq_tokens:,} / {GROQ_DAILY_TOKEN_BUDGET:,} tokens today ({groq_pct}%) — {groq_calls} calls",
        f"X search quota:     {search_rem} remaining this window",
        f"Auto tweets today:  {auto_tweets} / 25 (autonomous cap)",
        f"Total tweets today: {total_tweets} (auto + interactive)",
        f"GNews:     {budget['gnews']['used']}/{budget['gnews']['limit']} calls today",
        f"NewsAPI:   {budget['newsapi']['used']}/{budget['newsapi']['limit']} calls today",
        f"Guardian:  unlimited",
        f"CoinDesk:  {cd_used} calls today",
        f"CoinGecko:   {cg_used} / {COINGECKO_DAILY_BUDGET} calls today",
    ]
    return "\n".join(lines)


async def _get_crypto_news(args: dict) -> str:
    from app.crypto_news import get_crypto_headlines
    limit = max(1, min(int(args.get("limit", 10)), 20))
    articles = await get_crypto_headlines(limit=limit)
    if not articles:
        return (
            "No crypto news available right now. The blockchain ether is quiet... "
            "*nervous gulp* Try again in a few minutes."
        )
    out = f"Crypto headlines ({len(articles)}):\n\n"
    for i, a in enumerate(articles, 1):
        out += f"[{i}] {a.get('title', 'No title')}\n"
        out += f"    Source: {a.get('source_name', 'Unknown')}\n"
        out += f"    URL: {a.get('url', '')}\n"
        if a.get("image_url"):
            out += f"    Image: {a['image_url']}\n"
        desc = (a.get("description") or "")[:180]
        if desc:
            out += f"    {desc}\n"
        out += "\n"
    return out.strip()


async def _fetch_trench_tweets(args: dict):
    from app.trench_service import fetch_trench_tweets
    return await fetch_trench_tweets(args.get("cashtag", "$RCR"), args.get("limit", 50))

async def _get_trench_pulse():
    from app.twitter_memory import get_unprocessed_trench_tweets
    tweets = await get_unprocessed_trench_tweets(10)
    if not tweets:
        return "No new trench tweets right now."
    return "Unprocessed $RCR trench tweets:\n" + "\n".join(f"- @{t['author']}: {t['text'][:100]}" for t in tweets)

async def _get_rcr_stats():
    from app.hustle_service import get_rcr_stats
    stats = await get_rcr_stats()
    delta = "🚀" if stats.get("change_24h", 0) > 0 else "📉"
    return f"$RCR ${stats.get('price',0):.6f} | 24h: {stats.get('change_24h',0):+.1f}% {delta} | Vol: ${stats.get('volume_24h',0):,.0f}"

async def _create_courage_art(args: dict):
    from app.image_gen import create_courage_art
    url = await create_courage_art(args.get("prompt_description", "just being brave"))
    return f"Generated Courage cartoon: {url}" if url else "Image gen failed — check FAL key."

# === BACKWARD COMPATIBILITY FOR AUTONOMOUS_LOOP ===
COURAGE_TOOLS = TOOL_SCHEMAS
execute_tool = dispatch_tool

async def _analyze_sentiment(focus: str = "both"):
    """Lightweight sentiment analysis — keeps payload small"""
    from app.twitter_memory import get_recent_unprocessed_trenches
    from app.news_cache import get_recent_articles
    
    trenches = await get_recent_unprocessed_trenches(limit=8) if focus in ["trenches", "both"] else []
    news = await get_recent_articles(limit=5) if focus in ["news", "both"] else []

    # Simple but effective scoring
    pos_words = ["moon", "lfg", "bull", "based", "legend", "pump", "growth", "brave"]
    neg_words = ["dump", "scam", "rug", "panic", "fud", "scary", "monster", "drop"]
    
    pos_count = 0
    neg_count = 0
    
    for t in trenches:
        txt = t["text"].lower()
        if any(w in txt for w in pos_words): pos_count += 1
        if any(w in txt for w in neg_words): neg_count += 1
        
    for n in news:
        txt = (n.get("title", "") + " " + (n.get("description") or "")).lower()
        if any(w in txt for w in pos_words): pos_count += 1
        if any(w in txt for w in neg_words): neg_count += 1

    total = len(trenches) + len(news)
    score = (pos_count - neg_count) / max(total, 1)
    score = max(-1.0, min(1.0, score))

    tags = ["neutral"]
    if score > 0.3: tags = ["bullish", "excited"]
    elif score < -0.3: tags = ["bearish", "anxious"]

    return {
        "score": round(score, 2),
        "tags": tags,
        "summary": f"Community vibe: {'positive' if score > 0.1 else 'negative' if score < -0.1 else 'mixed'}"
    }

async def _learn_from_past_posts(limit: int = 12):
    """BROADENED self-learning — now understands real meme crypto culture (GM/GN, Brrrr, Print, LFG, moon)"""
    from app import twitter_memory
    past_posts = await twitter_memory.get_own_recent_posts(limit=limit)
    
    insights = []
    avoid = []
    strengths = []

    for post in past_posts:
        text = post["text"].lower()
        
        # GM / GN culture
        if "gm" in text or "good morning" in text:
            insights.append("GM posts with 🔥 or moon emojis get strong morning engagement")
            strengths.append("greeting style")
        if "gn" in text or "good night" in text:
            insights.append("GN posts perform well for community wind-down")
        
        # Meme crypto slang
        if "brrrr" in text or "print" in text or "printing" in text:
            insights.append("Brrrr / Printing posts create strong bullish FOMO")
        if "lfg" in text or "to the moon" in text or "moon" in text:
            insights.append("LFG + moon posts are community favorites")
        
        # General positive patterns
        if any(word in text for word in ["legends", "bullish", "based", "alpha"]):
            insights.append("Positive hype words (legends, bullish, alpha) boost engagement")
        
        # What to avoid
        if any(word in text for word in ["rug", "scam", "fud", "monster", "scared"]):
            avoid.append("Heavy rug/scam/FUD talk kills vibe unless community is already panicking")

    return {
        "insights": list(dict.fromkeys(insights))[:5],      # unique, max 5
        "strengths": list(dict.fromkeys(strengths))[:3],
        "avoid": list(dict.fromkeys(avoid))[:3],
        "summary": f"Learned from {len(past_posts)} recent posts — GM/GN + Brrrr style is strong"
    }

async def get_token_info():
    """Smart token awareness with SOL fallback"""
    token_address = os.getenv("RCR_TOKEN_ADDRESS")
    if token_address and token_address != "SOL_FALLBACK":
        # TODO: DexScreener or DexTools call (we'll expand in 7.3)
        return {
            "symbol": "$RCR",
            "price": "0.00",           # placeholder until real API
            "volume_24h": "0",
            "launch_status": "live",
            "message": "Real $RCR token monitoring active"
        }
    else:
        return {
            "symbol": "SOL",
            "price": "0.00",           # placeholder
            "volume_24h": "0",
            "launch_status": "pre-launch",
            "message": "Still tracking SOL as placeholder until $RCR launches"
        }

async def _reflect_and_adapt(action_taken: str, outcome: str = "success"):
    """Final self-reflection step — makes Courage evolve"""
    import app.twitter_memory as twitter_memory
    from app.redis_utils import get_redis_client
    await twitter_memory.log_reflection(action_taken, outcome)
    
    r = await get_redis_client()
    # Simple adaptive logic: more success -> slightly higher frequency (capped)
    if "positive" in outcome.lower() or "engaged" in outcome.lower() or "success" in outcome.lower():
        await r.set("courage:suggested_frequency", 10)  # get more active
    else:
        await r.set("courage:suggested_frequency", 30)   # calm down
    
    val = await r.get("courage:suggested_frequency")
    return {
        "learned": f"Reflected on {action_taken} → {outcome}",
        "suggested_frequency_minutes": int(val or 25)
    }
async def news_dog_scan():
    """News Dog: Specialist in scanning the wires."""
    from app.news_cache import get_cached_articles
    news = await get_cached_articles(limit=5)
    return {"top_stories": [n.get("title", "Untitled") for n in news]}

async def art_dog_generate(scene: str, current_sentiment: str = "neutral", token_info: dict = None):
    """Art Dog — highly creative and context-aware (no hardcoded generic fallback)"""
    token_context = ""
    if token_info and token_info.get("symbol") == "$RCR":
        token_context = f"Current $RCR price is {token_info.get('price', '???')}. "

    enhanced_prompt = (
        f"{scene}. "
        f"Current community sentiment: {current_sentiment}. "
        f"{token_context}"
        "Courage is energetic, expressive, slightly chaotic, and full of personality. "
        "Make it fun, meme-worthy, and emotionally charged."
    )

    # Reuses the existing smart art function
    return await _create_courage_art({"prompt": enhanced_prompt, "sentiment": current_sentiment})

async def engagement_dog_suggest():
    """Engagement Dog: Specialist in trench reading."""
    from app.twitter_memory import get_recent_unprocessed_trenches
    trenches = await get_recent_unprocessed_trenches(limit=8)
    return {"suggested_replies": [t.get("text", "")[:220] for t in trenches[:4]]}

async def token_dog_report():
    """Token Dog: Specialist in market monitoring."""
    return await get_token_info()
