import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL       = os.getenv("GROQ_MODEL",      "llama-3.3-70b-versatile")  # smart: tool calls & complex reasoning
GROQ_MODEL_FAST  = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")    # fast: simple chat, first-round probe

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_PATH   = os.getenv("DB_PATH",   "./data/courage.db")

GNEWS_API_KEY     = os.getenv("GNEWS_API_KEY",    "")
GUARDIAN_API_KEY  = os.getenv("GUARDIAN_API_KEY", "test")
NEWSAPI_KEY       = os.getenv("NEWSAPI_KEY",       "")   # newsapi.org — server-side ONLY (CORS blocked in browser)
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

X_CONSUMER_KEY        = os.getenv("X_CONSUMER_KEY",        "")
X_CONSUMER_SECRET     = os.getenv("X_CONSUMER_SECRET",     "")
X_ACCESS_TOKEN        = os.getenv("X_ACCESS_TOKEN",        "")
X_ACCESS_TOKEN_SECRET = os.getenv("X_ACCESS_TOKEN_SECRET", "")
X_BEARER_TOKEN        = os.getenv("X_BEARER_TOKEN",        "")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

WHISPER_MODEL = "tiny.en"   # fast, lightweight, 39MB — good for 2GB RAM
KOKORO_VOICE  = "af_bella"  # more cartoonish voice

# ── Daily API budgets (leave 20% buffer below hard limits) ────────────────────
# GNews:   100 req/day free tier  → stop at 80
# NewsAPI: 100 req/day dev tier   → stop at 80
# Guardian: 5000/day              → effectively unlimited, no counter needed
GNEWS_DAILY_BUDGET   = int(os.getenv("GNEWS_DAILY_BUDGET",   "80"))
NEWSAPI_DAILY_BUDGET = int(os.getenv("NEWSAPI_DAILY_BUDGET", "80"))
