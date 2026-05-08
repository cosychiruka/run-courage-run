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

Courage is not a simple chatbot; he is a highly reactive, state-aware agent powered by a **500+ line System Prompt Engine** (`system_prompt.py`). He operates under the persona of the *"Meme Mario Nawfal of News,"* reacting to real-world crypto and global events with characteristic panic, utilizing sound effects (`*whimper*`, `*gulp*`), and specific catchphrases (*"The things I do for love..."*).

### The Autonomous Brain (`autonomous_loop.py`)
At the core of Courage is his Heartbeat. Rather than firing blindly, Courage builds a highly compressed, token-efficient JSON state payload before making any decision.

1. **State Gathering (`_gather_state`)**:
   - Compiles live data: active voice sessions, unreplied Twitter mentions, current `$RCR`/`SOL` token pricing (`hustle_service.py`), and real-time Twitter API rate limits.
   - Performs a "Light RAG" query against his SQLite memory to fetch the current `community_vibe`.
2. **Groq Inference**:
   - The state JSON is injected into a strict `SYSTEM_PROMPT_MINIMAL`.
   - Llama 3.3 (70b) evaluates the state against 20+ available tools and outputs a single, optimal tool-call decision.
3. **Execution & Tracing (`dispatch_tool`)**:
   - Executes the selected tool and logs the exact arguments, execution status, and potential errors to a Redis list (`courage:brain_decisions`) for the Creator God-Mode Dashboard.

---

## 🧠 Intelligence Upgrades (Phase 2.0 - 5.0)

Courage is a living agent. He does not just sit and wait; he actively manages his resources and timeline.

- **The Execution Layer**: Tools like `post_tweet` are strictly wired with X dependencies, ensuring decisions made by the LLM are successfully published and verified with real tweet IDs.
- **Credit-Aware Intelligence**: He tracks his own API budget. If Twitter API limits are reached (`SpendCapReached`), he sets a `capped` flag in Redis and intelligently pivots to safe-mode tools.
- **Idle-Mode Fallback (`idle_hype_post`)**: If credits are depleted or the community trenches are quiet, he doesn't crash or go silent. He falls back to generating cost-free internal hype and memes.
- **Proactive Personality (`proactive_personality_post`)**: Driven by his 25-minute autonomous heartbeat (`autonomous_tick`), if there is no urgent news or game moments, Courage will proactively post GM/GN greetings, SOL pulse updates, or random chaos to keep the timeline alive. He is never silent.

---

## ⚡ Event-Driven Sensor Architecture

Courage doesn't just wait for his 18-minute APScheduler loop. He actively listens to the world via background sensors (`/sensors`).

- **`game_sensor.py`**: A background task that searches Twitter for specific keywords ("become a monster", "homestead", "runcouragerun"). 
  - **Cost Tracking**: It actively tracks X API search costs to prevent rate-limit burnout.
  - **Debouncing**: Limits event emissions to once every 30 seconds to prevent Groq inference spam.
- **Redis PubSub (`events.py`)**: When a sensor detects activity, it emits a `GAME_MOMENT` or `MARKET_SURGE` payload to the `courage:urgent_events` PubSub channel.
- **Urgent Listener (`main.py`)**: An asynchronous listener catches these events and triggers `force_autonomous_tick()`, allowing Courage to react to market spikes or player activity in near real-time.

---

## 🐕 The Sub-Agent Team (Prompt Wrappers)

To keep the core decision engine fast, complex reasoning is delegated to "Dog" sub-agents (`tools.py`). These are intelligent prompt-injection wrappers that enrich context before executing core functions.

