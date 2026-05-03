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
                    "article_url":    {"type": "string", "description": "Optional: URL of article to attach as a news-card image (keeps URL out of tweet text)"},
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
                "Attempt to fetch trending topics. NOTE: This endpoint requires X Pro plan "
                "and will likely return an error on the current plan. "
                "Use search_tweets with relevant keywords as a better alternative."
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

    safety_error = _check_tweet_safety(text)
    if safety_error:
        print(f"[TWITTER] post_tweet BLOCKED by safety filter: {safety_error}")
        return safety_error

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
        if "453" in err_str or "403" in err_str or "subset of X API" in err_str:
            print("[TWITTER] get_trends: endpoint not available on current X plan (requires Pro)")
            return (
                "The Twitter trends endpoint (v1.1/trends/place) requires an X API Pro plan "
                "and is not available on the current Basic/Free tier. "
                "I can still post tweets, read mentions, and check news. "
                "For sports trends, try fetching sports news instead with get_news(category='sports')."
            )
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


async def _check_api_credits(x_client) -> str:
    import datetime
    try:
        import redis as _sync_redis
        r = _sync_redis.from_url(REDIS_URL, decode_responses=True)
        today = datetime.date.today().isoformat()
        groq_tokens = int(r.get(f"groq:tokens:{today}") or 0)
        groq_calls  = int(r.get(f"groq:calls:{today}") or 0)
        search_limit = r.hgetall("rate:/tweets/search/recent") or {}
        search_rem   = search_limit.get("remaining", "unknown")
    except Exception:
        groq_tokens = groq_calls = 0
        search_rem = "unknown"

    budget = await get_budget_status()
    lines = [
        "== API CREDIT REPORT ==",
        f"AI brain (Groq): {groq_tokens:,} tokens / {groq_calls} calls used today",
        f"X search quota: {search_rem} requests remaining this 15-min window",
        f"GNews: {budget['gnews']['used']}/{budget['gnews']['limit']} calls today",
        f"NewsAPI: {budget['newsapi']['used']}/{budget['newsapi']['limit']} calls today",
        f"Guardian: unlimited (no counter)",
    ]
    return "\n".join(lines)
