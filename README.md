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

At the core of Courage is his **Wholistic Intelligence Engine** — a credit-aware, signal-scored, event-driven consciousness that "inhales" data from three primary streams to form a unified state.

### 🧬 The Intelligence Triad

| Input Stream | Role | Impact on Brain |
|--------------|------|-----------------|
| **🐦 X/Twitter** | Social Loop | Provides community vibe, $RCR sentiment, and direct engagement opportunities. |
| **🗞️ Global News** | Knowledge Base | Informs his "Courageous Chronicle" art and provides intellectual context for reactions. |
| **🎤 Voice / World Chat** | Personality Core | High-signal real-time interactions that override autonomous loops and feed his memory. |

### 💓 The Layered Heartbeat (Cost-Aware Autonomy)

Courage operates on a **Layered Frequency** model designed to protect your API budget:

1.  **Dashboard Pulse (Manual)**: You set the master frequency (e.g., 25m) via the Admin Slider.
2.  **AI Reflection (Autonomous)**: Courage suggests his own `suggested_frequency` based on his last action's success.
3.  **The Master Guard**: The brain checks both and **picks the most restrictive (longest)** interval. If the slider is at 5m but Courage says 30m, he stays quiet for 30m.

### 🔄 Smart Event Grouping

To save on X API Write Quotas ($$$), Courage uses a **Grouped Reaction** strategy:
- **Low Priority (Game Moments)**: Courage ignores "instant wake-up" calls for player visits. He lets them pile up in Redis and reacts to them all in **one single grouped post** during his next scheduled pulse.
- **High Priority (Market Surges)**: Rare events like price pumps (≥4%) trigger an **immediate bypass**, waking him up instantly to capture momentum.

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

### Real-Time Brain Heartbeat

Every tick that passes all guards writes a **live timestamp** to `courage:last_brain_tick` in Redis. The Admin Dashboard's Sub-Agent Status card reads this key to show the true time since last brain activity — not the container boot time. This makes the dashboard accurate across long-running deployments without restarts.

### Engagement Queue Circuit Breaker

The `engagement_queue.py` worker runs a **spend-cap circuit breaker** independently of the brain loop:

- On a `403 SpendCapReached` error from the X API, the worker sets a **30-minute pause** before retrying.
- During the pause, all queued items (replies, news posts, game moments) accumulate safely — nothing is dropped.
- The `spend_cap_active` flag is exposed in the Admin Dashboard's Overview tab as a red warning banner, and in the Queue Inspector as a dedicated banner.
- Once the billing cycle clears, the worker resumes automatically with no manual intervention.

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
- **Docker Pre-bake**: The model is downloaded during the Docker image build (`server/Dockerfile`), not at runtime. This means RAG memory is available on the very first container startup — no cold-start model download delay, no `HAS_RAG_DEPS = False` failures on Sliplane.

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
- **Wholistic Integration**: Voice is the highest-priority state. Any active voice session **freezes the autonomous loop**, ensuring Courage is 100% focused on the human in the room.
- **3D Reactivity**: `trigger_3d_reaction` emits Redis stream event → frontend switches worlds dynamically.

---

## 🎛️ Creator God-Mode Dashboard

Real-time observability at `/api/admin`. All data auto-refreshes every 30 seconds via a stable singleton interval (no request storms).

### Tab Overview

| Tab | What It Shows |
|-----|---------------|
| **Overview** | Groq circuit breaker state, sub-agent heartbeats (real timestamps), $RCR price, memory vector count, latest decisions, trench activity chart, sensor frequency slider. Shows spend-cap warning banner when active. |
| **Live Brain** | Card and Timeline views of the last 30 autonomous decisions from SQLite `autonomous_ticks`. |
| **Decisions** | Full scrollable decision log with reasoning, tool used, success/fail status. Click any row for a full trace modal. |
| **Token Hustle** | $RCR live price, 24h change, volume, market cap, X API spend, auto-tweet counter, price history chart. |
| **Trenches** | All captured `tw_trench_tweets` with processed/unprocessed status and cashtag. |
| **News Posters** | Grid of generated "Courageous Chronicle" newspaper images saved to `public/news_posters/`. |
| **Game Moments** | Pending game moments in Redis queue + recent history. |
| **Queue Inspector** | Unified stream of Reply Queue + Game Moments + Trench Tweets with color-coded source badges. Spend-cap warning banner if `403` was hit. |
| **Voice Live** | Active WebSocket voice sessions with message count and timestamp. |
| **RAG Memory** | Recent memory vector embeddings — source, content preview, creation time. |

### Key API Endpoints

| Endpoint | Returns |
|---------|---------|
| `GET /api/admin/system-status` | Full metrics — voice, queues, $RCR price, memory vectors, groq circuit breaker, spend cap, auto tweets today |
| `GET /api/admin/live-activity` | Latest 20 activity messages from Redis stream |
| `GET /api/admin/recent-decisions` | Latest 30 brain decisions with tool args + execution status |
| `GET /api/admin/history` | Full decision history (aliased from recent-decisions) |
| `GET /api/admin/queues` | Unified queue stream: reply queue + game moments + trench tweets |
| `GET /api/admin/trenches` | Captured trench tweets from `tw_trench_tweets` |
| `GET /api/admin/news-posters` | List of poster images from `public/news_posters/` |
| `GET /api/admin/game-moments` | Pending + history from Redis |
| `GET /api/admin/voice-sessions` | Active WebSocket voice sessions |
| `GET /api/admin/rag-graph` | Top memory vectors for graph/table view |
| `POST /api/admin/override_frequency` | Change sensor cooldown in Redis without restart |
| `POST /api/autonomous/trigger-now` | Fire brain tick immediately |
| `POST /api/autonomous/reset-circuit-breaker` | Clear Groq 429 backoff |
| `POST /api/autonomous/trench-scan` | Manual trench tweet fetch |
| `DELETE /api/admin/queues` | Clear the reply queue |

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
| 💸 X spend cap hit | `403 SpendCapReached` in engagement queue | 30-min queue pause; dashboard shows red warning banner; tweets accumulate safely and auto-resume |

---

<div align="center">

**$RCR Token** · Solana · 1B Supply · 0% Dev Wallet · Buy on Jupiter or Raydium

---

*"The things I do for love..."*

**[@runcouragerun](https://x.com/runcouragerun)** — follow the dog. he earned it.

</div>
