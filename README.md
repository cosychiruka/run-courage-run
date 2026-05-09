<div align="center">

# 🐕 Run Courage Run

<img src="src/assets/images/Courage.gif" alt="Courage the Cowardly Dog — Self-Aware AI Agent" width="220" />

### *A fully autonomous, event-driven, credit-aware AI agent built on FastAPI and Llama 3.3.*

**Born May 1st, 2026. Still scared of everything. Posting anyway.**

[![Twitter](https://img.shields.io/badge/@runcouragerun-000000?style=for-the-badge&logo=x)](https://x.com/runcouragerun)
[![Solana](https://img.shields.io/badge/$RCR_Token-9945FF?style=for-the-badge&logo=solana)](https://solana.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Llama_3.3](https://img.shields.io/badge/Llama_3.3_70b-0466C8?style=for-the-badge)](https://groq.com/)

</div>

---

## 🧠 System Architecture & Identity

Courage is not a simple chatbot. He is a highly reactive, state-aware autonomous agent powered by a **500+ line System Prompt Engine** (`system_prompt.py`). He operates under the persona of the *"Meme Mario Nawfal of News"* — reacting to real-world crypto and global events with characteristic panic, sound effects (`*whimper*`, `*gulp*`), and catchphrases (*"The things I do for love..."*).

---

## ⚡ The Autonomous Brain (`autonomous_loop.py`)

At the core of Courage is his **Heartbeat** — a credit-aware, signal-scored, event-driven decision engine.

### State Gathering (`_gather_state`)

Before every decision, Courage assembles a compressed JSON payload:

| State Field | Source | Notes |
|-------------|--------|-------|
| `time_context` | System clock | Hour, energy (GM/GN/chaos), day phase, day of week |
| `game_moments` | Redis `courage:pending_game_moments` | Tweets detected by game sensor this cycle |
| `trending_topics` | SQLite `tw_trends` | Up to 5 recent Twitter trends from memory |
| `news[]` | SQLite all categories | 8 articles, scored + sorted by signal tier |
| `top_news_signal` | Signal scorer | 0–80 score of highest-priority article |
| `trenches[]` | SQLite `tw_trench_tweets` | Top 6 unprocessed $RCR community tweets |
| `community_vibe` | RAG cosine similarity | 1–2 sentence semantic summary |
| `rcr_or_sol_stats` | DexScreener / CoinGecko | Live price, 24h delta, volume |
| `x_rate_status` | X API headers | Per-endpoint remaining calls |
| `voice_active` | Redis session set | Pauses all autonomous actions if True |

### News Signal Scoring

Every article entering the brain is scored 0–80 before the LLM sees it. Articles are sorted highest-first so the most important story is always position 0.

| Score | Tier | Example Keywords |
|-------|------|-----------------|
| **80** | EXTREME | alien, ufo, classified, whistleblower, declassified, government files |
| **60** | HIGH | bitcoin, solana, memecoin, pump, surge, all time high, hack, scandal |
| **40** | MEDIUM | crypto, blockchain, regulation, fed rate, inflation |
| **20** | LOW | stocks, economy, business, earnings |
| **10** | Default | Everything else |

Score ≥ 80 overrides even a credit-capped state — alien/government/nuclear news always gets posted.

### Decision Engine

1. State JSON + `SYSTEM_PROMPT_MINIMAL` → Groq Llama 3.3 (70b) with `tool_choice="auto"`
2. LLM selects one tool and arguments
3. `dispatch_tool()` executes, logs to Redis + dashboard
4. `reflect_and_adapt` → `eternal_reflect` run after every action
5. Game moments cleared from Redis — won't re-fire next tick

### Safety Guards (in order of check)

1. **Voice active** → return immediately, don't interrupt user
2. **Groq circuit breaker** (`courage:groq_backoff_until`) → if set, stay quiet until expired
3. **EXTREME signal override** → score ≥ 80 bypasses credit cap
4. **Credit cap** (`courage:x_credit_status = "capped"`) → idle_hype mode
5. **Quiet trenches + no game moments** → proactive personality post

---

## ⚡ Event-Driven Sensor Architecture

Courage doesn't wait for his scheduled heartbeat. Three background sensors interrupt the loop in real time.

### `game_sensor.py` — Player & Community Detection

Searches Twitter every **25 minutes** (configurable from dashboard) for:

```
"become a monster" OR "@runcouragerun" OR "runcouragerun"
OR "$RCR" OR "cowardly dog" OR "homestead" -is:retweet lang:en
```

- **On hit**: Emits `GAME_MOMENT` to Redis pub/sub **AND** stores tweet data in `courage:pending_game_moments` (30-min TTL, max 5 queued)
- **Brain sees it**: `_gather_state()` fetches pending moments → LLM knows exactly who triggered the wake and can shout them out
- **Cost tracking**: Tracks X API search cost per call
- **Debounce**: Max 1 event per 30 seconds

### `market_sensor.py` — $RCR Price Surge

Polls DexScreener every 60 seconds. On ≥4% price move:

- Emits `MARKET_SURGE` → `force_autonomous_tick()` (bypasses 6-minute cooldown)
- Brain picks up current token stats → posts hype/hustle content

### Redis PubSub (`events.py` + `main.py`)

- `courage:urgent_events` channel receives all sensor events
- Urgent listener has 360-second minimum cooldown between reactive ticks
- `force_autonomous_tick()` always checks voice-active guard before acting

---

## 🗞️ News Discovery Pipeline

### Guardian Section Coverage

Discovery runs across **6 section pairs** (was 3):

| Section | Guardian Slug | Catches |
|---------|--------------|---------|
| `general` | `news` | Main headlines |
| `technology` | `technology` | Tech & AI |
| `business` | `business` | Markets, finance |
| `world` | `world` | International events |
| `politics` | `us-news` | US government, political releases |
| `science` | `science` | Space, research, UFO disclosures |

Articles are cached in Redis (2h TTL) + persisted to SQLite. `_gather_state()` reads ALL categories — not just `general` — so politics and science stories reach the brain.

### Multi-Source Stack

1. **Guardian** (5,000/day) — 6 section pairs, primary general news
2. **CoinDesk** (crypto-specific) — Bitcoin, Solana, DeFi headlines
3. **CoinGecko** — crypto fallback with thumbnail images
4. Redis 30-min hot cache → SQLite durable store → older cached articles as last resort

---

## 🛠️ Tool Dispatch

All 30+ tools are defined in `tools.py`. The three key posting tools are now fully implemented:

| Tool | Trigger | Behavior |
|------|---------|---------|
| `auto_news_react` | Interesting/shocking news | Generates Courage meme art → posts tweet with title + summary |
| `auto_hustle_post` | Market surge / token update | Posts LLM-authored hype text with optional art |
| `proactive_personality_post` | Idle/quiet | Posts GM/GN/hype/meme/SOL update |

`post_tweet` retries up to **3 times** with exponential backoff (10s, 20s) on transient failures. Auth errors (401/403/429) are not retried.

---

## 🤖 The Sub-Agent Team

Specialist "Dog" sub-agents handle complex reasoning inside `tools.py`:

- 🎨 **Art Dog** (`art_dog_generate`) — Injects live $RCR price + RAG vibe → Fal.ai image
- 🤝 **Engagement Dog** (`engagement_dog_suggest`) — Reads unprocessed trenches → pre-drafts replies
- 📰 **News Dog** (`news_dog_scan`) — Scans all cached articles, returns top 5 titles
- 🪙 **Token Dog** (`token_dog_report`) — Live $RCR stats + suggested messaging
- 🧠 **Eternal Reflect** (`eternal_reflect`) — Reviews last 20 posts → long-term pattern learning
- 📣 **Viral Growth** (`viral_growth_suggest`) — Reads community sentiment → suggests raids/collabs

---

## 💾 Local RAG Memory System (`rag.py`)

Courage has semantic long-term memory — no external API, no LangChain.

- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (CPU, local)
- **Storage**: NumPy byte arrays in SQLite `rag_vectors` table
- **Retrieval**: Raw cosine similarity — top-K relevant memories per query
- **Auto-embedded**: Trench tweets, token snapshots, daily summaries

---

## 💳 Credit & Cost Management

| Resource | Limit | Tracking Key | Behavior at Cap |
|----------|-------|-------------|-----------------|
| X API search | Pay-per-post ($0.005) | `courage:x_spend_today` | Sets `capped` flag → idle_hype mode |
| Groq tokens | 500k/day | `groq:tokens:{date}` | Voice returns canned message; loop sets circuit breaker |
| Groq 429 | Rate limit | `courage:groq_backoff_until` | Both voice AND loop respect 1-hour backoff |
| Auto tweets | 25/day cap | `courage:auto_tweets:{date}` | Tracked in dashboard |
| Fal.ai images | ~$1/day soft cap | `courage:fal_spend_today` | Stops generating; posts text-only |
| Guardian API | 5,000/day | Internal counter | Falls back to cached articles |

---

## 🗣️ Voice Pipeline & 3D Worlds

Courage lives in four immersive **React Three Fiber** worlds (Sunrise, Noon, Evening, Disco).

- **Local Voice Stack**: Browser audio → WebSocket → `faster-whisper` (CPU int8 Tiny.en) → Llama 3.1 (8b) → `kokoro-onnx` TTS (24kHz) → streamed back
- **Session Isolation**: Each voice session stored in Redis with 4-hour TTL
- **Priority**: Any active voice session halts all autonomous tool calls immediately
- **3D Reactivity**: `trigger_3d_reaction` emits Redis stream event → frontend switches worlds dynamically

---

## 🎛️ Creator God-Mode Dashboard

Real-time observability at `/api/admin`:

| Endpoint | Returns |
|---------|---------|
| `GET /api/admin/system-status` | Full metrics — voice, queues, $RCR price, memory vectors |
| `GET /api/admin/live-activity` | Latest 30 activity messages |
| `GET /api/admin/recent-decisions` | Latest 50 brain decisions with args + execution status |
| `GET /api/admin/history` | Full decision history |
| `POST /api/admin/override_frequency` | Change sensor cooldown in Redis without restart |
| `POST /api/autonomous/trigger-now` | Fire tick immediately |
| `POST /api/autonomous/reset-circuit-breaker` | Clear Groq 429 backoff |

---

## 🗄️ Database Schema

### SQLite (`courage.db`) — All tables use WAL mode for concurrent async safety

| Table | Purpose |
|-------|---------|
| `articles` | Guardian + news articles (all 6 category pairs) |
| `tw_tweets` | Courage's posted tweets |
| `tw_mentions` | Mentions + reply status |
| `tw_trench_tweets` | $RCR community posts (for engagement) |
| `tw_trends` | Trending topics captured from Twitter |
| `tw_searches` | Search history |
| `tw_reflections` | Post-action learning log |
| `rag_vectors` | Semantic embeddings (NumPy blobs) |
| `token_daily_stats` | Daily $RCR price snapshots |
| `goal_snapshots` | Follower growth tracking |
| `autonomous_ticks` | Full decision log with tool + reasoning |

---

## 🚀 Setup & Installation

### Requirements
- Python 3.11+
- Node.js 18+
- Redis (local or hosted)
- 2 GB+ RAM (Whisper + Kokoro models)

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

### 2. Configure Environment (`.env`)
```env
# ── LLM ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_MODEL_FAST=llama-3.1-8b-instant

# ── Storage ───────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
DB_PATH=./data/courage.db

# ── News APIs ─────────────────────────────────────────────────────────────────
GUARDIAN_API_KEY=test      # Free tier covers 5,000 req/day
NEWSAPI_KEY=
GNEWS_API_KEY=
FIRECRAWL_API_KEY=         # Optional: full article text scraping
COINDESK_API_KEY=
COINGECKO_API_KEY=

# ── X / Twitter ───────────────────────────────────────────────────────────────
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_BEARER_TOKEN=

# ── AI & Media ────────────────────────────────────────────────────────────────
FAL_API_KEY=                    # Required for Art Dog image generation
COURAGE_BASE_IMAGE_URL=         # Base image for Fal.ai image-to-image

# ── Project ───────────────────────────────────────────────────────────────────
FRONTEND_ORIGIN=http://localhost:5173
RCR_TOKEN_ADDRESS=              # $RCR Solana contract address
AUTONOMOUS_INTERVAL_MINUTES=60  # Heartbeat interval (default 60)
```

### 3. Run
```bash
# Terminal 1 — Backend
cd server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
npm run dev
```

### Startup Sequence
1. 5s health-check wait
2. SQLite init (WAL mode enabled on all tables)
3. Redis connect (falls back to in-memory MockRedis if unavailable)
4. Voice models loaded in background (Whisper Tiny + Kokoro)
5. APScheduler starts (discovery round, crypto discovery, auto tick, weekly prune)
6. Engagement queue worker starts
7. Market sensor, game sensor, realtime WebSocket sensor all spawn
8. Redis pub/sub urgent event listener starts
9. Guarded startup tick fires (respects 15-min startup cooldown)
10. Ready banner printed

---

## 📡 Designed Scenarios — Event Coverage

Courage is built to react to all of these automatically:

| Scenario | Detection | Response |
|----------|----------|---------|
| 🛸 Government/alien news drops | Guardian `us-news` or `science` section + signal score 80 | Meme art + tweet, overrides credit cap |
| 🚀 Crypto pump day | CoinDesk headlines + signal score 60 | `auto_news_react` with hype art |
| 📈 $RCR market surge (≥4%) | `market_sensor.py` → DexScreener | `force_autonomous_tick()` → `auto_hustle_post` |
| 🎮 Player game moment | `game_sensor.py` → tweet stored in Redis | Brain sees author + text → shouts out player |
| 🎙️ Voice session active | Redis `active_voice_sessions` | All autonomous actions paused |
| 💳 Credits capped + EXTREME news | `top_news_signal ≥ 80` | Credit override → posts anyway |
| 🤖 Groq 429 hit | Exception in `decide_and_act` | 1-hour circuit breaker set, both voice + loop respect it |
| 😴 Quiet day | No trenches, no game moments, low signal | `proactive_personality_post` (GM/GN/hype) |
| 📉 Bear market | CoinDesk crash headlines (signal 60) | Brain reacts with Courage's "brave despite fear" persona |

---

<div align="center">

**$RCR Token** · Solana · 1B Supply · 0% Dev Wallet · Buy on Jupiter or Raydium

---

*"The things I do for love..."*

**[@runcouragerun](https://x.com/runcouragerun)** — follow the dog. he earned it.

</div>