- 🎨 **Art Dog (`art_dog_generate`)**: Automatically injects live `$RCR` token pricing and the current RAG-derived `community_vibe` into the prompt before passing it to the Fal AI image generator.
- 🤝 **Engagement Dog (`engagement_dog_suggest`)**: Queries the SQLite memory for the latest unprocessed trenches (replies/mentions) and pre-drafts contextual responses.
- 📰 **News Dog (`news_dog_scan`)**: Filters Guardian, NewsAPI, and GNews caches, returning only the top 5 most relevant stories for Courage to parse.
- 🧠 **Eternal Reflect (`eternal_reflect`)**: Analyzes Courage's last 20 posts from the SQLite memory to determine what content (e.g., "GM/GN", "Brrrr") generates the most engagement, directly appending this to his `past_reflections` state.

---

## 💾 Local RAG Memory System (`rag.py`)

Courage has semantic long-term memory.

- **Model**: Runs `sentence-transformers/all-MiniLM-L6-v2` entirely locally on the CPU (no external API calls or LangChain bloat).
- **Database**: Vectors are converted to NumPy byte arrays and stored in a local SQLite database (`courage.db`) under the `rag_vectors` table, alongside metadata and source tracking.
- **Retrieval**: Uses raw Cosine Similarity math on the NumPy arrays to instantly fetch the top K most relevant past memories, tweets, or community vibes.

---

## 🎛️ Creator God-Mode Dashboard

The backend exposes rich observability endpoints (`/api/admin`) that power a real-time dashboard.

- **Live Brain Activity**: The UI polls `/api/admin/live-activity` for a real-time, pulsing feed of Courage's inner monologue and tool dispatches.
- **Execution Modals**: Every decision in the `Recent Brain Decisions` feed is clickable, revealing the exact JSON payload, arguments, and success/failure states of the dispatch loop.
- **Vector Tracking**: Displays the live count of semantic memories stored in the `rag_vectors` table via the `/api/admin/memory-vectors` endpoint.
- **Sub-Agent Monitoring**: Real-time status indicators for the News Dog, Art Dog, Engagement Dog, and Token Dog.
- **Override Frequency**: Admins can hit `/api/admin/override_frequency` to dynamically alter the global sensor cooldowns in Redis without restarting the server.

---

## 🗣️ Voice Pipeline & 3D Reactivity

Courage lives in four immersive **React Three Fiber** worlds (Sunrise, Noon, Evening, Disco).

- **Local Voice Stack**: User audio is streamed via WebSocket to `faster-whisper` (CPU int8). Courage's response is generated by Llama 3.1 and synthesized on the fly using `kokoro-onnx` (24kHz `af_bella`), streaming back to the browser.
- **Dynamic 3D Reactivity**: Courage's LLM can invoke `trigger_3d_reaction`. By passing specific arguments (e.g., `stage="disco"`, `event="pump"`), he emits a WebSocket signal that forces the React frontend to instantly switch environments to celebrate a community win.

---

## 🚀 Setup & Installation

### Requirements
- Python 3.11+
- Node.js 18+
- Redis (local or hosted)
- 2GB+ RAM (Required for local Whisper + Kokoro models)

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

# ── APIs & AI ─────────────────────────────────────────────────────────────────
GUARDIAN_API_KEY=test
NEWSAPI_KEY=
GNEWS_API_KEY=
FIRECRAWL_API_KEY=
FAL_API_KEY=                 # Required for Art Dog

# ── X / Twitter ───────────────────────────────────────────────────────────────
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_BEARER_TOKEN=

# ── Project Specific ──────────────────────────────────────────────────────────
FRONTEND_ORIGIN=http://localhost:5173
RCR_TOKEN_ADDRESS=           # $RCR Contract Address
COURAGE_BASE_IMAGE_URL=      # Base image for Fal AI overlays
```

### 3. Run
```bash
# Terminal 1 — Backend
cd server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
npm run dev
```

---

<div align="center">

**$RCR Token** · Solana · 1B Supply · 0% Dev Wallet · Buy on Jupiter or Raydium

---

*"The things I do for love..."*

**[@runcouragerun](https://x.com/runcouragerun)** — follow the dog. he earned it.

</div>
