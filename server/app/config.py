import os
import urllib.parse as _up
from dotenv import load_dotenv

load_dotenv()

# LLM configuration. OpenRouter is the production default; Groq remains available
# only when LLM_PROVIDER=groq is set explicitly.
LLM_PROVIDER       = os.getenv("LLM_PROVIDER", "openrouter").lower()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
DEFAULT_MODEL      = os.getenv("DEFAULT_MODEL", "qwen/qwen3-coder:free")
FALLBACK_MODEL     = os.getenv("FALLBACK_MODEL", "meta-llama/llama-3.3-70b-instruct")
OPENROUTER_REFERER = os.getenv("OPENROUTER_REFERER", "https://github.com/cosychiruka/run-courage-run")
OPENROUTER_TITLE   = os.getenv("OPENROUTER_TITLE", "Run Courage Run")

GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL       = os.getenv("GROQ_MODEL",      "llama-3.3-70b-versatile")      # legacy smart model
GROQ_MODEL_FAST  = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")        # legacy fast model

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_PATH   = os.getenv("DB_PATH",   os.path.join(BASE_DIR, "data", "courage.db"))

GNEWS_API_KEY     = os.getenv("GNEWS_API_KEY",    "")
GUARDIAN_API_KEY  = os.getenv("GUARDIAN_API_KEY", "test")
NEWSAPI_KEY       = os.getenv("NEWSAPI_KEY") or os.getenv("NEWS_API_KEY", "")  # .env uses NEWS_API_KEY
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

X_CONSUMER_KEY        = os.getenv("X_CONSUMER_KEY")        or os.getenv("VITE_X_CONSUMER_KEY",        "")
X_CONSUMER_SECRET     = os.getenv("X_CONSUMER_SECRET")     or os.getenv("VITE_X_CONSUMER_SECRET",     "")
X_ACCESS_TOKEN        = os.getenv("X_ACCESS_TOKEN")        or os.getenv("VITE_X_ACCESS_TOKEN",        "")
X_ACCESS_TOKEN_SECRET = os.getenv("X_ACCESS_TOKEN_SECRET") or os.getenv("VITE_X_ACCESS_TOKEN_SECRET", "")
X_CLIENT_ID           = os.getenv("X_CLIENT_ID")           or os.getenv("VITE_X_CLIENT_ID",           "")
X_CLIENT_SECRET       = os.getenv("X_CLIENT_SECRET")       or os.getenv("VITE_X_CLIENT_SECRET",       "")

# Bearer token may be URL-encoded from the X portal — decode it
_bt_raw = os.getenv("X_BEARER_TOKEN") or os.getenv("VITE_X_BEARER_TOKEN", "")
X_BEARER_TOKEN = _up.unquote(_bt_raw) if _bt_raw else ""

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

WHISPER_MODEL = "tiny.en"   # fast, lightweight, 39MB — good for 2GB RAM
KOKORO_VOICE  = "af_bella"  # more cartoonish voice

# ── Daily API budgets (leave 20% buffer below hard limits) ────────────────────
# GNews:   100 req/day free tier  → stop at 80
# NewsAPI: 100 req/day dev tier   → stop at 80
# Guardian: 5000/day              → effectively unlimited, no counter needed
GNEWS_DAILY_BUDGET        = int(os.getenv("GNEWS_DAILY_BUDGET",        "80"))
NEWSAPI_DAILY_BUDGET      = int(os.getenv("NEWSAPI_DAILY_BUDGET",      "80"))
LLM_DAILY_TOKEN_BUDGET    = int(os.getenv("LLM_DAILY_TOKEN_BUDGET", os.getenv("GROQ_DAILY_TOKEN_BUDGET", "500000")))
GROQ_DAILY_TOKEN_BUDGET   = LLM_DAILY_TOKEN_BUDGET

CRYPTOPANIC_API_KEY         = os.getenv("CRYPTOPANIC_API_KEY", "") # Deprecated
COINDESK_API_KEY            = os.getenv("COINDESK_API_KEY",    "")
COINGECKO_API_KEY           = os.getenv("COINGECKO_API_KEY", "")
COINGECKO_DAILY_BUDGET      = int(os.getenv("COINGECKO_DAILY_BUDGET", "100"))
AUTONOMOUS_INTERVAL_MINUTES = int(os.getenv("AUTONOMOUS_INTERVAL_MINUTES", "60"))
X_DAILY_SEARCH_SPEND_CAP    = float(os.getenv("X_DAILY_SEARCH_SPEND_CAP", "5.0"))

RCR_TOKEN_ADDRESS    = os.getenv("RCR_TOKEN_ADDRESS", "")
FAL_API_KEY          = os.getenv("FAL_API_KEY", "")
COURAGE_BASE_IMAGE_URL = os.getenv("COURAGE_BASE_IMAGE_URL", "")
