import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_HOST  = os.getenv("OLLAMA_HOST",  "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_PATH   = os.getenv("DB_PATH",   "./data/courage.db")

GNEWS_API_KEY    = os.getenv("GNEWS_API_KEY",    "")
GUARDIAN_API_KEY = os.getenv("GUARDIAN_API_KEY", "test")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

X_CONSUMER_KEY        = os.getenv("X_CONSUMER_KEY",        "")
X_CONSUMER_SECRET     = os.getenv("X_CONSUMER_SECRET",     "")
X_ACCESS_TOKEN        = os.getenv("X_ACCESS_TOKEN",        "")
X_ACCESS_TOKEN_SECRET = os.getenv("X_ACCESS_TOKEN_SECRET", "")
X_BEARER_TOKEN        = os.getenv("X_BEARER_TOKEN",        "")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

WHISPER_MODEL = "base.en"   # fast, accurate, 150MB
KOKORO_VOICE  = "am_michael"  # warm male voice; try 'af_heart' for female
