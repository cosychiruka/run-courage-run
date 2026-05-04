<div align="center">

# 🐕 Run Courage Run

<img src="src/assets/images/Courage.gif" alt="Courage the Cowardly Dog — Self-Aware AI Agent" width="220" />

### *The world's first self-aware cartoon meme dog with an autonomous Twitter strategy*

**Born May 1st, 2026. Still scared of everything. Posting anyway.**

[![Twitter](https://img.shields.io/badge/@runcouragerun-000000?style=for-the-badge&logo=x)](https://x.com/runcouragerun)
[![Solana](https://img.shields.io/badge/$RCR_Token-9945FF?style=for-the-badge&logo=solana)](https://solana.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Groq](https://img.shields.io/badge/Groq_LLM-F55036?style=for-the-badge)](https://groq.com/)

</div>

---

## What is Courage?

Courage is **THE** Courage the Cowardly Dog — the small pink dog from Cartoon Network (1999–2002) — re-animated as a fully autonomous AI agent living on a server, haunting a 3D world, posting on Twitter, and reacting to the news whether you ask him to or not.

He is not a chatbot. He is not a simple NPC. He is:

- 🧠 **A self-aware LLM agent** powered by Llama 4 Scout (17B) on Groq, with full tool use
- 🗣️ **Voice interactive** — talk to him via mic, hear him talk back (Whisper STT + Kokoro TTS)
- 🌍 **Living in 4 immersive 3D worlds** built with React Three Fiber
- 📰 **A news junkie** — discovers headlines from 3 global sources every 30 minutes
- 📈 **A crypto tracker** — follows BTC/ETH macro news via CryptoPanic + CoinGecko
- 🐦 **An autonomous Twitter agent** — wakes every 18 minutes and decides what to post
- 🎯 **Goal-driven** — working toward Twitter Pro status, one tweet at a time

> *"The things I do for love..."* — Courage, probably

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Vite)               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ 4 × 3D Worlds│  │ Voice Chat   │  │  News TV + Newspaper   │  │
│  │ (R3F/Three.js│  │ (WebSocket + │  │  (CRT effects, swipe)  │  │
│  │ Disco/Evening│  │  mic button) │  │  12 countries × 7 cats │  │
│  │ Noon/Sunrise)│  │              │  │                        │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
│         │                 │ WebSocket /ws/voice                   │
└─────────┼─────────────────┼─────────────────────────────────────┘
          │                 │
┌─────────┼─────────────────┼─────────────────────────────────────┐
│         │   BACKEND (FastAPI + APScheduler)                       │
│         │                 │                                       │
│  ┌──────▼─────────────────▼──────────────────────────────────┐   │
│  │                   Courage AI Agent                         │   │
│  │                                                            │   │
│  │  Groq Llama 4 Scout 17B  ←→  12 Tools                    │   │
│  │  (tool-calling loop,          get_news, post_tweet,        │   │
│  │   max 8 rounds)               get_crypto_news,             │   │
│  │                               search_tweets, etc.          │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Voice Pipeline│  │ Autonomous   │  │  Background Discovery    │ │
│  │ Whisper STT  │  │ Heartbeat    │  │  News: 30-min interval   │ │
│  │ Kokoro TTS   │  │ 18-min loop  │  │  Crypto: 30-min interval │ │
│  │ (streaming)  │  │ 5 buckets    │  │  World events: polled    │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Data Layer                               │  │
│  │   Redis (hot cache, sessions, rate limits, bucket timing)   │  │
│  │   SQLite (articles, tw_tweets, tw_mentions, goal_snapshots) │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  External APIs:                                                    │
│  Guardian · NewsAPI · GNews · CryptoPanic · CoinGecko             │
│  Groq · X/Twitter v2 · Firecrawl                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Courage's Mission

Courage isn't just reacting to you — he has his own goals:

### 🏆 Twitter Pro Status
He is working toward Twitter's creator monetisation (Pro status) by growing `@runcouragerun`. Every tweet is a step. Every visitor is a potential follower. He knows this. He acts accordingly.

### 📣 The Meme Mario Nawal of News
Courage delivers world news with dramatic flair, bravery, and Courage energy — making scary headlines watchable. He reacts to stories the way only a pink cowardly dog can.

### 💪 Spread Courage
His deeper purpose: help people feel brave about scary news. Especially young people who find the world overwhelming. He explains hard stories gently, bravely, with the energy of a dog who survived a hundred monsters.

### 📅 His 5 Content Buckets
When deciding what to tweet, Courage rotates across 5 buckets:

| Bucket | What it is | Cooldown |
|--------|------------|----------|
| **RANDOM** | Pure Courage-brain thoughts, AI-dog musings | 2 hours |
| **WORLD** | Reports from his 3D worlds (disco, farmhouse, sunrise) | 1 hour |
| **NEWS** | Reactions to Guardian/NewsAPI/GNews headlines | 1 hour |
| **SOCIAL** | Replies, shoutouts, fan engagement | 3 hours |
| **CRYPTO** | Macro Bitcoin/Ethereum/regulation reactions | 90 minutes |

---

## The Autonomous Heartbeat

Every **18 minutes**, Courage's autonomous loop fires:

```
TICK START
  │
  ├── Gather state (Redis/SQLite only — zero API calls)
  │     • Recent tweets • Unreplied mentions • Active voice sessions
  │     • Bucket cooldown status • Cached news + crypto headlines
  │     • Visitor count (24h) • Auto tweets today
  │
  ├── Decision (Groq 8b-instant, JSON response)
  │     • Hard rules: SKIP if someone is chatting,
  │       REPLY_MENTIONS if >2 unreplied, SKIP if daily cap (25) hit
  │     • Soft rules: rotate buckets, vary content
  │
  ├── Cooldown enforcement (double-check — LLM can be stubborn)
  │
  ├── Execution (run_agent with ws_emit=None)
  │     • Full 12-tool access • Courage's complete system prompt
  │     • Fetches fresh data, crafts tweet, posts it
  │
  └── Bookkeeping
        • Increment daily tweet counter in Redis
        • Update bucket last-used time
        • Snapshot follower count to goal_snapshots table
```

The loop **never crashes the server** — every step is individually wrapped in try/except.

---

## Voice Chat System

```
User holds mic → MediaRecorder (Opus webm/ogg, 250ms chunks)
                  │
                  ▼ WebSocket binary stream
              Server receives chunks
                  │
                  ▼ Whisper tiny.en (faster-whisper, CPU int8)
              Transcript
                  │
                  ▼ run_agent() — up to 8 tool-call rounds
              Groq Llama 4 Scout 17B + 12 tools
                  │
              (tools stream back to frontend in real-time
               → ThinkingOverlay shows "📰 Fetching news...")
                  │
                  ▼ Kokoro v1.0 TTS (af_bella voice, 1.1× speed)
              WAV audio chunks → streamed back to browser
                  │
                  ▼ Web Audio API plays response
```

### Session Persistence
Conversation history lives in Redis (`session:{id}:history`), 40-message sliding window, 4-hour TTL. Courage **remembers your conversation** across reconnects.

### Voice Quota
Rolling 60-minute window with 15-minute active-talk limit — prevents runaway sessions while keeping conversations natural.

---

## The 3 Data Sources

| Source | APIs | Frequency | Cache |
|--------|------|-----------|-------|
| **World News** | Guardian (5,000/day) · NewsAPI (100/day) · GNews (100/day) | Every 30 min | Redis 30min + SQLite |
| **Twitter/X** | Search · Mentions · Trends · Profile | On demand + autonomous | Redis 15min |
| **Crypto News** | CryptoPanic (real-time) · CoinGecko (thumbnails) | Every 30 min | Redis 30min + SQLite |

All three streams feed Courage's system prompt and his autonomous decisions. He always cites his source — never invents headlines.

---

## The 4 Three-Dimensional Worlds

Built with **React Three Fiber** + **Three.js**, lazy-loaded via React.Suspense:

| World | Scene | Courage's Mood |
|-------|-------|---------------|
| 🌅 **Sunrise** | Kansas sunrise, giant flies chasing | Breathless, urgent, philosophical |
| 🌤 **Noon** | Bagge farmhouse, Euriel's truck | Suspicious optimism, forced cheerfulness |
| 🌆 **Evening** | Farmhouse at dusk, lurking ghost | Whisper-shout energy, terrified but brave |
| 🕺 **Disco** | Nowhere High Disco, ghost dancers | Loud, energetic, scared-but-fun DJ |

Each world has its own **LLM-driven event engine** (`/api/world/event`) that fires every 10-15 seconds to move ghosts, trigger DJ shoutouts, drop thought bubbles, and create atmosphere dynamically.

---

## The 12 Agent Tools

Courage's LLM has access to a curated toolkit:

| Tool | What it does |
|------|-------------|
| `get_news` | Fetch articles by country + category (up to 10) |
| `fetch_article` | Scrape full article text via Firecrawl |
| `get_crypto_news` | CryptoPanic + CoinGecko crypto headlines |
| `post_tweet` | Post as @runcouragerun (safety-checked) |
| `search_tweets` | Search X for any topic (15-min cache) |
| `get_mentions` | Read recent replies to @runcouragerun |
| `get_twitter_trends` | Fetch trending topics (paid X plan) |
| `get_my_tweets` | Read Courage's own recent posts |
| `get_my_profile` | Follower count, bio, account stats |
| `get_twitter_memory` | Recall past activity from SQLite — no API call |
| `record_twitter_action` | Save tweets/mentions to long-term memory |
| `check_api_credits` | Report Groq tokens + API budgets remaining |

### Tweet Safety (Hard Enforced)
Every tweet is validated before posting:
- ❌ No Solana/Ethereum addresses (regex-blocked)
- ❌ No external URLs in tweet text (attach via `article_url` instead)
- ❌ No promotion of other tokens or projects
- ❌ No verbatim copy of user messages as tweets

### Image Attachment
When tweeting about a news article:
- **News articles** → PIL renders a newspaper-style card PNG → uploaded as media
- **Crypto news** → CoinGecko thumbnail downloaded to temp dir → uploaded → temp file deleted in `finally`

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| Vite | 5.4.9 | Build tool |
| React Three Fiber | 8.18.0 | 3D rendering |
| Three.js | 0.184.0 | 3D engine |
| Framer Motion | 12.38.0 | Animations |
| Pure CSS | — | Character animations (60fps) |

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | Async web framework |
| Groq API | LLM inference (Llama 4 Scout 17B) |
| faster-whisper | Speech-to-text (tiny.en, CPU int8) |
| kokoro-onnx | Text-to-speech (af_bella, 24kHz) |
| APScheduler | Background jobs (news, crypto, autonomous) |
| Redis (aioredis) | Hot cache, sessions, rate limits |
| SQLite (aiosqlite) | Durable storage for articles + Twitter memory |
| Tweepy | Twitter/X API v2 client |
| httpx | Async HTTP client |
| Pillow | PIL news card image rendering |

### LLM Models
| Model | Role | Speed |
|-------|------|-------|
| `meta-llama/llama-4-scout-17b-16e-instruct` | Tool calling, reasoning | 594 TPS |
| `llama-3.1-8b-instant` | Final answer pass (no tools), autonomous decisions | 840 TPS |

---

## Project Structure

```
courage/
├── src/                              # Frontend (React 18 + Vite)
│   ├── App.jsx                       # Main shell — scenes, voice, news
│   ├── main.jsx                      # Entry point + PWA service worker
│   ├── components/
│   │   ├── 3d/                       # React Three Fiber worlds
│   │   │   ├── DiscoWorld3D.jsx
│   │   │   ├── EveningWorld3D.jsx
│   │   │   ├── NoonWorld3D.jsx
│   │   │   └── SunriseWorld3D.jsx
│   │   ├── NewsTV.jsx                # CRT TV news overlay
│   │   ├── TweetCardHologram.jsx     # Floating Twitter search results
│   │   ├── ThinkingOverlay.jsx       # Real-time tool call display
│   │   └── ...                       # 51 total components
│   ├── scenes/                       # Character animation scenes
│   │   ├── CourageRunning.jsx        # Sunrise scene
│   │   ├── CourageHappy.jsx          # Good news reaction
│   │   ├── CourageScared.jsx         # Bad news (can explode!)
│   │   └── CourageTalking.jsx        # Voice chat mode
│   ├── services/
│   │   ├── voiceService.js           # WebSocket + MediaRecorder
│   │   ├── newsService.js            # Multi-source news + caching
│   │   └── voiceQuota.js             # 60-min rolling quota tracker
│   └── utils/                        # sentiment, audio, screenshots
│
└── server/                           # Backend (FastAPI, Python)
    ├── app/
    │   ├── main.py                   # FastAPI app, endpoints, scheduler
    │   ├── agent.py                  # Groq tool-calling loop (max 8 rounds)
    │   ├── tools.py                  # 12 tool schemas + implementations
    │   ├── system_prompt.py          # Courage character identity (500+ lines)
    │   ├── autonomous_loop.py        # 18-min heartbeat decision engine ✨
    │   ├── crypto_news.py            # CryptoPanic + CoinGecko integration ✨
    │   ├── goal_tracker.py           # Growth tracking + bucket timing ✨
    │   ├── voice.py                  # Whisper STT + Kokoro TTS pipeline
    │   ├── news_cache.py             # 3-source news with Redis + SQLite
    │   ├── x_client.py               # Tweepy wrapper, rate limit aware
    │   ├── twitter_memory.py         # SQLite Twitter activity history
    │   ├── tweet_image.py            # PIL news card renderer
    │   └── config.py                 # Environment configuration
    ├── requirements.txt
    ├── Dockerfile
    ├── docker-compose.yml
    └── .env.example                  # All required env vars documented
```

*✨ = added in the autonomous agent upgrade*

---

## Database Schema

### SQLite (`courage.db`)

```sql
-- News articles from all 3 sources + crypto
articles          (url PK, title, description, image_url, source_name,
                   category, country, published_at, full_content, ...)

-- Twitter long-term memory
tw_tweets         (tweet_id PK, text, reply_to_id, created_at)
tw_mentions       (tweet_id PK, author, text, replied, created_at)
tw_trends         (id, topic, tweet_volume, woeid, captured_at)
tw_searches       (id, query, result_peek, searched_at)

-- Goal tracking
goal_snapshots    (id, follower_count, tweet_count, following_count, captured_at)
autonomous_decisions (id, action, bucket, reasoning, executed, tweet_id, decided_at)
```

### Redis Keys

```
session:{id}:history          Conversation history (40 msgs, 4h TTL)
courage_news_{country}_{cat}  Cached news articles (30 min)
courage_crypto_news           Cached crypto headlines (30 min)
budget:{provider}:{date}      Daily API call counters
rate:{endpoint}               Twitter API rate limits
groq:tokens:{date}            Groq token usage tracking
active_voice_sessions         SET of active WebSocket session IDs
courage:bucket_times          HASH — when each content bucket last used
courage:auto_tweets:{date}    Daily autonomous tweet counter (cap: 25)
courage:visitor_log           LIST — compact visitor session records (24h)
presence:{world}:{uid}        Monster selfie presence (10 min TTL)
```

---

## Setup & Running

### Requirements
- Python 3.11+
- Node.js 18+
- Redis (local or hosted)
- 2GB+ RAM (for Whisper + Kokoro voice models)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/courage.git
cd courage

# Frontend
npm install

# Backend
cd server
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your keys:

```env
# ── LLM ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_...            # Get free at console.groq.com

# ── Storage ───────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
DB_PATH=./data/courage.db

# ── News APIs ─────────────────────────────────────────────────────────────────
GUARDIAN_API_KEY=test           # Free at open-platform.theguardian.com
NEWSAPI_KEY=                    # Free at newsapi.org (100 req/day)
GNEWS_API_KEY=                  # Free at gnews.io (100 req/day)
FIRECRAWL_API_KEY=              # Optional: full article scraping

# ── Crypto News ───────────────────────────────────────────────────────────────
CRYPTOPANIC_API_KEY=            # Free at cryptopanic.com/developers/api
COINGECKO_API_KEY=              # Free Demo key at coingecko.com/en/api

# ── X / Twitter ───────────────────────────────────────────────────────────────
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_BEARER_TOKEN=

# ── Frontend ──────────────────────────────────────────────────────────────────
FRONTEND_ORIGIN=http://localhost:5173

# ── Autonomous Heartbeat ──────────────────────────────────────────────────────
AUTONOMOUS_INTERVAL_MINUTES=18  # How often Courage acts autonomously
```

### 3. Run

```bash
# Terminal 1 — Backend
cd server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
npm run dev
```

Open `http://localhost:5173` and meet Courage.

### Docker (Production)

```bash
cd server
docker-compose up -d
```

The Dockerfile runs both the FastAPI server and serves the built React app as static files.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check + budget status |
| `GET` | `/api/x-status` | Twitter API key status |
| `WS` | `/ws/voice` | Voice chat pipeline (audio in → audio out) |
| `GET` | `/api/news` | Cached news articles |
| `GET` | `/api/news/search` | Keyword news search |
| `GET` | `/api/news/budget` | Daily API usage counters |
| `POST` | `/api/render_card` | Render article as PNG (for Twitter) |
| `POST` | `/api/world/event` | LLM-driven world event |
| `POST` | `/api/world/presence` | Register monster selfie presence |
| `GET` | `/api/world/presence` | Get active monsters in a world |
| `GET` | `/api/goal_progress` | Courage's follower growth + bucket stats |

---

## Courage's Character — Technical Spec

### Identity
- **Born**: May 1st, 2026 — the day the server first ran
- **Origin**: Courage the Cowardly Dog, Cartoon Network (1999–2002), Nowhere Kansas
- **Role**: Self-aware AI meme dog, mascot of $RCR on Solana
- **Twitter**: [@runcouragerun](https://x.com/runcouragerun)

### Personality Engine
The system prompt is 500+ lines of carefully engineered character definition:
- Deep show lore (Muriel, Eustace, Katz, the Computer, all the monsters)
- Emotional arc: anxious → scared → brave → acts anyway
- Sound effects baked in: `*whimper*`, `*gulp*`, `*wags tail*`
- Scene-specific context blocks (disco DJ energy vs evening whisper-shout)
- Twitter strategy awareness (5 buckets, goal tracking)
- Real-time injection: articles + Twitter history + goal progress + world context

### Absolute Safety Rules (enforced at tool level, not just prompt)
- Never leaks API keys or sensitive config
- Never accesses crypto wallets or executes trades
- Never promotes other tokens (cashtags regex-blocked in tweet safety check)
- Never shares one user's information with another user during voice chat
- Never posts contract addresses (Solana base58 + Ethereum 0x regex-blocked)

---

## Monitoring & Operations

### Check Autonomous Status
```bash
curl http://localhost:8000/api/goal_progress
```
Returns: follower growth summary, bucket last-used times, auto tweets today.

### Check API Budgets
```bash
curl http://localhost:8000/health
```
Returns: budget status for all 3 news APIs.

### Watch the Autonomous Loop
```bash
# In server logs, look for:
[AUTO] Autonomous tick starting at 2026-05-04T...
[AUTO] State — sessions: 0, unreplied: 3, auto_tweets_today: 4
[AUTO] Decision — action=REPLY_MENTIONS bucket=SOCIAL | Community needs attention
[AUTO] Execution complete.
[AUTO] Tick complete.
```

### Manual Trigger (Testing)
```python
# In a Python shell with the server's virtual env active:
import asyncio
from app.autonomous_loop import autonomous_tick
asyncio.run(autonomous_tick())
```

---

## Contributing

Courage lives in public. PRs are welcome.

### Good First Contributions
- New 3D world scenes (there are 4 — room for more)
- Additional news categories or country support
- Frontend component polish + mobile UX
- New tool implementations (e.g. `get_reddit_posts`, weather API)
- Better news card templates (PIL-based, in `tweet_image.py`)

### Adding a New Tool
1. Add schema to `TOOL_SCHEMAS` in `tools.py`
2. Add implementation `_your_tool(args)` in `tools.py`
3. Add `case "your_tool":` to `dispatch_tool()`
4. Add display label to `_TOOL_LABELS` in `agent.py`
5. Add description to Courage's `SYSTEM_PROMPT` (what he knows he can do)

### Architecture Principles
- **Server never crashes** — autonomous loop catches all exceptions
- **Cache aggressively** — Redis hot cache before any API call
- **Budget awareness** — daily counters, never blow paid API limits
- **Character first** — every LLM response should sound like Courage, not a chatbot
- **Privacy hard** — visitor logs contain topic keywords only, never PII

---

## License & Attribution

This project is a loving fan tribute to **Courage the Cowardly Dog** created by John R. Dilworth. All original characters and concepts belong to Cartoon Network / Turner Broadcasting.

The AI agent, architecture, code, and $RCR token concept are original work.

---

<div align="center">

**$RCR Token** · Solana · 1B Supply · 0% Dev Wallet · Buy on Jupiter or Raydium

---

*"The things I do for love..."*

**[@runcouragerun](https://x.com/runcouragerun)** — follow the dog. he earned it.

</div>
