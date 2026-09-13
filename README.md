# Run Courage Run

<p align="center">
  <img src="src/assets/images/Courage.gif" alt="Courage, the self-aware meme in Nowhere" width="220" />
</p>

**A self-aware meme escaped the forest. The forest followed.**

Run Courage Run is an interactive, browser-native meme world built around Courage: an
anxious pink dog who wakes inside the Nowhere farmhouse, follows an emerald signal trail,
and finds a portal above the river. The landing page, four procedural 3D worlds, live voice
agent, sourced crypto news, Robinhood Chain discovery data, memory, and autonomous X loop all tell
the same story.

The project is currently served at [`hoodcourage.xyz`](https://hoodcourage.xyz);
`@cowardlyhood` is its X identity.

## What exists now

### Four living 3D worlds

| World | Current story behavior |
| --- | --- |
| Sunrise | Courage begins the escape while giant flies join the chase. |
| Noon | A detailed caretaker crosses the yard and drives the rebuilt farm truck. |
| Evening | Ghosts, watching bushes, the river, and the portal wake up. |
| Disco | The rear farmhouse world becomes a reactive monster dance floor. |

Midnight is a landing-page time state that enters Evening; it is not a fifth 3D scene. World
bundles are lazy-loaded and share a deliberately bounded procedural environment.

### Tickerlings and the forest signal

Short, dense hero bushes blink and track the camera. A deliberate click/tap—or keeping a bush
near the camera center after navigating—can trigger a Tickerling encounter. The face uses a
session-stable token assignment from the same Robinhood Chain snapshot as the landing widget.
If the first snapshot is still loading, the world briefly shows an original `TUNING...` face,
then replays the encounter with the assigned ticker. It never invents a token.

The backend fetches DexScreener boost feeds and chain-filtered pair discovery, retains the
source tags, applies a minimum display-quality filter, and serves eligible logos through a
bounded image proxy. The backend snapshot, concurrent refresh, browser memory, browser storage,
market widget, and every world reuse one cache pipeline. A search-discovered token is not called
trending; only boost-feed records receive a boosted/trending flag. This is discovery metadata,
not vetting or financial advice. The shared cache keeps the full normalized snapshot; the landing
page sorts it and renders at most ten signals, using a compact two-row swipe rail on phones.

### Voice, memory, news, and X

- Browser audio streams over `/ws/voice`.
- `faster-whisper` transcribes locally; the configured OpenRouter model runs the tool-capable
  agent; Kokoro synthesizes the reply locally.
- Each voice connection has isolated history, with optional short-lived Redis restoration.
  Without Redis, one shared in-process fallback powers voice priority, counters, and caches.
- CoinDesk crypto news is cached once for the app, agent tools, heartbeat, and sourced
  Courageous Chronicle cards. CoinDesk RSS is the keyless fallback.
- The autonomous heartbeat combines time, news priority, live Robinhood Chain metadata,
  community memory, rate limits, and voice priority before choosing one action or silence.
- Relevant X conversation is grouped before the next heartbeat; it is not mislabeled as a
  website visit.

## Agent identity contract

[`server/app/system_prompt.py`](server/app/system_prompt.py) is the canonical brain contract.
It defines:

- the farmhouse → signal trail → watching forest → river portal lore;
- the four real world states and Midnight mapping;
- voice/editorial rules that favor useful observations over generic hype;
- a semantic symbol grammar (`🐕`, `🌲`, `🌀`, `👀`, `🟢`, `📡`, `🎙️`);
- source, market, financial-safety, and public-action boundaries; and
- separate voice and autonomous decision behavior.

Creative-origin attribution lives once in the public lore rather than being repeated by the
agent. Fixed project cashtags and legacy Solana helpers remain compatibility utilities, not
Courage's default identity or posting mission.

See [`docs/AGENT_BRAIN.md`](docs/AGENT_BRAIN.md) for the decision contract and
[`docs/WORLD_EXPERIENCE.md`](docs/WORLD_EXPERIENCE.md) for scene, Tickerling, data, performance,
and brand constraints.

## Architecture

```text
React 18 + Vite + React Three Fiber
  |- time-aware landing and PWA shell
  |- four lazy-loaded procedural worlds
  |- voice controls and per-world context
  `- shared Robinhood Chain token snapshot client
                 |
                 v
FastAPI + APScheduler
  |- voice WebSocket -> Whisper -> agent/tools -> Kokoro
  |- sourced crypto-news cache and Chronicle renderer
  |- Robinhood Chain discovery + safe token-logo proxy
  |- autonomous heartbeat and grouped community sensor
  |- world-event director and presence endpoints
  `- admin command center
          |
          +--> SQLite: articles, X history, decisions, RAG metadata
          `--> Redis: queues, sessions, cooldowns, budgets, live activity
```

Important paths:

| Path | Responsibility |
| --- | --- |
| `src/App.jsx` | Active landing application and world entry points |
| `src/components/3d/Scene3D.jsx` | Shared terrain, atmosphere, forest, river, and portal |
| `src/components/3d/worldGround.js` | Flat homestead surface and shared asset-grounding contract |
| `src/components/3d/TickerlingForest.jsx` | Bush encounters and token-logo faces |
| `src/utils/audioManager.js` | Race-safe world music playback and full Exit teardown |
| `src/services/tokenService.js` | Shared browser snapshot/cache contract |
| `server/app/robinhood_service.py` | DexScreener normalization, ranking, and eligibility |
| `server/app/system_prompt.py` | Canonical character, lore, symbols, truth rules |
| `server/app/autonomous_loop.py` | State gathering and one-action heartbeat |
| `server/app/agent.py` | Multi-turn tool loop for voice/text conversation |
| `server/app/main.py` | API, WebSocket, scheduler, world events, and admin routes |

## Local development

### Requirements

- Node.js 18 or newer
- Python 3.11
- FFmpeg for browser-recorded audio
- Redis 7 for full queue/session behavior (a reduced in-memory fallback exists)
- an OpenRouter API key for agent replies

### Install

```powershell
git clone https://github.com/cosychiruka/run-courage-run.git
Set-Location run-courage-run

npm ci

python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r server\requirements.txt

Copy-Item .env.example .env
```

Edit `.env` and set at least `OPENROUTER_API_KEY`. Keep all X credentials server-side. For a
safe UI-only local run, keep `BACKGROUND_AUTOMATION_ENABLED=false` and
`X_AUTOMATION_ENABLED=false`. The first prevents scheduled discovery, sensors, queue processing,
and autonomous LLM calls; the second disables X client creation even when credentials are present.
Production also verifies the authenticated handle against
`X_EXPECTED_USERNAME=cowardlyhood` before enabling X. Set both switches to `true` only in the
deployment that should run the heartbeat and read or post through that account.

The server defaults to `nvidia/nemotron-3-super-120b-a12b:free`, which has been exercised with
Courage's real multi-tool schema. `qwen/qwen3-30b-a3b-instruct-2507` is the low-cost paid
fallback. Free OpenRouter capacity is provider-controlled, so fund the OpenRouter account before
treating the fallback as production reliability rather than configuration only.

For full local voice, place `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` in the backend working
directory (`server/` when using the command below). `faster-whisper` downloads `tiny.en` on its
first successful load. The backend remains healthy if voice models are absent, but voice calls
will report that the models are unavailable.

### Run

Start Redis if it is not already available:

```powershell
docker compose -f server\docker-compose.yml up -d redis
```

Backend terminal:

```powershell
.\.venv\Scripts\Activate.ps1
Set-Location server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend terminal, from the repository root:

```powershell
npm run dev -- --host 127.0.0.1
```

Open:

- landing/worlds: `http://127.0.0.1:5173`
- admin: `http://127.0.0.1:5173/admin`
- backend health: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`

The combined production container can be built with:

```powershell
docker compose -f server\docker-compose.yml up --build
```

The Docker image downloads the required Whisper/Kokoro assets during its build.

For Sliplane, deploy `server/Dockerfile` with repository-root build context and expose port 8000.
That combined image serves the frontend and API on the same origin and bakes in Whisper, a
quantized Kokoro model, and FFmpeg. The 1 GB deployment profile uses `VOICE_MEMORY_MODE=low`:
Whisper and Kokoro load one at a time behind a single inference lock, then release native memory.
`RAG_MODE=lexical` also keeps sentence-transformers and PyTorch out of the production image.
This favors survival over first-response speed. `/health` reports voice state and whether the
cache backend is Redis or memory; confirm one real microphone round after every deployment.

Redis is optional for a single Sliplane instance. Leave `REDIS_URL` blank to use the shared
in-process fallback plus SQLite. Only configure it when the referenced Redis service exists in
the same reachable network. A bad internal hostname adds connection failures without improving
durability. Persistent cross-redeploy history requires a valid Redis service or a mounted data
volume for the SQLite data directory.

## Configuration

Use [`.env.example`](.env.example) as the source of truth. Key groups are:

| Group | Variables |
| --- | --- |
| LLM | `LLM_PROVIDER`, `OPENROUTER_API_KEY`, `DEFAULT_MODEL`, `FALLBACK_MODEL`, `LLM_DAILY_TOKEN_BUDGET` |
| Runtime | `REDIS_URL`, `DB_PATH`, `PUBLIC_BASE_URL`, `FRONTEND_ORIGIN`, `BACKGROUND_AUTOMATION_ENABLED`, `AUTONOMOUS_INTERVAL_MINUTES` |
| 1 GB memory | `VOICE_MEMORY_MODE=low`, `WHISPER_BEAM_SIZE=1`, quantized `KOKORO_MODEL_PATH`, `RAG_MODE=lexical` |
| News | `COINDESK_API_KEY`; optional `FIRECRAWL_API_KEY` for full-article extraction |
| X | `X_AUTOMATION_ENABLED`, `X_EXPECTED_USERNAME`, `X_BEARER_TOKEN`, OAuth consumer/access credentials, `X_DAILY_SEARCH_SPEND_CAP` |
| Art | `FAL_API_KEY`, `COURAGE_BASE_IMAGE_URL` |
| Browser | `VITE_BACKEND_URL`, `VITE_BACKEND_WS` |

Never commit `.env`, model binaries, generated posters, screenshots, build output, or local
databases.

## Verification

Run the focused checks used for the current experience:

```powershell
npx eslint src/components/RobinhoodWidgets.jsx src/components/WorldLoreSection.jsx src/components/3d/Terrain3D.jsx src/components/3d/ForestPortal.jsx src/components/3d/TickerlingForest.jsx src/components/3d/worldGround.js src/components/3d/useDisposableThreeResource.js src/hooks/useTrendingTokens.js src/services/newsService.js src/services/tokenService.js src/utils/audioManager.js src/utils/sentimentUtils.js
python -m unittest server.tests.test_robinhood_service_unit server.tests.test_market_sensor server.tests.test_system_prompt server.tests.test_x_client server.tests.test_llm -v
python -m py_compile server/app/system_prompt.py server/app/autonomous_loop.py server/app/tools.py server/app/robinhood_service.py server/app/sensors/market_sensor.py server/app/sensors/game_sensor.py server/app/main.py
npm run build
```

The repository-wide ESLint command still includes legacy/duplicate source with a large existing
baseline. Touched-file lint plus the production build is the current bounded gate; do not hide
global cleanup inside feature work.

## Brand boundary

Run Courage Run is an independent, fan-made meme experience. It is not affiliated with or
endorsed by Robinhood, Warner Bros., Cartoon Network, DexScreener, or token issuers.
Market discovery is informational and is not financial advice.
