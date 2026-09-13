import os
import urllib.parse as _up
from dotenv import load_dotenv

load_dotenv()

# Public deployment identity. Keep outbound links and provider attribution on
# the canonical domain while allowing local/dev overrides.
PUBLIC_BASE_URL     = os.getenv("PUBLIC_BASE_URL", "https://hoodcourage.xyz").rstrip("/")

# LLM configuration. OpenRouter is the production provider.
LLM_PROVIDER       = os.getenv("LLM_PROVIDER", "openrouter").lower()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
DEFAULT_MODEL      = os.getenv("DEFAULT_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
FALLBACK_MODEL     = os.getenv("FALLBACK_MODEL", "qwen/qwen3-30b-a3b-instruct-2507")
OPENROUTER_REFERER = os.getenv("OPENROUTER_REFERER", PUBLIC_BASE_URL)
OPENROUTER_TITLE   = os.getenv("OPENROUTER_TITLE", "Run Courage Run")

# GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")  # Legacy - now using OpenRouter
# GROQ_MODEL       = os.getenv("GROQ_MODEL",      "llama-3.3-70b-versatile")      # legacy smart model
# GROQ_MODEL_FAST  = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")        # legacy fast model

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Redis is optional. An empty value selects the process-local fallback without
# attempting DNS/network connections (the production default for one instance).
REDIS_URL = os.getenv("REDIS_URL", "").strip()
DB_PATH   = os.getenv("DB_PATH", "").strip() or os.path.join(BASE_DIR, "data", "courage.db")

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

BACKGROUND_AUTOMATION_ENABLED = os.getenv("BACKGROUND_AUTOMATION_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
X_AUTOMATION_ENABLED  = os.getenv("X_AUTOMATION_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
X_EXPECTED_USERNAME   = os.getenv("X_EXPECTED_USERNAME", "cowardlyhood").strip().lstrip("@").lower()
X_CONSUMER_KEY        = os.getenv("X_CONSUMER_KEY", "")
X_CONSUMER_SECRET     = os.getenv("X_CONSUMER_SECRET", "")
X_ACCESS_TOKEN        = os.getenv("X_ACCESS_TOKEN", "")
X_ACCESS_TOKEN_SECRET = os.getenv("X_ACCESS_TOKEN_SECRET", "")
X_CLIENT_ID           = os.getenv("X_CLIENT_ID", "")
X_CLIENT_SECRET       = os.getenv("X_CLIENT_SECRET", "")

# Bearer token may be URL-encoded from the X portal — decode it
_bt_raw = os.getenv("X_BEARER_TOKEN", "")
X_BEARER_TOKEN = _up.unquote(_bt_raw) if _bt_raw else ""

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", PUBLIC_BASE_URL).rstrip("/")

VOICE_MEMORY_MODE = os.getenv("VOICE_MEMORY_MODE", "low").strip().lower()
if VOICE_MEMORY_MODE not in {"low", "resident"}:
    VOICE_MEMORY_MODE = "low"
# A 1 GB/1 vCPU deployment cannot reliably keep local STT and TTS inference in
# the same process. In low-memory mode the browser therefore speaks the reply by
# default, while Kokoro remains available as an explicit opt-in for larger hosts.
VOICE_TTS_MODE = os.getenv(
    "VOICE_TTS_MODE",
    "browser" if VOICE_MEMORY_MODE == "low" else "kokoro",
).strip().lower()
if VOICE_TTS_MODE not in {"browser", "kokoro"}:
    VOICE_TTS_MODE = "browser" if VOICE_MEMORY_MODE == "low" else "kokoro"
VOICE_STT_TIMEOUT_SECONDS   = max(10, int(os.getenv("VOICE_STT_TIMEOUT_SECONDS", "45")))
VOICE_AGENT_TIMEOUT_SECONDS = max(10, int(os.getenv("VOICE_AGENT_TIMEOUT_SECONDS", "40")))
VOICE_TTS_TIMEOUT_SECONDS   = max(10, int(os.getenv("VOICE_TTS_TIMEOUT_SECONDS", "45")))
VOICE_MAX_TOOL_ROUNDS       = max(1, min(8, int(os.getenv("VOICE_MAX_TOOL_ROUNDS", "4"))))
WHISPER_MODEL       = os.getenv("WHISPER_MODEL", "tiny.en")
WHISPER_BEAM_SIZE   = max(1, int(os.getenv("WHISPER_BEAM_SIZE", "1")))
KOKORO_MODEL_PATH   = os.getenv("KOKORO_MODEL_PATH", "kokoro-v1.0.int8.onnx")
KOKORO_VOICES_PATH  = os.getenv("KOKORO_VOICES_PATH", "voices-v1.0.bin")
KOKORO_VOICE        = os.getenv("KOKORO_VOICE", "af_bella")
RAG_MODE            = os.getenv("RAG_MODE", "lexical").strip().lower()

# ── Daily API budgets ─────────────────────────────────────────────────────────
LLM_DAILY_TOKEN_BUDGET    = int(os.getenv("LLM_DAILY_TOKEN_BUDGET", "500000"))
# GROQ_DAILY_TOKEN_BUDGET   = LLM_DAILY_TOKEN_BUDGET  # Legacy - now using OpenRouter

COINDESK_API_KEY            = os.getenv("COINDESK_API_KEY",    "")
AUTONOMOUS_INTERVAL_MINUTES = int(os.getenv("AUTONOMOUS_INTERVAL_MINUTES", "60"))
X_DAILY_SEARCH_SPEND_CAP    = float(os.getenv("X_DAILY_SEARCH_SPEND_CAP", "5.0"))

RCR_TOKEN_ADDRESS    = os.getenv("RCR_TOKEN_ADDRESS", "")
FAL_API_KEY          = os.getenv("FAL_API_KEY", "")
COURAGE_BASE_IMAGE_URL = os.getenv("COURAGE_BASE_IMAGE_URL", "")
